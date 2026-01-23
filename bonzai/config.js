const path = require('path');

// Root directory (one level up from templates/)
const ROOT = path.join(__dirname, '..');

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

