#Cart Service

##Configuration parameters

```
export SERVICE_PORT=5008
export CART_TIMEOUT=60000
export RETRY_TIMEOUT=5000
export DISCOVERY_SERVICE_URLS=http://46.101.138.192:8500,http://46.101.191.124:8500
export MAX_REQUEST_PER_MINUTE=5
export REQUEST_THROTTLE_MS=10
export SHUTDOWN_TIMEOUT_MS=10000
```

##Build

`docker build -t cart-service .`

##Run locally

`docker run -t -i -p 5008:5008 cart-service`

##Release into private registry

```
docker tag cart-service 46.101.191.124:5000/cart-service:0.0.14
docker push 46.101.191.124:5000/cart-service:0.0.14
```

##Deploy via Shipyard

```
curl -X POST \
-H 'Content-Type: application/json' \
-H 'X-Service-Key: pdE4.JVg43HyxCEMWvsFvu6bdFV7LwA7YPii' \
http://46.101.191.124:8080/api/containers?pull=true \
-d '{  
  "name":"46.101.191.124:5000/cart-service:0.0.14",
  "cpus":0.1,
  "memory":32,
  "environment":{
    "SERVICE_CHECK_SCRIPT":"curl -s http://46.101.191.124:5020/healthcheck",
    "DISCOVERY_SERVICE_URLS":"http://46.101.138.192:8500,http://46.101.191.124:8500",
    "SERVICE_PORT":"5020",
    "CART_TIMEOUT":"3600000",
    "RETRY_TIMEOUT":"5000",
    "MAX_REQUEST_PER_MINUTE":"75",
    "REQUEST_THROTTLE_MS":"10",
    "SHUTDOWN_TIMEOUT_MS":"10000",
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
       "port":5020,
       "container_port":5020
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
http://localhost:5008/cart/mycart1
```

####Add cart items

```
curl -X POST \
-H 'Content-Type: application/json' \
http://localhost:5008/cart/mycart1 \
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
http://localhost:5008/cart/mycart1/close \
-d '{}'
```

###Replication

```
curl -X GET \
-H 'Content-Type: application/json' \
http://localhost:5008/replicate
```

###HealthCheck

```
curl -X GET \
-H 'Content-Type: application/json' \
http://localhost:5008/healthcheck
```
