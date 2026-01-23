const fs = require('fs');
const { babelParser } = require('../config');

// Extract functions, classes, and methods from a Python file
function extractPythonFunctions(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const functions = [];
    const classes = [];
    let currentFunction = null;
    let currentClass = null;
    let decorators = [];
    let classIndent = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Calculate indentation level
      const match = line.match(/^\s*/);
      const currentIndent = match ? match[0].length : 0;
      
      // Check for decorators (only at top level, before function/class)
      if (trimmed.startsWith('@') && currentIndent === 0) {
        decorators.push(line);
        continue;
      }
      
      // Check if this is a top-level class definition
      const classMatch = trimmed.match(/^class\s+(\w+)/);
      if (classMatch && currentIndent === 0) {
        // Save previous function/class if exists
        if (currentFunction) {
          currentFunction.content = currentFunction.content.trim();
          functions.push(currentFunction);
          currentFunction = null;
        }
        if (currentClass) {
          currentClass.content = currentClass.content.trim();
          classes.push(currentClass);
        }
        
        // Start new class
        const className = classMatch[1];
        let classContent = '';
        
        // Add decorators if any
        if (decorators.length > 0) {
          classContent = decorators.join('\n') + '\n';
          decorators = [];
        }
        
        classContent += line;
        classIndent = currentIndent;
        
        currentClass = {
          name: className,
          content: classContent,
          methods: [],
          startLine: i + 1,
          endLine: i + 1
        };
        continue;
      }
      
      // Check if this is a method definition (inside a class)
      const methodMatch = trimmed.match(/^def\s+(\w+)\s*\(/);
      if (methodMatch && currentClass && currentIndent > classIndent) {
        // Save previous method if exists
        if (currentFunction) {
          currentFunction.content = currentFunction.content.trim();
          currentClass.methods.push(currentFunction);
          currentFunction = null;
        }
        
        // Start new method
        const methodName = methodMatch[1];
        let methodContent = '';
        
        // Add decorators if any
        if (decorators.length > 0) {
          methodContent = decorators.join('\n') + '\n';
          decorators = [];
        }
        
        methodContent += line;
        
        currentFunction = {
          name: currentClass.name + '.' + methodName,
          content: methodContent,
          startLine: i + 1,
          endLine: i + 1,
          isMethod: true,
          className: currentClass.name,
          methodName: methodName
        };
        continue;
      }
      
      // Check if this is a top-level function definition
      const funcMatch = trimmed.match(/^def\s+(\w+)\s*\(/);
      
      if (funcMatch && currentIndent === 0) {
        // Save previous function/class if exists
        if (currentFunction) {
          currentFunction.content = currentFunction.content.trim();
          if (currentFunction.isMethod && currentClass) {
            currentClass.methods.push(currentFunction);
          } else {
          functions.push(currentFunction);
          }
          currentFunction = null;
        }
        if (currentClass) {
          currentClass.content = currentClass.content.trim();
          classes.push(currentClass);
          currentClass = null;
          classIndent = -1;
        }
        
        // Start new function
        const functionName = funcMatch[1];
        let functionContent = '';
        
        // Add decorators if any
        if (decorators.length > 0) {
          functionContent = decorators.join('\n') + '\n';
          decorators = [];
        }
        
        functionContent += line;
        
        currentFunction = {
          name: functionName,
          content: functionContent,
          startLine: i + 1,
          endLine: i + 1
        };
      } else if (currentFunction || currentClass) {
        // We're processing lines after a function/class definition
        if (currentIndent === 0 && trimmed && !trimmed.startsWith('#')) {
          // Back to top level with non-comment content - function/class ended
          if (currentFunction) {
          currentFunction.content = currentFunction.content.trim();
            if (currentFunction.isMethod && currentClass) {
              currentClass.methods.push(currentFunction);
            } else {
          functions.push(currentFunction);
            }
          currentFunction = null;
          }
          if (currentClass) {
            currentClass.content = currentClass.content.trim();
            classes.push(currentClass);
            currentClass = null;
            classIndent = -1;
          }
          
          // Check if this line starts a new function/class
          if (funcMatch) {
            const functionName = funcMatch[1];
            let functionContent = '';
            
            if (decorators.length > 0) {
              functionContent = decorators.join('\n') + '\n';
              decorators = [];
            }
            
            functionContent += line;
            
            currentFunction = {
              name: functionName,
              content: functionContent,
              startLine: i + 1,
              endLine: i + 1
            };
          } else if (classMatch) {
            const className = classMatch[1];
            let classContent = '';
            
            if (decorators.length > 0) {
              classContent = decorators.join('\n') + '\n';
              decorators = [];
            }
            
            classContent += line;
            classIndent = currentIndent;
            
            currentClass = {
              name: className,
              content: classContent,
              methods: [],
              startLine: i + 1,
              endLine: i + 1
            };
          } else if (trimmed.startsWith('@')) {
            decorators.push(line);
          }
        } else {
          // Still inside function/class (indented or empty/comment line)
          if (currentFunction) {
          currentFunction.content += '\n' + line;
          currentFunction.endLine = i + 1;
          }
          if (currentClass) {
            currentClass.content += '\n' + line;
            currentClass.endLine = i + 1;
          }
        }
      }
    }
    
    // Don't forget the last function/class
    if (currentFunction) {
      currentFunction.content = currentFunction.content.trim();
      if (currentFunction.isMethod && currentClass) {
        currentClass.methods.push(currentFunction);
      } else {
      functions.push(currentFunction);
      }
    }
    if (currentClass) {
      currentClass.content = currentClass.content.trim();
      classes.push(currentClass);
    }
    
    return { functions, classes };
  } catch (e) {
    // If parsing fails (invalid Python, etc.), return empty arrays
    console.warn('Failed to parse Python file:', filePath, e.message);
    return { functions: [], classes: [] };
  }
}

