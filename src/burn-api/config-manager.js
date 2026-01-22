import fs from 'fs';
import path from 'path';
import https from 'https';
import { homedir } from 'os';
import crypto from 'crypto';

const CONFIG_DIR = path.join(homedir(), '.bonzai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const TOKEN_FILE = path.join(CONFIG_DIR, 'token');

const API_BASE = 'https://api.bonzai.dev';

// Default config schema
const DEFAULT_CONFIG = {
  version: '0.0.0',
  rules: {
    maxLinesPerFile: 500,
    requiredFolders: [],
    testPatterns: {
      '.vue': '.test.js',
      '.jsx': '.test.jsx',
      '.tsx': '.test.tsx',
      '.js': '.test.js',
      '.ts': '.test.ts'
    },
    architecturalPatterns: []
  }
};

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Get or create user token
 */
export function getUserToken() {
  ensureConfigDir();

  if (fs.existsSync(TOKEN_FILE)) {
    return fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
  }

  // Generate new token
  const token = crypto.randomUUID();
  fs.writeFileSync(TOKEN_FILE, token);
  return token;
}

/**
 * Load local config
 */
export function loadLocalConfig() {
  ensureConfigDir();

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      // Invalid config, return default
      return { ...DEFAULT_CONFIG };
    }
  }

  return { ...DEFAULT_CONFIG };
}

/**
 * Save config to local file
 */
export function saveLocalConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Make HTTPS request with timeout
 */
function httpsRequest(url, options = {}, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Fetch latest version from API
 */
export async function getLatestVersion() {
  try {
    const response = await httpsRequest(`${API_BASE}/config/version`);

    if (response.status === 200 && response.data?.version) {
      return {
        success: true,
        version: response.data.version
      };
    }

    return {
      success: false,
      error: 'Invalid response from server'
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      offline: true
    };
  }
}

/**
 * Check if config needs update
 * Returns { needsUpdate: boolean, latestVersion?: string, offline?: boolean }
 */
export async function checkConfigVersion() {
  const localConfig = loadLocalConfig();
  const localVersion = localConfig.version || '0.0.0';

  const latestResult = await getLatestVersion();

  if (!latestResult.success) {
    // Offline or API error - use local config but warn
    return {
      needsUpdate: false,
      currentVersion: localVersion,
      offline: latestResult.offline || false,
      error: latestResult.error
    };
  }

  const latestVersion = latestResult.version;

  // Compare versions (simple string comparison works for semver)
  const needsUpdate = compareVersions(localVersion, latestVersion) < 0;

  return {
    needsUpdate,
    currentVersion: localVersion,
    latestVersion,
    offline: false
  };
}

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }

  return 0;
}

/**
 * Poll for config approval status
 */
export async function pollConfigStatus(token, timeout = 300000, interval = 2000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await httpsRequest(`${API_BASE}/config/status?token=${token}`);

      if (response.status === 200 && response.data) {
        if (response.data.approved === true) {
          return {
            approved: true,
            config: response.data.config
          };
        }
      }
    } catch (e) {
      // Network error, continue polling
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return {
    approved: false,
    timedOut: true
  };
}

/**
 * Download and save new config from API
 */
export async function downloadConfig(token) {
  try {
    const response = await httpsRequest(`${API_BASE}/config/download?token=${token}`);

    if (response.status === 200 && response.data) {
      const config = response.data;
      saveLocalConfig(config);
      return {
        success: true,
        config
      };
    }

    return {
      success: false,
      error: 'Failed to download config'
    };
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Get config file path
 */
export function getConfigPath() {
  return CONFIG_FILE;
}

/**
 * Get config directory path
 */
export function getConfigDir() {
  return CONFIG_DIR;
}

export default {
  getUserToken,
  loadLocalConfig,
  saveLocalConfig,
  checkConfigVersion,
  pollConfigStatus,
  downloadConfig,
  getConfigPath,
  getConfigDir
};
