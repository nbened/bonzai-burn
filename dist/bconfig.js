#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { ENABLED_LOOPS } from './loops.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template folder in the package
const TEMPLATE_DIR = path.join(__dirname, 'graph-templates');

// Helper function to recursively copy directory
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  const currentDir = process.cwd();
  const bonzaiDir = path.join(currentDir, 'bonzai');
  const receiverPath = path.join(bonzaiDir, 'receiver.js');

  console.log('Setting up local file server...');

  // Create bonzai directory
  if (!fs.existsSync(bonzaiDir)) {
    console.log('Creating bonzai directory...');
    fs.mkdirSync(bonzaiDir);
  }

  // Write receiver.js
  console.log('Writing receiver.js...');
  const receiverContent = fs.readFileSync(path.join(TEMPLATE_DIR, 'receiver.js'), 'utf8');
  fs.writeFileSync(receiverPath, receiverContent);
  fs.chmodSync(receiverPath, '755');

  // Write config.js
  console.log('Writing config.js...');
  const configContent = fs.readFileSync(path.join(TEMPLATE_DIR, 'config.js'), 'utf8');
  fs.writeFileSync(path.join(bonzaiDir, 'config.js'), configContent);

  // Copy handlers from enabled loops
  console.log('Copying handlers...');
  const handlersDest = path.join(bonzaiDir, 'handlers');
  if (!fs.existsSync(handlersDest)) {
    fs.mkdirSync(handlersDest, { recursive: true });
  }

  // Copy visualization loop handlers
  if (ENABLED_LOOPS.includes('visualization')) {
    const vizSrc = path.join(TEMPLATE_DIR, 'loops', 'visualization');
    if (fs.existsSync(vizSrc)) {
      for (const file of fs.readdirSync(vizSrc)) {
        fs.copyFileSync(path.join(vizSrc, file), path.join(handlersDest, file));
      }
    }
  }

  // Copy backend loop handlers
  if (ENABLED_LOOPS.includes('backend')) {
    const backendSrc = path.join(TEMPLATE_DIR, 'loops', 'backend');
    if (fs.existsSync(backendSrc)) {
      for (const file of fs.readdirSync(backendSrc)) {
        fs.copyFileSync(path.join(backendSrc, file), path.join(handlersDest, file));
      }
    }
  }

  // Copy utils directory
  console.log('Copying utils...');
  const utilsSrc = path.join(TEMPLATE_DIR, 'utils');
  const utilsDest = path.join(bonzaiDir, 'utils');
  copyDirectory(utilsSrc, utilsDest);

  // Write .ignore file in bonzai directory
  const ignoreTargetPath = path.join(bonzaiDir, '.ignore');
  if (!fs.existsSync(ignoreTargetPath)) {
    console.log('Writing .ignore file...');
    const ignoreContent = fs.readFileSync(path.join(TEMPLATE_DIR, 'ignore.txt'), 'utf8');
    fs.writeFileSync(ignoreTargetPath, ignoreContent);
  }

  // Setup package.json in bonzai directory
  const packageJsonPath = path.join(bonzaiDir, 'package.json');
  let packageJson = {};

  if (fs.existsSync(packageJsonPath)) {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } else {
    packageJson = {
      name: "bonzai-server",
      version: "1.0.0",
      description: "Dependencies for bonzai graph server",
      main: "receiver.js",
      scripts: {
        test: "echo \"Error: no test specified\" && exit 1"
      },
      author: "",
      license: "ISC"
    };
  }

  // Add dependencies
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  packageJson.dependencies.express = "^4.18.2";
  packageJson.dependencies.cors = "^2.8.5";
  packageJson.dependencies["@babel/parser"] = "^7.23.0";
  packageJson.dependencies.ws = "^8.14.2";
  packageJson.dependencies["node-pty"] = "^1.0.0";

  // Add script to run receiver
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts["file-server"] = "node receiver.js";

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  console.log('Installing dependencies...');

  // Install dependencies in bonzai directory
  return new Promise((resolve, reject) => {
    const npm = spawn('npm', ['install'], {
      stdio: 'inherit',
      cwd: bonzaiDir
    });

    npm.on('close', (code) => {
      if (code === 0) {
        // Fix node-pty spawn-helper permissions (npm doesn't preserve execute bits)
        const nodePtyPrebuilds = path.join(bonzaiDir, 'node_modules', 'node-pty', 'prebuilds');
        if (fs.existsSync(nodePtyPrebuilds)) {
          const archDirs = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64'];
          for (const arch of archDirs) {
            const spawnHelperPath = path.join(nodePtyPrebuilds, arch, 'spawn-helper');
            if (fs.existsSync(spawnHelperPath)) {
              try {
                fs.chmodSync(spawnHelperPath, '755');
                console.log(`Fixed node-pty spawn-helper permissions (${arch})`);
              } catch (e) {
                console.warn(`Warning: Could not fix spawn-helper permissions for ${arch}:`, e.message);
              }
            }
          }
        }

        console.log('\nListener endpoints successfully deployed');
        console.log('All code stays on your machine\n');
        console.log('Relay server running on localhost:3001');
        console.log('Terminal WebSocket available at ws://localhost:3001/terminal');
        console.log('Diagram available at https://bonzai.dev/\n');

        // Start the server automatically
        const server = spawn('node', ['receiver.js'], {
          stdio: 'inherit',
          cwd: bonzaiDir,
          env: {
            ...process.env,
            BONZAI_REPO_DIR: currentDir
          }
        });

        // Open browser automatically
        exec('open https://bonzai.dev/');

        // Handle server process
        server.on('close', (serverCode) => {
          console.log(`\nServer stopped with code ${serverCode}`);
          process.exit(serverCode);
        });

        server.on('error', (err) => {
          console.error('Error starting server:', err.message);
          process.exit(1);
        });

        // Handle cleanup on exit
        process.on('SIGINT', () => {
          console.log('\nShutting down server...');
          server.kill('SIGINT');
        });

        process.on('SIGTERM', () => {
          console.log('\nShutting down server...');
          server.kill('SIGTERM');
        });

        resolve();
      } else {
        reject(new Error('npm install failed with code ' + code));
      }
    });

    npm.on('error', (err) => {
      reject(err);
    });
  });
}

// Export for use via index.js flags
export { main };

// Run directly if called as standalone command
const isDirectRun = process.argv[1]?.endsWith('bconfig.js');
if (isDirectRun) {
  main().catch(console.error);
}
