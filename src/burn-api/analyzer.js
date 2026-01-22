import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Analyzes codebase for unused imports, architectural issues, and code quality
 * Uses ESLint for unused detection, TSC for TypeScript, and custom rules
 *
 * Config structure (from bonzai/config.json):
 * {
 *   "lineLimit": { "enabled": bool, "limit": number, "prompt": "..." },
 *   "folderLimit": { "enabled": bool, "limit": number, "prompt": "..." }
 * }
 */

// Default configuration matching bonzai/config.json structure
const DEFAULT_CONFIG = {
  lineLimit: {
    enabled: false,
    limit: 500,
    prompt: 'Split any file with over {{ linelimit }} lines into smaller files.'
  },
  folderLimit: {
    enabled: false,
    limit: 20,
    prompt: 'Split any folder with over {{ folderlimit }} items into smaller, compartmentalized folders.'
  },
  testPatterns: {
    '.vue': '.test.js',
    '.jsx': '.test.jsx',
    '.tsx': '.test.tsx',
    '.js': '.test.js',
    '.ts': '.test.ts'
  }
};

/**
 * List all files recursively, respecting common ignore patterns
 */
function listAllFiles(dir, basePath = '') {
  const ignorePatterns = ['node_modules', '.git', '.DS_Store', 'dist', 'build', 'coverage'];
  let results = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);

      // Skip ignored patterns
      if (ignorePatterns.some(p => entry.name === p || relativePath.includes(p))) {
        continue;
      }

      if (entry.isDirectory()) {
        results = results.concat(listAllFiles(fullPath, relativePath));
      } else {
        results.push({
          path: relativePath,
          fullPath: fullPath
        });
      }
    }
  } catch (e) {
    // Directory access error, skip
  }

  return results;
}

/**
 * Run ESLint to detect unused imports and variables
 */
