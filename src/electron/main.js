const fs = require('fs');
const path = require('path');

const { app, BrowserWindow, ipcMain, dialog } = require('electron');

const fsPromises = require('fs').promises;
const os = require('os');

// Database imported via ./database module
// spawn imported when needed for child processes

const chokidar = require('chokidar');
const log = require('electron-log');

const DirectoryTree = require('./directory-tree');
const {
  ErrorSeverity,
  ErrorCode,
  AppError,
  errorBuffer,
  setMainWindow,
  setSafeLog,
  reportErrorToRenderer,
  setupGlobalErrorHandlers,
  setupErrorIPC,
} = require('./error-handler');
const { initializeMenu } = require('./menu');
const { createTray, destroyTray } = require('./tray');
// Continuation detection imported when needed

// Phase 3: Import ContinuationChainService (extracted domain service)
const { ContinuationChainService } = require('./services/ContinuationChainService');
// Phase 4: Import AnalysisService (extracted analysis domain)
const { AnalysisService } = require('./services/AnalysisService');

// Phase 1: Import Database modules (extracted from inline code)
const { initializeConnection, closeConnection } = require('./database');
const { initializeSchema } = require('./database/schema');
const {
  loadSettings: loadSettingsFromDb,
  getSetting: getSettingFromDb,
  saveSetting: saveSettingToDb,
  saveAllSettings: saveAllSettingsToDb,
} = require('./database/settings');
const {
  checkDailyQuota: checkQuotaFromDb,
  incrementQuota: incrementQuotaFromDb,
  getQuotaStats: getQuotaStatsFromDb,
} = require('./database/quota');

// Phase 2: Utils modules (pure functions extracted from SessionViewerApp class)
const { expandPath } = require('./utils/security');

const { extractTextContent, extractTitleFromSummary } = require('./utils/parsing');

const { fallbackPathResolution } = require('./utils/helpers');

// Import error handling infrastructure

// Import electron-log for safe logging (prevents EPIPE errors when terminal is closed)
// Main process logging configuration using electron-log

// Configure electron-log
// Logs are written to: ~/Library/Logs/universal-session-viewer-v2/main.log (macOS)
log.transports.file.level = 'info';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn';

/**
 * Safe logging wrapper that prevents EPIPE errors
 *
 * Root Cause: EPIPE occurs when writing to stdout/stderr after the pipe is closed.
 * This happens when:
 *   1. User closes the terminal that launched the Electron app
 *   2. App runs via Finder/Spotlight (no terminal connection)
 *   3. App is shutting down and console streams are no longer writable
 *
 * Solution: Use electron-log which writes to files instead of stdout/stderr.
 * Additionally, wrap any console calls in try-catch as a safety net.
 */
const safeLog = {
  log: (...args) => {
    try {
      log.info(...args);
    } catch (error) {
      // Silently ignore logging errors - we can't log about logging failures
    }
  },
  warn: (...args) => {
    try {
      log.warn(...args);
    } catch (error) {
      // Silently ignore
    }
  },
  error: (...args) => {
    try {
      log.error(...args);
    } catch (error) {
      // Silently ignore
    }
  },
  debug: (...args) => {
    try {
      log.debug(...args);
    } catch (error) {
      // Silently ignore
    }
  },
};

// Set safeLog reference in error handler for consistent logging
setSafeLog(safeLog);

// ==========================================================================
// Terminal Launch Command Templates
// Configurable terminal application support for resume-session and open-sessions-tmux4
// ==========================================================================

