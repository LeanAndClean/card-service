FROM node:0.10-onbuild

ADD . /

WORKDIR /

RUN npm install

ENV SERVICE_PORT=5008
ENV CART_TIMEOUT=60000
ENV RETRY_TIMEOUT=5000
ENV DISCOVERY_SERVICE_URLS=http://46.101.138.192:8500;http://46.101.191.124:8500

ENTRYPOINT npm start
