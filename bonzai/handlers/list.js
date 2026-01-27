const path = require('path');
const { ROOT } = require('../config');
const { listAllFiles } = require('../utils/fileList');

function listHandler(req, res) {
  try {
    const files = listAllFiles(ROOT);
    res.json({ files });
  } catch (e) {
    res.status(500).send(e.message);
  }
}

module.exports = listHandler;

