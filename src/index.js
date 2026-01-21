#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'fs';
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

function init() {
  const currentDir = process.cwd();
  const bonzaiPath = join(currentDir, BONZAI_DIR);
  const specsPath = join(bonzaiPath, SPECS_FILE);

  if (existsSync(bonzaiPath)) {
    console.log(`📁 ${BONZAI_DIR}/ already exists`);
    return;
  }

  mkdirSync(bonzaiPath, { recursive: true });
  writeFileSync(specsPath, DEFAULT_SPECS);
  console.log(`📁 Created ${BONZAI_DIR}/ folder with specs.md`);
  console.log(`📝 Edit ${BONZAI_DIR}/specs.md to define your cleanup rules`);
  console.log(`🔥 Run 'btrim' to start a cleanup session`);
}

init();
