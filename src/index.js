#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BONZAI_DIR = 'bonzai';
const TEMPLATE_DIR = join(__dirname, '..', 'payload-bonzai');

function showHelp() {
  console.log(`
🌳 Bonzai Burn - Code Analysis Tool

Usage: npx bonzai-burn [option]

Options:
  (no option)   Initialize bonzai in current directory
  -b, --burn    Run code analysis (bburn)
  -c, --config  Launch visualization server (bconfig)
  -h, --hook    Manage Claude Code stop hook (bhook)
  --help        Show this help message

Hook subcommands (-h):
  -h            Install hook (default)
  -h -i         Install hook
  -h -s         Show hook status
  -h -u         Uninstall hook

Examples:
  npx bonzai-burn          # Initialize bonzai folder
  npx bonzai-burn -b       # Run burn analysis
  npx bonzai-burn -c       # Start graph server
  npx bonzai-burn -h       # Install hook
  npx bonzai-burn -h -s    # Check hook status
`);
}

function init() {
  const currentDir = process.cwd();
  const bonzaiPath = join(currentDir, BONZAI_DIR);

  if (existsSync(bonzaiPath)) {
    console.log(`📁 ${BONZAI_DIR}/ already exists`);
    return;
  }

  mkdirSync(bonzaiPath, { recursive: true });
  copyFileSync(join(TEMPLATE_DIR, 'config.json'), join(bonzaiPath, 'config.json'));
  console.log(`📁 Created ${BONZAI_DIR}/ folder with config.json`);
  console.log(`📝 Edit ${BONZAI_DIR}/config.json to configure your burn rules`);
  console.log(`🔥 Run 'npx bonzai-burn -b' to analyze your codebase`);
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                                                             │');
  console.log('│   🌳 Run `npx bonzai-burn -c` to visualize your codebase    │');
  console.log('│                                                             │');
  console.log('└─────────────────────────────────────────────────────────────┘');
}

async function main() {
  const args = process.argv.slice(2);
  const flag = args[0];

  switch (flag) {
    case '-b':
    case '--burn': {
      const { main: burnMain } = await import('./bburn.js');
      if (burnMain) await burnMain();
      break;
    }
    case '-c':
    case '--config': {
      const { main: configMain } = await import('./bconfig.js');
      if (configMain) await configMain();
      break;
    }
    case '-h':
    case '--hook': {
      const { main: hookMain } = await import('./bhook.js');
      // Pass remaining args as subcommands (e.g., -h -s → ['-s'])
      const subArgs = args.slice(1);
      if (hookMain) await hookMain(subArgs);
      break;
    }
    case '--help':
      showHelp();
      break;
    default:
      init();
      break;
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
