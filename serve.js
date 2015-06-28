'use strict';

var express         = require('express');
var app             = require('./package.json');
var bodyParser      = require('body-parser');
var rateLimit       = require('express-rate-limit');
var responseTime    = require('response-time');
var uuid            = require('node-uuid');
var cache           = require('memory-cache');
var CircuitBreaker  = require('circuit-breaker-js');
var _               = require('lodash');
var serviceSDK      = require('lc-sdk-node.js');

var DISCOVERY_SERVICE_URLS = (process.env.DISCOVERY_SERVICE_URLS || '').split(/\s*;\s*|\s*,\s*/);
var RETRY_TIMEOUT =  parseInt(process.env.RETRY_TIMEOUT) || 2000;
var CART_TIMEOUT = parseInt(process.env.CART_TIMEOUT) || 60000;
var MAX_REQUEST_PER_MINUTE = parseInt(process.env.MAX_REQUEST_PER_MINUTE) || 5;
var REQUEST_THROTTLE_MS = parseInt(process.env.REQUEST_THROTTLE_MS) || 10;
var SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS) || 10000;

var serviceClient = serviceSDK({ discoveryServers: DISCOVERY_SERVICE_URLS });

var app = express();
app.use(responseTime(function(req, res, time){
  console.log('LOG: ' + req.method + ',' + req.url + ',' + res.statusCode + ',' + time);
}));
app.enable('trust proxy');
app.use(rateLimit({
        windowMs: 60000,
        delayMs: REQUEST_THROTTLE_MS,
        max: MAX_REQUEST_PER_MINUTE,
        global: true
}));
app.use(bodyParser.json());
app.use(function(req, res, next){
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE, PUT');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

var catalogItems = [];
var contractItems = [];

var catalogServiceBreaker = new CircuitBreaker({
  timeoutDuration: 1000,
  volumeThreshold: 1,
  errorThreshold: 50
});

retryReplicate();

app.get('/cart/:key', function(req, res){
  if(!req.params.key) return res.status(400).send({message: 'cart id is missing'});

  var cart = cache.get(req.params.key);
  if(!cart) return res.status(400).send({message: 'cart not found'});

  res.send(cart);  
});
app.post('/cart/:key/close', function(req,res){
  var cartId = req.params.key;

  if(!cartId) return res.status(400).send({message: 'cart id is missing'});

  cache.del(cartId);
  res.status(202).send({id: cartId, message: 'accepted'});
});
app.post('/cart/:key?', function(req, res){
  var payload = {
    cartId: req.params.key || uuid.v4(),
    orders: req.body || [],
    timestamp: Date.now(),
    datetime: new Date()
  };
  
  payload.orders = payload.orders.map(function(itm){
    
    var catalogItem = _.find(catalogItems, {id: itm.id});
    _.assign(itm, catalogItem);

    itm.price = parseFloat(itm.price);    

    return itm;
  });

  payload.cart = payload.orders.reduce(function(cart, itm){
    
    if(!cart.orders) cart.orders = {};
    if(!cart.orders[itm.id]) cart.orders[itm.id] = {
      id: '',
      mbid: '',
      artist: '',
      title: '',
      amount: 0,
      price: 0,
      total: 0     
    };

    cart.orders[itm.id].id = itm.id;
    cart.orders[itm.id].mbid = itm.mbid;
    cart.orders[itm.id].artist = itm.artist;
    cart.orders[itm.id].title = itm.title;

    cart.orders[itm.id].amount = itm.removed ?  cart.orders[itm.id].amount - 1 :  cart.orders[itm.id].amount + 1;
    if(cart.orders[itm.id].amount < 0) cart.orders[itm.id].amount = 0;

    cart.orders[itm.id].price = itm.price;
    cart.orders[itm.id].total = cart.orders[itm.id].price * cart.orders[itm.id].amount;

    return cart;
  }, {
    orders: {},
    total: 0
  });

  for(var idx in payload.cart.orders){
    payload.cart.total += payload.cart.orders[idx].total || 0;
  }

  cache.put(payload.cartId, payload, CART_TIMEOUT);
  res.status(201).send({cart: payload});
});

app.get('/healthcheck', function(req, res){
  res.send({ message: 'OK', version: app.version});
});
app.get('/replicate', function(req, res){
  var command = function(success, failed) {
    replicate(function(result){
       res.send({message: result.body.rows.length + ' items replicated'});
       success();
    }, failed);
  };

  catalogServiceBreaker.run(command, function() {    
    res.status(500).send({ message: 'Replication error' });
  });
});
app.get('/error', function(req, res){
  console.log(new Error('Error - shut down'));
  process.exit(-1);
});

var server = app.listen(process.env.SERVICE_PORT, function(){
  console.log('Listen on ' + process.env.SERVICE_PORT);
});

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  console.log('Received kill signal, shutting down gracefully in ' + SHUTDOWN_TIMEOUT_MS + 'ms');
  server.close(function() {
    console.log('Closed out remaining connections');
    console.error('Shutting down after ' + SHUTDOWN_TIMEOUT_MS + 'ms');
    setTimeout(process.exit, SHUTDOWN_TIMEOUT_MS);
  });

  setTimeout(function() {
   console.error('Force shutting down after ' + (SHUTDOWN_TIMEOUT_MS * 3) + 'ms');
   process.exit();
  }, (SHUTDOWN_TIMEOUT_MS * 3));  
}

function replicate(success, failed) {
  serviceClient.get('couchdb', '/products/_all_docs?include_docs=true')
    .then(function (result) {
      catalogItems = result.body.rows.map(function (itm) {
        itm.doc.id = itm.doc._id;
        delete itm.doc._id;
        delete itm.doc._rev;
        return itm.doc;
      }) || [];
      console.log(result.body.rows.length + ' items replicated');
      console.log(catalogItems);
      return result;
    })
    .then(success, function (error) {
      console.log('Replication error: ' + error);
      if (typeof failed === 'function') failed(error);
    });
}

function retryReplicate() {
  replicate(null, function () {
    setTimeout(retryReplicate, RETRY_TIMEOUT);  
  });
}
