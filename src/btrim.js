#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BONZAI_DIR = 'bonzai';
const SPECS_FILE = 'specs.md';

const DEFAULT_SPECS = `# Bonzai Specs

Define your cleanup requirements below. btrim will follow these instructions.

## Example:
- Remove unused imports
- Delete files matching pattern "*.tmp"
- Clean up console.log statements
`;

function ensureBonzaiDir() {
  const bonzaiPath = join(process.cwd(), BONZAI_DIR);
  const specsPath = join(bonzaiPath, SPECS_FILE);

  if (!existsSync(bonzaiPath)) {
    mkdirSync(bonzaiPath, { recursive: true });
    console.log(`📁 Created ${BONZAI_DIR}/ folder\n`);
  }

  if (!existsSync(specsPath)) {
    writeFileSync(specsPath, DEFAULT_SPECS);
    console.log(`📝 Created ${BONZAI_DIR}/${SPECS_FILE} - edit this file to define your cleanup specs\n`);
  }

  return specsPath;
}

function loadSpecs(specsPath) {
  const content = readFileSync(specsPath, 'utf-8');
  return `You are a code cleanup assistant. Follow these specifications:\n\n${content}`;
}

function exec(command) {
  return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function execVisible(command) {
  execSync(command, { stdio: 'inherit' });
}

async function burn() {
  try {
    // Ensure bonzai directory and specs file exist
    const specsPath = ensureBonzaiDir();
    const specs = loadSpecs(specsPath);

    // Check if Claude CLI exists
    console.log('🔍 Checking for Claude Code CLI...');
    try {
      exec('which claude');
    } catch {
      console.error('❌ Claude Code CLI not found');
      console.error('Install: npm install -g @anthropic-ai/claude-code');
      process.exit(1);
    }

    // Check if in git repo
    try {
      exec('git rev-parse --git-dir');
    } catch {
      console.error('❌ Not a git repository');
      process.exit(1);
    }

    // Get current branch
    const originalBranch = exec('git branch --show-current');

    // Handle uncommitted changes - auto-commit to current branch
    const hasChanges = exec('git status --porcelain') !== '';
    let madeWipCommit = false;

    if (hasChanges) {
      const timestamp = Date.now();
      console.log('💾 Auto-committing your work...');
      exec('git add -A');
      exec(`git commit -m "WIP: pre-burn checkpoint ${timestamp}"`);
      madeWipCommit = true;
      console.log(`✓ Work saved on ${originalBranch}\n`);
    }

    // Always use same burn branch name
    const burnBranch = 'bonzai-burn';

    // Delete existing burn branch if it exists
    try {
      exec(`git branch -D ${burnBranch}`);
      console.log(`🧹 Cleaned up old ${burnBranch} branch\n`);
    } catch {
      // Branch doesn't exist, that's fine
    }

    console.log(`📍 Starting from: ${originalBranch}`);
    console.log(`🌿 Creating: ${burnBranch}\n`);

    // Create burn branch from current position
    exec(`git checkout -b ${burnBranch}`);

    // Save metadata for revert
    exec(`git config bonzai.originalBranch ${originalBranch}`);
    exec(`git config bonzai.burnBranch ${burnBranch}`);
    exec(`git config bonzai.madeWipCommit ${madeWipCommit}`);

    console.log(`📋 Specs loaded from: ${BONZAI_DIR}/${SPECS_FILE}`);
    console.log('🔥 Running Bonzai burn...\n');

    const startTime = Date.now();

    // Execute Claude with specs from bonzai/specs.md
    execVisible(`claude -p "${specs.replace(/"/g, '\\"')}" --allowedTools "Read,Write,Edit,Bash" --permission-mode dontAsk`);

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n✓ Burn complete (${duration}s)\n`);

    // Commit burn changes
    const burnTimestamp = Date.now();
    exec('git add -A');
    exec(`git commit -m "bonzai burn ${burnTimestamp}" --allow-empty`);

    console.log('Files changed from original:');
    execVisible(`git diff --stat ${originalBranch}..${burnBranch}`);

    console.log(`\n✅ Changes applied on: ${burnBranch}`);
    console.log(`📊 Full diff: git diff ${originalBranch}`);
    console.log(`\n✓ Keep changes: git checkout ${originalBranch} && git merge ${burnBranch}`);
    console.log(`✗ Discard: brevert\n`);

  } catch (error) {
    console.error('❌ Burn failed:', error.message);
    process.exit(1);
  }
}

burn();
