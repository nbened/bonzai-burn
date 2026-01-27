#!/usr/bin/env node

const express = require('./node_modules/express');
const cors = require('./node_modules/cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./config');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  const repoName = path.basename(ROOT);
  res.json({ message: 'Bonzai Server', status: 'running', repoName });
});

// Dynamically load handlers based on what exists
const handlersDir = path.join(__dirname, 'handlers');

function tryLoad(name) {
  const filePath = path.join(handlersDir, name + '.js');
  if (fs.existsSync(filePath)) {
    return require(filePath);
  }
  return null;
}

// Visualization loop handlers
const listHandler = tryLoad('list');
const readHandler = tryLoad('read');

if (listHandler) app.get('/list', listHandler);
if (readHandler) app.get('/read', readHandler);

// Backend loop handlers
const deleteHandler = tryLoad('delete');
const writeHandler = tryLoad('write');
const shutdownHandler = tryLoad('shutdown');
const terminalHandlers = tryLoad('terminal');

if (deleteHandler) app.post('/delete', deleteHandler);
if (writeHandler) app.post('/write', writeHandler);
if (shutdownHandler) app.post('/shutdown', shutdownHandler);
if (terminalHandlers) {
  const { WebSocketServer } = require('./node_modules/ws');
  const wss = new WebSocketServer({ server, path: '/terminal' });
  terminalHandlers.setupTerminalWebSocket(wss);
  app.get('/terminal', terminalHandlers.terminalHandler);
}

const port = 3001;
server.listen(port, () => {
  console.log('File server running on http://localhost:' + port);
});
