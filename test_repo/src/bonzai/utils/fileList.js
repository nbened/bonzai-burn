const fs = require('fs');
const path = require('path');
const { getIgnorePatterns, shouldIgnore } = require('./ignore');
const { extractPythonFunctions, extractJavaScriptFunctions, extractVueFunctions } = require('./parsers');

// Recursively list all files in a directory, respecting ignore patterns
function listAllFiles(dir, base = '', ignorePatterns = null) {
  if (ignorePatterns === null) {
    ignorePatterns = getIgnorePatterns();
  }
  
  let results = [];
  const list = fs.readdirSync(dir);
  
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const relativePath = path.join(base, file);
    
    // Check if this path should be ignored
    if (shouldIgnore(relativePath, ignorePatterns)) {
      continue;
    }
    
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      // Skip node_modules directories explicitly
      if (file === 'node_modules' || relativePath.includes('node_modules/')) {
        continue;
      }
      // Add the directory itself to results
      results.push(relativePath + '/');
      // Recursively list files inside the directory
      results = results.concat(listAllFiles(fullPath, relativePath, ignorePatterns));
    } else {
      // Skip files in node_modules explicitly
      if (relativePath.includes('node_modules/') || fullPath.includes('node_modules')) {
        continue;
      }
      
      results.push(relativePath);
      
      // Helper function to add functions, classes, and methods as virtual files
      const addVirtualFiles = (parseResult, filePath) => {
        // Add functions
        for (const func of parseResult.functions) {
          const functionFileName = func.name + '.function';
          const functionFilePath = path.join(filePath, functionFileName).replace(/\\/g, '/');
          results.push(functionFilePath);
        }
        
        // Add classes and their methods
        for (const cls of parseResult.classes) {
          // Add class itself (optional, but useful)
          const className = cls.name + '.class';
          const classFilePath = path.join(filePath, className).replace(/\\/g, '/');
          results.push(classFilePath);
          
          // Add methods nested under the class: ClassName.methodName
          if (cls.methods && cls.methods.length > 0) {
            for (const method of cls.methods) {
              const methodFileName = method.name + '.method';
              const methodFilePath = path.join(classFilePath, methodFileName).replace(/\\/g, '/');
              results.push(methodFilePath);
            }
          }
        }
      };
      
      // Handle Python files
      if (file.endsWith('.py')) {
        const parseResult = extractPythonFunctions(fullPath);
        addVirtualFiles(parseResult, relativePath);
      }
      
      // Handle JavaScript/TypeScript files
      // Skip .d.ts files (TypeScript declaration files) and .min.js files (minified)
      if ((file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) &&
          !file.endsWith('.d.ts') && !file.endsWith('.min.js')) {
        const parseResult = extractJavaScriptFunctions(fullPath);
        addVirtualFiles(parseResult, relativePath);
      }
      
      // Handle Vue files
      if (file.endsWith('.vue')) {
        const parseResult = extractVueFunctions(fullPath);
        addVirtualFiles(parseResult, relativePath);
      }
    }
  }
  return results;
}

module.exports = {
  listAllFiles
};

