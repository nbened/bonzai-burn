#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template folder in the package
const TEMPLATE_DIR = path.join(__dirname, '..', 'payload-bonzai', 'graph-templates');

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

  // Copy handlers directory
  console.log('Copying handlers...');
  const handlersSrc = path.join(TEMPLATE_DIR, 'handlers');
  const handlersDest = path.join(bonzaiDir, 'handlers');
  copyDirectory(handlersSrc, handlersDest);

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
        console.log('\nListener endpoints successfully deployed');
        console.log('All code stays on your machine\n');
        console.log('Relay server running on localhost:3001');
        console.log('Diagram available at https://bonzai.dev/\n');

        // Start the server automatically
        const server = spawn('node', ['receiver.js'], {
          stdio: 'inherit',
          cwd: bonzaiDir
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

main().catch(console.error);