// Extract functions, classes, and methods from a JavaScript/TypeScript file
function extractJavaScriptFunctions(filePath) {
  try {
    if (!babelParser) {
      return { functions: [], classes: [] };
    }
    
    // Skip .d.ts files, minified files, and node_modules
    if (filePath.endsWith('.d.ts') || filePath.endsWith('.min.js') || filePath.includes('node_modules')) {
      return { functions: [], classes: [] };
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const functions = [];
    const classes = [];
    
    // Determine if it's TypeScript
    const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    
    try {
      const ast = babelParser.parse(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      });
      
      // Helper to extract code snippet from source
      const getCode = (node) => {
        return content.substring(node.start, node.end);
      };
      
      // Track visited nodes to avoid duplicates
      const visitedNodes = new Set();
      
      // Traverse AST
      function traverse(node, parentType = null) {
        if (!node) return;
        
        // Skip if already visited (avoid processing same node twice)
        if (visitedNodes.has(node)) return;
        visitedNodes.add(node);
        
        // Function declarations: function myFunc() {}
        // Skip if inside ExportNamedDeclaration (will be handled below)
        if (node.type === 'FunctionDeclaration' && node.id && parentType !== 'ExportNamedDeclaration') {
          functions.push({
            name: node.id.name,
            content: getCode(node),
            startLine: node.loc ? node.loc.start.line : 0,
            endLine: node.loc ? node.loc.end.line : 0
          });
        }
        
        // Arrow functions: const myFunc = () => {}
        if (node.type === 'VariableDeclarator' && 
            node.init && 
            (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression') &&
            node.id && node.id.type === 'Identifier') {
          const funcContent = getCode(node);
          functions.push({
            name: node.id.name,
            content: funcContent,
            startLine: node.loc ? node.loc.start.line : 0,
            endLine: node.loc ? node.loc.end.line : 0
          });
        }
        
        // Helper function to extract methods from a class body
        const extractClassMethods = (classNode, className) => {
          const methods = [];
          if (classNode.body && classNode.body.body && Array.isArray(classNode.body.body)) {
            for (const member of classNode.body.body) {
              // Handle MethodDefinition (regular methods, constructors, getters, setters, static methods)
              if (member && member.type === 'MethodDefinition' && member.key) {
                let methodName;
                if (member.key.type === 'Identifier') {
                  methodName = member.key.name;
                } else if (member.key.type === 'PrivateName') {
                  methodName = '#' + member.key.id.name;
                } else if (member.key.type === 'StringLiteral' || member.key.type === 'NumericLiteral') {
                  methodName = String(member.key.value);
                } else {
                  methodName = String(member.key.value || member.key.name || 'unknown');
                }
                
                // Include kind (constructor, get, set, method) in the name for clarity
                const kind = member.kind || 'method';
                const isStatic = member.static || false;
                
                // For getters and setters, include the kind in the method name to distinguish them
                // e.g., "value" getter vs "value" setter -> "get value" and "set value"
                let fullMethodName = methodName;
                if (kind === 'get') {
                  fullMethodName = 'get ' + methodName;
                } else if (kind === 'set') {
                  fullMethodName = 'set ' + methodName;
                } else if (kind === 'constructor') {
                  fullMethodName = 'constructor';
                } else if (isStatic) {
                  fullMethodName = 'static ' + methodName;
                }
                
                methods.push({
                  name: className + '.' + methodName,
                  content: getCode(member),
                  startLine: member.loc ? member.loc.start.line : 0,
                  endLine: member.loc ? member.loc.end.line : 0,
                  isMethod: true,
                  className: className,
                  methodName: methodName,
                  kind: kind,
                  static: isStatic
                });
              }
            }
          }
          return methods;
        };
        
        // Class declarations: class User { ... }
        // Skip if inside ExportNamedDeclaration or ExportDefaultDeclaration (will be handled below)
        if (node.type === 'ClassDeclaration' && node.id && 
            parentType !== 'ExportNamedDeclaration' && parentType !== 'ExportDefaultDeclaration') {
          const className = node.id.name;
          const methods = extractClassMethods(node, className);
          
          classes.push({
            name: className,
            content: getCode(node),
            methods: methods,
            startLine: node.loc ? node.loc.start.line : 0,
            endLine: node.loc ? node.loc.end.line : 0
          });
        }
        
        // Export declarations: export function, export class
        if (node.type === 'ExportNamedDeclaration' && node.declaration) {
          if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
            functions.push({
              name: node.declaration.id.name,
              content: getCode(node.declaration),
              startLine: node.declaration.loc ? node.declaration.loc.start.line : 0,
              endLine: node.declaration.loc ? node.declaration.loc.end.line : 0,
              isExported: true
            });
            // Mark as visited to avoid duplicate processing
            visitedNodes.add(node.declaration);
          } else if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
            const className = node.declaration.id.name;
            const methods = extractClassMethods(node.declaration, className);
            
            classes.push({
              name: className,
              content: getCode(node.declaration),
              methods: methods,
              startLine: node.declaration.loc ? node.declaration.loc.start.line : 0,
              endLine: node.declaration.loc ? node.declaration.loc.end.line : 0,
              isExported: true
            });
            // Mark as visited to avoid duplicate processing
            visitedNodes.add(node.declaration);
          }
        }
        
        // Export default declarations: export default class
        if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
          if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
            const className = node.declaration.id.name;
            const methods = extractClassMethods(node.declaration, className);
            
            classes.push({
              name: className,
              content: getCode(node.declaration),
              methods: methods,
              startLine: node.declaration.loc ? node.declaration.loc.start.line : 0,
              endLine: node.declaration.loc ? node.declaration.loc.end.line : 0,
              isExported: true,
              isDefaultExport: true
            });
            // Mark as visited to avoid duplicate processing
            visitedNodes.add(node.declaration);
          } else if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
            functions.push({
              name: node.declaration.id.name,
              content: getCode(node.declaration),
              startLine: node.declaration.loc ? node.declaration.loc.start.line : 0,
              endLine: node.declaration.loc ? node.declaration.loc.end.line : 0,
              isExported: true,
              isDefaultExport: true
            });
            visitedNodes.add(node.declaration);
          }
        }
        
        // Recursively traverse children
        for (const key in node) {
          if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') continue;
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(c => traverse(c, node.type));
          } else if (child && typeof child === 'object' && child.type) {
            traverse(child, node.type);
          }
        }
      }
      
      traverse(ast);
    } catch (parseError) {
      // Silently skip parsing errors - these are expected for some files
      // Only log if it's not in node_modules or a known problematic file type
      if (!filePath.includes('node_modules') && !filePath.endsWith('.d.ts') && !filePath.endsWith('.min.js')) {
        // Suppress warnings for common parsing issues
        const errorMsg = parseError.message || '';
        if (!errorMsg.includes('outside of function') && 
            !errorMsg.includes('Missing initializer') &&
            !errorMsg.includes('Export') &&
            !errorMsg.includes('Unexpected token')) {
          // Only log unexpected errors
        }
      }
      return { functions: [], classes: [] };
    }
    
    return { functions, classes };
  } catch (e) {
    console.warn('Failed to read JavaScript/TypeScript file:', filePath, e.message);
    return { functions: [], classes: [] };
  }
}

