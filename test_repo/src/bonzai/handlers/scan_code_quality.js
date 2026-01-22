const fs = require('fs');
const path = require('path');
const { ROOT } = require('../config');

function scanCodeQualityHandler(req, res) {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    
    const targetPath = path.join(ROOT, projectPath);
    
    if (!targetPath.startsWith(ROOT)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }
    
    const issues = [];
    
    // Basic code quality checks
    function scanDirectory(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(ROOT, fullPath);
        
        // Skip node_modules and other ignored directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'bonzai') {
          continue;
        }
        
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          // Check file size (warn if > 500KB)
          const stats = fs.statSync(fullPath);
          if (stats.size > 500 * 1024) {
            issues.push({
              file: relativePath,
              severity: 'warning',
              message: `Large file detected (${(stats.size / 1024).toFixed(2)}KB). Consider splitting into smaller modules.`,
              type: 'file-size'
            });
          }
          
          // Check for common code quality issues in JS/TS files
          if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || 
              entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split('\n');
              
              // Check for very long lines
              lines.forEach((line, index) => {
                if (line.length > 200) {
                  issues.push({
                    file: relativePath,
                    line: index + 1,
                    severity: 'info',
                    message: `Long line detected (${line.length} characters). Consider breaking into multiple lines.`,
                    type: 'line-length'
                  });
                }
              });
              
              // Check for TODO/FIXME comments
              lines.forEach((line, index) => {
                if (line.match(/TODO|FIXME|XXX|HACK/i)) {
                  issues.push({
                    file: relativePath,
                    line: index + 1,
                    severity: 'info',
                    message: `TODO/FIXME comment found: ${line.trim().substring(0, 100)}`,
                    type: 'todo-comment'
                  });
                }
              });
              
              // Check for console.log statements (potential debug code)
              lines.forEach((line, index) => {
                if (line.match(/console\.(log|debug|info|warn|error)/) && !line.includes('//')) {
                  issues.push({
                    file: relativePath,
                    line: index + 1,
                    severity: 'warning',
                    message: `Console statement found. Consider removing or using a proper logging library.`,
                    type: 'console-statement'
                  });
                }
              });
              
            } catch (e) {
              // Skip files that can't be read
            }
          }
        }
      }
    }
    
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      scanDirectory(targetPath);
    } else {
      // Single file scan
      const relativePath = path.relative(ROOT, targetPath);
      const content = fs.readFileSync(targetPath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (line.length > 200) {
          issues.push({
            file: relativePath,
            line: index + 1,
            severity: 'info',
            message: `Long line detected (${line.length} characters)`,
            type: 'line-length'
          });
        }
      });
    }
    
    res.json({
      success: true,
      issues: issues,
      totalIssues: issues.length,
      summary: {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length
      }
    });
    
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = scanCodeQualityHandler;
