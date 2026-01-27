#!/usr/bin/env node
import fs from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { analyze, formatAnalysisResults } from './analyzer.js';

const BONZAI_DIR = 'bonzai';
const CONFIG_FILE = 'config.json';

/**
 * Load project config from bonzai/config.json
 * This is the source of truth for all burn configuration
 */
function loadConfig() {
  const configPath = join(process.cwd(), BONZAI_DIR, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    console.error(`❌ No config found at ${BONZAI_DIR}/${CONFIG_FILE}`);
    console.error(`   Run 'bonzai-burn' to initialize.\n`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`❌ Could not parse ${BONZAI_DIR}/${CONFIG_FILE}`);
    process.exit(1);
  }
}

async function main() {
  console.log('\n🔥 Finding unused code...\n');

  // Load config - source of truth
  const config = loadConfig();

  // Run analysis
  const results = await analyze(process.cwd(), config);
  const { output, totalIssues } = formatAnalysisResults(results);

  // Display results
  if (totalIssues > 0 || results.customRequirements) {
    console.log('─'.repeat(50));
    console.log(`\n🔥 Found tech debt:\n`);
    console.log(output);
    console.log('─'.repeat(50));
    console.log(`${totalIssues} issues across ${results.filesScanned} files (${results.durationMs}ms)\n`);

    // Copy to clipboard
    try {
      execSync('pbcopy', { input: output });
      console.log('Issues copied to clipboard. Run "claude" to implement.\n');
    } catch {
      console.log('Copy the above and give to Claude.\n');
    }
  } else {
    console.log('✓ No issues found\n');
  }
}

// Export for use via index.js flags
export { main };

// Run directly if called as standalone command
const isDirectRun = process.argv[1]?.endsWith('bburn.js');
if (isDirectRun) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