function runEslintAnalysis(rootDir) {
  const issues = [];

  try {
    // Check if ESLint is available
    execSync('which eslint', { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    // ESLint not installed, skip this analysis
    return issues;
  }

  try {
    // Run ESLint with JSON format to capture unused vars/imports
    const result = execSync(
      `eslint "${rootDir}" --format json --rule "no-unused-vars: error" --rule "@typescript-eslint/no-unused-vars: error" 2>/dev/null || true`,
      { encoding: 'utf-8', stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
    );

    if (result.trim()) {
      const eslintOutput = JSON.parse(result);

      for (const file of eslintOutput) {
        for (const msg of file.messages || []) {
          if (msg.ruleId && (
            msg.ruleId.includes('no-unused') ||
            msg.ruleId.includes('unused')
          )) {
            issues.push({
              type: 'unused-import',
              severity: msg.severity === 2 ? 'error' : 'warning',
              file: path.relative(rootDir, file.filePath),
              line: msg.line,
              message: msg.message,
              suggestion: `Remove unused ${msg.message.includes('import') ? 'import' : 'variable'}`
            });
          }
        }
      }
    }
  } catch (e) {
    // ESLint failed, continue with other analysis
  }

  return issues;
}

/**
 * Run TypeScript compiler to check for unused locals
 */
function runTypeScriptAnalysis(rootDir) {
  const issues = [];
  const tsconfigPath = path.join(rootDir, 'tsconfig.json');

  // Only run if tsconfig.json exists
  if (!fs.existsSync(tsconfigPath)) {
    return issues;
  }

  try {
    // Check if tsc is available
    execSync('which tsc', { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    // TypeScript not installed, skip
    return issues;
  }

  try {
    const result = execSync(
      `cd "${rootDir}" && tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1 || true`,
      { encoding: 'utf-8', stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
    );

    // Parse TypeScript errors (format: file.ts(line,col): error TS####: message)
    const lines = result.split('\n');
    const errorRegex = /^(.+)\((\d+),(\d+)\):\s*error\s+TS(\d+):\s*(.+)$/;

    for (const line of lines) {
      const match = line.match(errorRegex);
      if (match) {
        const [, filePath, lineNum, , errorCode, message] = match;

        // Filter for unused-related errors (TS6133, TS6196, etc.)
        if (['6133', '6196', '6198'].includes(errorCode)) {
          issues.push({
            type: 'unused-import',
            severity: 'error',
            file: path.relative(rootDir, filePath),
            line: parseInt(lineNum, 10),
            message: message,
            suggestion: 'Remove unused declaration'
          });
        }
      }
    }
  } catch (e) {
    // TypeScript check failed, continue
  }

  return issues;
}

/**
 * Check files against line limit
 * Uses config.lineLimit.enabled, config.lineLimit.limit, config.lineLimit.prompt
 */
function checkLineLimits(files, config) {
  const issues = [];

  // Check if lineLimit is enabled
  const lineLimitConfig = config.lineLimit || DEFAULT_CONFIG.lineLimit;
  if (!lineLimitConfig.enabled) {
    return issues;
  }

  const maxLines = lineLimitConfig.limit || DEFAULT_CONFIG.lineLimit.limit;
  const promptTemplate = lineLimitConfig.prompt || DEFAULT_CONFIG.lineLimit.prompt;
  const suggestion = promptTemplate.replace(/\{\{\s*linelimit\s*\}\}/gi, maxLines);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.fullPath, 'utf-8');
      const lineCount = content.split('\n').length;

      if (lineCount > maxLines) {
        issues.push({
          type: 'line-limit',
          severity: 'warning',
          file: file.path,
          line: 1,
          message: `File has ${lineCount} lines, exceeds limit of ${maxLines}`,
          suggestion: suggestion
        });
      }
    } catch (e) {
      // Can't read file, skip
    }
  }

  return issues;
}

/**
 * Check folders against item limit
 * Uses config.folderLimit.enabled, config.folderLimit.limit, config.folderLimit.prompt
 */
function checkFolderLimits(files, config) {
  const issues = [];

  // Check if folderLimit is enabled
  const folderLimitConfig = config.folderLimit || DEFAULT_CONFIG.folderLimit;
  if (!folderLimitConfig.enabled) {
    return issues;
  }

  const maxItems = folderLimitConfig.limit || DEFAULT_CONFIG.folderLimit.limit;
  const promptTemplate = folderLimitConfig.prompt || DEFAULT_CONFIG.folderLimit.prompt;
  const suggestion = promptTemplate.replace(/\{\{\s*folderlimit\s*\}\}/gi, maxItems);

  // Count items per folder
  const folderCounts = {};

  for (const file of files) {
    const dir = path.dirname(file.path);
    if (!folderCounts[dir]) {
      folderCounts[dir] = 0;
    }
    folderCounts[dir]++;
  }

  // Check which folders exceed limit
  for (const [folder, count] of Object.entries(folderCounts)) {
    if (count > maxItems) {
      issues.push({
        type: 'folder-limit',
        severity: 'warning',
        file: folder,
        line: 0,
        message: `Folder has ${count} items, exceeds limit of ${maxItems}`,
        suggestion: suggestion
      });
    }
  }

  return issues;
}

/**
 * Check for missing test files
 */
function checkMissingTests(files, config) {
  const issues = [];
  const testPatterns = config.testPatterns || DEFAULT_CONFIG.testPatterns;

  // Get all test file paths for quick lookup
  const testFiles = new Set(
    files
      .filter(f => f.path.includes('.test.') || f.path.includes('.spec.') || f.path.includes('__tests__'))
      .map(f => f.path.toLowerCase())
  );

  for (const file of files) {
    const ext = path.extname(file.path);
    const testExt = testPatterns[ext];

    // Skip if no test pattern defined for this extension
    if (!testExt) continue;

    // Skip if this is already a test file
    if (file.path.includes('.test.') || file.path.includes('.spec.') || file.path.includes('__tests__')) {
      continue;
    }

    // Skip non-component/non-source files
    if (!file.path.startsWith('src/') && !file.path.startsWith('lib/') && !file.path.startsWith('components/')) {
      continue;
    }

    // Generate expected test file name
    const baseName = path.basename(file.path, ext);
    const dirName = path.dirname(file.path);
    const expectedTestFile = path.join(dirName, `${baseName}${testExt}`).toLowerCase();
    const expectedTestFileAlt = path.join('tests', dirName, `${baseName}${testExt}`).toLowerCase();
    const expectedTestFileAlt2 = path.join('__tests__', dirName, `${baseName}${testExt}`).toLowerCase();

    // Check if any test file exists
    const hasTest = testFiles.has(expectedTestFile) ||
      testFiles.has(expectedTestFileAlt) ||
      testFiles.has(expectedTestFileAlt2) ||
      [...testFiles].some(t => t.includes(baseName.toLowerCase()) && t.includes('.test.'));

    if (!hasTest) {
      issues.push({
        type: 'missing-test',
        severity: 'warning',
        file: file.path,
        line: 1,
        message: `No test file found for ${file.path}`,
        suggestion: `Create test file: ${baseName}${testExt}`
      });
    }
  }

  return issues;
}

/**
 * Check architectural rules from config
 */
function checkArchitecturalRules(files, config) {
  const issues = [];
  const patterns = config.architecturalPatterns || [];

  for (const pattern of patterns) {
    // Pattern format: { match: "glob", mustBeIn: "folder", message: "..." }
    const matchRegex = new RegExp(pattern.match.replace(/\*/g, '.*'));

    for (const file of files) {
      if (matchRegex.test(file.path)) {
        if (pattern.mustBeIn && !file.path.startsWith(pattern.mustBeIn)) {
          issues.push({
            type: 'architectural',
            severity: 'error',
            file: file.path,
            line: 1,
            message: pattern.message || `File should be in ${pattern.mustBeIn}`,
            suggestion: `Move file to ${pattern.mustBeIn}/${path.basename(file.path)}`
          });
        }

        if (pattern.mustNotBeIn && file.path.startsWith(pattern.mustNotBeIn)) {
          issues.push({
            type: 'architectural',
            severity: 'error',
            file: file.path,
            line: 1,
            message: pattern.message || `File should not be in ${pattern.mustNotBeIn}`,
            suggestion: `Move file out of ${pattern.mustNotBeIn}`
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check for required folders
 */
function checkRequiredFolders(rootDir, config) {
  const issues = [];
  const requiredFolders = config.rules?.requiredFolders || [];

  for (const folder of requiredFolders) {
    const folderPath = path.join(rootDir, folder);
    if (!fs.existsSync(folderPath)) {
      issues.push({
        type: 'architectural',
        severity: 'warning',
        file: folder,
        line: 0,
        message: `Required folder "${folder}" does not exist`,
        suggestion: `Create the ${folder}/ directory`
      });
    }
  }

  return issues;
}

/**
 * Main analyzer function
 * @param {string} rootDir - Root directory to analyze
 * @param {object} config - Configuration object from bonzai/config.json
 * @returns {object} Analysis results
 */
export async function analyze(rootDir = process.cwd(), config = DEFAULT_CONFIG) {
  const startTime = Date.now();

  // Merge config with defaults, preserving nested structures
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    lineLimit: { ...DEFAULT_CONFIG.lineLimit, ...config?.lineLimit },
    folderLimit: { ...DEFAULT_CONFIG.folderLimit, ...config?.folderLimit },
    testPatterns: { ...DEFAULT_CONFIG.testPatterns, ...config?.testPatterns }
  };

  // List all files
  const files = listAllFiles(rootDir);

  // Run all analyses in parallel where possible
  const [eslintIssues, tsIssues] = await Promise.all([
    Promise.resolve(runEslintAnalysis(rootDir)),
    Promise.resolve(runTypeScriptAnalysis(rootDir))
  ]);

  // Run synchronous checks based on config
  const lineLimitIssues = checkLineLimits(files, mergedConfig);
  const folderLimitIssues = checkFolderLimits(files, mergedConfig);
  const missingTestIssues = checkMissingTests(files, mergedConfig);
  const architecturalIssues = checkArchitecturalRules(files, mergedConfig);

  // Combine all issues
  const allIssues = [
    ...eslintIssues,
    ...tsIssues,
    ...lineLimitIssues,
    ...folderLimitIssues,
    ...missingTestIssues,
    ...architecturalIssues
  ];

  // Sort by severity (errors first) then by file
  allIssues.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'error' ? -1 : 1;
    }
    return a.file.localeCompare(b.file);
  });

  // Generate summary
  const errorCount = allIssues.filter(i => i.severity === 'error').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  const typeBreakdown = {};

  for (const issue of allIssues) {
    typeBreakdown[issue.type] = (typeBreakdown[issue.type] || 0) + 1;
  }

  const duration = Date.now() - startTime;

  return {
    issues: allIssues,
    summary: `Found ${allIssues.length} issues (${errorCount} errors, ${warningCount} warnings) across ${Object.keys(typeBreakdown).length} categories`,
    breakdown: typeBreakdown,
    filesScanned: files.length,
    durationMs: duration
  };
}

/**
 * Format analysis results for display
 */
export function formatAnalysisResults(results) {
  if (results.issues.length === 0) {
    return 'No issues found.';
  }

  let output = `${results.summary}\n\n`;

  // Group by type
  const byType = {};
  for (const issue of results.issues) {
    if (!byType[issue.type]) {
      byType[issue.type] = [];
    }
    byType[issue.type].push(issue);
  }

  for (const [type, issues] of Object.entries(byType)) {
    const icon = {
      'unused-import': '🗑️',
      'architectural': '🏗️',
      'line-limit': '📏',
      'missing-test': '🧪'
    }[type] || '⚠️';

    output += `${icon} ${type.toUpperCase()} (${issues.length})\n`;

    for (const issue of issues.slice(0, 10)) { // Limit to 10 per category
      const severity = issue.severity === 'error' ? '❌' : '⚠️';
      output += `  ${severity} ${issue.file}:${issue.line} - ${issue.message}\n`;
      if (issue.suggestion) {
        output += `     → ${issue.suggestion}\n`;
      }
    }

    if (issues.length > 10) {
      output += `  ... and ${issues.length - 10} more\n`;
    }

    output += '\n';
  }

  return output;
}

export default { analyze, formatAnalysisResults };
