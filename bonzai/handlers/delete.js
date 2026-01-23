const fs = require('fs');
const path = require('path');
const { ROOT } = require('../config');

function deleteHandler(req, res) {
  try {
    const targetPath = path.join(ROOT, req.body.path || '');
    if (!targetPath.startsWith(ROOT)) {
      return res.status(400).send('Invalid path');
    }
    // Delete file or directory recursively
    fs.rmSync(targetPath, { recursive: true, force: true });
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).send(e.message);
  }
}

module.exports = deleteHandler;

