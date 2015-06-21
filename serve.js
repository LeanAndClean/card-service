'use strict';

var express         = require('express');
var app             = require('./package.json');
var bodyParser      = require('body-parser');
var uuid            = require('node-uuid');
var cache           = require('memory-cache');
var CircuitBreaker  = require('circuit-breaker-js');
var _               = require('lodash');
var serviceSDK      = require('./lc-sdk-node');

var DISCOVERY_SERVICE_URLS = (process.env.DISCOVERY_SERVICE_URLS || '').split(/\s*;\s*|\s*,\s*/);
var RETRY_TIMEOUT =  parseInt(process.env.RETRY_TIMEOUT) || 2000;
var CART_TIMEOUT = parseInt(process.env.CART_TIMEOUT) || 60000;

var serviceClient = serviceSDK({ discoveryServers: DISCOVERY_SERVICE_URLS });

var server = express();
server.use(bodyParser.json());
server.use(function(req, res, next){
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE, PUT');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

var catalogItems = [];
var catalogServiceBreaker = new CircuitBreaker({
  timeoutDuration: 1000,
  volumeThreshold: 1,
  errorThreshold: 50
});

retryReplicate();

server.get('/healthcheck', function(req, res){
  res.send({ message: 'OK', version: app.version});
});

server.get('/cart/:key?', function(req, res){

  var cart = cache.get(req.params.key);

  if(!cart) cart = {};
  if(!cart.orders) cart.orders = [];
  
  cart.total = 0;
  cart.datetime = new Date();
  
  cart.orders = cart.orders.map(function(itm){
    
    var catalogItem = _.find(catalogItems, {id: itm.id});
    _.assign(itm, catalogItem);

    itm.price = parseFloat(itm.price);    

    return itm;
  });

  cart.cart = cart.orders.reduce(function(cart, itm){
    
    if(!cart.orders) cart.orders = {};
    if(!cart.orders[itm.id]) cart.orders[itm.id] = {
      id: Infinity,
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

  for(var idx in cart.cart.orders){
    cart.cart.total += cart.cart.orders[idx].total || 0;
  }

  res.send(cart);  
});

server.post('/cart/:key?', function(req, res){
  var cartId = req.params.key || uuid.v4();
  var orders  = req.body || [];

  var payload = {
    orders: orders,
    timestamp: Date.now(),
    datetime: new Date()
  };

  cache.put(cartId, payload, CART_TIMEOUT || 3600000);
  res.send({id: cartId, message: 'accepted'});
});

server.get('/replicate', function(req, res){
  var command = function(success, failed) {
    replicate(function(result){
       res.send({message: result.body.rows.length + ' items replicated'});
       success();
    }, failed);
  };

  catalogServiceBreaker.run(command, function() {    
    res.send({ message: 'Replication error' });
  });
});

server.get('/error', function(req, res){
  console.log(new Error('Error - shut down'));
  process.exit(-1);
});

server.listen(process.env.SERVICE_PORT, function(){
  console.log('Listen on ' + process.env.SERVICE_PORT);
});

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
