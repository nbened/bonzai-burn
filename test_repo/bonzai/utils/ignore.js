const fs = require('fs');
const path = require('path');

// Read and parse ignore patterns from .ignore file
function getIgnorePatterns() {
  try {
    const ignorePath = path.join(__dirname, '..', '.ignore');
    if (fs.existsSync(ignorePath)) {
      const content = fs.readFileSync(ignorePath, 'utf8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(pattern => {
          // Convert simple glob patterns to regex
          if (pattern.endsWith('/')) {
            // Directory pattern
            pattern = pattern.slice(0, -1);
          }
          
          // Simple approach: escape dots and convert globs
          pattern = pattern.replace(/\./g, '\\.');
          pattern = pattern.replace(/\*\*/g, '|||DOUBLESTAR|||');
          pattern = pattern.replace(/\*/g, '[^/]*');
          pattern = pattern.replace(/\|\|\|DOUBLESTAR\|\|\|/g, '.*');
          
          return new RegExp('^' + pattern + '(/.*)?$');
        });
    }
  } catch (e) {
    console.warn('Could not read .ignore file:', e.message);
  }
  
  // Default ignore patterns if no .ignore file exists
  return [
    /^node_modules(\/.*)?$/,
    /^\.git(\/.*)?$/,
    /^\.DS_Store$/,
    /^\.env$/,
    /^bonzai(\/.*)?$/
  ];
}

// Check if a path should be ignored
function shouldIgnore(relativePath, ignorePatterns) {
  return ignorePatterns.some(pattern => pattern.test(relativePath));
}

module.exports = {
  getIgnorePatterns,
  shouldIgnore
};

