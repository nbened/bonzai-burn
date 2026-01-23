#!/usr/bin/env node
import fs from 'fs';
import { join } from 'path';

const BONZAI_DIR = 'bonzai';
const CONFIG_FILE = 'config.json';
const CLAUDE_DIR = '.claude';
const SETTINGS_FILE = 'settings.local.json';

/**
 * Load project config from bonzai/config.json
 */
function loadBonzaiConfig() {
  const configPath = join(process.cwd(), BONZAI_DIR, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

/**
 * Load or create Claude settings
 */
function loadClaudeSettings() {
  const settingsPath = join(process.cwd(), CLAUDE_DIR, SETTINGS_FILE);

  if (!fs.existsSync(settingsPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return {};
  }
}

/**
 * Save Claude settings
 */
function saveClaudeSettings(settings) {
  const claudeDir = join(process.cwd(), CLAUDE_DIR);
  const settingsPath = join(claudeDir, SETTINGS_FILE);

  // Ensure .claude directory exists
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * Check if bburn hook is already installed
 */
function hasBburnHook(settings) {
  const stopHooks = settings.hooks?.Stop || [];
  return stopHooks.some(entry =>
    entry.hooks?.some(hook => hook.command === 'bburn')
  );
}

/**
 * Install bburn as a Stop hook
 */
function installHook() {
  const settings = loadClaudeSettings();

  if (hasBburnHook(settings)) {
    console.log('✓ bburn hook already installed\n');
    return;
  }

  // Initialize hooks structure if needed
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [];
  }

  // Add bburn hook with correct nested structure
  settings.hooks.Stop.push({
    hooks: [
      {
        type: 'command',
        command: 'bburn'
      }
    ]
  });

  saveClaudeSettings(settings);
  console.log('✓ Installed bburn as Claude Code Stop hook');
  console.log('  bburn will run after every Claude Code message\n');
}

/**
 * Uninstall bburn hook
 */
function uninstallHook() {
  const settings = loadClaudeSettings();

  if (!hasBburnHook(settings)) {
    console.log('✓ bburn hook not installed\n');
    return;
  }

  // Remove entries that contain bburn hooks
  settings.hooks.Stop = settings.hooks.Stop.filter(entry =>
    !entry.hooks?.some(hook => hook.command === 'bburn')
  );

  // Clean up empty arrays
  if (settings.hooks.Stop.length === 0) {
    delete settings.hooks.Stop;
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  saveClaudeSettings(settings);
  console.log('✓ Removed bburn hook from Claude Code\n');
}

/**
 * Show current status
 */
function showStatus() {
  const settings = loadClaudeSettings();
  const config = loadBonzaiConfig();

  console.log('\n🔥 Bonzai Hook Status\n');

  // Check autoBurn config
  const autoBurnEnabled = config?.autoBurn?.enabled ?? false;
  console.log(`Config autoBurn: ${autoBurnEnabled ? 'enabled' : 'disabled'}`);

  // Check hook status
  const hookInstalled = hasBburnHook(settings);
  console.log(`Claude hook: ${hookInstalled ? 'installed' : 'not installed'}\n`);

  if (autoBurnEnabled && !hookInstalled) {
    console.log('Run "bhook install" to install the hook\n');
  }
}

async function main(subArgs = []) {
  // Use passed args or fall back to process.argv
  const args = subArgs.length > 0 ? subArgs : process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'uninstall':
    case 'remove':
    case '-u':
      uninstallHook();
      break;
    case 'status':
    case '-s':
      showStatus();
      break;
    case 'install':
    case '-i':
    default:
      // Default action is to install (like bburn runs analysis by default)
      installHook();
      break;
  }
}

// Export for use via index.js flags
export { main };

// Run directly if called as standalone command
const isDirectRun = process.argv[1]?.endsWith('bhook.js');
if (isDirectRun) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
