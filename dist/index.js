#!/usr/bin/env node
import fs, { existsSync, mkdirSync, copyFileSync } from 'fs';
import path, { dirname, join } from 'path';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/loops.config.js
var CHANNELS, channel, ENABLED_LOOPS;
var init_loops_config = __esm({
  "src/loops.config.js"() {
    CHANNELS = {
      dev: ["visualization", "backend"],
      staging: ["visualization", "backend"],
      prod: ["visualization", "backend"]
    };
    channel = "prod";
    ENABLED_LOOPS = CHANNELS[channel] || CHANNELS.prod;
  }
});

// src/bconfig.js
var bconfig_exports = {};
__export(bconfig_exports, {
  main: () => main
});
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
  const bonzaiDir = path.join(currentDir, "bonzai");
  const receiverPath = path.join(bonzaiDir, "receiver.js");
  console.log("Setting up local file server...");
  if (!fs.existsSync(bonzaiDir)) {
    console.log("Creating bonzai directory...");
    fs.mkdirSync(bonzaiDir);
  }
  console.log("Writing receiver.js...");
  const receiverContent = fs.readFileSync(path.join(TEMPLATE_DIR, "receiver.js"), "utf8");
  fs.writeFileSync(receiverPath, receiverContent);
  fs.chmodSync(receiverPath, "755");
  console.log("Writing config.js...");
  const configContent = fs.readFileSync(path.join(TEMPLATE_DIR, "config.js"), "utf8");
  fs.writeFileSync(path.join(bonzaiDir, "config.js"), configContent);
  console.log("Copying handlers...");
  const handlersDest = path.join(bonzaiDir, "handlers");
  if (!fs.existsSync(handlersDest)) {
    fs.mkdirSync(handlersDest, { recursive: true });
  }
  if (ENABLED_LOOPS.includes("visualization")) {
    const vizSrc = path.join(TEMPLATE_DIR, "loops", "visualization");
    if (fs.existsSync(vizSrc)) {
      for (const file of fs.readdirSync(vizSrc)) {
        fs.copyFileSync(path.join(vizSrc, file), path.join(handlersDest, file));
      }
    }
  }
  if (ENABLED_LOOPS.includes("backend")) {
    const backendSrc = path.join(TEMPLATE_DIR, "loops", "backend");
    if (fs.existsSync(backendSrc)) {
      for (const file of fs.readdirSync(backendSrc)) {
        fs.copyFileSync(path.join(backendSrc, file), path.join(handlersDest, file));
      }
    }
  }
  console.log("Copying utils...");
  const utilsSrc = path.join(TEMPLATE_DIR, "utils");
  const utilsDest = path.join(bonzaiDir, "utils");
  copyDirectory(utilsSrc, utilsDest);
  const ignoreTargetPath = path.join(bonzaiDir, ".ignore");
  if (!fs.existsSync(ignoreTargetPath)) {
    console.log("Writing .ignore file...");
    const ignoreContent = fs.readFileSync(path.join(TEMPLATE_DIR, "ignore.txt"), "utf8");
    fs.writeFileSync(ignoreTargetPath, ignoreContent);
  }
  const packageJsonPath = path.join(bonzaiDir, "package.json");
  let packageJson = {};
  if (fs.existsSync(packageJsonPath)) {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } else {
    packageJson = {
      name: "bonzai-server",
      version: "1.0.0",
      description: "Dependencies for bonzai graph server",
      main: "receiver.js",
      scripts: {
        test: 'echo "Error: no test specified" && exit 1'
      },
      author: "",
      license: "ISC"
    };
  }
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  packageJson.dependencies.express = "^4.18.2";
  packageJson.dependencies.cors = "^2.8.5";
  packageJson.dependencies["@babel/parser"] = "^7.23.0";
  packageJson.dependencies.ws = "^8.14.2";
  packageJson.dependencies["node-pty"] = "^1.0.0";
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts["file-server"] = "node receiver.js";
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log("Installing dependencies...");
  return new Promise((resolve, reject) => {
    const npm = spawn("npm", ["install"], {
      stdio: "inherit",
      cwd: bonzaiDir
    });
    npm.on("close", (code) => {
      if (code === 0) {
        const nodePtyPrebuilds = path.join(bonzaiDir, "node_modules", "node-pty", "prebuilds");
        if (fs.existsSync(nodePtyPrebuilds)) {
          const archDirs = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64"];
          for (const arch of archDirs) {
            const spawnHelperPath = path.join(nodePtyPrebuilds, arch, "spawn-helper");
            if (fs.existsSync(spawnHelperPath)) {
              try {
                fs.chmodSync(spawnHelperPath, "755");
                console.log(`Fixed node-pty spawn-helper permissions (${arch})`);
              } catch (e) {
                console.warn(`Warning: Could not fix spawn-helper permissions for ${arch}:`, e.message);
              }
            }
          }
        }
        console.log("\nListener endpoints successfully deployed");
        console.log("All code stays on your machine\n");
        console.log("Relay server running on localhost:3001");
        console.log("Terminal WebSocket available at ws://localhost:3001/terminal");
        console.log("Diagram available at https://bonzai.dev/visualize\n");
        const server = spawn("node", ["receiver.js"], {
          stdio: "inherit",
          cwd: bonzaiDir,
          env: {
            ...process.env,
            BONZAI_REPO_DIR: currentDir
          }
        });
        exec("open https://bonzai.dev/visualize");
        server.on("close", (serverCode) => {
          console.log(`
Server stopped with code ${serverCode}`);
          process.exit(serverCode);
        });
        server.on("error", (err) => {
          console.error("Error starting server:", err.message);
          process.exit(1);
        });
        process.on("SIGINT", () => {
          console.log("\nShutting down server...");
          server.kill("SIGINT");
        });
        process.on("SIGTERM", () => {
          console.log("\nShutting down server...");
          server.kill("SIGTERM");
        });
        resolve();
      } else {
        reject(new Error("npm install failed with code " + code));
      }
    });
    npm.on("error", (err) => {
      reject(err);
    });
  });
}
var __filename$1, __dirname$1, TEMPLATE_DIR, _a, isDirectRun;
var init_bconfig = __esm({
  "src/bconfig.js"() {
    init_loops_config();
    __filename$1 = fileURLToPath(import.meta.url);
    __dirname$1 = path.dirname(__filename$1);
    TEMPLATE_DIR = path.join(__dirname$1, "graph-templates");
    isDirectRun = (_a = process.argv[1]) == null ? void 0 : _a.endsWith("bconfig.js");
    if (isDirectRun) {
      main().catch(console.error);
    }
  }
});

