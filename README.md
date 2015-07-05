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
```

##Deploy configuration

```
export SERVICE_VERSION=0.0.14
export PUBLISH_SERVICE=<ip>:<port>
export DEPLOY_SERVICE=<ip>:<port>
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

##Deploy via Shipyard

```
curl -X POST \
-H 'Content-Type: application/json' \
-H 'X-Service-Key: pdE4.JVg43HyxCEMWvsFvu6bdFV7LwA7YPii' \
http://$DEPLOY_SERVICE/api/containers?pull=true \
-d '{  
  "name":"'$PUBLISH_SERVICE'/cart-service:'$SERVICE_VERSION'",
  "cpus":0.1,
  "memory":32,
  "environment":{
    "SERVICE_CHECK_SCRIPT":"curl -s http://$SERVICE_CONTAINER_IP:$SERVICE_CONTAINER_PORT/healthcheck",
    "DISCOVERY_SERVICE_URLS":"'$DISCOVERY_SERVICE_URLS'",
    "SERVICE_PORT":"'$SERVICE_PORT'",
    "CART_TIMEOUT":"'$CART_TIMEOUT'",
    "RETRY_TIMEOUT":"'$RETRY_TIMEOUT'",
    "MAX_REQUEST_PER_MINUTE":"'$MAX_REQUEST_PER_MINUTE'",
    "REQUEST_THROTTLE_MS":"'$REQUEST_THROTTLE_MS'",
    "SHUTDOWN_TIMEOUT_MS":"'$SHUTDOWN_TIMEOUT_MS'",
    "LOG":"true"
  },
  "hostname":"",
  "domain":"",
  "type":"service",
  "network_mode":"bridge",
  "links":{},
  "volumes":[],
  "bind_ports":[  
    {  
       "proto":"tcp",
       "host_ip":null,
       "port":'$SERVICE_PORT',
       "container_port":'$SERVICE_PORT'
    }
  ],
  "labels":[],
  "publish":false,
  "privileged":false,
  "restart_policy":{  
    "name":"no"
  }
}'
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
