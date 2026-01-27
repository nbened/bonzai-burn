const path = require('path');
const { ROOT } = require('../config');
const { listAllFiles } = require('../utils/fileList');

function listHandler(req, res) {
  try {
    const relativeFiles = listAllFiles(ROOT);
    const repoName = path.basename(ROOT);
    // Prefix paths with repo name: repoName/src/file.js
    const files = relativeFiles.map(f => path.join(repoName, f));
    res.json({ files, root: ROOT });
  } catch (e) {
    res.status(500).send(e.message);
  }
}

module.exports = listHandler;

