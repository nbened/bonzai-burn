const fs = require('fs');
const path = require('path');
const { ROOT } = require('../config');
const { extractPythonFunctions, extractJavaScriptFunctions, extractVueFunctions } = require('../utils/parsers');

function readHandler(req, res) {
  try {
    const requestedPath = req.query.path || '';
    const filePath = path.join(ROOT, requestedPath);
    
    if (!filePath.startsWith(ROOT)) {
      return res.status(400).send('Invalid path');
    }
    
    // Helper function to find and return content from parse result
    const findAndReturn = (parseResult, name, type) => {
      if (type === 'function') {
        const target = parseResult.functions.find(f => f.name === name);
        if (target) return target.content;
      } else if (type === 'method') {
        // Method name format: ClassName.methodName
        for (const cls of parseResult.classes) {
          const method = cls.methods.find(m => m.name === name);
          if (method) return method.content;
        }
      } else if (type === 'class') {
        const target = parseResult.classes.find(c => c.name === name);
        if (target) return target.content;
      }
      return null;
    };
    
    // Check if this is a virtual file request (.function, .method, or .class)
    if (requestedPath.endsWith('.function') || requestedPath.endsWith('.method') || requestedPath.endsWith('.class')) {
      // Traverse up the path to find the actual source file
      let currentPath = filePath;
      let sourceFilePath = null;
      let parser = null;
      
      // Keep going up until we find a source file (.py, .js, .jsx, .ts, .tsx, .vue)
      while (currentPath !== ROOT && currentPath !== path.dirname(currentPath)) {
        const stat = fs.existsSync(currentPath) ? fs.statSync(currentPath) : null;
        
        // Check if current path is a file with a supported extension
        if (stat && stat.isFile()) {
          if (currentPath.endsWith('.py')) {
            parser = extractPythonFunctions;
            sourceFilePath = currentPath;
            break;
          } else if (currentPath.endsWith('.js') || currentPath.endsWith('.jsx') || 
                     currentPath.endsWith('.ts') || currentPath.endsWith('.tsx')) {
            parser = extractJavaScriptFunctions;
            sourceFilePath = currentPath;
            break;
          } else if (currentPath.endsWith('.vue')) {
            parser = extractVueFunctions;
            sourceFilePath = currentPath;
            break;
          }
        }
        
        // Move up one level
        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) break; // Reached root
        currentPath = parentPath;
      }
      
      if (!sourceFilePath || !parser) {
        return res.status(404).send('Source file not found for virtual file');
      }
      
      // Extract the requested item name from the requested path
      let itemName = '';
      let itemType = '';
      
      if (requestedPath.endsWith('.function')) {
        itemName = path.basename(requestedPath, '.function');
        itemType = 'function';
      } else if (requestedPath.endsWith('.method')) {
        itemName = path.basename(requestedPath, '.method');
        itemType = 'method';
      } else if (requestedPath.endsWith('.class')) {
        itemName = path.basename(requestedPath, '.class');
        itemType = 'class';
      }
      
      // Check if the source file exists
      try {
        if (!fs.existsSync(sourceFilePath)) {
          return res.status(404).send('Source file not found');
        }
        
        // Parse the file
        const parseResult = parser(sourceFilePath);
        
        // Find and return the content
        const content = findAndReturn(parseResult, itemName, itemType);
        
        if (!content) {
          return res.status(404).send(`${itemType} '${itemName}' not found in file`);
        }
        
        return res.json({ content });
      } catch (e) {
        const errorType = requestedPath.endsWith('.function') ? 'function' : 
                         requestedPath.endsWith('.method') ? 'method' : 'class';
        return res.status(500).send('Error reading ' + errorType + ': ' + e.message);
      }
    }
    
    // Regular file read
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content });
  } catch (e) {
    res.status(500).send(e.message);
  }
}

module.exports = readHandler;

