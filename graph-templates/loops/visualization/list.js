const path = require('path');
const { ROOT } = require('../config');
const { listAllFiles } = require('../utils/fileList');

function listHandler(req, res) {
  try {
    const relativeFiles = listAllFiles(ROOT);
    // Prefix all paths with ROOT to make them absolute
    const files = relativeFiles.map(f => path.join(ROOT, f));
    res.json({ files });
  } catch (e) {
    res.status(500).send(e.message);
  }
}

module.exports = listHandler;

