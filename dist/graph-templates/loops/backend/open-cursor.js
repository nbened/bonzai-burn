const path = require('path');
const { exec } = require('child_process');
const { ROOT } = require('../config');

function openCursorHandler(req, res) {
  try {
    const requestedPath = req.body.path || '';

    console.log('[open-cursor] ROOT:', ROOT);
    console.log('[open-cursor] requestedPath:', requestedPath);

    // Resolve path relative to ROOT (similar to other endpoints)
    // If path is absolute and within ROOT, use it directly
    // Otherwise, resolve it relative to ROOT
    let filePath;
    if (path.isAbsolute(requestedPath)) {
      // If absolute path, check if it's within ROOT
      if (requestedPath.startsWith(ROOT)) {
        filePath = requestedPath;
      } else {
        // Path might contain incorrect segments (like "codemaps")
        // Try to find ROOT in the path and extract the relative part
        const rootIndex = requestedPath.indexOf(ROOT);
        if (rootIndex !== -1) {
          // Extract the part after ROOT and remove leading slashes
          let relativePart = requestedPath.substring(rootIndex + ROOT.length);
          while (relativePart.startsWith('/')) {
            relativePart = relativePart.substring(1);
          }
          filePath = path.join(ROOT, relativePart);
        } else {
          return res.status(400).json({ error: 'Invalid path: path must be within project root' });
        }
      }
    } else {
      // Relative path - resolve relative to ROOT
      // Remove root directory name prefix if present (from /list endpoint format)
      const rootName = path.basename(ROOT);
      let relativePath = requestedPath;
      if (relativePath.startsWith(rootName + '/')) {
        relativePath = relativePath.substring(rootName.length + 1);
      }
      filePath = path.join(ROOT, relativePath);
    }
    
    // Validate the resolved path is within ROOT
    if (!filePath.startsWith(ROOT)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    console.log('[open-cursor] resolved filePath:', filePath);

    const { line } = req.body;
    
    // Always use cursor CLI command first (it handles line numbers correctly)
    const cursorCommands = [
      'cursor',
      '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
      '/usr/local/bin/cursor',
      'code'
    ];
    
    const tryCommand = (commandIndex = 0) => {
      if (commandIndex >= cursorCommands.length) {
        return res.status(500).json({ 
          error: 'Cursor not found. Please install Cursor CLI or check Cursor installation.' 
        });
      }
      
      // Use proper Cursor CLI syntax for line numbers
      const command = line 
        ? `${cursorCommands[commandIndex]} --goto "${filePath}:${line}"`
        : `${cursorCommands[commandIndex]} "${filePath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error && error.code === 127) {
        // Command not found, try next one
        tryCommand(commandIndex + 1);
      } else if (error) {
        console.error('Error opening Cursor:', error);
        return res.status(500).json({ error: error.message });
      } else {
        // File opened successfully, now bring Cursor to front
        const isMac = process.platform === 'darwin';
        if (isMac) {
          // Use AppleScript to bring Cursor to the front
          exec('osascript -e "tell application \\"Cursor\\" to activate"', (activateError) => {
            if (activateError) {
              console.log('Could not activate Cursor, but file opened successfully');
            }
          });
          
          // Additional command to ensure it's really in front
          setTimeout(() => {
            exec('osascript -e "tell application \\"System Events\\" to set frontmost of process \\"Cursor\\" to true"', () => {
              // Don't worry if this fails
            });
          }, 500);
        }
        
        res.json({ success: true, message: 'Cursor opened and focused successfully', openedPath: filePath });
      }
    });
  };
  
  tryCommand();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = openCursorHandler;

