const log = require('electron-log');
const path = require('path');
const os = require('os');

log.transports.file.level = 'info';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn';

const safeLog = {
  log: (...args) => {
    try {
      log.info(...args);
    } catch {
      // Silently ignore logging errors (e.g., EPIPE when terminal closed)
    }
  },
  info: (...args) => {
    try {
      log.info(...args);
    } catch {
      // Silently ignore logging errors
    }
  },
  warn: (...args) => {
    try {
      log.warn(...args);
    } catch {
      // Silently ignore logging errors
    }
  },
  error: (...args) => {
    try {
      log.error(...args);
    } catch {
      // Silently ignore logging errors
    }
  },
  debug: (...args) => {
    try {
      log.debug(...args);
    } catch {
      // Silently ignore logging errors
    }
  },
};

const CONSTANTS = {
  UUID_V4_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  TEMP_DIR_PATTERNS: ['-tmp-', '-private-var-folders', '-var-folders-'],

  MIN_SESSION_SIZE: 100,

  DEBOUNCE_MS: 300,
  STABILIZATION_MS: 500,

  CHUNK_SIZE: 102400,

  PAGE_SIZE: 50,

  DEFAULT_ANALYSIS_LIMIT: 20,
  CACHE_DURATION_DAYS: 30,

  ORPHAN_HEALING_INTERVAL: 5 * 60 * 1000,

  SEARCH_CACHE_TTL: 5 * 60 * 1000,
  SEARCH_CACHE_MAX_SIZE: 50,
};

function getPaths(app) {
  const isDev = !app.isPackaged;

  return {
    sessionViewerBinary: isDev
      ? path.join(__dirname, '../../..', 'bin', 'session-viewer')
      : getProductionBinaryPath(),

    sessionViewerData: path.join(os.homedir(), '.universal-session-viewer'),
    claudeProjects: path.join(os.homedir(), '.claude', 'projects'),

    pathParsingLog: path.join(os.homedir(), '.claude-m', 'path-parsing.log'),
  };
}

function getProductionBinaryPath() {
  const platform = process.platform;
  const arch = process.arch;

  let binaryName = 'session-viewer';
  if (platform === 'darwin') {
    binaryName = arch === 'arm64' ? 'session-viewer-darwin-arm64' : 'session-viewer-darwin-amd64';
  } else if (platform === 'linux') {
    binaryName = 'session-viewer-linux-amd64';
  } else if (platform === 'win32') {
    binaryName = 'session-viewer-windows-amd64.exe';
  }

  return path.join(process.resourcesPath, 'bin', binaryName);
}

module.exports = {
  safeLog,
  CONSTANTS,
  getPaths,
  log,
};
