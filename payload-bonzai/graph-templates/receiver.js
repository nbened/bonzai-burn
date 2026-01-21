#!/usr/bin/env node

const express = require('./node_modules/express');
const cors = require('./node_modules/cors');

// Import handlers
const indexHandler = require('./handlers/index');
const listHandler = require('./handlers/list');
const readHandler = require('./handlers/read');
const deleteHandler = require('./handlers/delete');
const openCursorHandler = require('./handlers/open-cursor');
const shutdownHandler = require('./handlers/shutdown');
const scanCodeQualityHandler = require('./handlers/scan_code_quality');

const app = express();

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

const port = 3001;
app.listen(port, () => {
  console.log('📂 File server running on http://localhost:' + port);
});