// Terminal launch command templates (per specification)
// NOTE: Ghostty on Linux uses -e flag for executing commands
// See: https://man.archlinux.org/man/ghostty.1
// macOS Ghostty must be launched via 'open -a' since CLI launching is not fully supported
const TERMINAL_LAUNCH_COMMANDS = {
  // macOS default
  'Terminal.app': {
    direct: (scriptPath) => ['open', ['-a', 'Terminal.app', scriptPath]],
    available: () => process.platform === 'darwin',
  },

  // Linux default
  'gnome-terminal': {
    direct: (scriptPath) => ['gnome-terminal', ['--', 'bash', scriptPath]],
    available: () => {
      try {
        require('child_process').execSync('which gnome-terminal', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    },
  },

  // Ghostty (macOS/Linux)
  // On macOS: Must use 'open -a Ghostty' as CLI launching is limited
  // On Linux: Use 'ghostty -e bash <script>' to execute the script
  Ghostty: {
    direct: (scriptPath) => {
      if (process.platform === 'darwin') {
        // macOS: Launch via 'open -a' - Ghostty will execute the script
        return ['open', ['-a', 'Ghostty', scriptPath]];
      }
      // Linux: Use -e flag to execute bash with the script
      // Note: Ghostty -e takes the command directly, not a shell wrapper
      return ['ghostty', ['-e', 'bash', scriptPath]];
    },
    available: () => {
      try {
        if (process.platform === 'darwin') {
          return fs.existsSync('/Applications/Ghostty.app');
        }
        require('child_process').execSync('which ghostty', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    },
  },
};

// Get terminal settings from database with defaults
function _getTerminalSettings(db) {
  const DEFAULT_TERMINAL = {
    application: process.platform === 'darwin' ? 'Terminal.app' : 'gnome-terminal',
    useTmux: false,
    tmuxSessionPrefix: 'claude-',
    customLaunchCommand: undefined,
  };

  if (!db) return DEFAULT_TERMINAL;

  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('terminal');
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      return { ...DEFAULT_TERMINAL, ...parsed };
    }
  } catch (error) {
    safeLog.error('Error reading terminal settings:', error);
  }

  return DEFAULT_TERMINAL;
}

// Launch terminal with the given script
function _launchTerminal(scriptPath, terminalSettings) {
  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    let cmd, args;

    if (terminalSettings.application === 'custom') {
      // Custom command with {cmd} placeholder
      if (!terminalSettings.customLaunchCommand) {
        return reject(new Error('Custom terminal selected but no command configured'));
      }

      // Replace {cmd} with the script path
      const fullCmd = terminalSettings.customLaunchCommand.replace('{cmd}', `bash "${scriptPath}"`);
      // Execute via shell
      cmd = '/bin/sh';
      args = ['-c', fullCmd];
    } else {
      const launcher = TERMINAL_LAUNCH_COMMANDS[terminalSettings.application];
      if (!launcher) {
        return reject(new Error(`Unknown terminal: ${terminalSettings.application}`));
      }

      if (!launcher.available()) {
        return reject(
          new Error(`Terminal ${terminalSettings.application} is not available on this system`)
        );
      }

      [cmd, args] = launcher.direct(scriptPath);
    }

    safeLog.log(`Launching terminal: ${cmd} ${args.join(' ')}`);

    const terminal = spawn(cmd, args);

    terminal.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Terminal exited with code ${code}`));
      }
    });

    terminal.on('error', (error) => {
      reject(error);
    });
  });
}

// ==========================================================================
// End Terminal Launch Command Templates
// ==========================================================================

// Create a write stream for logging path parsing activity
const homeDir = os.homedir();
const logDir = path.join(homeDir, '.claude-m');
const pathParsingLog = fs.createWriteStream(path.join(logDir, 'path-parsing.log'), { flags: 'a' });

function logPathParsing(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  pathParsingLog.write(logMessage);
  // Removed console.log - path parsing details logged to file only
}

/**
 * Get the path to the session-viewer binary.
 * Handles both development and production environments.
 */
function _getSessionViewerPath() {
  const isDev = !app.isPackaged;

  if (isDev) {
    // Development: Use binary from bin/
    return path.join(__dirname, '..', '..', 'bin', 'session-viewer');
  } else {
    // Production: Use binary from app resources
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
}

class SessionViewerApp {
  constructor() {
    this.mainWindow = null;
    this.claudeEnginePath = path.join(__dirname, '../../..', 'claude-m-engine');
    this.sessions = [];
    this.analysisQueue = [];
    this.isAnalyzing = false;
    this.db = null;
    this.dbPath = process.env.CLAUDE_M_DB_PATH || null; // Allow custom database path
    this.pathCache = new Map(); // Cache for resolved paths
    this.filesystemTree = null; // DirectoryTree instance
    this.treeBuilding = null; // Promise to prevent concurrent builds

    // Process lifecycle management - prevents orphaned processes on app exit
    this.childProcesses = new Set(); // Track all spawned child processes
    this.activeAnalyses = new Map(); // Track analysis processes by session ID

    // Settings management
    this.settings = null; // Loaded from database

    // Run orphan healing every 5 minutes
    this.orphanHealingInterval = setInterval(
      () => {
        this.healOrphanedContinuations();
      },
      5 * 60 * 1000
    );

    safeLog.log('SessionViewerApp constructor completed');
    if (this.dbPath) {
      safeLog.log(`Using custom database path: ${this.dbPath}`);
    }
  }

  /**
   * Debug logging - only outputs when enableDebugLogging setting is true
   * Uses safeLog to prevent EPIPE errors when stdout is broken
   */
  debugLog(...args) {
    if (this.getSetting('enableDebugLogging', false)) {
      safeLog.debug(...args);
    }
  }

  /**
   * Standard logging - always outputs important messages
   * Uses safeLog to prevent EPIPE errors when stdout is broken
   */
  log(...args) {
    safeLog.log(...args);
  }

  // ==========================================================================
  // Path Expansion and Resolution Helpers
  // Per Implementation Plan: Section 2.3.2
  // NOTE: expandPath() moved to utils/security.js (Phase 2 extraction)
  // ==========================================================================

  /**
   * Get the effective Claude projects directory from settings.
   * Falls back to default if setting is invalid or not set.
   */
  getClaudeProjectsDir() {
    const settings = this.getAllSettings();
    const configuredPath = settings.paths?.claudeProjects;

    if (configuredPath) {
      const expanded = expandPath(configuredPath);
      try {
        if (fs.existsSync(expanded) && fs.statSync(expanded).isDirectory()) {
          return expanded;
        }
      } catch (error) {
        this.debugLog(`Invalid claudeProjects path: ${expanded} - ${error.message}`);
      }
    }

    // Fallback to default
    return path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * Get the effective session viewer data directory from settings.
   */
  getSessionViewerDataDir() {
    const settings = this.getAllSettings();
    const configuredPath = settings.paths?.sessionViewerData;

    if (configuredPath) {
      const expanded = expandPath(configuredPath);
      try {
        // Create directory if it doesn't exist
        if (!fs.existsSync(expanded)) {
          fs.mkdirSync(expanded, { recursive: true });
        }
        return expanded;
      } catch (error) {
        this.debugLog(`Invalid sessionViewerData path: ${expanded} - ${error.message}`);
      }
    }

    // Fallback to default
    return path.join(os.homedir(), '.universal-session-viewer');
  }

  /**
   * Get the effective prompts directory from settings.
   */
  getPromptsDir() {
    const settings = this.getAllSettings();
    const configuredPath = settings.paths?.promptsDirectory;

    if (configuredPath) {
      const expanded = expandPath(configuredPath);
      try {
        if (fs.existsSync(expanded) && fs.statSync(expanded).isDirectory()) {
          return expanded;
        }
      } catch (error) {
        this.debugLog(`Invalid promptsDirectory path: ${expanded} - ${error.message}`);
      }
    }

    // Fallback to default (keep legacy path for backward compatibility)
    return path.join(os.homedir(), '.claude-m', 'state', 'prompts');
  }

  /**
   * Resolve symlinks in a path for proper duplicate detection.
   */
  resolveSymlinks(inputPath) {
    try {
      const expanded = expandPath(inputPath);
      return fs.realpathSync(expanded);
    } catch {
      // If resolution fails (path doesn't exist yet), return the expanded path
      return expandPath(inputPath);
    }
  }

  /**
   * Get all discovery paths (claudeProjects + additionalDiscoveryPaths).
   * Filters out invalid paths, removes duplicates, and handles symlinks.
   *
   * SYMLINK HANDLING: Uses fs.realpathSync() to resolve symlinks before
   * adding to the Set, preventing duplicate discovery when symlinks point
   * to the same physical directory.
   */
  getAllDiscoveryPaths() {
    const settings = this.getAllSettings();
    const resolvedPaths = new Set(); // Use resolved paths for dedup
    const resultPaths = []; // Store original paths for return

    // Add primary claude projects dir
    const primaryPath = this.getClaudeProjectsDir();
    const resolvedPrimary = this.resolveSymlinks(primaryPath);

    // Validate excludePaths don't exclude the primary path entirely
    if (this.shouldExcludePath(primaryPath)) {
      this.debugLog(
        `WARNING: excludePaths would exclude primary claudeProjects path: ${primaryPath}`
      );
      // Emit warning to renderer
      this.safeSend('path-warning', {
        path: 'excludePaths',
        message:
          'Warning: excludePaths includes primary projects directory. No sessions will be discovered.',
        severity: 'warning',
      });
    }

    resolvedPaths.add(resolvedPrimary);
    resultPaths.push(primaryPath);

    // Add additional discovery paths
    const additionalPaths = settings.paths?.additionalDiscoveryPaths || [];
    for (const additionalPath of additionalPaths) {
      if (!additionalPath) continue;

      const expanded = expandPath(additionalPath);
      try {
        if (!fs.existsSync(expanded)) {
          this.debugLog(`Skipping non-existent additional path: ${expanded}`);
          continue;
        }

        if (!fs.statSync(expanded).isDirectory()) {
          this.debugLog(`Skipping non-directory additional path: ${expanded}`);
          continue;
        }

        // Resolve symlinks for duplicate detection
        const resolved = this.resolveSymlinks(expanded);

        if (resolvedPaths.has(resolved)) {
          this.debugLog(`Skipping duplicate (via symlink): ${expanded} -> ${resolved}`);
          continue;
        }

        resolvedPaths.add(resolved);
        resultPaths.push(expanded);
      } catch (error) {
        this.debugLog(`Error checking additional path ${expanded}: ${error.message}`);
      }
    }

    return resultPaths;
  }

  /**
   * Check if a path should be excluded from discovery.
   */
  shouldExcludePath(testPath) {
    const settings = this.getAllSettings();
    const excludePaths = settings.paths?.excludePaths || [];

    for (const excludePattern of excludePaths) {
      if (!excludePattern) continue;

      const expandedExclude = expandPath(excludePattern);

      // Exact match
      if (testPath === expandedExclude) {
        return true;
      }

      // Parent directory exclusion
      if (testPath.startsWith(expandedExclude + path.sep)) {
        return true;
      }

      // Basic glob: trailing /* or /**
      if (excludePattern.endsWith('/*') || excludePattern.endsWith('/**')) {
        const basePath = expandPath(excludePattern.replace(/\/\*+$/, ''));
        if (testPath.startsWith(basePath + path.sep)) {
          return true;
        }
      }
    }

    return false;
  }

  // ==========================================================================
  // End Path Expansion and Resolution Helpers
  // ==========================================================================

  /**
   * Safe webContents send - prevents "Object has been destroyed" errors
   * Wraps webContents.send() calls with proper error handling
   */
  safeSend(channel, ...args) {
    try {
      if (
        this.mainWindow &&
        this.mainWindow.webContents &&
        !this.mainWindow.webContents.isDestroyed()
      ) {
        this.mainWindow.webContents.send(channel, ...args);
        return true;
      }
      return false;
    } catch (error) {
      // Silently handle destroyed webContents - this is expected during shutdown
      if (!error.message.includes('Object has been destroyed')) {
        safeLog.warn(`Error sending to ${channel}:`, error.message);
      }
      return false;
    }
  }

  async ensureFilesystemTree() {
    if (this.filesystemTree) {
      return this.filesystemTree;
    }

    if (this.treeBuilding) {
      return await this.treeBuilding;
    }

    this.debugLog('Building filesystem tree for fast path resolution...');
    this.treeBuilding = this.buildFilesystemTree();
    this.filesystemTree = await this.treeBuilding;
    this.treeBuilding = null;

    return this.filesystemTree;
  }

  async buildFilesystemTree() {
    const startTime = Date.now();
    const tree = new DirectoryTree();

    // Build the full system tree from /Users - this includes all user directories
    // No mocking, no hardcoded paths - just scan the actual system
    const roots = [
      '/Users', // Build from the actual Users directory
    ];

    for (const root of roots) {
      await tree.buildFrom(root, {
        maxDepth: 5, // Limit recursion depth
        skipHidden: false, // Include other hidden dirs but .claude will be filtered out
        skipPatterns: ['.git', 'node_modules', '.Trash'], // Skip these
      });
    }

    const endTime = Date.now();
    logPathParsing(
      `Built filesystem tree from ${roots.join(', ')} in ${endTime - startTime}ms with ${tree.size()} directories`
    );

    return tree;
  }

  async initializeDatabase() {
    try {
      this.db = initializeConnection(this.dbPath);

      await initializeSchema(this.db, this);

      // Check if continuation migration needed
      try {
        const continuationsPopulated = this.db
          .prepare(
            `
          SELECT COUNT(*) as count FROM session_continuations
        `
          )
          .get();

        // If table exists but is empty, and we have sessions, run migration
        if (continuationsPopulated.count === 0) {
          const sessionCount = this.db
            .prepare(
              `
            SELECT COUNT(*) as count FROM session_metadata
          `
            )
            .get();

          if (sessionCount.count > 0) {
            this.debugLog(
              'Session continuations table is empty but sessions exist - migration may be needed'
            );
            // Migration will be triggered separately via IPC or on-demand
          }
        } else {
          this.debugLog(`Session continuations table has ${continuationsPopulated.count} entries`);
        }
      } catch (continuationError) {
        safeLog.warn('Continuation check warning:', continuationError.message);
      }

      // Phase 3: Instantiate ContinuationChainService after database is ready
      this.continuationService = new ContinuationChainService(
        this.db,
        this.safeSend.bind(this),
        this.debugLog.bind(this)
      );
      this.debugLog('ContinuationChainService initialized');

      // Phase 4: Instantiate AnalysisService after database is ready
      this.analysisService = new AnalysisService(
        this.db,
        this.getSetting.bind(this), // Pass getSetting as bound function
        this.childProcesses, // Set for tracking child processes
        this.activeAnalyses, // Map for tracking active analyses
        this.debugLog.bind(this) // Pass debugLog as bound function
      );
      this.debugLog('AnalysisService initialized');
      this.debugLog('Database initialized successfully');
    } catch (error) {
      safeLog.error('Error initializing database:', error);
    }
  }

  closeDatabase() {
    // Phase 1: Use database module for closing connection
    closeConnection(this.db);
    this.db = null;
  }

  // NOTE: getDefaultSettings() moved to database/settings.js (Phase 1 extraction)
  // NOTE: escapeForShell() moved to utils/security.js (Phase 2 extraction)

  /**
   * Builds a Claude CLI command string with configured options.
   * @param {Object} options - Command options
   * @param {string} options.sessionId - Session ID for --resume (optional)
   * @param {string} options.promptFile - Prompt file for --append-system-prompt (optional)
   * @param {Object} claudeCodeSettings - Claude Code settings from app settings (optional)
   * @returns {string} The constructed command string
   */
  /**
   * Build Claude CLI command with settings and options
   * Phase 4: Delegate to AnalysisService
   * @param {string} sessionId - Session ID to resume
   * @param {string|null} promptFile - Optional prompt file path
   * @returns {Array<string>} Command array for spawn
   */
  buildClaudeCommand(sessionId, promptFile = null) {
    return this.analysisService.buildClaudeCommand(sessionId, promptFile);
  }

  /**
   * Gets a setting value with fallback to default
   * @param {string} key - Setting key (supports dot notation for nested)
   * @param {*} defaultValue - Default value if not found
   * @returns {*} The setting value or default
   */
  // =========================================================================
  // Settings Management Methods

  // =========================================================================

  getSetting(key, defaultValue = undefined) {
    return getSettingFromDb(this.settings, key, defaultValue);
  }

  loadSettings() {
    this.settings = loadSettingsFromDb(this.db);
  }

  saveSetting(key, value) {
    saveSettingToDb(this.db, key, value);
    this.settings[key] = value;
  }

  saveAllSettings(settings) {
    saveAllSettingsToDb(this.db, settings);
    this.settings = { ...this.settings, ...settings };
  }

  getAllSettings() {
    if (!this.settings) {
      this.loadSettings();
    }
    return { ...this.settings };
  }

  // =========================================================================
  // Daily Quota Tracking Methods

  // =========================================================================

  checkDailyQuota() {
    const dailyLimit = this.getSetting('dailyAnalysisLimit', 20);
    return checkQuotaFromDb(this.db, dailyLimit);
  }

  incrementQuota(success = true, isRetry = false) {
    return incrementQuotaFromDb(this.db, success, isRetry);
  }

  getQuotaStats(days = 7) {
    return getQuotaStatsFromDb(this.db, days);
  }
  /**
   * Get sessions that need analysis on startup.
   * Returns most recent sessions that are either:
   * 1. Never analyzed (is_analyzed = 0)
   * 2. Modified since last analysis (file_modified_time > analysis_timestamp)
   *
   * Respects daily quota limit.
   */
  getSessionsToAnalyze() {
    if (!this.db) {
      return [];
    }

    // Check quota first
    const quota = this.checkDailyQuota();
    if (!quota.allowed) {
      this.log(`Skipping analysis: ${quota.message}`);
      return [];
    }

    const remainingQuota = quota.limit - quota.current;
    if (remainingQuota <= 0) {
      return [];
    }

    try {
      // Query for sessions needing analysis:
      // - Valid and non-empty sessions
      // - Either never analyzed OR modified since last analysis
      // - Ordered by most recent activity first
      // - Limited to remaining daily quota
      const stmt = this.db.prepare(`
        SELECT
          sm.session_id as id,
          sm.project_name as project,
          sm.project_path as projectPath,
          sm.file_path as filePath,
          sm.file_name as fileName,
          sm.file_modified_time as modified,
          sm.file_size as size,
          sm.is_analyzed as isAnalyzed,
          sac.analysis_timestamp as analysisTimestamp
        FROM session_metadata sm
        LEFT JOIN session_analysis_cache sac ON sm.session_id = sac.session_id
        WHERE sm.is_valid = 1
          AND sm.is_empty = 0
          AND (
            sm.is_analyzed = 0
            OR (sac.analysis_timestamp IS NOT NULL
                AND sm.file_modified_time > sac.analysis_timestamp)
          )
        ORDER BY sm.last_message_time DESC
        LIMIT ?
      `);

      const sessions = stmt.all(remainingQuota);

      if (sessions.length > 0) {
        const neverAnalyzed = sessions.filter((s) => !s.isAnalyzed).length;
        const needsReanalysis = sessions.length - neverAnalyzed;
        this.log(
          `Found ${sessions.length} sessions to analyze: ${neverAnalyzed} new, ${needsReanalysis} modified`
        );
      }

      return sessions;
    } catch (error) {
      safeLog.error('Error getting sessions to analyze:', error);
      return [];
    }
  }

  async createWindow() {
    this.debugLog('Creating window...');

    // Try to make the app more obvious - only if app is available (not in test environment)
    try {
      const { app } = require('electron');
      if (app && app.dock) {
        app.dock.show(); // Make sure the app shows in the dock
      }
    } catch (error) {
      // Ignore dock errors in test environment
      this.debugLog('Dock not available (likely test environment)');
    }

    try {
      this.mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js'),
        },
        title: 'Universal Claude Session Viewer',
        show: true, // Show immediately
        fullscreen: false,
        skipTaskbar: false, // Show in taskbar/dock
        opacity: 1.0, // Fully opaque
      });

      this.debugLog('BrowserWindow created successfully');

      // Dev/prod detection - V2 Pattern: Load from Vite dev server or built files
      // E2E Test Fix: Force production mode when E2E_TEST_MODE is set
      const isDev = !app.isPackaged && !process.env.E2E_TEST_MODE;

      if (isDev) {
        this.debugLog('Development mode - Opening DevTools...');
        this.mainWindow.webContents.openDevTools({ mode: 'detach' });

        this.debugLog('Loading from Vite dev server...');
        await this.mainWindow.loadURL('http://localhost:5173');
      } else {
        this.debugLog('Production mode - Loading built files...');
        await this.mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
      }
      this.debugLog('App loaded, window should be visible');

      // Force window to be visible and focused
      this.mainWindow.show();
      this.mainWindow.focus();
      this.mainWindow.center(); // Center on screen

      // Flash the dock icon to get attention - only if available
      try {
        const { app } = require('electron');
        if (app && app.dock) {
          app.dock.bounce();
        }
      } catch (error) {
        this.debugLog('Dock bounce not available (likely test environment)');
      }

      // Session analysis will start when renderer signals it's ready
      // (via IPC handshake to avoid race conditions)
    } catch (error) {
      safeLog.error('Error creating window:', error);
      safeLog.error('Error stack:', error.stack);
    }
  }

  // Extract metadata from a session without using LLM
  async extractSessionMetadata(session) {
    try {
      const content = await fs.promises.readFile(session.filePath, 'utf8');
      const lines = content.trim().split('\n');

      let messageCount = 0;
      let firstTimestamp = null;
      let lastTimestamp = null;
      let hasValidMessages = false;

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'user' || parsed.type === 'assistant') {
            messageCount++;
            hasValidMessages = true;

            const ts = parsed.timestamp;
            if (ts) {
              if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
              if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;
            }
          }
        } catch (parseError) {
          continue;
        }
      }

      const duration =
        firstTimestamp && lastTimestamp ? Math.floor((lastTimestamp - firstTimestamp) / 1000) : 0;

      return {
        messageCount,
        firstMessageTime: firstTimestamp,
        lastMessageTime: lastTimestamp,
        duration,
        isValid: lines.length > 0,
        isEmpty: !hasValidMessages,
      };
    } catch (error) {
      return {
        messageCount: 0,
        firstMessageTime: null,
        lastMessageTime: null,
        duration: 0,
        isValid: false,
        isEmpty: true,
      };
    }
  }

  // Populate metadata for a session (for ongoing sync)
  // IMPORTANT: Uses separate INSERT/UPDATE to avoid triggering cache invalidation
  // INSERT OR REPLACE fires DELETE trigger which wipes continuation_chain_cache
  async populateSessionMetadata(session) {
    if (!this.db) return;

    try {
      const metadata = await this.extractSessionMetadata(session);
      const analyzed = this.db
        .prepare(
          `
        SELECT 1 FROM session_analysis_cache WHERE session_id = ?
      `
        )
        .get(session.id);

      // Check if session already exists
      const existing = this.db
        .prepare(
          `
        SELECT 1 FROM session_metadata WHERE session_id = ?
      `
        )
        .get(session.id);

      if (existing) {
        // UPDATE existing row - does NOT fire DELETE trigger, preserves cache
        const updateStmt = this.db.prepare(`
          UPDATE session_metadata SET
            project_name = ?,
            project_path = ?,
            file_path = ?,
            file_name = ?,
            file_size = ?,
            file_modified_time = ?,
            message_count = ?,
            first_message_time = ?,
            last_message_time = ?,
            session_duration_seconds = ?,
            is_analyzed = ?,
            is_valid = ?,
            is_empty = ?
          WHERE session_id = ?
        `);

        updateStmt.run(
          session.project,
          session.projectPath,
          session.filePath,
          session.fileName,
          session.size,
          Math.floor(session.modified.getTime() / 1000),
          metadata.messageCount,
          metadata.firstMessageTime,
          metadata.lastMessageTime,
          metadata.duration,
          analyzed ? 1 : 0,
          metadata.isValid ? 1 : 0,
          metadata.isEmpty ? 1 : 0,
          session.id
        );
      } else {
        // INSERT new row
        const insertStmt = this.db.prepare(`
          INSERT INTO session_metadata
          (session_id, project_name, project_path, file_path, file_name,
           file_size, file_modified_time, message_count, first_message_time,
           last_message_time, session_duration_seconds, is_analyzed, is_valid, is_empty)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
          session.id,
          session.project,
          session.projectPath,
          session.filePath,
          session.fileName,
          session.size,
          Math.floor(session.modified.getTime() / 1000),
          metadata.messageCount,
          metadata.firstMessageTime,
          metadata.lastMessageTime,
          metadata.duration,
          analyzed ? 1 : 0,
          metadata.isValid ? 1 : 0,
          metadata.isEmpty ? 1 : 0
        );
      }
    } catch (error) {
      this.debugLog(`Failed to populate metadata for ${session.id}: ${error.message}`);
    }
  }

  startFilesystemSync() {
    // Start file watcher for real-time updates (replaces 5-minute polling)
    this.startFileWatcher();
  }

  startFileWatcher() {
    // Stop existing watcher if any (prevents duplicates on restart)
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }

    // Get all discovery paths (primary + additional)
    // Per Implementation Plan: Section 2.3.5
    const discoveryPaths = this.getAllDiscoveryPaths();
    this.log(
      `Starting file watcher on ${discoveryPaths.length} path(s): ${discoveryPaths.join(', ')}`
    );

    // Create watch patterns for all discovery paths
    const watchPatterns = discoveryPaths.map((dir) => `${dir}/**/*.jsonl`);

    // Watch all .jsonl files in all discovery directories
    this.fileWatcher = chokidar.watch(watchPatterns, {
      persistent: true,
      ignoreInitial: true, // Don't trigger on existing files at startup
      awaitWriteFinish: {
        // Wait for writes to complete before triggering
        stabilityThreshold: 500,
        pollInterval: 100,
      },
      depth: 2, // Only watch 2 levels deep (projects/project-name/*.jsonl)
    });

    // Debounce map to batch rapid changes
    this.pendingUpdates = new Map();
    this.updateDebounceTimer = null;

    this.fileWatcher.on('change', (filePath) => {
      this.handleFileChange(filePath, 'change');
    });

    this.fileWatcher.on('add', (filePath) => {
      this.handleFileChange(filePath, 'add');
    });

    this.fileWatcher.on('unlink', (filePath) => {
      this.handleFileDelete(filePath);
    });

    this.fileWatcher.on('error', (error) => {
      safeLog.error('File watcher error:', error);
    });

    this.fileWatcher.on('ready', () => {
      this.log('File watcher ready and monitoring for changes');
    });
  }

  async handleFileChange(filePath, eventType) {
    // Only process UUID-named session files
    const fileName = path.basename(filePath, '.jsonl');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fileName)) {
      return; // Skip agent files and non-UUID files
    }

    // Skip temp directories (macOS temp folders)
    const projectDir = path.basename(path.dirname(filePath));
    if (
      projectDir.startsWith('-tmp-') ||
      projectDir.startsWith('-private-var-folders') ||
      projectDir.includes('-var-folders-')
    ) {
      return; // Skip temp directory sessions
    }

    // Add to pending updates (debounce rapid changes)
    this.pendingUpdates.set(filePath, { eventType, timestamp: Date.now() });

    // Debounce: process all pending updates after 300ms of quiet
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }

    this.updateDebounceTimer = setTimeout(async () => {
      await this.processPendingUpdates();
    }, 300);
  }

  async processPendingUpdates() {
    if (this.pendingUpdates.size === 0) return;

    const updates = new Map(this.pendingUpdates);
    this.pendingUpdates.clear();

    this.debugLog(`Processing ${updates.size} file change(s)`);

    let updatedCount = 0;
    let addedCount = 0;

    for (const [filePath, { eventType }] of updates) {
      try {
        const sessionId = path.basename(filePath, '.jsonl');
        const projectDir = path.basename(path.dirname(filePath));

        // Get current file stats
        const stats = await fsPromises.stat(filePath);

        // Build session object for metadata population
        const session = {
          id: sessionId,
          project: projectDir,
          projectPath: await this.sanitizeProjectPath(projectDir),
          filePath: filePath,
          fileName: path.basename(filePath),
          modified: stats.mtime,
          size: stats.size,
        };

        // Update metadata (INSERT OR REPLACE handles both add and update)
        await this.populateSessionMetadata(session);

        if (eventType === 'add') {
          addedCount++;
        } else {
          updatedCount++;
        }
      } catch (error) {
        this.debugLog(`Error processing file change for ${filePath}: ${error.message}`);
      }
    }

    // PHASE 2: Continuation Detection (NEW - real-time detection)
    let continuationsDetected = 0;

    for (const [filePath, { eventType }] of updates) {
      // Only detect for new files
      if (eventType !== 'add') continue;

      try {
        const sessionId = path.basename(filePath, '.jsonl');

        // UUID validation (defensive)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(sessionId)) continue;

        // Detect continuation
        const { detectContinuationMetadata } = require('../migrations/continuation-detection');
        const metadata = await detectContinuationMetadata(filePath);

        if (metadata.isChild && metadata.parentSessionId) {
          // Validate parent UUID
          if (!uuidRegex.test(metadata.parentSessionId)) {
            this.debugLog(`Invalid parent UUID in ${sessionId}: ${metadata.parentSessionId}`);
            continue;
          }

          // Check if parent exists
          const parentExists = this.db
            .prepare('SELECT 1 FROM session_metadata WHERE session_id = ?')
            .get(metadata.parentSessionId);

          // Calculate continuation order
          const existingChildren = this.db
            .prepare(
              `
            SELECT MAX(continuation_order) as max_order
            FROM session_continuations
            WHERE parent_session_id = ?
          `
            )
            .get(metadata.parentSessionId);

          const newOrder = (existingChildren?.max_order || 0) + 1;

          // Insert continuation relationship
          this.db
            .prepare(
              `
            INSERT OR REPLACE INTO session_continuations
            (child_session_id, parent_session_id, continuation_order,
             child_started_timestamp, is_orphaned, has_file_history_event)
            VALUES (?, ?, ?, ?, ?, 1)
          `
            )
            .run(
              sessionId,
              metadata.parentSessionId,
              newOrder,
              metadata.childStartedTimestamp || Date.now(),
              parentExists ? 0 : 1
            );

          // Populate cache for the entire chain
          if (this.continuationService) {
            try {
              const rootSessionId = await this.continuationService.findRootParent(
                metadata.parentSessionId
              );
              await this.continuationService.populateChainCache(
                rootSessionId || metadata.parentSessionId
              );
              this.debugLog(`Cache populated for chain rooted at ${rootSessionId}`);
            } catch (cacheError) {
              this.debugLog(`Chain cache population failed: ${cacheError.message}`);
            }
          }

          continuationsDetected++;
          this.debugLog(`Detected continuation: ${sessionId} → ${metadata.parentSessionId}`);
        }
      } catch (error) {
        this.debugLog(`Continuation detection failed: ${error.message}`);
      }
    }

    // Notify frontend if we have changes
    if (updatedCount > 0 || addedCount > 0) {
      this.log(
        `File watcher: +${addedCount} new, ~${updatedCount} updated, ${continuationsDetected} continuations`
      );

      this.safeSend('sessions-updated', {
        added: addedCount,
        updated: updatedCount,
        removed: 0,
        continuationsDetected,
      });

      // Emit separate continuation event if any detected
      if (continuationsDetected > 0) {
        this.safeSend('continuations-updated', {
          type: 'realtime',
          count: continuationsDetected,
        });
      }
    }
  }

  async handleFileDelete(filePath) {
    const fileName = path.basename(filePath, '.jsonl');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fileName)) {
      return;
    }

    const sessionId = fileName;
    this.debugLog(`File deleted: ${sessionId}`);

    try {
      if (this.db) {
        this.db.prepare('DELETE FROM session_metadata WHERE session_id = ?').run(sessionId);

        if (this.mainWindow && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('sessions-updated', {
            added: 0,
            updated: 0,
            removed: 1,
          });
        }
      }
    } catch (error) {
      this.debugLog(`Error handling file delete: ${error.message}`);
    }
  }

  stopFileWatcher() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      this.log('File watcher stopped');
    }
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = null;
    }
  }

  async syncFilesystemToMetadata() {
    if (!this.db) {
      this.debugLog('Database not initialized, skipping sync');
      return;
    }

    try {
      this.debugLog('Starting filesystem sync...');
      const syncStart = Date.now();

      // Get current sessions from filesystem
      const currentSessions = await this.findAllSessions();
      const currentSessionsMap = new Map(currentSessions.map((s) => [s.id, s]));
      const currentIds = new Set(currentSessions.map((s) => s.id));

      // Get sessions from database with their modification times
      const dbSessions = this.db
        .prepare('SELECT session_id, file_modified_time FROM session_metadata')
        .all();
      const dbSessionsMap = new Map(dbSessions.map((s) => [s.session_id, s.file_modified_time]));
      const dbIds = new Set(dbSessions.map((s) => s.session_id));

      // Detect new sessions (in filesystem but not in database)
      const newIds = [...currentIds].filter((id) => !dbIds.has(id));

      // Detect deleted sessions (in database but not in filesystem)
      const deletedIds = [...dbIds].filter((id) => !currentIds.has(id));

      // Detect modified sessions (file mtime changed since last sync)
      const modifiedIds = [...currentIds].filter((id) => {
        if (!dbIds.has(id)) return false; // New session, not modified
        const session = currentSessionsMap.get(id);
        const dbMtime = dbSessionsMap.get(id);
        const currentMtime = Math.floor(session.modified.getTime() / 1000);
        return currentMtime > dbMtime;
      });

      // Add new sessions
      if (newIds.length > 0) {
        this.debugLog(`Found ${newIds.length} new sessions, adding to database...`);
        for (const id of newIds) {
          const session = currentSessionsMap.get(id);
          if (session) {
            await this.populateSessionMetadata(session);
          }
        }
      }

      // Update modified sessions
      if (modifiedIds.length > 0) {
        this.debugLog(`Found ${modifiedIds.length} modified sessions, updating metadata...`);
        for (const id of modifiedIds) {
          const session = currentSessionsMap.get(id);
          if (session) {
            await this.populateSessionMetadata(session);
          }
        }
      }

      // Remove deleted sessions
      if (deletedIds.length > 0) {
        this.debugLog(`Found ${deletedIds.length} deleted sessions, removing from database...`);
        const deleteStmt = this.db.prepare('DELETE FROM session_metadata WHERE session_id = ?');
        for (const id of deletedIds) {
          deleteStmt.run(id);
        }
      }

      const syncDuration = Date.now() - syncStart;
      if (newIds.length > 0 || deletedIds.length > 0 || modifiedIds.length > 0) {
        this.log(
          `Filesystem sync complete: +${newIds.length} new, ~${modifiedIds.length} updated, -${deletedIds.length} deleted (${syncDuration}ms)`
        );

        // Notify frontend if we have changes
        if (this.mainWindow && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('sessions-updated', {
            added: newIds.length,
            updated: modifiedIds.length,
            removed: deletedIds.length,
          });
        }
      } else {
        this.debugLog(`Filesystem sync complete: no changes (${syncDuration}ms)`);
      }
    } catch (error) {
      safeLog.error('Filesystem sync error:', error);
    }
  }

  async findAllSessions() {
    const sessions = [];

    try {
      // Get all discovery paths (primary + additional)
      // Per Implementation Plan: Section 2.3.4
      const discoveryPaths = this.getAllDiscoveryPaths();
      this.debugLog(
        `Discovering sessions from ${discoveryPaths.length} path(s): ${discoveryPaths.join(', ')}`
      );

      // Start building filesystem tree in background (don't block session discovery)
      const treePromise = this.ensureFilesystemTree();

      for (const claudeDir of discoveryPaths) {
        // Skip if this path should be excluded
        if (this.shouldExcludePath(claudeDir)) {
          this.debugLog(`Skipping excluded path: ${claudeDir}`);
          continue;
        }

        try {
          const projects = await fsPromises.readdir(claudeDir, { withFileTypes: true });

          for (const project of projects) {
            if (project.isDirectory()) {
              const projectPath = path.join(claudeDir, project.name);

              // Check if this project path should be excluded
              if (this.shouldExcludePath(projectPath)) {
                this.debugLog(`Skipping excluded project: ${projectPath}`);
                continue;
              }

              // Skip temporary directories (macOS temp folders)
              if (
                project.name.startsWith('-tmp-') ||
                project.name.startsWith('-private-var-folders') ||
                project.name.includes('-var-folders-')
              ) {
                this.debugLog(`Skipping temp directory: ${project.name}`);
                continue;
              }

              const files = await fsPromises.readdir(projectPath);

              for (const file of files) {
                if (file.endsWith('.jsonl')) {
                  const sessionId = file.replace('.jsonl', '');

                  // Filter out invalid session IDs - only keep UUIDs
                  // Skip agent- prefixed files and other non-UUID formats
                  const uuidRegex =
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                  if (!uuidRegex.test(sessionId)) {
                    this.debugLog(`Skipping non-UUID session file: ${file}`);
                    continue;
                  }

                  const filePath = path.join(projectPath, file);

                  // Read file content to determine if it should be discovered
                  try {
                    // Just verify we can read the file
                    await fsPromises.access(filePath);
                    const stats = await fsPromises.stat(filePath);
                    const content = await fsPromises.readFile(filePath, 'utf8');
                    const lines = content.trim().split('\n');

                    let hasSummary = false;
                    let hasSystem = false;
                    let hasUserOrAssistant = false;

                    for (const line of lines) {
                      try {
                        const parsed = JSON.parse(line);
                        if (parsed.type === 'summary' || parsed.data_type === 'summary') {
                          hasSummary = true;
                        } else if (parsed.type === 'system' || parsed.data_type === 'system') {
                          hasSystem = true;
                        } else if (parsed.type === 'user' || parsed.type === 'assistant') {
                          hasUserOrAssistant = true;
                          break;
                        }
                      } catch {
                        // Skip malformed JSON lines
                      }
                    }

                    // Filter out sessions with no meaningful conversation data
                    // Skip any session that doesn't have actual user/assistant messages
                    // This includes:
                    // 1. Empty files
                    // 2. Summary-only sessions (collapsed with no original messages)
                    // 3. Metadata-only sessions (file-history-snapshot, etc.)
                    if (lines.length === 0 || !hasUserOrAssistant) {
                      this.debugLog(
                        `Skipping session with no conversation data: ${sessionId} (lines: ${lines.length}, hasUserOrAssistant: ${hasUserOrAssistant}, hasSummary: ${hasSummary}, hasSystem: ${hasSystem})`
                      );
                      continue;
                    }

                    // Create session object without projectPath initially (will be resolved after tree is built)
                    sessions.push({
                      id: sessionId,
                      project: project.name,
                      projectPath: null, // Will be resolved after tree is built
                      filePath: filePath,
                      fileName: file,
                      modified: stats.mtime,
                      size: stats.size,
                      recentMessages: [],
                      status: 'pending',
                    });
                  } catch (error) {
                    // If we can't read the file, skip it
                    this.debugLog(
                      `Skipping unreadable session file: ${file} - Error: ${error.message || error.code || error}`
                    );
                    continue;
                  }
                }
              }
            }
          }
        } catch (dirError) {
          // Log but continue - don't fail entire discovery for one bad path
          this.debugLog(`Error scanning ${claudeDir}: ${dirError.message}`);
        }
      }

      // Wait for tree to finish building
      await treePromise;

      // Now resolve all project paths using the tree (fast!)
      for (const session of sessions) {
        try {
          session.projectPath = await this.sanitizeProjectPath(session.project);
        } catch (pathError) {
          this.debugLog(
            `Error sanitizing project path for ${session.project}: ${pathError.message}`
          );
          // Use the project name as-is if sanitization fails
          session.projectPath = session.project;
        }

        // Populate metadata for this session (ongoing sync)
        await this.populateSessionMetadata(session);
      }
    } catch (error) {
      safeLog.error('Error finding sessions:', error);
    }

    // Sort by modification time, most recent first
    return sessions.sort((a, b) => b.modified - a.modified);
  }

  // Fallback path resolution when tree doesn't find a match
  // Uses path.join() to avoid double slashes and properly handle path separators
  // NOTE: fallbackPathResolution() moved to utils/helpers.js (Phase 2 extraction)

  async sanitizeProjectPath(projectName) {
    // Check cache first
    if (this.pathCache.has(projectName)) {
      return this.pathCache.get(projectName);
    }

    logPathParsing(`=== Processing project name: ${projectName} ===`);

    // Ensure tree is built - let the tree handle ALL path resolution logic
    const tree = await this.ensureFilesystemTree();

    // Use tree to find best match
    const result = tree.findBestMatch(projectName);

    // If the tree returned the original path, it means it's not a valid project path
    if (result === projectName) {
      logPathParsing(`No valid project path found for: ${projectName}`);
      // Use fallback path resolution with proper path.join()
      const displayName = fallbackPathResolution(projectName);
      // Don't cache fallback results - directory might be created later in tests
      logPathParsing(`Using fallback display name: ${displayName}`);
      return displayName;
    }

    // Cache result
    this.pathCache.set(projectName, result);
    logPathParsing(`Resolved to: ${result}`);

    return result;
  }

  /**
   * Filter session content for analysis
   * Phase 4: Delegate to AnalysisService
   */
  async filterSessionForAnalysis(session) {
    return this.analysisService.filterSessionForAnalysis(session);
  }

  // NOTE: extractTextContent() moved to utils/parsing.js (Phase 2 extraction)

  /**
   * Get recent messages from session
   * Phase 4: Delegate to AnalysisService
   */
  async getRecentMessages(session, count = 5) {
    return this.analysisService.getRecentMessages(session, count);
  }

  // NOTE: extractTitleFromSummary() moved to utils/parsing.js (Phase 2 extraction)
  // NOTE: extractFromFirstMeaningfulLine() moved to utils/parsing.js (Phase 2 extraction)

  // Fallback: Generate title via direct Claude CLI call (only used if regex extraction fails)
  /**
   * Generate title via Claude CLI
   * Phase 4: Delegate to AnalysisService
   */
  async generateTitleWithClaude(filteredContent) {
    return this.analysisService.generateTitleWithClaude(filteredContent);
  }

  /**
   * Analyze session with Go backend
   * Phase 4: Delegate to AnalysisService
   */
  /**
   * Analyze session with Go backend
   * Phase 4: Delegate to AnalysisService
   */
  async analyzeSessionWithHaiku(session, bypassQuota = false, customInstructions = '') {
    return this.analysisService.analyzeSessionWithHaiku(
      session,
      bypassQuota,
      customInstructions,
      () => this.checkDailyQuota(),
      (success, isRetry) => this.incrementQuota(success, isRetry)
    );
  }

  // NOTE: isCacheStillValid() moved to utils/validation.js (Phase 2 extraction)
  // NOTE: Main process now calls isCacheStillValid(timestamp, cacheDurationDays) directly

  /**
   * Compute SHA-256 hash of file
   * Phase 4: Delegate to AnalysisService
   */
  /**
   * Compute SHA-256 hash of file
   * Phase 4: Delegate to AnalysisService
   */
  async computeFileHash(filePath) {
    return this.analysisService.computeFileHash(filePath);
  }

  /**
   * Cache analysis results
   * Phase 4: Delegate to AnalysisService
   */
  /**
   * Cache analysis results
   * Phase 4: Delegate to AnalysisService
   */
  async cacheAnalysis(session, summary, analysisDuration) {
    return this.analysisService.cacheAnalysis(session, summary, analysisDuration);
  }

  /**
   * Get cached analysis for session
   * Phase 4: Delegate to AnalysisService
   */
  /**
   * Get cached analysis for session
   * Phase 4: Delegate to AnalysisService
   */
  async getCachedAnalysis(session, fileModTime) {
    return this.analysisService.getCachedAnalysis(session, fileModTime);
  }

  getAllCachedSessions() {
    if (!this.db) {
      return [];
    }

    try {
      const stmt = this.db.prepare(`
        SELECT session_id, project_path, title, summary, analysis_timestamp, created_at
        FROM session_analysis_cache
        ORDER BY analysis_timestamp DESC
      `);
      return stmt.all();
    } catch (error) {
      safeLog.error('Error retrieving cached sessions:', error);
      return [];
    }
  }

  async cacheSessionAnalysis(session, title, summary, analysisDuration) {
    if (!this.db) return;

    try {
      // FIXED: Defensive check for undefined summary
      if (!summary || typeof summary !== 'string') {
        safeLog.warn(`Cannot cache - invalid summary for session ${session.id}`);
        return;
      }

      const stats = await fsPromises.stat(session.filePath);
      const fileModTime = Math.floor(stats.mtime.getTime() / 1000);

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO session_analysis_cache
        (session_id, project_path, file_path, file_modified_time, title, summary,
         analysis_model, analysis_timestamp, messages_analyzed, tokens_saved,
         analysis_duration_ms, cache_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        session.id,
        session.project,
        session.filePath,
        fileModTime,
        title || 'Untitled Session',
        summary,
        'claude-haiku-4-5o10o',
        Math.floor(Date.now() / 1000),
        20,
        Math.floor(summary.length * 0.8),
        analysisDuration,
        1
      );

      this.debugLog(`Cached title and analysis for session ${session.id}`);
    } catch (error) {
      safeLog.error('Failed to cache session analysis:', error);
    }
  }

  // New Search & Pagination Methods

  async searchSessions(query, limit = 50, offset = 0) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // FTS5 search for analyzed sessions (with metadata fields)
      const ftsStmt = this.db.prepare(`
        SELECT
          m.session_id,
          m.project_path,
          m.file_path,
          m.file_modified_time,
          m.message_count,
          m.last_message_time,
          m.is_analyzed,
          c.title,
          c.summary,
          c.analysis_timestamp,
          c.analysis_date,
          1 as search_rank
        FROM session_fts f
        JOIN session_analysis_cache c ON f.session_id = c.session_id
        JOIN session_metadata m ON c.session_id = m.session_id
        WHERE session_fts MATCH ?
        ORDER BY rank, m.last_message_time DESC
      `);

      const ftsResults = ftsStmt.all(query);

      // Fallback: Search unanalyzed sessions by project_path or session_id
      const fallbackStmt = this.db.prepare(`
        SELECT
          session_id,
          project_path,
          file_path,
          file_modified_time,
          message_count,
          last_message_time,
          is_analyzed,
          NULL as title,
          NULL as summary,
          NULL as analysis_timestamp,
          NULL as analysis_date,
          2 as search_rank
        FROM session_metadata
        WHERE is_analyzed = 0
          AND is_valid = 1
          AND is_empty = 0
          AND (project_path LIKE ? OR session_id LIKE ?)
        ORDER BY last_message_time DESC
      `);

      const fallbackResults = fallbackStmt.all(`%${query}%`, `%${query}%`);

      // Merge results (FTS first, then fallback)
      let allResults = [...ftsResults, ...fallbackResults];

      // CRITICAL: Search Parent Bubbling - Show parent session when child matches
      // If groupContinuations is enabled and a child session matches:
      // 1. Remove child from results
      // 2. Fetch parent session
      // 3. Set _searchMatchChapter metadata on parent
      // 4. Add parent to results with chapter information
      const groupContinuations = this.getSetting('groupContinuations', false);
      const parentBubbleMap = new Map(); // parentId → { matchedChildren: Set, chapters: [...] }

      if (groupContinuations) {
        const childSessionIds = new Set();
        const parentsToFetch = new Set();

        // Prepare statements for continuation lookups
        const getParentStmt = this.db.prepare(`
          SELECT parent_session_id, continuation_order
          FROM session_continuations
          WHERE child_session_id = ?
        `);

        const getTotalChaptersStmt = this.db.prepare(`
          SELECT COUNT(*) as total
          FROM session_continuations
          WHERE parent_session_id = ?
        `);

        // First pass: Identify child sessions and their parents
        for (const session of allResults) {
          const parentInfo = getParentStmt.get(session.session_id);

          if (parentInfo) {
            // This is a child session that matched the search
            childSessionIds.add(session.session_id);
            parentsToFetch.add(parentInfo.parent_session_id);

            // Track which chapter matched for parent bubbling
            if (!parentBubbleMap.has(parentInfo.parent_session_id)) {
              parentBubbleMap.set(parentInfo.parent_session_id, {
                matchedChildren: new Set(),
                chapters: [],
              });
            }

            const bubbleData = parentBubbleMap.get(parentInfo.parent_session_id);
            bubbleData.matchedChildren.add(session.session_id);
            bubbleData.chapters.push(parentInfo.continuation_order);
          }
        }

        // Filter out child sessions
        allResults = allResults.filter((session) => !childSessionIds.has(session.session_id));

        // Second pass: Fetch parent sessions that aren't already in results
        if (parentsToFetch.size > 0) {
          const existingParentIds = new Set(allResults.map((s) => s.session_id));

          for (const parentId of parentsToFetch) {
            if (!existingParentIds.has(parentId)) {
              // Fetch parent session from database
              const parentSession = this.db
                .prepare(
                  `
                SELECT
                  m.session_id,
                  m.project_path,
                  m.file_path,
                  m.file_modified_time,
                  m.message_count,
                  m.last_message_time,
                  m.is_analyzed,
                  c.title,
                  c.summary,
                  c.analysis_timestamp,
                  c.analysis_date,
                  1 as search_rank
                FROM session_metadata m
                LEFT JOIN session_analysis_cache c ON m.session_id = c.session_id
                WHERE m.session_id = ?
              `
                )
                .get(parentId);

              if (parentSession) {
                allResults.push(parentSession);
                existingParentIds.add(parentId);
              }
            }
          }
        }

        // Third pass: Attach chapter metadata to parent sessions
        for (const session of allResults) {
          if (parentBubbleMap.has(session.session_id)) {
            const bubbleData = parentBubbleMap.get(session.session_id);
            const totalChapters = getTotalChaptersStmt.get(session.session_id);

            // Set search match metadata for parent
            session._searchMatchChapter = bubbleData.chapters.sort((a, b) => a - b);
            session._searchMatchTotalChapters = (totalChapters?.total || 0) + 1; // +1 for parent itself
            session._searchMatchedChildrenCount = bubbleData.matchedChildren.size;
          }
        }

        this.debugLog(
          `Search parent bubbling: ${childSessionIds.size} children replaced with ${parentsToFetch.size} parents`
        );
      }

      const total = allResults.length;

      // Apply pagination
      const sessions = allResults.slice(offset, offset + limit);

      this.debugLog(
        `Search for "${query}" found ${total} results (${ftsResults.length} analyzed, ${fallbackResults.length} unanalyzed)`
      );

      return { sessions, total };
    } catch (error) {
      safeLog.error('Search error:', error);
      throw error;
    }
  }

  // ==========================================================================
  // SQL Query Builder - Shared Function for Session Metadata
  // ==========================================================================

  /**
   * Builds SELECT query for session metadata with configurable fields
   *
   * CRITICAL: This is the SINGLE SOURCE OF TRUTH for session metadata queries.
   * Both loadSessionsPaginated and getSessionDetails MUST use this function.
   *
   * This function eliminates field inconsistency bugs (like missing continuation_count)
   * by centralizing SQL generation logic.
   *
   * @param {Object} options - Query configuration
   * @param {boolean} options.includeContinuationCount - Add continuation_count subquery
   * @param {boolean} options.includeAnalysis - Join session_analysis_cache
   * @param {string} options.orderBy - Sort column (default: last_message_time DESC)
   * @param {number} options.limit - Result limit (optional)
   * @param {number} options.offset - Pagination offset (optional)
   * @returns {string} - Complete SQL SELECT statement
   *
   * @example
   * // Basic usage (list view)
   * const sql = buildSessionMetadataQuery({
   *   includeContinuationCount: true,
   *   includeAnalysis: true,
   *   limit: 50,
   *   offset: 0
   * });
   *
   * @example
   * // Detail view (single session)
   * const baseSql = buildSessionMetadataQuery({
   *   includeContinuationCount: true,
   *   includeAnalysis: true
   * });
   * const sql = `${baseSql} WHERE m.session_id = ?`;
   */
  buildSessionMetadataQuery(options = {}) {
    // Base SELECT with core fields
    const baseFields = `
      m.session_id,
      m.project_path,
      m.file_path,
      m.file_modified_time,
      m.message_count,
      m.last_message_time,
      m.is_analyzed`;

    // Conditional field: continuation_count from cache (total chain size for any session in chain)
    // Uses continuation_chain_cache which has precomputed chain info
    // Returns total chain size for ANY session in the chain, not just the root
    const continuationCountField = options.includeContinuationCount
      ? `,
            (SELECT COUNT(*) FROM continuation_chain_cache cc2
             WHERE cc2.root_session_id = (
               SELECT root_session_id FROM continuation_chain_cache WHERE session_id = m.session_id
             )) as continuation_count`
      : '';

    // Conditional fields: analysis cache
    const analysisFields = options.includeAnalysis
      ? `,
            c.title,
            c.summary,
            c.analysis_timestamp,
            c.analysis_date`
      : '';

    // Conditional fields: continuation metadata (always include for consistency)
    const continuationMetadataFields = `
      sc.parent_session_id as continuation_of,
      sc.continuation_order as chain_position,
      sc.is_active_continuation`;

    // Conditional JOIN clause for analysis
    const analysisJoin = options.includeAnalysis
      ? 'LEFT JOIN session_analysis_cache c ON m.session_id = c.session_id'
      : '';

    // Continuation metadata JOIN (always present)
    const continuationJoin =
      'LEFT JOIN session_continuations sc ON m.session_id = sc.child_session_id';

    // ORDER BY clause
    const orderBy = options.orderBy || 'last_message_time DESC';

    // LIMIT/OFFSET clauses
    const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
    const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';

    // Assemble final query
    return `
      SELECT ${baseFields}${continuationCountField}${analysisFields},
            ${continuationMetadataFields}
      FROM session_metadata m
      ${analysisJoin}
      ${continuationJoin}
      ORDER BY m.${orderBy}
      ${limitClause} ${offsetClause}
    `.trim();
  }

  // ==========================================================================
  // Session Loading Methods
  // ==========================================================================

  async loadSessionsPaginated(limit = 50, offset = 0, filters = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Base WHERE conditions: only valid, non-empty sessions
      const whereConditions = ['m.is_valid = 1', 'm.is_empty = 0'];
      const params = [];

      // Date range filter - use last_message_time from metadata
      // Convert to ISO strings for comparison (timestamps are stored as ISO strings)
      if (filters.dateFrom) {
        whereConditions.push('m.last_message_time >= ?');
        params.push(new Date(filters.dateFrom).toISOString());
      }
      if (filters.dateTo) {
        whereConditions.push('m.last_message_time <= ?');
        params.push(new Date(filters.dateTo).toISOString());
      }

      // Project filter
      if (filters.projectPath) {
        whereConditions.push('m.project_path = ?');
        params.push(filters.projectPath);
      }

      // Continuation chain filter
      // Use SQL IN clause with parameterized placeholders for safety
      if (
        filters.chainSessionIds &&
        Array.isArray(filters.chainSessionIds) &&
        filters.chainSessionIds.length > 0
      ) {
        // SQLite supports up to 999 parameters - safe for typical chains (10-20 members)
        // Pattern: session_id IN (?, ?, ?) with spread operator
        const placeholders = filters.chainSessionIds.map(() => '?').join(',');
        whereConditions.push(`m.session_id IN (${placeholders})`);
        params.push(...filters.chainSessionIds);
      }

      // Build WHERE clause
      const whereClause = 'WHERE ' + whereConditions.join(' AND ');

      // Use shared SQL builder function with continuation_count
      const baseQuery = this.buildSessionMetadataQuery({
        includeContinuationCount: true,
        includeAnalysis: true,
        orderBy: 'last_message_time DESC',
        limit: limit,
        offset: offset,
      });

      // Inject WHERE clause between JOINs and ORDER BY
      // Pattern: Split at "ORDER BY", insert WHERE, rejoin
      const queryParts = baseQuery.split('ORDER BY');
      const query = `${queryParts[0]} ${whereClause} ORDER BY ${queryParts[1]}`;

      // Note: limit and offset already embedded in query by buildSessionMetadataQuery
      const stmt = this.db.prepare(query);
      const sessions = stmt.all(...params);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM session_metadata m
        ${whereClause}
      `;
      const countStmt = this.db.prepare(countQuery);
      const { total } = countStmt.get(...params); // limit/offset are in SQL, not params

      const hasMore = offset + sessions.length < total;

      this.debugLog(
        `Loaded ${sessions.length} sessions (offset: ${offset}, total: ${total}, analyzed: ${sessions.filter((s) => s.is_analyzed).length})`
      );

      return { sessions, total, hasMore };
    } catch (error) {
      safeLog.error('Error loading sessions:', error);
      throw error;
    }
  }

  async getSessionCount(filters = {}) {
    if (!this.db) {
      return 0;
    }

    try {
      const whereConditions = [];
      const params = [];

      if (filters.dateFrom) {
        whereConditions.push('analysis_timestamp >= ?');
        params.push(Math.floor(new Date(filters.dateFrom).getTime() / 1000));
      }
      if (filters.dateTo) {
        whereConditions.push('analysis_timestamp <= ?');
        params.push(Math.floor(new Date(filters.dateTo).getTime() / 1000));
      }
      if (filters.projectPath) {
        whereConditions.push('project_path = ?');
        params.push(filters.projectPath);
      }

      const whereClause =
        whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      const query = `SELECT COUNT(*) as count FROM session_analysis_cache ${whereClause}`;
      const stmt = this.db.prepare(query);
      const { count } = stmt.get(...params);

      return count;
    } catch (error) {
      safeLog.error('Error getting session count:', error);
      return 0;
    }
  }

  async getAvailableProjects(filters = {}) {
    if (!this.db) {
      return [];
    }

    try {
      // Build dynamic WHERE conditions based on filters
      const whereConditions = ['is_valid = 1', 'is_empty = 0'];
      const params = [];

      // Date range filter - matches getPaginatedSessions logic
      if (filters.dateFrom) {
        whereConditions.push('last_message_time >= ?');
        params.push(new Date(filters.dateFrom).toISOString());
      }
      if (filters.dateTo) {
        whereConditions.push('last_message_time <= ?');
        params.push(new Date(filters.dateTo).toISOString());
      }

      // Query session_metadata to get ALL projects (analyzed + unanalyzed)
      // Order by most recent session activity (Approach A from plan)
      const stmt = this.db.prepare(`
        SELECT project_path, COUNT(*) as session_count, MAX(last_message_time) as most_recent
        FROM session_metadata
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY project_path
        ORDER BY most_recent DESC
      `);

      return stmt.all(params);
    } catch (error) {
      safeLog.error('Error getting available projects:', error);
      return [];
    }
  }

  async loadAndAnalyzeSessions() {
    try {
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('analysis-status', {
          status: 'loading',
          message: 'Finding sessions...',
        });
      }

      // NEW: findAllSessions now populates metadata table
      await this.findAllSessions();

      // Continuation detection (first-time, empty, or E2E test mode)
      try {
        const continuationCount = this.db
          .prepare('SELECT COUNT(*) as count FROM session_continuations')
          .get();

        // Run continuation detection if:
        // 1. Table is empty (first-time detection), OR
        // 2. E2E_TEST_MODE is enabled (always detect for test sessions)
        const shouldRunDetection =
          continuationCount.count === 0 || process.env.E2E_TEST_MODE === 'true';

        if (shouldRunDetection) {
          this.mainWindow.webContents.send('analysis-status', {
            status: 'loading',
            message: 'Detecting session continuations...',
            phase: 'detection',
          });

          const stats = await this.resolveContinuationChains();

          this.debugLog('Continuation detection complete:', stats);

          this.mainWindow.webContents.send('continuations-detected', stats);
        }
      } catch (error) {
        safeLog.error('Continuation detection error:', error);
      }

      // ALWAYS rebuild cache after relationship detection (not conditional)
      // This ensures cold start correctly populates cache after all relationships detected
      try {
        const rootSessions = this.db
          .prepare(
            `
          SELECT DISTINCT parent_session_id as root_id
          FROM session_continuations
          WHERE parent_session_id NOT IN (
            SELECT child_session_id FROM session_continuations
          )
        `
          )
          .all();

        if (rootSessions.length > 0) {
          this.debugLog(`Rebuilding cache for ${rootSessions.length} chains...`);

          for (const { root_id } of rootSessions) {
            try {
              await this.continuationService.populateChainCache(root_id);
            } catch (cacheErr) {
              this.debugLog(`Cache population failed for chain ${root_id}: ${cacheErr.message}`);
            }
          }

          this.debugLog('Continuation cache rebuild complete');
        } else {
          this.debugLog('No continuation chains found to cache');
        }
      } catch (cacheError) {
        safeLog.error('Continuation cache rebuild error:', cacheError);
      }

      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('discovery-complete', {
          message: 'Session discovery complete - loading page 1...',
        });
      }

      // Start filesystem sync (5-minute interval)
      this.startFilesystemSync();

      // Frontend pagination system takes over from here
    } catch (error) {
      safeLog.error('Error loading sessions:', error);
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('analysis-error', {
          error: error.message,
        });
      }
    }
  }

  async analyzeSessionsQueue(sessions) {
    this.isAnalyzing = true;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];

      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('analysis-status', {
          status: 'analyzing',
          message: `Analyzing session ${i + 1}/${sessions.length}...`,
          current: i + 1,
          total: sessions.length,
        });
      }

      try {
        // Get recent messages for immediate viewing
        const recentMessages = await this.getRecentMessages(session, 3);
        session.recentMessages = recentMessages;
        session.status = 'analyzing';

        if (this.mainWindow && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('session-updated', session);
        }

        // OPTIMIZED: Generate summary only (1 API call instead of 2)
        const result = await this.analyzeSessionWithHaiku(session);
        session.summary = result.summary;

        // Extract title from summary using regex (95% success, zero cost)
        let title = extractTitleFromSummary(result.summary);

        // Fallback: If regex extraction failed, use Claude CLI directly (5% of cases)
        if (
          title === 'Untitled Session' &&
          result.summary &&
          result.summary !== 'No conversation data to analyze'
        ) {
          this.debugLog(`Regex extraction failed for ${session.id}, falling back to Claude CLI`);
          const filteredContent = await this.filterSessionForAnalysis(session);
          title = await this.generateTitleWithClaude(filteredContent);
        }

        session.title = title;
        session.status = 'completed';

        // Cache both title and summary together
        await this.cacheSessionAnalysis(session, title, result.summary, result.duration);

        if (this.mainWindow && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('session-updated', session);
        }
      } catch (error) {
        safeLog.error('Error analyzing session:', error);
        session.status = 'error';
        session.error = error.message;

        if (this.mainWindow && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('session-updated', session);
        }
      }

      // Small delay to prevent overwhelming the UI
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    this.isAnalyzing = false;
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('analysis-complete', {
        message: 'Analysis complete!',
      });
    }
  }

  async getSessionDetails(sessionId, loadFullMessages = false) {
    try {
      // 🚀 FIX: Use shared buildSessionMetadataQuery() with continuation_count
      const baseSql = this.buildSessionMetadataQuery({
        includeContinuationCount: true, // 🔧 BUG FIX: Include continuation count
        includeAnalysis: true,
      });

      // Append WHERE clause for specific session
      const sql = `
        SELECT * FROM (${baseSql}) AS base_query
        WHERE session_id = ?
      `;

      const metadata = this.db.prepare(sql).get(sessionId);

      if (!metadata) {
        this.debugLog(`Session ${sessionId} not found in database`);
        return null;
      }

      // Build session object from database metadata
      const session = {
        id: metadata.session_id,
        project: metadata.project_path ? path.basename(metadata.project_path) : 'Unknown',
        projectPath: metadata.project_path,
        filePath: metadata.file_path,
        fileName: metadata.file_name,
        messageCount: metadata.message_count,
        title: metadata.title,
        summary: metadata.summary,
        modified: new Date(metadata.last_message_time),
        continuation_count: metadata.continuation_count || 0, // 🔧 BUG FIX: Ensure field exists
      };

      // 🚀 FIX #2: Lazy loading - only load messages if requested
      if (!loadFullMessages) {
        // Return metadata only (instant response)
        session.recentMessages = await this.getRecentMessagesOptimized(metadata.file_path, 20);
        return session;
      }

      // 🚀 FIX #3: Optimized file reading for full messages
      const messages = await this.loadMessagesFromFile(metadata.file_path);

      return {
        ...session,
        messages: messages,
      };
    } catch (error) {
      safeLog.error('Error getting session details:', error);
      return null;
    }
  }

  // ==========================================================================
  // Continuation Chain Methods
  // ==========================================================================

  /**
   * Get the full continuation chain for a session (parent + all children in order)
   * @param {string} sessionId - Session ID to get chain for
   * @returns {Object} Chain with parent session and ordered children
   */
  async getContinuationChain(sessionId) {
    return this.continuationService.getContinuationChain(sessionId);
  }

  /**
   * Find the root parent of a continuation chain
   * @param {string} sessionId - Starting session ID
   * @returns {string} Root parent session ID
   */
  async findRootParent(sessionId) {
    return this.continuationService.findRootParent(sessionId);
  }

  /**
   * Build complete continuation chain starting from parent
   * @param {string} parentId - Root parent session ID
   * @returns {Object} Chain with parent, children, flatDescendants, and branching info
   */
  async buildChainFromParent(parentId) {
    return this.continuationService.buildChainFromParent(parentId);
  }

  /**
   * Get direct children of a session
   * @param {string} sessionId - Parent session ID
   * @returns {Promise<Array>} Array of child sessions
   */
  async getContinuationChildren(sessionId) {
    return this.continuationService.getContinuationChildren(sessionId);
  }

  /**
   * Get session with full continuation context (parent chain + children)
   * @param {string} sessionId - Session ID
   * @param {boolean} loadFullMessages - Whether to load full messages
   * @returns {Object} Session with continuation context
   */
  async getSessionWithContinuations(sessionId, loadFullMessages = false) {
    return this.continuationService.getSessionWithContinuations(
      sessionId,
      loadFullMessages,
      this.getSessionDetails.bind(this)
    );
  }

  /**
   * Get continuation metadata for a session
   * @param {string} sessionId - Session ID
   * @returns {Object} Metadata about continuation status
   */
  async getContinuationMetadata(sessionId) {
    return this.continuationService.getContinuationMetadata(sessionId);
  }

  /**
   * Get continuation statistics across all sessions
   * @returns {Object} Statistics about continuation chains
   */
  async getContinuationStats() {
    return this.continuationService.getContinuationStats();
  }

  // =========================================================================
  // Continuation Chain Cache Methods (Enterprise-Grade Caching)
  // =========================================================================
  // Purpose: O(1) lookups for continuation chain data instead of O(N) traversal
  // Pattern: Lazy population with trigger-based invalidation
  // Reference: docs/CONTINUATION_CACHE_ARCHITECTURE.md
  // =========================================================================

  /**
   * Populate continuation cache for a single session.
   * Called on-demand when cache miss occurs.
   *
   * @param {string} sessionId - Session ID to populate cache for
   * @returns {Promise<Object>} Cached continuation data
   */
  async populateContinuationCache(sessionId) {
    return this.continuationService.populateContinuationCache(sessionId);
  }

  /**
   * Get cached continuation data, populate if missing.
   * This is the primary entry point for getting continuation data.
   *
   * @param {string} sessionId - Session ID to get cache for
   * @returns {Promise<Object>} Cached continuation data
   */
  async getCachedContinuationData(sessionId) {
    return this.continuationService.getCachedContinuationData(sessionId);
  }

  /**
   * Get chain statistics from cache with O(1) lookup.
   * Falls back to computing if cache is empty.
   *
   * @param {string} rootSessionId - Root session ID of the chain
   * @returns {Promise<Object>} Chain statistics
   */
  async getCachedChainStats(rootSessionId) {
    return this.continuationService.getCachedChainStats(rootSessionId);
  }

  /**
   * Batch populate cache for all sessions in a chain.
   * Used for preloading entire chains on expansion.
   *
   * @param {string} rootSessionId - Root session ID to populate chain for
   * @returns {Promise<number>} Number of sessions cached
   */
  async populateChainCache(rootSessionId) {
    return this.continuationService.populateChainCache(rootSessionId);
  }

  /**
   * Clear continuation cache (useful for testing/debugging).
   * Note: Normally cache is cleared by database triggers, not application code.
   *
   * @returns {number} Number of entries cleared
   */
  clearContinuationCache() {
    return this.continuationService.clearContinuationCache();
  }

  /**
   * Detect continuation metadata from JSONL file
   *
   * Parses the JSONL file to find:
   * - logicalParentUuid in file-history-snapshot events
   * - compact_boundary events with next session IDs
   *
   * @param {string} filePath - Absolute path to JSONL file
   * @returns {Promise<Object>} Continuation metadata
   */
  async detectSessionContinuation(filePath) {
    return this.continuationService.detectSessionContinuation(filePath);
  }

  /**
   * Get all session IDs in a continuation group
   *
   * @param {string} sessionId - Any session ID in the group
   * @returns {Promise<Array<string>>} All session IDs in the group
   */
  async getSessionGroup(sessionId) {
    return this.continuationService.getSessionGroup(sessionId);
  }

  /**
   * Resolve continuation chains after session discovery
   *
   * Scans all JSONL files for continuation markers and populates
   * the session_continuations table.
   *
   * @returns {Promise<Object>} Statistics about resolved chains
   */
  async resolveContinuationChains() {
    return this.continuationService.resolveContinuationChains(this.mainWindow);
  }

  async healOrphanedContinuations() {
    return this.continuationService.healOrphanedContinuations(this.mainWindow);
  }

  /**
   * Detect orphaned continuations (children whose parents are missing)
   *
   * @returns {Promise<Array<Object>>} Array of orphaned continuation records
   */
  async detectOrphanedContinuations() {
    return this.continuationService.detectOrphanedContinuations();
  }

  // ==========================================================================
  // End Continuation Chain Methods
  // ==========================================================================

  async getRecentMessagesOptimized(filePath, limit = 20) {
    try {
      const stats = await fsPromises.stat(filePath);
      const fileSize = stats.size;

      const CHUNK_SIZE = 100000; // 100KB per chunk

      const messages = [];
      const seenUuids = new Set(); // Track seen UUIDs to prevent duplicates
      let currentEnd = fileSize;

      // Open file once for all chunk reads
      const fd = await fsPromises.open(filePath, 'r');
      try {
        // Continue until we have enough messages or reach start of file
        while (messages.length < limit && currentEnd > 0) {
          // Calculate chunk boundaries
          const chunkStart = Math.max(0, currentEnd - CHUNK_SIZE);
          const chunkSize = currentEnd - chunkStart;

          // Read chunk
          const buffer = Buffer.alloc(chunkSize);
          await fd.read(buffer, 0, chunkSize, chunkStart);

          const content = buffer.toString('utf8');
          const lines = content.split('\n').filter((line) => line.trim());

          // Handle partial first line (may be cut off at chunk boundary)
          if (chunkStart > 0 && lines.length > 0) {
            lines.shift(); // Discard potentially incomplete first line
          }

          // Process lines from end to start
          for (let i = lines.length - 1; i >= 0 && messages.length < limit; i--) {
            try {
              const parsed = JSON.parse(lines[i]);

              if (parsed.type === 'user' || parsed.type === 'assistant') {
                // Skip meta messages (system caveats, etc.)
                if (parsed.isMeta) {
                  continue;
                }

                // Skip duplicates (can happen at chunk boundaries)
                if (parsed.uuid && seenUuids.has(parsed.uuid)) {
                  continue;
                }

                const textContent = extractTextContent(parsed.message?.content || '');
                if (textContent) {
                  if (parsed.uuid) seenUuids.add(parsed.uuid);
                  // Insert at beginning to maintain chronological order
                  messages.unshift({
                    type: parsed.type,
                    content: textContent,
                    timestamp: parsed.timestamp,
                    uuid: parsed.uuid,
                  });
                }
              }
            } catch (parseError) {
              continue;
            }
          }

          // Move to previous chunk
          currentEnd = chunkStart;
        }
      } finally {
        await fd.close();
      }

      return messages;
    } catch (error) {
      this.debugLog(`Error reading recent messages: ${error.message}`);
      return [];
    }
  }

  async loadMessagesFromFile(filePath) {
    try {
      // For full message load, still read entire file but with better error handling
      const content = await fsPromises.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n');

      const messages = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);

          if (parsed.type === 'user') {
            const userContent = extractTextContent(parsed.message?.content || '');
            if (userContent) {
              messages.push({
                type: 'user',
                content: userContent,
                timestamp: parsed.timestamp,
                uuid: parsed.uuid,
              });
            }
          } else if (parsed.type === 'assistant') {
            const assistantContent = extractTextContent(parsed.message?.content || '');
            if (assistantContent) {
              messages.push({
                type: 'assistant',
                content: assistantContent,
                timestamp: parsed.timestamp,
                uuid: parsed.uuid,
              });
            }
          }
        } catch (parseError) {
          continue;
        }
      }

      return messages;
    } catch (error) {
      safeLog.error('Error loading messages from file:', error);
      return [];
    }
  }

  async getAvailablePrompts() {
    try {
      // Use getPromptsDir() for consistent path handling with user settings
      const promptsDir = this.getPromptsDir();
      const files = await fsPromises.readdir(promptsDir);

      const prompts = files
        .filter((file) => file.endsWith('.md'))
        .map((file) => ({
          filename: file,
          displayName: file.replace('.md', '').replace(/-/g, ' '),
        }))
        .sort((a, b) => a.filename.localeCompare(b.filename));

      return prompts;
    } catch (error) {
      safeLog.error('Error getting prompts:', error);
      return [];
    }
  }

  // ==========================================================================
  // Terminal Handler Business Logic
  // Task 3: Extract and implement business logic methods for terminal IPC
  // ==========================================================================

  /**
   * Handle resume-session request
   * Opens a terminal in the session's project directory
   *
   * @param {string} sessionId - Session identifier
   * @param {string} promptFile - Optional prompt file to load
   * @param {boolean} useTmuxOverride - Whether to use tmux
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async handleResumeSession(sessionId, promptFile, useTmuxOverride) {
    const { execSync } = require('child_process');
    const { getTerminalSettings, launchTerminal } = require('./config/terminal');

    // eslint-disable-next-line no-async-promise-executor -- Legacy pattern, functional as-is
    return new Promise(async (resolve) => {
      try {
        // Get terminal settings from database
        const terminalSettings = getTerminalSettings(this.db);

        // useTmuxOverride allows UI to override the setting
        // If not explicitly passed (undefined), use settings
        const useTmux = useTmuxOverride !== undefined ? useTmuxOverride : terminalSettings.useTmux;

        // Construct full prompt file path if a filename was provided
        // getAvailablePrompts returns only filenames, so we need to reconstruct the full path
        let fullPromptPath = null;
        if (promptFile) {
          try {
            const promptsDir = this.getPromptsDir();
            fullPromptPath = path.join(promptsDir, promptFile);

            // Validate prompt file before use
            // This will throw AppError if validation fails (path traversal, not found, etc.)
            validatePromptFile(fullPromptPath, promptsDir);
          } catch (error) {
            if (error instanceof AppError) {
              // Report validation error to user via toast
              reportErrorToRenderer(error);
              // Abort session resume - validation failed
              resolve({
                success: false,
                error: error.message,
              });
              return;
            }
            // Unexpected error - re-throw
            throw error;
          }
        }

        if (useTmux) {
          // Use configurable prefix instead of hardcoded 'claude-'
          const tmuxPrefix = terminalSettings.tmuxSessionPrefix || 'claude-';
          const sessionName = `${tmuxPrefix}${sessionId.substring(0, 8)}`;

          // Check if tmux is installed
          try {
            execSync('which tmux', { stdio: 'pipe' });
          } catch (err) {
            safeLog.error('tmux not found');
            resolve({
              success: false,
              error: 'tmux is not installed. Please install tmux or disable tmux in settings.',
            });
            return;
          }

          // Query database to get working directory (same pattern as tmux4)
          let workingDir = null;
          if (this.db) {
            const row = this.db
              .prepare(
                `
              SELECT project_path, file_path
              FROM session_metadata
              WHERE session_id = ?
            `
              )
              .get(sessionId);

            if (row) {
              // Use project_path if available, otherwise extract from file_path
              workingDir = row.project_path;
              if (!workingDir && row.file_path) {
                workingDir = path.dirname(row.file_path);
              }
            }
          }

          // Validate working directory exists, fall back to $HOME if not
          if (workingDir && !fs.existsSync(workingDir)) {
            safeLog.warn(
              `Original working directory not found: ${workingDir}, falling back to $HOME`
            );
            workingDir = null; // Will use fallback below
          }

          if (!workingDir) {
            workingDir = os.homedir(); // Fallback to home directory
          }

          // Build the claude command using configured settings
          // Uses buildClaudeCommand for model, binary path, permissions, etc.
          const escapedWorkingDir = workingDir.replace(/'/g, "'\\''");
          const cmdArray = this.buildClaudeCommand(sessionId, fullPromptPath);
          // Properly quote each argument for shell execution
          // CRITICAL: Arguments with $(cat...) command substitution must use double quotes
          // to allow the substitution to execute inside bash -c
          const claudeCmd = cmdArray
            .map((arg) => {
              // Detect command substitution pattern: "$(cat ...)"
              if (arg.startsWith('"$(cat ') && arg.endsWith(')"')) {
                // DON'T escape - return as-is
                // The argument is already properly quoted: "$(cat /path)"
                // When embedded in bash -c "${claudeCmd}", bash will execute the substitution
                return arg;
              }
              // Default: use single quotes for safety (no expansion)
              return `'${arg.replace(/'/g, "'\\''")}'`;
            })
            .join(' ');

          // Create temporary shell script for reliable execution
          // This approach is more reliable than osascript because:
          // 1. Shell scripts handle quoting/escaping natively
          // 2. Terminal opens the script in a new window
          // 3. The script can clean itself up after execution
          const scriptPath = path.join(
            os.tmpdir(),
            `claude-resume-${sessionName}-${Date.now()}.sh`
          );

          // Script content with self-cleanup
          // The script:
          // 1. Changes to the correct working directory
          // 2. Checks if tmux session already exists (kill it if so)
          // 3. Creates new tmux session with the claude command
          // 4. Attaches to the session
          // 5. Removes itself after tmux exits
          const scriptContent = `#!/bin/bash
# Auto-generated script for resuming Claude session in tmux
# Session: ${sessionId}
# Working Directory: ${workingDir}
# Tmux Session: ${sessionName}
# Generated: ${new Date().toISOString()}

# Store script path for self-cleanup
SCRIPT_PATH="${scriptPath}"

# Change to working directory
cd '${escapedWorkingDir}' || {
    echo "Error: Could not change to directory ${escapedWorkingDir}"
    echo "Press any key to close..."
    read -n 1
    rm -f "$SCRIPT_PATH"
    exit 1
}

# Check if session already exists and kill it
if tmux has-session -t "${sessionName}" 2>/dev/null; then
    echo "Session ${sessionName} already exists, killing it..."
    tmux kill-session -t "${sessionName}"
fi

# Create new tmux session and run claude
# Using bash -c to ensure command substitution $(cat) is executed
tmux new-session -s "${sessionName}" -- bash -c "${claudeCmd}"

# Cleanup: Remove this script after tmux exits
rm -f "$SCRIPT_PATH"
`;

          // Write the script file
          fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
          safeLog.log(`Created resume script at: ${scriptPath}`);

          // Track script for cleanup on app exit (in case terminal isn't opened)
          if (!this.tempScripts) {
            this.tempScripts = new Set();
          }
          this.tempScripts.add(scriptPath);

          // Launch using configured terminal (instead of hardcoded Terminal.app)
          try {
            await launchTerminal(scriptPath, terminalSettings);
            safeLog.log(`Opened tmux session ${sessionName} via ${terminalSettings.application}`);
            resolve({ success: true });
          } catch (error) {
            // Cleanup script on failure
            try {
              fs.unlinkSync(scriptPath);
              this.tempScripts?.delete(scriptPath);
            } catch (e) {
              // Ignore cleanup errors
            }
            resolve({ success: false, error: error.message });
          }
        } else {
          // Non-tmux: Single terminal session
          // Also using shell script approach for consistency and reliability

          // Query database to get working directory (same pattern as tmux)
          let workingDir = null;
          if (this.db) {
            const row = this.db
              .prepare(
                `
              SELECT project_path, file_path
              FROM session_metadata
              WHERE session_id = ?
            `
              )
              .get(sessionId);

            if (row) {
              // Use project_path if available, otherwise extract from file_path
              workingDir = row.project_path;
              if (!workingDir && row.file_path) {
                workingDir = path.dirname(row.file_path);
              }
            }
          }

          // Validate working directory exists, fall back to $HOME if not
          if (workingDir && !fs.existsSync(workingDir)) {
            safeLog.warn(
              `Original working directory not found: ${workingDir}, falling back to $HOME`
            );
            workingDir = null; // Will use fallback below
          }

          if (!workingDir) {
            workingDir = os.homedir(); // Fallback to home directory
          }

          // Build claude command using configured settings
          // Uses buildClaudeCommand for model, binary path, permissions, etc.
          const escapedWorkingDir = workingDir.replace(/'/g, "'\\''");
          // Properly quote each argument for shell execution
          // CRITICAL: Arguments with $(cat...) command substitution must use double quotes
          const claudeCmd = this.buildClaudeCommand(sessionId, fullPromptPath)
            .map((arg) => {
              // Detect command substitution pattern: "$(cat ...)"
              if (arg.startsWith('"$(cat ') && arg.endsWith(')"')) {
                // Use double quotes and escape for non-tmux direct execution
                // Since line 3014 uses ${claudeCmd} without quotes, keep the quotes in the arg
                return arg;
              }
              // Default: use single quotes for safety (no expansion)
              return `'${arg.replace(/'/g, "'\\''")}'`;
            })
            .join(' ');

          const scriptPath = path.join(
            os.tmpdir(),
            `claude-resume-${sessionId.substring(0, 8)}-${Date.now()}.sh`
          );

          const scriptContent = `#!/bin/bash
# Auto-generated script for resuming Claude session
# Session: ${sessionId}
# Working Directory: ${workingDir}
# Generated: ${new Date().toISOString()}

SCRIPT_PATH="${scriptPath}"

# Change to working directory
cd '${escapedWorkingDir}' || {
    echo "Error: Could not change to directory ${escapedWorkingDir}"
    echo "Press any key to close..."
    read -n 1
    rm -f "$SCRIPT_PATH"
    exit 1
}

# Run claude resume command
${claudeCmd}

# Cleanup: Remove this script after claude exits
rm -f "$SCRIPT_PATH"
`;

          fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
          safeLog.log(`Created resume script at: ${scriptPath}`);

          // Track script for cleanup
          if (!this.tempScripts) {
            this.tempScripts = new Set();
          }
          this.tempScripts.add(scriptPath);

          // Launch using configured terminal (instead of hardcoded Terminal.app)
          try {
            await launchTerminal(scriptPath, terminalSettings);
            safeLog.log(`Spawning terminal for session: ${sessionId}`);
            resolve({ success: true });
          } catch (error) {
            try {
              fs.unlinkSync(scriptPath);
              this.tempScripts?.delete(scriptPath);
            } catch (e) {
              // Ignore cleanup errors
            }
            resolve({ success: false, error: error.message });
          }
        }
      } catch (error) {
        // Catch any synchronous errors during setup
        safeLog.error('Error in resume-session:', error);
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Handle open-sessions-tmux4 request
   * Opens multiple sessions in tmux windows
   *
   * @param {string[]} sessionIds - Array of session identifiers
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async handleOpenSessionsTmux4(sessionIds) {
    const { getTerminalSettings, launchTerminal } = require('./config/terminal');
    const { execSync } = require('child_process');

    try {
      // Validation: Accept 1-4 sessions
      if (!Array.isArray(sessionIds) || sessionIds.length === 0 || sessionIds.length > 4) {
        return {
          success: false,
          error:
            sessionIds.length > 4
              ? 'Maximum 4 sessions can be opened in tmux. First 4 will be used.'
              : 'Please select at least 1 session to open.',
        };
      }

      // Check if tmux is installed
      try {
        execSync('which tmux', { stdio: 'pipe' });
      } catch (err) {
        return {
          success: false,
          error: 'tmux is not installed. Please install tmux to use this feature.',
        };
      }

      // Query database for each session to get working directory
      if (!this.db) {
        return { success: false, error: 'Database not initialized' };
      }

      const sessionData = [];
      for (const sessionId of sessionIds.slice(0, 4)) {
        // Only take first 4
        const row = this.db
          .prepare(
            `
          SELECT session_id, project_path, file_path
          FROM session_metadata
          WHERE session_id = ?
        `
          )
          .get(sessionId);

        if (!row) {
          return { success: false, error: `Session ${sessionId} not found in database` };
        }

        // Use project_path if available, otherwise extract directory from file_path
        let workingDir = row.project_path;
        if (!workingDir && row.file_path) {
          workingDir = path.dirname(row.file_path);
        }

        // Validate working directory exists, fall back to $HOME if not
        if (workingDir && !fs.existsSync(workingDir)) {
          safeLog.warn(
            `Original working directory not found for session ${sessionId}: ${workingDir}, falling back to $HOME`
          );
          workingDir = null; // Will use fallback below
        }

        if (!workingDir) {
          workingDir = os.homedir(); // Fallback to home directory
        }

        sessionData.push({
          sessionId: row.session_id,
          workingDir: workingDir,
        });
      }

      // Build shell script for tmux4 layout (2x2 pane grid)
      const sessionName = `claude-multi-${Date.now()}`;
      const scriptPath = path.join(os.tmpdir(), `claude-tmux4-${sessionName}.sh`);

      // Escape paths for shell safety
      const escapeForShell = (str) => str.replace(/'/g, "'\\''");

      // Build claude commands using configured settings for each session
      // Properly quote each argument for shell execution
      // CRITICAL: Arguments with $(cat...) command substitution must use double quotes
      const quoteArg = (arg) => {
        // Detect command substitution pattern: "$(cat ...)"
        if (arg.startsWith('"$(cat ') && arg.endsWith(')"')) {
          // DON'T escape - return as-is
          // The argument is already properly quoted: "$(cat /path)"
          // When embedded in bash -c "${claudeCmd}", bash will execute the substitution
          return arg;
        }
        // Default: use single quotes for safety (no expansion)
        return `'${arg.replace(/'/g, "'\\''")}'`;
      };

      const claudeCmd0 = this.buildClaudeCommand(sessionData[0].sessionId).map(quoteArg).join(' ');
      const claudeCmd1 = sessionData[1]
        ? this.buildClaudeCommand(sessionData[1].sessionId).map(quoteArg).join(' ')
        : null;
      const claudeCmd2 = sessionData[2]
        ? this.buildClaudeCommand(sessionData[2].sessionId).map(quoteArg).join(' ')
        : null;
      const claudeCmd3 = sessionData[3]
        ? this.buildClaudeCommand(sessionData[3].sessionId).map(quoteArg).join(' ')
        : null;

      let scriptContent = `#!/bin/bash
# Auto-generated script for opening ${sessionData.length} Claude sessions in tmux4 layout
# Session Name: ${sessionName}
# Generated: ${new Date().toISOString()}

SCRIPT_PATH="${scriptPath}"

# Check if tmux session already exists and kill it
if tmux has-session -t "${sessionName}" 2>/dev/null; then
    echo "Session ${sessionName} already exists, killing it..."
    tmux kill-session -t "${sessionName}"
fi

# Pane 1 (top-left) - Create new tmux session
cd '${escapeForShell(sessionData[0].workingDir)}' || exit 1
tmux new-session -d -s "${sessionName}" -- ${claudeCmd0}
`;

      // Pane 2 (top-right) - Split horizontally
      if (sessionData[1]) {
        scriptContent += `
# Pane 2 (top-right) - Split horizontally
tmux split-window -h -t "${sessionName}" -c '${escapeForShell(sessionData[1].workingDir)}' -- ${claudeCmd1}
`;
      }

      // Pane 3 (bottom-left) - Split first pane vertically
      if (sessionData[2]) {
        scriptContent += `
# Pane 3 (bottom-left) - Split first pane vertically
tmux select-pane -t "${sessionName}":0.0
tmux split-window -v -t "${sessionName}" -c '${escapeForShell(sessionData[2].workingDir)}' -- ${claudeCmd2}
`;
      }

      // Pane 4 (bottom-right) - Split second pane vertically
      if (sessionData[3]) {
        scriptContent += `
# Pane 4 (bottom-right) - Split second pane vertically
tmux select-pane -t "${sessionName}":0.1
tmux split-window -v -t "${sessionName}" -c '${escapeForShell(sessionData[3].workingDir)}' -- ${claudeCmd3}
`;
      }

      scriptContent += `
# Apply tiled layout for even distribution
tmux select-layout -t "${sessionName}" tiled

# Attach to the session
tmux attach-session -t "${sessionName}"

# Cleanup: Remove this script after tmux exits
rm -f "$SCRIPT_PATH"
`;

      // Write the script file
      fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
      safeLog.log(`Created tmux4 script at: ${scriptPath}`);

      // Track script for cleanup on app exit
      if (!this.tempScripts) {
        this.tempScripts = new Set();
      }
      this.tempScripts.add(scriptPath);

      // Get terminal settings from database
      const terminalSettings = getTerminalSettings(this.db);

      // Launch using configured terminal
      try {
        await launchTerminal(scriptPath, terminalSettings);
        safeLog.log(
          `Opened ${sessionData.length} sessions in tmux4 layout via ${terminalSettings.application}`
        );
        return { success: true };
      } catch (error) {
        try {
          fs.unlinkSync(scriptPath);
          this.tempScripts?.delete(scriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }
        return { success: false, error: error.message };
      }
    } catch (error) {
      safeLog.error('Error in open-sessions-tmux4:', error);
      return { success: false, error: error.message };
    }
  }
}

// =============================================================================
// PROMPT FILE VALIDATION
// =============================================================================

/**
 * Validates prompt file path and content before use
 *
 * Performs comprehensive security and validation checks:
 * 1. Path traversal prevention - ensures file is within allowed directory
 * 2. Existence check - file must exist
 * 3. File type check - must be regular file (not symlink, directory, device)
 * 4. Size check - max 10MB to prevent DoS attacks
 * 5. Permission check - must have read permission
 * 6. Content validation - must not be empty or whitespace-only
 *
 * @param {string} promptPath - Absolute path to prompt file
 * @param {string} promptsDir - Base prompts directory for traversal check
 * @returns {string} File content (validated non-empty)
 * @throws {AppError} If validation fails (code: PROMPT_FILE_*)
 *
 * @example
 * try {
 *   const content = validatePromptFile('/path/to/prompt.txt', '/path/to/prompts');
 *   console.log('Valid prompt:', content);
 * } catch (error) {
 *   if (error instanceof AppError) {
 *     reportErrorToRenderer(error);
 *   }
 * }
 */
function validatePromptFile(promptPath, promptsDir) {
  const { AppError, ErrorCode } = require('./error-handler');

  // 1. PATH TRAVERSAL CHECK
  // Normalize both paths and ensure prompt file is within allowed directory
  const normalizedPath = path.normalize(promptPath);
  const normalizedDir = path.normalize(promptsDir);

  if (!normalizedPath.startsWith(normalizedDir)) {
    throw new AppError(
      ErrorCode.PROMPT_FILE_PATH_TRAVERSAL,
      `Prompt file outside allowed directory: ${promptPath}`,
      { promptPath, promptsDir }
    );
  }

  // 2. EXISTENCE CHECK
  // File must exist before we can validate it
  if (!fs.existsSync(promptPath)) {
    throw new AppError(ErrorCode.PROMPT_FILE_NOT_FOUND, `Prompt file not found: ${promptPath}`, {
      promptPath,
    });
  }

  // 3. FILE TYPE CHECK
  // Reject symlinks, directories, and other non-regular files
  // Use lstat (not stat) to detect symlinks before following them
  let stats;
  try {
    stats = fs.lstatSync(promptPath);
  } catch (err) {
    throw new AppError(
      ErrorCode.PROMPT_FILE_UNREADABLE,
      `Cannot access prompt file: ${promptPath}`,
      { promptPath, originalError: err.message }
    );
  }

  if (!stats.isFile()) {
    const fileType = stats.isDirectory() ? 'directory' : 'other';
    throw new AppError(
      ErrorCode.PROMPT_FILE_INVALID,
      `Prompt path is not a regular file: ${promptPath}`,
      { promptPath, type: fileType }
    );
  }

  // 4. SIZE CHECK
  // Prevent DoS attacks with huge files (max 10MB)
  const MAX_PROMPT_SIZE = 10 * 1024 * 1024; // 10MB
  if (stats.size > MAX_PROMPT_SIZE) {
    throw new AppError(
      ErrorCode.PROMPT_FILE_INVALID,
      `Prompt file too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max 10MB)`,
      { promptPath, size: stats.size }
    );
  }

  // 5. READ PERMISSION CHECK
  // Ensure we have permission to read the file before attempting
  try {
    fs.accessSync(promptPath, fs.constants.R_OK);
  } catch (err) {
    throw new AppError(
      ErrorCode.PROMPT_FILE_UNREADABLE,
      `Cannot read prompt file (permission denied): ${promptPath}`,
      { promptPath, originalError: err.message }
    );
  }

  // 6. READ CONTENT
  // Actually read the file content
  let content;
  try {
    content = fs.readFileSync(promptPath, 'utf8');
  } catch (err) {
    throw new AppError(
      ErrorCode.PROMPT_FILE_UNREADABLE,
      `Failed to read prompt file: ${err.message}`,
      { promptPath, originalError: err.message }
    );
  }

  // 7. EMPTY CONTENT CHECK
  // Reject empty files or files with only whitespace
  if (content.trim().length === 0) {
    throw new AppError(ErrorCode.PROMPT_FILE_EMPTY, `Prompt file is empty: ${promptPath}`, {
      promptPath,
    });
  }

  return content;
}

// Check if app is available (Electron context) OR if this is the main module
if ((app && typeof app.isReady === 'function' && !app.isReady()) || require.main === module) {
  safeLog.log('Starting Universal Session Viewer...');

  // Setup global error handlers first
  // This ensures we catch any errors during app initialization
  setupGlobalErrorHandlers();

  let appInstance;

  try {
    appInstance = new SessionViewerApp();
    safeLog.log('SessionViewerApp instance created successfully');
  } catch (error) {
    safeLog.error('Failed to create SessionViewerApp instance:', error);
    safeLog.error('Error stack:', error.stack);
    errorBuffer.add(
      new AppError(ErrorCode.UNKNOWN, error.message, { severity: ErrorSeverity.CRITICAL })
    );
    process.exit(1);
  }

  app
    .whenReady()
    .then(async () => {
      safeLog.log('App is ready, initializing database...');
      try {
        // Initialize database with graceful degradation
        try {
          await appInstance.initializeDatabase();
          appInstance.loadSettings();
          safeLog.log('Database initialized');
        } catch (dbError) {
          // Database failure is recoverable - app can run with limited functionality
          safeLog.error(
            'Database initialization failed (app will continue with limited functionality):',
            dbError
          );
          errorBuffer.add(
            new AppError(ErrorCode.DB_INIT_FAILED, dbError.message, {
              severity: ErrorSeverity.ERROR,
              recoverable: true,
            })
          );
          // Continue without database - some features will be disabled
        }

        safeLog.log('Setting up IPC...');
        // Using modular IPC handlers (src/electron/ipc/)
        // Replaces inline setupIPC function with organized, maintainable handlers
        const { registerAllHandlers } = require('./ipc');
        registerAllHandlers(appInstance);

        // Setup error-related IPC handlers
        setupErrorIPC(ipcMain);

        safeLog.log('IPC setup complete, initializing menu...');
        initializeMenu(appInstance);
        safeLog.log('Menu initialized, initializing system tray...');

        try {
          createTray(appInstance);
          safeLog.log('System tray initialized');
        } catch (trayError) {
          // Tray failure is non-critical
          safeLog.warn('System tray initialization failed (non-critical):', trayError);
        }

        safeLog.log('Creating window...');
        await appInstance.createWindow();

        // Set main window reference for error reporting
        if (appInstance.mainWindow) {
          setMainWindow(appInstance.mainWindow);

          // Window lifecycle error handling
          appInstance.mainWindow.on('unresponsive', () => {
            safeLog.warn('Window became unresponsive');
            errorBuffer.add(
              new AppError(ErrorCode.WINDOW_LOAD_FAILED, 'Window became unresponsive', {
                severity: ErrorSeverity.WARNING,
              })
            );
          });

          appInstance.mainWindow.on('responsive', () => {
            safeLog.log('Window became responsive again');
          });

          appInstance.mainWindow.webContents.on('crashed', (event, killed) => {
            safeLog.error('Renderer process crashed', { killed });
            errorBuffer.add(
              new AppError(
                ErrorCode.WINDOW_LOAD_FAILED,
                killed ? 'Renderer process was killed' : 'Renderer process crashed',
                { severity: ErrorSeverity.CRITICAL }
              )
            );

            // Offer to reload or quit
            dialog
              .showMessageBox(appInstance.mainWindow, {
                type: 'error',
                title: 'Renderer Crashed',
                message: 'The application display crashed.',
                detail: 'Would you like to reload the app?',
                buttons: ['Reload', 'Quit'],
                defaultId: 0,
              })
              .then(({ response }) => {
                if (response === 0) {
                  appInstance.mainWindow.reload();
                } else {
                  app.quit();
                }
              })
              .catch(() => {
                app.quit();
              });
          });

          appInstance.mainWindow.webContents.on('render-process-gone', (event, details) => {
            safeLog.error('Render process gone:', details);
            errorBuffer.add(
              new AppError(ErrorCode.WINDOW_LOAD_FAILED, `Render process gone: ${details.reason}`, {
                severity: ErrorSeverity.CRITICAL,
                details,
              })
            );
          });

          appInstance.mainWindow.webContents.on(
            'did-fail-load',
            (event, errorCode, errorDescription, validatedURL) => {
              if (errorCode !== -3) {
                // Ignore aborted loads
                safeLog.error('Failed to load:', { errorCode, errorDescription, validatedURL });
                errorBuffer.add(
                  new AppError(
                    ErrorCode.WINDOW_LOAD_FAILED,
                    `Failed to load: ${errorDescription}`,
                    { severity: ErrorSeverity.ERROR, errorCode, validatedURL }
                  )
                );
              }
            }
          );
        }

        safeLog.log('Window creation complete');

        // Sync stale entries on startup (catches changes while app was closed)
        safeLog.log('Syncing filesystem changes since last run...');
        try {
          await appInstance.syncFilesystemToMetadata();
          safeLog.log('Startup sync complete');
        } catch (syncError) {
          safeLog.error('Filesystem sync failed (non-critical):', syncError);
          errorBuffer.add(
            new AppError(ErrorCode.FS_READ_FAILED, 'Failed to sync filesystem changes', {
              severity: ErrorSeverity.WARNING,
            })
          );
        }

        // Start file watcher for real-time session updates
        try {
          appInstance.startFileWatcher();
          safeLog.log('File watcher started');
        } catch (watchError) {
          safeLog.error('File watcher failed to start:', watchError);
          errorBuffer.add(
            new AppError(ErrorCode.FS_WATCH_FAILED, watchError.message, {
              severity: ErrorSeverity.WARNING,
            })
          );
          // Report to renderer so user knows auto-refresh is disabled
          reportErrorToRenderer(
            new AppError(
              ErrorCode.FS_WATCH_FAILED,
              'Auto-refresh disabled. Manual refresh required.',
              { severity: ErrorSeverity.WARNING }
            )
          );
        }

        // Start background analysis of sessions that need it
        const sessionsToAnalyze = appInstance.getSessionsToAnalyze();
        if (sessionsToAnalyze.length > 0) {
          safeLog.log(`Starting background analysis of ${sessionsToAnalyze.length} sessions...`);
          // Run analysis in background (don't await - let app be responsive)
          appInstance
            .analyzeSessionsQueue(sessionsToAnalyze)
            .then(() => {
              safeLog.log('Background analysis complete');
            })
            .catch((err) => {
              safeLog.error('Background analysis error:', err);
              errorBuffer.add(
                new AppError(ErrorCode.ANALYSIS_FAILED, err.message, {
                  severity: ErrorSeverity.WARNING,
                })
              );
            });
        } else {
          safeLog.log('No sessions need analysis');
        }
      } catch (error) {
        safeLog.error('Error during app initialization:', error);
        safeLog.error('Error stack:', error.stack);
        errorBuffer.add(
          new AppError(ErrorCode.UNKNOWN, error.message, {
            severity: ErrorSeverity.CRITICAL,
            stack: error.stack,
          })
        );
      }
    })
    .catch((error) => {
      safeLog.error('Error during app ready:', error);
      safeLog.error('Error stack:', error.stack);
      errorBuffer.add(
        new AppError(ErrorCode.UNKNOWN, error.message, { severity: ErrorSeverity.CRITICAL })
      );
    });

  app.on('window-all-closed', () => {
    try {
      appInstance.closeDatabase();
    } catch (error) {
      safeLog.error('Error closing database:', error);
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    try {
      destroyTray();

      if (appInstance.orphanHealingInterval) {
        clearInterval(appInstance.orphanHealingInterval);
        appInstance.orphanHealingInterval = null;
      }

      // Stop file watcher to prevent resource leaks and IPC errors during shutdown
      if (appInstance.fileWatcher) {
        appInstance.stopFileWatcher();
        safeLog.log('File watcher stopped during app shutdown');
      }

      // Kill all active child processes (Go backend, Claude CLI)
      if (appInstance.childProcesses && appInstance.childProcesses.size > 0) {
        safeLog.log(`Terminating ${appInstance.childProcesses.size} active child process(es)`);

        for (const childProcess of appInstance.childProcesses) {
          try {
            if (!childProcess.killed) {
              // Send SIGTERM first (graceful shutdown)
              childProcess.kill('SIGTERM');

              // Force kill after 2 seconds if still alive
              setTimeout(() => {
                if (!childProcess.killed) {
                  safeLog.warn('Process did not terminate gracefully, sending SIGKILL');
                  childProcess.kill('SIGKILL');
                }
              }, 2000);
            }
          } catch (killError) {
            // Ignore errors killing already-dead processes
            safeLog.debug(`Could not kill process: ${killError.message}`);
          }
        }

        appInstance.childProcesses.clear();
        appInstance.activeAnalyses.clear();
      }

      // Cancel pending analyses in queue
      if (appInstance.analysisQueue && appInstance.analysisQueue.length > 0) {
        safeLog.log(`Cancelling ${appInstance.analysisQueue.length} pending analysis tasks`);
        appInstance.analysisQueue = [];
        appInstance.isAnalyzing = false;
      }

      appInstance.closeDatabase();

      // Clean up any remaining temp scripts from resume-session
      // These scripts self-delete after execution, but we clean up any that remain
      // (e.g., if Terminal.app wasn't opened or the app is quitting early)
      if (appInstance.tempScripts && appInstance.tempScripts.size > 0) {
        safeLog.log(`Cleaning up ${appInstance.tempScripts.size} temp resume scripts`);
        for (const scriptPath of appInstance.tempScripts) {
          try {
            if (fs.existsSync(scriptPath)) {
              fs.unlinkSync(scriptPath);
              safeLog.log(`Cleaned up temp script: ${scriptPath}`);
            }
          } catch (e) {
            // Ignore individual cleanup errors
            safeLog.warn(`Could not clean up temp script ${scriptPath}: ${e.message}`);
          }
        }
        appInstance.tempScripts.clear();
      }
    } catch (error) {
      safeLog.error('Error during app cleanup:', error);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      appInstance
        .createWindow()
        .then(() => {
          if (appInstance.mainWindow) {
            setMainWindow(appInstance.mainWindow);
          }
        })
        .catch((error) => {
          safeLog.error('Error creating window on activate:', error);
        });
    }
  });

  // Handle GPU process crashes
  app.on('gpu-process-crashed', (event, killed) => {
    safeLog.error('GPU process crashed', { killed });
    errorBuffer.add(
      new AppError(ErrorCode.UNKNOWN, killed ? 'GPU process was killed' : 'GPU process crashed', {
        severity: ErrorSeverity.WARNING,
      })
    );
  });

  // Handle child process crashes
  app.on('child-process-gone', (event, details) => {
    safeLog.error('Child process gone:', details);
    errorBuffer.add(
      new AppError(ErrorCode.UNKNOWN, `Child process (${details.type}) gone: ${details.reason}`, {
        severity: ErrorSeverity.WARNING,
        details,
      })
    );
  });
}

// Export the class and functions for testing
module.exports = SessionViewerApp;
module.exports.validatePromptFile = validatePromptFile;
