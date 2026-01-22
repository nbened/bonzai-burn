import { execSync } from 'child_process';
import {
  getUserToken,
  loadLocalConfig,
  checkConfigVersion,
  pollConfigStatus,
  downloadConfig,
  saveLocalConfig
} from '../burn-api/config-manager.js';
import { analyze, formatAnalysisResults } from '../burn-api/analyzer.js';

const APP_URL = 'https://app.bonzai.dev';

/**
 * Open URL in default browser
 * Uses native commands instead of 'open' package to avoid dependencies
 */
function openBrowser(url) {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore', shell: true });
    } else {
      // Linux and others
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }
    return true;
  } catch (e) {
    console.error(`Could not open browser. Please visit: ${url}`);
    return false;
  }
}

/**
 * Display spinner animation while waiting
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

/**
 * Enforce browser configuration - THIS BLOCKS UNTIL APPROVED
 * This is the core mechanism that ensures users complete browser config
 */
async function enforceConfigApproval() {
  const token = getUserToken();

  // Check if config needs update
  const versionCheck = await checkConfigVersion();

  if (versionCheck.offline) {
    console.log('\n⚠️  Offline mode - using cached configuration');
    console.log('   Run "bonzai config" when online to update.\n');
    return loadLocalConfig();
  }

  if (!versionCheck.needsUpdate) {
    // Config is current
    return loadLocalConfig();
  }

  // Config needs update - BLOCK and require browser approval
  console.log('\n🔥 Bonzai needs your project configuration to continue');
  console.log('   Opening browser for setup...\n');

  const configUrl = `${APP_URL}/config?token=${token}&version=${versionCheck.latestVersion}`;

  openBrowser(configUrl);

  console.log(`   If browser doesn't open, visit:`);
  console.log(`   ${configUrl}\n`);

  // Start polling spinner
  const spinner = createSpinner('Waiting for configuration approval...');

  // Poll for approval - this BLOCKS execution
  const pollResult = await pollConfigStatus(token, 300000, 2000); // 5 minute timeout, 2 second interval

  if (!pollResult.approved) {
    spinner.stop('❌ Configuration timeout');
    console.error('\n❌ Configuration was not completed within 5 minutes.');
    console.error('   Please run "bonzai config" to try again.\n');
    process.exit(1);
  }

  spinner.stop('✓ Configuration approved');

  // Download and save the new config
  const downloadResult = await downloadConfig(token);

  if (!downloadResult.success) {
    console.error(`\n❌ Failed to download config: ${downloadResult.error}`);
    console.error('   Using cached configuration.\n');
    return loadLocalConfig();
  }

  console.log('✓ Configuration updated. Continuing burn...\n');

  return downloadResult.config;
}

/**
 * Run the post-burn hook
 * This is called automatically after every burn completes when autoBurn is enabled
 * @param {object} projectConfig - The project's bonzai/config.json (lineLimit, folderLimit, etc.)
 */
export async function runPostBurnHook(projectConfig = {}) {
  console.log('\n📋 Running post-burn analysis...');

  // STEP 1: Enforce config approval (BLOCKS if needed) - uses global ~/.bonzai/config.json
  await enforceConfigApproval();

  // STEP 2: Run code analysis with PROJECT's config (bonzai/config.json)
  // This is where lineLimit, folderLimit settings come from
  console.log('🔍 Analyzing codebase...\n');

  const analysisResults = await analyze(process.cwd(), projectConfig);

  // STEP 3: Format and return results (INFORMATIONAL ONLY)
  if (analysisResults.issues.length === 0) {
    console.log('✓ No issues found\n');
    return {
      success: true,
      message: 'Burn complete. No additional issues detected.',
      issues: [],
      summary: analysisResults.summary
    };
  }

  // Format for display
  const formattedOutput = formatAnalysisResults(analysisResults);
  console.log(formattedOutput);

  // Return structured results for Claude - INFORMATIONAL ONLY
  return {
    success: true,
    message: `Burn complete. Code analysis detected ${analysisResults.issues.length} issues (informational only - do not modify):`,
    issues: analysisResults.issues,
    summary: analysisResults.summary,
    formatted: formattedOutput,
    breakdown: analysisResults.breakdown
  };
}

/**
 * Format results for Claude tool response
 * NOTE: This is INFORMATIONAL ONLY - Claude should echo these issues but NOT change anything
 */
export function formatForClaude(results) {
  if (results.issues.length === 0) {
    return 'No additional issues detected.';
  }

  let output = `INFORMATIONAL: The following issues were detected during post-burn analysis.\n`;
  output += `DO NOT modify any files. Just echo what was found and what could be done.\n\n`;

  // Group by type for readability
  const byType = {};
  for (const issue of results.issues) {
    if (!byType[issue.type]) {
      byType[issue.type] = [];
    }
    byType[issue.type].push(issue);
  }

  for (const [type, issues] of Object.entries(byType)) {
    output += `## ${type.toUpperCase()} (${issues.length})\n`;

    for (const issue of issues.slice(0, 15)) { // Limit per category
      output += `- ${issue.file}:${issue.line} - ${issue.message}\n`;
      if (issue.suggestion) {
        output += `  Could fix by: ${issue.suggestion}\n`;
      }
    }

    if (issues.length > 15) {
      output += `... and ${issues.length - 15} more ${type} issues\n`;
    }

    output += '\n';
  }

  output += '---\n';
  output += 'Echo these files and what needs to be done, but DO NOT change anything.';

  return output;
}

export default {
  runPostBurnHook,
  formatForClaude,
  enforceConfigApproval
};
