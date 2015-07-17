#Cart Service

##Service configuration

```
export SERVICE_PORT=5020
export CART_TIMEOUT=60000
export RETRY_TIMEOUT=5000
export DISCOVERY_SERVICE_URLS=http://46.101.138.192:8500,http://46.101.191.124:8500
export MAX_REQUEST_PER_MINUTE=65
export REQUEST_THROTTLE_MS=1
export SHUTDOWN_TIMEOUT_MS=10000
export PUBLISH_SERVICE=<ip>:<port>
export SERVICE_VERSION=0.0.14
```

##Build

`docker build -t cart-service .`

##Run locally

`docker run -t -i -p $SERVICE_PORT:$SERVICE_PORT cart-service`

##Release into private registry

```
docker tag cart-service $PUBLISH_SERVICE/cart-service:$SERVICE_VERSION
docker push $PUBLISH_SERVICE/cart-service:$SERVICE_VERSION
```

##API

###Cart

####Get cart

```
curl -X GET \
-H 'Content-Type: application/json' \
http://localhost:$SERVICE_PORT/cart/mycart1
```

####Add cart items

```
curl -X POST \
-H 'Content-Type: application/json' \
http://localhost:$SERVICE_PORT/cart/mycart1 \
-d '
  [{
    "id": "725dfb991d1f699103311e2b0e07280c"
  },
  {
    "id": "725dfb991d1f699103311e2b0e073703"
  }]
'
```

####Set cart done

```
curl -X POST \
-H 'Content-Type: application/json' \
http://localhost:$SERVICE_PORT/cart/mycart1/close
```

###Replication

```
curl -X GET \
-H 'Content-Type: application/json' \
http://localhost:$SERVICE_PORT/replicate
```

###HealthCheck

```
curl -X GET \
-H 'Content-Type: application/json' \
http://localhost:$SERVICE_PORT/healthcheck
```
