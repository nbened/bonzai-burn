#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ENABLED_LOOPS } from './loops.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BONZAI_DIR = 'bonzai';
const TEMPLATE_DIR = join(__dirname, 'payload-bonzai');

function showHelp() {
  let help = `
Usage: npx bonzai-burn [option]

Options:
  (no option)   Initialize bonzai in current directory
  --help        Show this help message`;

  if (ENABLED_LOOPS.includes('visualization') || ENABLED_LOOPS.includes('backend')) {
    help = help.replace('--help', '-g, --graph   Launch visualization server\n  --help');
  }

  console.log(help);
}

function init() {
  const currentDir = process.cwd();
  const bonzaiPath = join(currentDir, BONZAI_DIR);

  if (existsSync(bonzaiPath)) {
    console.log(`${BONZAI_DIR}/ already exists`);
    return;
  }

  mkdirSync(bonzaiPath, { recursive: true });
  copyFileSync(join(TEMPLATE_DIR, 'config.json'), join(bonzaiPath, 'config.json'));
  console.log(`Created ${BONZAI_DIR}/ folder with config.json`);
  console.log('');
  console.log('  ┌───────────────────────────────────────────────────────┐');
  console.log('  │  npx bonzai-burn -g   Launch visualization server    │');
  console.log('  └───────────────────────────────────────────────────────┘');
}

async function main() {
  const args = process.argv.slice(2);
  const flag = args[0];

  // Visualization/Backend loop (server)
  if (ENABLED_LOOPS.includes('visualization') || ENABLED_LOOPS.includes('backend')) {
    if (flag === '-g' || flag === '--graph') {
      const { main: configMain } = await import('./bconfig.js');
      return configMain?.();
    }
  }

  if (flag === '--help') {
    showHelp();
    return;
  }

  // Default: init
  init();
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
