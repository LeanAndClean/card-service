'use strict';

var express         = require('express');
var bodyParser      = require('body-parser');
var uuid            = require('node-uuid');
var cache           = require('memory-cache');
var CircuitBreaker  = require('circuit-breaker-js');
var q               = require('q');
var request         = require('superagent');
var _               = require('lodash');

require('q-superagent')(request);

var server = express();
server.use(bodyParser.json());
server.use(function(req, res, next){
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE, PUT');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

var CATALOG_SERVICE_FULL_URL = process.env.CATALOG_SERVICE_URL;
var RETRY_TIMEOUT =  parseInt(process.env.RETRY_TIMEOUT) || 2000;
var CART_TIMEOUT = parseInt(process.env.CART_TIMEOUT) || 60000;

var catalogItems = [];
var catalogServiceBreaker = new CircuitBreaker({
  timeoutDuration: 1000,
  volumeThreshold: 1,
  errorThreshold: 50
});

retryReplicate(CATALOG_SERVICE_FULL_URL);

server.get('/healthcheck', function(req, res){
  res.send({ message: 'OK'});
});

server.get('/cart/:key?', function(req, res){

  var cart = cache.get(req.params.key);

  if(!cart) cart = {};
  if(!cart.orders) cart.orders = [];
  
  cart.total = 0;
  cart.datetime = new Date();
  


  cart.orders = cart.orders.map(function(itm){
    
    var catalogItem = _.find(catalogItems, {id: parseInt(itm.id)});
    _.assign(itm, catalogItem);

    itm.price = parseFloat(itm.price);
    itm.tax = parseInt(itm.tax);

    return itm;
  });

  cart.cart = cart.orders.reduce(function(cart, itm){
    
    if(!cart.orders) cart.orders = {};
    if(!cart.orders[itm.id]) cart.orders[itm.id] = {
      id: Infinity,
      name: '',
      amount: 0,
      price: 0,
      tax: 0
    };

    cart.orders[itm.id].id = itm.id;
    cart.orders[itm.id].name = itm.name;
    cart.orders[itm.id].tax = itm.tax;

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
   replicate(CATALOG_SERVICE_FULL_URL, function(result){
    res.send({message: result.body.length + ' items replicated'});
    success();
   }, failed)
  };

  catalogServiceBreaker.run(command, function() {    
    res.send({ message: 'Replication error' });
  });
});

server.listen(process.env.SERVICE_PORT, function(){
  console.log('Listen on ' + process.env.SERVICE_PORT);
});

function replicate(path, success, failed){
  request
    .get(path)
    .set('Connection','keep-alive')
    .accept('json')
    .timeout(2000)
    .q()
    .then(function(result){
      catalogItems = result.body || [];
      console.log(result.body.length + ' items replicated');
      console.log(result.body);
      return result;
    })
    .then(success)
    .fail(function(error){
      console.log(path + ' - Replication error');
      failed();
    });
}

function retryReplicate(CATALOG_SERVICE_FULL_URL){
  replicate(CATALOG_SERVICE_FULL_URL, null, function(){
    setTimeout(function(){
      retryReplicate(CATALOG_SERVICE_FULL_URL);
    }, RETRY_TIMEOUT);  
  });  
}