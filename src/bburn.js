#!/usr/bin/env node
import { execSync, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BONZAI_DIR = 'bonzai';
const SPECS_FILE = 'specs.md';
const CONFIG_FILE = 'config.json';

// Template folder in the package (ships as payload-bonzai, copied as bonzai)
const TEMPLATE_DIR = join(__dirname, '..', 'payload-bonzai');

// Parse --provider / -p argument, with config as fallback
function parseProvider(configDefault = 'claude') {
  const args = process.argv.slice(2);
  let provider = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' || args[i] === '-p') {
      provider = args[i + 1];
      break;
    }
    if (args[i].startsWith('--provider=')) {
      provider = args[i].split('=')[1];
      break;
    }
  }

  // Use config default if no CLI arg provided
  if (!provider) {
    provider = configDefault;
  }

  const validProviders = ['claude', 'cursor'];
  if (!validProviders.includes(provider)) {
    console.error(`❌ Invalid provider: "${provider}". Must be one of: ${validProviders.join(', ')}`);
    process.exit(1);
  }

  return provider;
}

function initializeBonzai() {
  const bonzaiPath = join(process.cwd(), BONZAI_DIR);
  const specsPath = join(bonzaiPath, SPECS_FILE);
  const configPath = join(bonzaiPath, CONFIG_FILE);

  // Check if bonzai/ folder exists
  if (!fs.existsSync(bonzaiPath)) {
    fs.mkdirSync(bonzaiPath, { recursive: true });
    console.log(`📁 Created ${BONZAI_DIR}/ folder`);
  }

  // Copy specs.md from package template
  if (!fs.existsSync(specsPath)) {
    fs.copyFileSync(join(TEMPLATE_DIR, SPECS_FILE), specsPath);
    console.log(`📝 Created ${BONZAI_DIR}/${SPECS_FILE}`);
  }

  // Copy config.json from package template
  if (!fs.existsSync(configPath)) {
    fs.copyFileSync(join(TEMPLATE_DIR, CONFIG_FILE), configPath);
    console.log(`⚙️  Created ${BONZAI_DIR}/${CONFIG_FILE}`);
    console.log(`\n⚠️  Please edit ${BONZAI_DIR}/${SPECS_FILE} to define your cleanup rules before running bburn.\n`);
    process.exit(0);
  }
}

function ensureBonzaiDir() {
  const bonzaiPath = join(process.cwd(), BONZAI_DIR);
  const specsPath = join(bonzaiPath, SPECS_FILE);
  const configPath = join(bonzaiPath, CONFIG_FILE);

  if (!fs.existsSync(bonzaiPath)) {
    fs.mkdirSync(bonzaiPath, { recursive: true });
    console.log(`📁 Created ${BONZAI_DIR}/ folder\n`);
  }

  if (!fs.existsSync(specsPath)) {
    fs.copyFileSync(join(TEMPLATE_DIR, SPECS_FILE), specsPath);
    console.log(`📝 Created ${BONZAI_DIR}/${SPECS_FILE} - edit this file to define your cleanup specs\n`);
  }

  if (!fs.existsSync(configPath)) {
    fs.copyFileSync(join(TEMPLATE_DIR, CONFIG_FILE), configPath);
    console.log(`⚙️  Created ${BONZAI_DIR}/${CONFIG_FILE}\n`);
  }

  return { specsPath, configPath };
}

function loadConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { debugMode: false };
  }
}

function loadSpecs(specsPath, config) {
  let content = fs.readFileSync(specsPath, 'utf-8');

  // Process lineLimit if enabled
  if (config.lineLimit?.enabled) {
    content = content.replace(/\{\{\s*linelimit\s*\}\}/gi, config.lineLimit.limit);
  } else {
    // Remove lines containing {{ linelimit }} if disabled
    content = content.split('\n')
      .filter(line => !/\{\{\s*linelimit\s*\}\}/i.test(line))
      .join('\n');
  }

  // Process folderLimit if enabled
  if (config.folderLimit?.enabled) {
    content = content.replace(/\{\{\s*folderlimit\s*\}\}/gi, config.folderLimit.limit);
  } else {
    // Remove lines containing {{ folderlimit }} if disabled
    content = content.split('\n')
      .filter(line => !/\{\{\s*folderlimit\s*\}\}/i.test(line))
      .join('\n');
  }

  return `You are a code cleanup assistant. Follow these specifications:\n\n${content}`;
}

