const path = require('path');

// Root directory - use BONZAI_REPO_DIR env var (set by bconfig.js when server starts)
const ROOT = process.env.BONZAI_REPO_DIR || path.join(__dirname, '..');

// Initialize babelParser (optional dependency)
let babelParser = null;
try {
  babelParser = require('./node_modules/@babel/parser');
} catch (e) {
  // Babel parser not available, will fall back gracefully
}

module.exports = {
  ROOT,
  babelParser
};

