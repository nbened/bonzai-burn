#!/usr/bin/env node
import { execSync } from 'child_process';

function exec(command) {
  return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function execVisible(command) {
  execSync(command, { stdio: 'inherit' });
}

async function revert() {
  try {
    // Get saved metadata
    let originalBranch;
    let burnBranch;
    let madeWipCommit;

    try {
      originalBranch = exec('git config bonzai.originalBranch');
      burnBranch = exec('git config bonzai.burnBranch');
      madeWipCommit = exec('git config bonzai.madeWipCommit') === 'true';
    } catch {
      console.error('❌ No burn to revert');
      console.error('Run btrim first');
      process.exit(1);
    }

    console.log(`🔙 Reverting burn...`);
    console.log(`   Discarding: ${burnBranch}\n`);

    // Checkout original branch
    execVisible(`git checkout ${originalBranch}`);

    // Delete burn branch
    execVisible(`git branch -D ${burnBranch}`);

    // Undo WIP commit if we made one
    if (madeWipCommit) {
      console.log('↩️  Undoing WIP commit...');
      exec('git reset HEAD~1');
      console.log('✓ Back to uncommitted changes\n');
    }

    // Clean up metadata
    exec('git config --unset bonzai.originalBranch');
    exec('git config --unset bonzai.burnBranch');
    exec('git config --unset bonzai.madeWipCommit');

    console.log(`✓ Burn fully reverted`);
    console.log(`Back on: ${originalBranch}\n`);

  } catch (error) {
    console.error('❌ Revert failed:', error.message);
    process.exit(1);
  }
}

revert();
