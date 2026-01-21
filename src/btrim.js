#!/usr/bin/env node
import { execSync, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
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

function initializeBonzai() {
  const bonzaiPath = join(process.cwd(), BONZAI_DIR);
  const specsPath = join(bonzaiPath, SPECS_FILE);

  // Check if bonzai/ folder exists
  if (!fs.existsSync(bonzaiPath)) {
    // Create bonzai/ folder
    fs.mkdirSync(bonzaiPath, { recursive: true });
    console.log(`📁 Created ${BONZAI_DIR}/ folder`);
  }

  // Generate bonzai/specs.md with template
  if (!fs.existsSync(specsPath)) {
    fs.writeFileSync(specsPath, DEFAULT_SPECS);
    console.log(`📝 Created ${BONZAI_DIR}/${SPECS_FILE}`);
    console.log(`\n⚠️  Please edit ${BONZAI_DIR}/${SPECS_FILE} to define your cleanup rules before running btrim.\n`);
    process.exit(0);
  }
}

function ensureBonzaiDir() {
  const bonzaiPath = join(process.cwd(), BONZAI_DIR);
  const specsPath = join(bonzaiPath, SPECS_FILE);

  if (!fs.existsSync(bonzaiPath)) {
    fs.mkdirSync(bonzaiPath, { recursive: true });
    console.log(`📁 Created ${BONZAI_DIR}/ folder\n`);
  }

  if (!fs.existsSync(specsPath)) {
    fs.writeFileSync(specsPath, DEFAULT_SPECS);
    console.log(`📝 Created ${BONZAI_DIR}/${SPECS_FILE} - edit this file to define your cleanup specs\n`);
  }

  return specsPath;
}

function loadSpecs(specsPath) {
  const content = fs.readFileSync(specsPath, 'utf-8');
  return `You are a code cleanup assistant. Follow these specifications:\n\n${content}`;
}

function exec(command) {
  return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function execVisible(command) {
  execSync(command, { stdio: 'inherit' });
}

function executeClaude(requirements) {
  // Check if Claude CLI exists
  try {
    execSync('which claude', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error) {
    throw new Error(
      'Claude Code CLI not found.\n' +
      'Install it with: npm install -g @anthropic-ai/claude-code'
    );
  }

  // Track token usage
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastToolName = '';

  // Execute Claude with streaming JSON output

  return new Promise((resolve, reject) => {
    const args = [
      '-p', requirements,
      '--allowedTools', 'Read,Write,Edit,Bash',
      '--permission-mode', 'dontAsk',
      '--output-format', 'stream-json',
      '--verbose'
    ];

    const claude = spawn('claude', args, {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let buffer = '';

    claude.stdout.on('data', (data) => {
      buffer += data.toString();

      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);

          // Track tokens from assistant messages
          if (event.type === 'assistant' && event.message?.usage) {
            const usage = event.message.usage;
            if (usage.input_tokens) totalInputTokens += usage.input_tokens;
            if (usage.output_tokens) totalOutputTokens += usage.output_tokens;
          }

          // Show tool usage updates
          if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            lastToolName = event.content_block.name || '';
          }

          if (event.type === 'content_block_stop' && lastToolName) {
            const icon = getToolIcon(lastToolName);
            console.log(`  ${icon} ${lastToolName}`);
            lastToolName = '';
          }

          // Show result events with file info
          if (event.type === 'result') {
            if (event.usage) {
              // Final usage stats
              totalInputTokens = event.usage.input_tokens || totalInputTokens;
              totalOutputTokens = event.usage.output_tokens || totalOutputTokens;
            }
          }

        } catch (e) {
          // Not valid JSON, skip
        }
      }
    });

    claude.stderr.on('data', (data) => {
      // Show errors but don't clutter with minor stderr
      const msg = data.toString().trim();
      if (msg && !msg.includes('ExperimentalWarning')) {
        console.error(msg);
      }
    });

    claude.on('close', (code) => {
      // Print token summary
      console.log(`\n📊 Tokens: ${totalInputTokens.toLocaleString()} in / ${totalOutputTokens.toLocaleString()} out`);

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Claude exited with code ${code}`));
      }
    });

    claude.on('error', (err) => {
      reject(new Error(`Failed to execute Claude: ${err.message}`));
    });
  });
}

function getToolIcon(toolName) {
  const icons = {
    'Read': '📖',
    'Write': '✏️',
    'Edit': '🔧',
    'Bash': '💻',
    'Glob': '🔍',
    'Grep': '🔎'
  };
  return icons[toolName] || '🔹';
}

async function burn() {
  try {
    // Initialize bonzai folder and specs.md on first execution
    initializeBonzai();
    
    // Ensure bonzai directory and specs file exist
    const specsPath = ensureBonzaiDir();
    const specs = loadSpecs(specsPath);

    // Check if Claude CLI exists and execute
    console.log('🔍 Checking for Claude Code CLI...');

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

    // Generate unique branch name with short UUID
    const shortId = crypto.randomUUID().slice(0, 8);
    const burnBranch = `bonzai-burn-${shortId}`;

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
    await executeClaude(specs);

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
    if (error.message.includes('Claude Code CLI not found')) {
      console.error('\n' + error.message);
    }
    process.exit(1);
  }
}

burn();
