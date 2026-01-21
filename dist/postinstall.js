#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const BONZAI_DIR = 'bonzai';
const SPECS_FILE = 'specs.md';
const DEFAULT_SPECS = `# Bonzai Specs

Define your cleanup requirements below. btrim will follow these instructions.

## Example:
- Remove unused imports
- Delete files matching pattern "*.tmp"
- Clean up console.log statements
`;
function findProjectRoot() {
    // npm sets INIT_CWD to the directory where npm was invoked
    const initCwd = process.env.INIT_CWD;
    if (initCwd && (0, fs_1.existsSync)((0, path_1.join)(initCwd, 'package.json'))) {
        return initCwd;
    }
    // Fallback: try to find project root from cwd
    let current = process.cwd();
    // If we're in node_modules, go up to find project root
    if (current.includes('node_modules')) {
        const nodeModulesIndex = current.lastIndexOf('node_modules');
        const projectRoot = current.substring(0, nodeModulesIndex - 1);
        if ((0, fs_1.existsSync)((0, path_1.join)(projectRoot, 'package.json'))) {
            return projectRoot;
        }
    }
    return null;
}
function postinstall() {
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
        // Silently exit if we can't find project root (e.g., global install)
        return;
    }
    const bonzaiPath = (0, path_1.join)(projectRoot, BONZAI_DIR);
    const specsPath = (0, path_1.join)(bonzaiPath, SPECS_FILE);
    // Don't overwrite existing setup
    if ((0, fs_1.existsSync)(bonzaiPath)) {
        return;
    }
    try {
        (0, fs_1.mkdirSync)(bonzaiPath, { recursive: true });
        (0, fs_1.writeFileSync)(specsPath, DEFAULT_SPECS);
        console.log(`\n📁 Created ${BONZAI_DIR}/ folder with specs.md`);
        console.log(`📝 Edit ${BONZAI_DIR}/specs.md to define your cleanup rules`);
        console.log(`🔥 Run 'btrim' to start a cleanup session\n`);
    }
    catch (error) {
        // Silently fail - don't break the install
    }
}
postinstall();
