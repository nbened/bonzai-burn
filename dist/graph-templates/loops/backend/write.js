const fs = require('fs');
const path = require('path');
const { ROOT } = require('../config');

function writeHandler(req, res) {
  try {
    const filePath = path.join(ROOT, req.body.path || '');
    if (!filePath.startsWith(ROOT)) {
      return res.status(400).send('Invalid path');
    }
    fs.writeFileSync(filePath, req.body.content, 'utf8');
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).send(e.message);
  }
}

module.exports = writeHandler;
