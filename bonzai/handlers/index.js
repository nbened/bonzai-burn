const path = require('path');
const { ROOT } = require('../config');

// Root route - simple API documentation
function indexHandler(req, res) {
  const repoName = path.basename(ROOT);
  res.json({
    message: 'Bonzai Server',
    status: 'running',
    repoName,
    endpoints: {
      'GET /list': 'List all files in the directory',
      'GET /read?path=<filepath>': 'Read file content',
      'POST /delete': 'Delete file or directory (body: {path})',
      'POST /open-cursor': 'Open Cursor (body: {path, line?})',
      'POST /shutdown': 'Gracefully shutdown the server',
      'POST /write': 'Write file content (body: {path, content})',
      'GET /git/burns': 'List all bonzai-burn branches',
      'POST /git/checkout': 'Checkout a branch (body: {branchName})',
      'WS /terminal': 'Interactive terminal via WebSocket'
    },
    example: 'Try: /list or /read?path=README.md'
  });
}

module.exports = indexHandler;

