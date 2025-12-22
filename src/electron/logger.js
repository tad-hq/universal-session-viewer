/**
 * Centralized Logger for Universal Session Viewer
 *
 * Wraps electron-log to provide safe, consistent logging throughout the Electron
 * main process. This prevents EPIPE errors that occur when using console.log/error
 * in async callbacks or after process shutdown begins.
 *
 * V2 Pattern: electron-log replaces all console.* calls in main process
 *
 * Features:
 *   - File logging to ~/.claude-m/logs/
 *   - Console output in development mode
 *   - Safe logging that won't throw EPIPE on broken pipe
 *   - Structured log levels (error, warn, info, debug)
 *   - Automatic log rotation
 *
 * Usage:
 *   const log = require('./logger');
 *   log.info('Session loaded');
 *   log.error('Failed to load session:', error);
 *   log.warn('Cache miss');
 *   log.debug('Verbose debug info');
 */

const os = require('os');
const path = require('path');

const electronLog = require('electron-log');

// Configure log file location
// Store logs in ~/.claude-m/logs/ alongside other app data
const logDir = path.join(os.homedir(), '.claude-m', 'logs');
electronLog.transports.file.resolvePathFn = () => path.join(logDir, 'main.log');

// Configure log rotation
electronLog.transports.file.maxSize = 10 * 1024 * 1024; // 10MB max file size

// Configure log format
electronLog.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// Configure console transport (for development)
// In production, we primarily rely on file logging
electronLog.transports.console.format = '[{level}] {text}';

// Set log level based on environment
// In development, show all logs including debug
// In production, show info and above
const isDev = process.env.NODE_ENV === 'development' || !require('electron').app?.isPackaged;
electronLog.transports.file.level = isDev ? 'debug' : 'info';
electronLog.transports.console.level = isDev ? 'debug' : 'info';

// Catch and log unhandled errors
electronLog.catchErrors({
  showDialog: false,
  onError: (error) => {
    electronLog.error('Unhandled error caught by electron-log:', error);
  },
});

/**
 * Safe wrapper that ensures logging never throws
 * This is critical for preventing EPIPE errors in async callbacks
 *
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {...any} args - Arguments to log
 */
function safeLog(level, ...args) {
  try {
    electronLog[level](...args);
  } catch {
    // Silently ignore logging errors (e.g., EPIPE on shutdown)
    // This is intentional - we don't want logging failures to crash the app
  }
}

/**
 * Exported logger interface
 *
 * Provides safe wrappers around electron-log methods:
 * - log.error() - For errors and exceptions
 * - log.warn() - For warnings and potential issues
 * - log.info() - For general informational messages
 * - log.debug() - For verbose debugging (disabled in production)
 * - log.log() - Alias for log.info()
 *
 * All methods are safe to call in any context, including:
 * - Async callbacks
 * - Error handlers
 * - Process shutdown handlers
 * - File watcher callbacks
 * - IPC handlers
 */
const log = {
  /**
   * Log an error message
   * Use for: Exceptions, failed operations, critical issues
   * @param {...any} args - Error message and optional error object
   */
  error: (...args) => safeLog('error', ...args),

  /**
   * Log a warning message
   * Use for: Deprecated features, potential issues, recoverable errors
   * @param {...any} args - Warning message
   */
  warn: (...args) => safeLog('warn', ...args),

  /**
   * Log an informational message
   * Use for: Status updates, operation completions, important events
   * @param {...any} args - Info message
   */
  info: (...args) => safeLog('info', ...args),

  /**
   * Log a debug message (only shown in development)
   * Use for: Verbose debugging, variable dumps, trace information
   * @param {...any} args - Debug message
   */
  debug: (...args) => safeLog('debug', ...args),

  /**
   * Alias for info() - general purpose logging
   * @param {...any} args - Message to log
   */
  log: (...args) => safeLog('info', ...args),

  /**
   * Get the path to the log file
   * Useful for displaying in settings or opening in file browser
   * @returns {string} Full path to the log file
   */
  getLogPath: () => path.join(logDir, 'main.log'),

  /**
   * Get the log directory path
   * @returns {string} Full path to the log directory
   */
  getLogDir: () => logDir,

  /**
   * Access to the underlying electron-log instance
   * For advanced use cases that need direct access
   */
  _electronLog: electronLog,
};

module.exports = log;
