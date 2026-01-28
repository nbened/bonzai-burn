#!/usr/bin/env node

const express = require('./node_modules/express');
const cors = require('./node_modules/cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./config');

const port = 3001;
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Serve static build files
const buildDir = path.join(__dirname, 'build');
app.use('/static', express.static(path.join(buildDir, 'static')));

// Embed shell - serves HTML that loads bundled app
app.get('/', (req, res) => {
  const repoName = path.basename(ROOT);

  // Read asset manifest to get hashed filenames
  const manifestPath = path.join(buildDir, 'asset-manifest.json');
  let cssFile = '';
  let jsFile = '';

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    cssFile = manifest.files['main.css'] || '';
    jsFile = manifest.files['main.js'] || '';
  } catch (e) {
    console.error('Could not read asset-manifest.json:', e.message);
  }

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bonzai - ${repoName}</title>
  ${cssFile ? `<link rel="stylesheet" href="${cssFile}">` : ''}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.BONZAI_REPO = "${repoName}";
    window.BONZAI_API = "http://localhost:${port}";
  </script>
  ${jsFile ? `<script src="${jsFile}"></script>` : '<p>Build not found. Run npm run build in the frontend.</p>'}
</body>
</html>`);
});

// Health check
app.get('/health', (req, res) => {
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

server.listen(port, () => {
  console.log('File server running on http://localhost:' + port);
});
