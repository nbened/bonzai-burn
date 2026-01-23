#!/usr/bin/env node

const express = require('./node_modules/express');
const cors = require('./node_modules/cors');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Bonzai Server', status: 'running' });
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
const scanCodeQualityHandler = tryLoad('scan_code_quality');

if (listHandler) app.get('/list', listHandler);
if (readHandler) app.get('/read', readHandler);
if (scanCodeQualityHandler) app.post('/scan_code_quality', scanCodeQualityHandler);

// Backend loop handlers
const deleteHandler = tryLoad('delete');
const openCursorHandler = tryLoad('open-cursor');
const writeHandler = tryLoad('write');
const shutdownHandler = tryLoad('shutdown');
const gitHandlers = tryLoad('git');
const terminalHandlers = tryLoad('terminal');

if (deleteHandler) app.post('/delete', deleteHandler);
if (openCursorHandler) app.post('/open-cursor', openCursorHandler);
if (writeHandler) app.post('/write', writeHandler);
if (shutdownHandler) app.post('/shutdown', shutdownHandler);
if (gitHandlers) {
  app.get('/git/burns', gitHandlers.listBurns);
  app.post('/git/checkout', gitHandlers.checkoutBranch);
}
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
