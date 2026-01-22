#!/usr/bin/env node
import { execSync } from 'child_process';
import {
  getUserToken,
  loadLocalConfig,
  checkConfigVersion,
  pollConfigStatus,
  downloadConfig,
  getConfigPath
} from '../burn-api/config-manager.js';

const APP_URL = 'https://app.bonzai.dev';

/**
 * Open URL in default browser
 */
function openBrowser(url) {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore', shell: true });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Display spinner animation
 */
function createSpinner(message) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i]} ${message}`);
    i = (i + 1) % frames.length;
  }, 80);

  return {
    stop: (finalMessage) => {
      clearInterval(interval);
      process.stdout.write(`\r${finalMessage}\n`);
    }
  };
}

async function main() {
  const args = process.argv.slice(2);

  // Handle --help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
bonzai config - Configure Bonzai settings

Usage:
  bonzai config           Open configuration in browser
  bonzai config --show    Show current configuration
  bonzai config --path    Show config file path

Options:
  --show    Display current configuration
  --path    Show path to config file
  --help    Show this help message
`);
    process.exit(0);
  }

  // Handle --path
  if (args.includes('--path')) {
    console.log(getConfigPath());
    process.exit(0);
  }

  // Handle --show
  if (args.includes('--show')) {
    const config = loadLocalConfig();
    console.log('\n📋 Current Bonzai Configuration:\n');
    console.log(JSON.stringify(config, null, 2));
    console.log(`\n📁 Config file: ${getConfigPath()}\n`);
    process.exit(0);
  }

  // Default: open browser for configuration
  const token = getUserToken();

  console.log('\n🔧 Bonzai Configuration\n');

  // Check current version status
  const versionCheck = await checkConfigVersion();

  if (versionCheck.offline) {
    console.log('⚠️  Cannot reach Bonzai servers.');
    console.log('   Check your internet connection and try again.\n');
    console.log(`📁 Local config: ${getConfigPath()}\n`);
    process.exit(1);
  }

  console.log(`Current version: ${versionCheck.currentVersion}`);
  if (versionCheck.latestVersion) {
    console.log(`Latest version:  ${versionCheck.latestVersion}`);
  }

  if (versionCheck.needsUpdate) {
    console.log('\n⚠️  Update available!\n');
  } else {
    console.log('\n✓ Configuration is up to date.\n');
  }

  // Open browser
  const configUrl = `${APP_URL}/config?token=${token}&version=${versionCheck.latestVersion || versionCheck.currentVersion}`;

  console.log('Opening browser for configuration...\n');

  const opened = openBrowser(configUrl);

  if (!opened) {
    console.log('Could not open browser automatically.');
  }

  console.log(`If browser doesn't open, visit:`);
  console.log(`${configUrl}\n`);

  // Ask if user wants to wait for approval
  console.log('Waiting for configuration changes...');
  console.log('(Press Ctrl+C to exit without waiting)\n');

  const spinner = createSpinner('Listening for changes...');

  // Poll for updates
  const pollResult = await pollConfigStatus(token, 300000, 2000);

  if (pollResult.approved) {
    spinner.stop('✓ Configuration received');

    // Download and save
    const downloadResult = await downloadConfig(token);

    if (downloadResult.success) {
      console.log('✓ Configuration saved\n');
      console.log('New configuration:');
      console.log(JSON.stringify(downloadResult.config, null, 2));
      console.log(`\n📁 Saved to: ${getConfigPath()}\n`);
    } else {
      console.error(`\n❌ Failed to save: ${downloadResult.error}\n`);
      process.exit(1);
    }
  } else {
    spinner.stop('⏱️  Timed out waiting for changes');
    console.log('\nNo changes detected. Run "bonzai config" again to retry.\n');
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
