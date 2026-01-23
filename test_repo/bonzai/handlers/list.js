const path = require('path');
const { ROOT } = require('../config');
const { listAllFiles } = require('../utils/fileList');

function listHandler(req, res) {
  try {
    const rootName = path.basename(ROOT);
    const files = listAllFiles(ROOT, rootName);
    res.json({ files });
  } catch (e) {
    res.status(500).send(e.message);
  }
}

module.exports = listHandler;