// src/index.js
init_loops_config();
var __filename2 = fileURLToPath(import.meta.url);
var __dirname2 = dirname(__filename2);
var BONZAI_DIR = "bonzai";
var TEMPLATE_DIR2 = join(__dirname2, "payload-bonzai");
function showHelp() {
  let help = `
Usage: npx bonzai-burn [option]

Options:
  (no option)   Initialize bonzai in current directory
  --help        Show this help message`;
  if (ENABLED_LOOPS.includes("visualization") || ENABLED_LOOPS.includes("backend")) {
    help = help.replace("--help", "-g, --graph   Launch visualization server\n  --help");
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
  copyFileSync(join(TEMPLATE_DIR2, "config.json"), join(bonzaiPath, "config.json"));
  console.log(`Created ${BONZAI_DIR}/ folder with config.json`);
  console.log("");
  console.log("  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  console.log("  \u2502  npx bonzai-burn -g   Launch visualization server    \u2502");
  console.log("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
}
async function main2() {
  const args = process.argv.slice(2);
  const flag = args[0];
  if (ENABLED_LOOPS.includes("visualization") || ENABLED_LOOPS.includes("backend")) {
    if (flag === "-g" || flag === "--graph") {
      const { main: configMain } = await Promise.resolve().then(() => (init_bconfig(), bconfig_exports));
      return configMain == null ? void 0 : configMain();
    }
  }
  if (flag === "--help") {
    showHelp();
    return;
  }
  init();
}
main2().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