// Extract script content from Vue file and parse it
function extractVueFunctions(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract <script> section from Vue file
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) {
      return { functions: [], classes: [] };
    }
    
    const scriptContent = scriptMatch[1];
    
    // Create a temporary file path for parsing (just for reference)
    // Parse the script content as JavaScript/TypeScript
    if (!babelParser) {
      return { functions: [], classes: [] };
    }
    
    const functions = [];
    const classes = [];
    
    // Check if it's TypeScript
    const isTypeScript = scriptMatch[0].includes('lang="ts"') || scriptMatch[0].includes("lang='ts'");
    
    try {
      const ast = babelParser.parse(scriptContent, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      });
      
      // Helper to extract code snippet from source
      const getCode = (node) => {
        return scriptContent.substring(node.start, node.end);
      };
      
      // Track visited nodes to avoid duplicates
      const visitedNodes = new Set();
      
      // Traverse AST (same logic as JavaScript parser)
      function traverse(node, parentType = null) {
        if (!node) return;
        
        // Skip if already visited (avoid processing same node twice)
        if (visitedNodes.has(node)) return;
        visitedNodes.add(node);
        
        // Function declarations: function myFunc() {}
        // Skip if inside ExportNamedDeclaration (will be handled below)
        if (node.type === 'FunctionDeclaration' && node.id && parentType !== 'ExportNamedDeclaration') {
          functions.push({
            name: node.id.name,
            content: getCode(node),
            startLine: node.loc ? node.loc.start.line : 0,
            endLine: node.loc ? node.loc.end.line : 0
          });
        }
        
        // Arrow functions: const myFunc = () => {}
        if (node.type === 'VariableDeclarator' && 
            node.init && 
            (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression') &&
            node.id && node.id.type === 'Identifier') {
          const funcContent = getCode(node);
          functions.push({
            name: node.id.name,
            content: funcContent,
            startLine: node.loc ? node.loc.start.line : 0,
            endLine: node.loc ? node.loc.end.line : 0
          });
        }
        
        // Helper function to extract methods from a class body
        const extractClassMethods = (classNode, className) => {
          const methods = [];
          if (classNode.body && classNode.body.body && Array.isArray(classNode.body.body)) {
            for (const member of classNode.body.body) {
              // Handle MethodDefinition (regular methods, constructors, getters, setters, static methods)
              if (member && member.type === 'MethodDefinition' && member.key) {
                let methodName;
                if (member.key.type === 'Identifier') {
                  methodName = member.key.name;
                } else if (member.key.type === 'PrivateName') {
                  methodName = '#' + member.key.id.name;
                } else if (member.key.type === 'StringLiteral' || member.key.type === 'NumericLiteral') {
                  methodName = String(member.key.value);
                } else {
                  methodName = String(member.key.value || member.key.name || 'unknown');
                }
                
                // Include kind (constructor, get, set, method) in the name for clarity
                const kind = member.kind || 'method';
                const isStatic = member.static || false;
                
                // For getters and setters, include the kind in the method name to distinguish them
                // e.g., "value" getter vs "value" setter -> "get value" and "set value"
                let fullMethodName = methodName;
                if (kind === 'get') {
                  fullMethodName = 'get ' + methodName;
                } else if (kind === 'set') {
                  fullMethodName = 'set ' + methodName;
                } else if (kind === 'constructor') {
                  fullMethodName = 'constructor';
                } else if (isStatic) {
                  fullMethodName = 'static ' + methodName;
                }
                
                methods.push({
                  name: className + '.' + methodName,
                  content: getCode(member),
                  startLine: member.loc ? member.loc.start.line : 0,
                  endLine: member.loc ? member.loc.end.line : 0,
                  isMethod: true,
                  className: className,
                  methodName: methodName,
                  kind: kind,
                  static: isStatic
                });
              }
            }
          }
          return methods;
        };
        
        // Class declarations: class User { ... }
        // Skip if inside ExportNamedDeclaration or ExportDefaultDeclaration (will be handled below)
        if (node.type === 'ClassDeclaration' && node.id && 
            parentType !== 'ExportNamedDeclaration' && parentType !== 'ExportDefaultDeclaration') {
          const className = node.id.name;
          const methods = extractClassMethods(node, className);
          
          classes.push({
            name: className,
            content: getCode(node),
            methods: methods,
            startLine: node.loc ? node.loc.start.line : 0,
            endLine: node.loc ? node.loc.end.line : 0
          });
        }
        
        // Export declarations: export function, export class
        if (node.type === 'ExportNamedDeclaration' && node.declaration) {
          if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
            functions.push({
              name: node.declaration.id.name,
              content: getCode(node.declaration),
              startLine: node.declaration.loc ? node.declaration.loc.start.line : 0,
              endLine: node.declaration.loc ? node.declaration.loc.end.line : 0,
              isExported: true
            });
            // Mark as visited to avoid duplicate processing
            visitedNodes.add(node.declaration);
          } else if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
            const className = node.declaration.id.name;
            const methods = extractClassMethods(node.declaration, className);
            
            classes.push({
              name: className,
              content: getCode(node.declaration),
              methods: methods,
              startLine: node.declaration.loc ? node.declaration.loc.start.line : 0,
              endLine: node.declaration.loc ? node.declaration.loc.end.line : 0,
              isExported: true
            });
            // Mark as visited to avoid duplicate processing
            visitedNodes.add(node.declaration);
          }
        }
        
        // Export default declarations: export default class
        if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
          if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
            const className = node.declaration.id.name;
            const methods = extractClassMethods(node.declaration, className);
            
            classes.push({
              name: className,
              content: getCode(node.declaration),
              methods: methods,
              startLine: node.declaration.loc ? node.declaration.loc.start.line : 0,
              endLine: node.declaration.loc ? node.declaration.loc.end.line : 0,
              isExported: true,
              isDefaultExport: true
            });
            // Mark as visited to avoid duplicate processing
            visitedNodes.add(node.declaration);
          } else if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
            functions.push({
              name: node.declaration.id.name,
              content: getCode(node.declaration),
              startLine: node.declaration.loc ? node.declaration.loc.start.line : 0,
              endLine: node.declaration.loc ? node.declaration.loc.end.line : 0,
              isExported: true,
              isDefaultExport: true
            });
            visitedNodes.add(node.declaration);
          }
        }
        
        // Recursively traverse children
        for (const key in node) {
          if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') continue;
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(c => traverse(c, node.type));
          } else if (child && typeof child === 'object' && child.type) {
            traverse(child, node.type);
          }
        }
      }
      
      traverse(ast);
    } catch (parseError) {
      // Silently skip parsing errors for Vue files
      return { functions: [], classes: [] };
    }
    
    return { functions, classes };
  } catch (e) {
    console.warn('Failed to read Vue file:', filePath, e.message);
    return { functions: [], classes: [] };
  }
}

module.exports = {
  extractPythonFunctions,
  extractJavaScriptFunctions,
  extractVueFunctions
};

