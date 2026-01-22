#!/usr/bin/env node

const express = require('./node_modules/express');
const cors = require('./node_modules/cors');
const http = require('http');
const { WebSocketServer } = require('./node_modules/ws');

// Import handlers
const indexHandler = require('./handlers/index');
const listHandler = require('./handlers/list');
const readHandler = require('./handlers/read');
const deleteHandler = require('./handlers/delete');
const openCursorHandler = require('./handlers/open-cursor');
const shutdownHandler = require('./handlers/shutdown');
const scanCodeQualityHandler = require('./handlers/scan_code_quality');
const writeHandler = require('./handlers/write');
const { listBurns, checkoutBranch } = require('./handlers/git');
const { terminalHandler, setupTerminalWebSocket } = require('./handlers/terminal');

const app = express();
const server = http.createServer(app);

// WebSocket server for terminal
const wss = new WebSocketServer({ server, path: '/terminal' });
setupTerminalWebSocket(wss);

app.use(cors());
app.use(express.json());

// Register routes
app.get('/', indexHandler);
app.get('/list', listHandler);
app.get('/read', readHandler);
app.post('/delete', deleteHandler);
app.post('/open-cursor', openCursorHandler);
app.post('/shutdown', shutdownHandler);
app.post('/scan_code_quality', scanCodeQualityHandler);
app.post('/write', writeHandler);
app.get('/git/burns', listBurns);
app.post('/git/checkout', checkoutBranch);
app.get('/terminal', terminalHandler);

const port = 3001;
server.listen(port, () => {
  console.log('📂 File server running on http://localhost:' + port);
  console.log('🖥️  Terminal WebSocket available at ws://localhost:' + port + '/terminal');
});