function exec(command) {
  return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function execVisible(command) {
  execSync(command, { stdio: 'inherit' });
}

function executeClaude(requirements, config) {
  // Check if Claude CLI exists
  try {
    execSync('which claude', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error) {
    throw new Error(
      'Claude Code CLI not found.\n' +
      'Install it with: npm install -g @anthropic-ai/claude-code'
    );
  }

  const debugMode = config.debugMode === true || config.debugMode === 'true';

  // Debug mode: run Claude with visible output
  if (debugMode) {
    console.log('🐛 Running in debug mode...\n');
    return new Promise((resolve, reject) => {
      const args = [
        '-p', requirements,
        '--allowedTools', 'Read,Write,Edit,Bash',
        '--permission-mode', 'dontAsk'
      ];

      const claude = spawn('claude', args, {
        stdio: 'inherit'
      });

      claude.on('close', (code) => {
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

  // Headless mode with token tracking
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastToolName = '';

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

function executeCursor(requirements, config) {
  // Check if cursor-agent CLI exists
  try {
    execSync('which cursor-agent', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error) {
    throw new Error(
      'cursor-agent CLI not found.\n' +
      'Install it with: npm install -g cursor-agent'
    );
  }

  const debugMode = config.debugMode === true || config.debugMode === 'true';

  // Debug mode: run cursor-agent with verbose output
  if (debugMode) {
    console.log('🐛 Running in debug mode...\n');
    return new Promise((resolve, reject) => {
      const args = ['-p', requirements, '--verbose'];

      const cursor = spawn('cursor-agent', args, {
        stdio: 'inherit'
      });

      cursor.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`cursor-agent exited with code ${code}`));
        }
      });

      cursor.on('error', (err) => {
        reject(new Error(`Failed to execute cursor-agent: ${err.message}`));
      });
    });
  }

  // Headless mode with token tracking
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastToolName = '';

  return new Promise((resolve, reject) => {
    const args = [
      '-p', requirements,
      '--output-format', 'stream-json'
    ];

    const cursor = spawn('cursor-agent', args, {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let buffer = '';

    cursor.stdout.on('data', (data) => {
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

          // Show result events with usage info
          if (event.type === 'result') {
            if (event.usage) {
              totalInputTokens = event.usage.input_tokens || totalInputTokens;
              totalOutputTokens = event.usage.output_tokens || totalOutputTokens;
            }
          }

        } catch (e) {
          // Not valid JSON, skip
        }
      }
    });

    cursor.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg && !msg.includes('ExperimentalWarning')) {
        console.error(msg);
      }
    });

    cursor.on('close', (code) => {
      // Print token summary
      console.log(`\n📊 Tokens: ${totalInputTokens.toLocaleString()} in / ${totalOutputTokens.toLocaleString()} out`);

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`cursor-agent exited with code ${code}`));
      }
    });

    cursor.on('error', (err) => {
      reject(new Error(`Failed to execute cursor-agent: ${err.message}`));
    });
  });
}

async function burn() {
  try {
    // Initialize bonzai folder and specs.md on first execution
    initializeBonzai();

    // Ensure bonzai directory and specs file exist
    const { specsPath, configPath } = ensureBonzaiDir();
    const config = loadConfig(configPath);
    const specs = loadSpecs(specsPath, config);

    // Determine provider: CLI arg overrides config
    const provider = parseProvider(config.provider || 'claude');

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
    console.log(`🤖 Provider: ${provider}`);
    console.log(`🐛 Debug mode: ${config.debugMode === true || config.debugMode === 'true' ? 'on' : 'off'}`);
    console.log('🔥 Running Bonzai burn...\n');

    const startTime = Date.now();

    // Execute with the selected provider
    if (provider === 'cursor') {
      await executeCursor(specs, config);
    } else {
      await executeClaude(specs, config);
    }

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
    console.log(`\n✓ Keep changes: baccept`);
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
