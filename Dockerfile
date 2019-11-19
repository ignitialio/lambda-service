FROM node:12-alpine

RUN mkdir -p /opt && mkdir -p /opt/lambda

ADD . /opt/lambda

WORKDIR /opt/lambda

RUN npm install && npm run client:build

CMD ["node", "./server/index.js"]
