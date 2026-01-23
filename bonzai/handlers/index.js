// Root route - simple API documentation
function indexHandler(req, res) {
  res.json({
    message: 'Local File Server API',
    endpoints: {
      'GET /list': 'List all files in the directory',
      'GET /read?path=<filepath>': 'Read file content',
      'POST /delete': 'Delete file or directory (body: {path})',
      'POST /open-cursor': 'Open Cursor (body: {path, line?})',
      'POST /shutdown': 'Gracefully shutdown the server',
      'POST /scan_code_quality': 'Scan code quality (body: {projectPath})',
      'POST /write': 'Write file content (body: {path, content})',
      'GET /git/burns': 'List all bonzai-burn branches',
      'POST /git/checkout': 'Checkout a branch (body: {branchName})',
      'WS /terminal': 'Interactive terminal via WebSocket'
    },
    example: 'Try: /list or /read?path=README.md'
  });
}

module.exports = indexHandler;

