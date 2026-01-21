#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BONZAI_DIR = 'bonzai';
const TEMPLATE_DIR = join(__dirname, '..', 'payload-bonzai');

function init() {
  const currentDir = process.cwd();
  const bonzaiPath = join(currentDir, BONZAI_DIR);

  if (existsSync(bonzaiPath)) {
    console.log(`📁 ${BONZAI_DIR}/ already exists`);
    return;
  }

  mkdirSync(bonzaiPath, { recursive: true });
  copyFileSync(join(TEMPLATE_DIR, 'specs.md'), join(bonzaiPath, 'specs.md'));
  copyFileSync(join(TEMPLATE_DIR, 'config.json'), join(bonzaiPath, 'config.json'));
  console.log(`📁 Created ${BONZAI_DIR}/ folder with specs.md and config.json`);
  console.log(`📝 Edit ${BONZAI_DIR}/specs.md to define your cleanup rules`);
  console.log(`🔥 Run 'btrim' to start a cleanup session`);
}

init();
