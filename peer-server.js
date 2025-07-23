const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});

app.use('/', peerServer);

server.listen(9000, () => {
  console.log('🎥 PeerJS server running at http://localhost:9000');
});
