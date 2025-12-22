/**
 * Error Handling Infrastructure for Electron Main Process
 * V2 Enhancement: Centralized error handling for robustness
 *
 * V1 Reference: V1 had scattered try-catch blocks with inconsistent error handling
 * V2 Pattern: Structured errors, global handlers, renderer reporting
 *
 * This module provides:
 * - Structured error classes (AppError)
 * - Error code constants with user-friendly messages
 * - Global exception/rejection handlers
 * - Error buffer for tracking recent errors
 * - IPC error boundary wrappers
 * - Renderer error reporting
 */

const { app, dialog, clipboard } = require('electron');

// =============================================================================
// ERROR SEVERITY AND CODES
// =============================================================================

/**
 * Error severity levels for categorization
 * - critical: App should show error to user and may need restart
 * - error: Operation failed but app can continue
 * - warning: Something unexpected but recoverable
 */
const ErrorSeverity = {
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
};

/**
 * Error codes for categorization
 * Each code maps to a user-friendly message
 */
const ErrorCode = {
  DB_INIT_FAILED: 'DB_INIT_FAILED',
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_MIGRATION_FAILED: 'DB_MIGRATION_FAILED',

  FS_READ_FAILED: 'FS_READ_FAILED',
  FS_WRITE_FAILED: 'FS_WRITE_FAILED',
  FS_WATCH_FAILED: 'FS_WATCH_FAILED',
  FS_NOT_FOUND: 'FS_NOT_FOUND',

  IPC_HANDLER_FAILED: 'IPC_HANDLER_FAILED',
  IPC_INVALID_PARAMS: 'IPC_INVALID_PARAMS',

  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  ANALYSIS_QUOTA_EXCEEDED: 'ANALYSIS_QUOTA_EXCEEDED',
  ANALYSIS_TIMEOUT: 'ANALYSIS_TIMEOUT',

  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_INVALID: 'SESSION_INVALID',

  PROMPT_FILE_NOT_FOUND: 'PROMPT_FILE_NOT_FOUND',
  PROMPT_FILE_UNREADABLE: 'PROMPT_FILE_UNREADABLE',
  PROMPT_FILE_EMPTY: 'PROMPT_FILE_EMPTY',
  PROMPT_FILE_INVALID: 'PROMPT_FILE_INVALID',
  PROMPT_FILE_PATH_TRAVERSAL: 'PROMPT_FILE_PATH_TRAVERSAL',

  WINDOW_CREATE_FAILED: 'WINDOW_CREATE_FAILED',
  WINDOW_LOAD_FAILED: 'WINDOW_LOAD_FAILED',

  UNKNOWN: 'UNKNOWN',
  UNCAUGHT_EXCEPTION: 'UNCAUGHT_EXCEPTION',
  UNHANDLED_REJECTION: 'UNHANDLED_REJECTION',
};

/**
 * User-friendly error messages for each error code
 */
const ErrorMessages = {
  [ErrorCode.DB_INIT_FAILED]: 'Failed to initialize database. Some features may not work.',
  [ErrorCode.DB_QUERY_FAILED]: 'Database query failed. Please try again.',
  [ErrorCode.DB_MIGRATION_FAILED]: 'Database migration failed. Some data may be outdated.',
  [ErrorCode.FS_READ_FAILED]: 'Failed to read file. Please check file permissions.',
  [ErrorCode.FS_WRITE_FAILED]: 'Failed to write file. Please check disk space and permissions.',
  [ErrorCode.FS_WATCH_FAILED]: 'Failed to watch for file changes. Auto-refresh disabled.',
  [ErrorCode.FS_NOT_FOUND]: 'File or directory not found.',
  [ErrorCode.IPC_HANDLER_FAILED]: 'Internal communication error. Please try again.',
  [ErrorCode.IPC_INVALID_PARAMS]: 'Invalid request parameters.',
  [ErrorCode.ANALYSIS_FAILED]: 'Session analysis failed. Please try again.',
  [ErrorCode.ANALYSIS_QUOTA_EXCEEDED]: 'Daily analysis limit reached. Try again tomorrow.',
  [ErrorCode.ANALYSIS_TIMEOUT]: 'Analysis timed out. The session may be too large.',
  [ErrorCode.SESSION_NOT_FOUND]: 'Session not found. It may have been deleted.',
  [ErrorCode.SESSION_INVALID]: 'Invalid session format.',
  [ErrorCode.WINDOW_CREATE_FAILED]: 'Failed to create application window.',
  [ErrorCode.WINDOW_LOAD_FAILED]: 'Failed to load application interface.',
  [ErrorCode.UNKNOWN]: 'An unexpected error occurred.',
  [ErrorCode.UNCAUGHT_EXCEPTION]: 'An unexpected error occurred. The app will attempt to continue.',
  [ErrorCode.UNHANDLED_REJECTION]: 'An async operation failed unexpectedly.',
};

// =============================================================================
// APP ERROR CLASS
// =============================================================================

/**
 * Structured error class for consistent error handling
 * Provides:
 * - Error code for programmatic handling
 * - User-friendly message
 * - Detailed technical info for debugging
 * - Serialization for IPC transmission
 */
class AppError extends Error {
  constructor(code, message, details = {}) {
    super(message || ErrorMessages[code] || ErrorMessages[ErrorCode.UNKNOWN]);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.severity = details.severity || ErrorSeverity.ERROR;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      severity: this.severity,
      stack: this.stack,
    };
  }

  toUserFriendly() {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      timestamp: this.timestamp,
    };
  }
}

// =============================================================================
// ERROR BUFFER
// =============================================================================

/**
 * Error log buffer for collecting errors to send to renderer
 * Holds last N errors for display and reporting
 */
class ErrorBuffer {
  constructor(maxSize = 100) {
    this.errors = [];
    this.maxSize = maxSize;
    this.listeners = new Set();
  }

  add(error) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      error:
        error instanceof AppError
          ? error.toJSON()
          : {
              name: error.name || 'Error',
              code: ErrorCode.UNKNOWN,
              message: error.message || String(error),
              stack: error.stack,
              timestamp: new Date().toISOString(),
              severity: ErrorSeverity.ERROR,
            },
      read: false,
      addedAt: Date.now(),
    };

    this.errors.unshift(entry);

    if (this.errors.length > this.maxSize) {
      this.errors = this.errors.slice(0, this.maxSize);
    }

    setImmediate(() => {
      this.listeners.forEach((listener) => {
        try {
          listener(entry);
        } catch (e) {
          // Ignore listener errors to prevent cascading failures
        }
      });
    });

    return entry;
  }

  getUnread() {
    return this.errors.filter((e) => !e.read);
  }

  getAll() {
    return [...this.errors];
  }

  getRecent(count = 10) {
    return this.errors.slice(0, count);
  }

  markAsRead(id) {
    const entry = this.errors.find((e) => e.id === id);
    if (entry) {
      entry.read = true;
    }
  }

  markAllAsRead() {
    this.errors.forEach((e) => (e.read = true));
  }

  clear() {
    this.errors = [];
  }

  onError(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

const errorBuffer = new ErrorBuffer();

// =============================================================================
// ERROR REPORTING
// =============================================================================

let mainWindowRef = null;
let safeLogRef = console;

/**
 * Set the main window reference for error reporting
 * @param {BrowserWindow} window - The main window instance
 */
function setMainWindow(window) {
  mainWindowRef = window;
}

/**
 * Set the safe logging reference
 * @param {Object} logger - The safeLog instance
 */
function setSafeLog(logger) {
  safeLogRef = logger;
}

/**
 * Report error to renderer process if window is available
 * @param {Error|AppError} error - The error to report
 */
function reportErrorToRenderer(error) {
  if (!mainWindowRef || mainWindowRef.isDestroyed() || !mainWindowRef.webContents) {
    return;
  }

  try {
    const errorData =
      error instanceof AppError
        ? error.toUserFriendly()
        : {
            code: ErrorCode.UNKNOWN,
            message: error.message || String(error),
            severity: ErrorSeverity.ERROR,
            timestamp: new Date().toISOString(),
          };

    mainWindowRef.webContents.send('main-process-error', errorData);
  } catch (e) {
    // Failed to send to renderer - expected if window is closing
  }
}

/**
 * Create IPC error response with consistent format
 * @param {Error} error - The error to convert
 * @param {string} code - Optional error code override
 * @returns {Object} Standardized error response
 */
function createErrorResponse(error, code = ErrorCode.IPC_HANDLER_FAILED) {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(code, error.message || String(error), {
          originalError: error.name,
          stack: error.stack,
        });

  errorBuffer.add(appError);

  return {
    success: false,
    error: appError.message,
    errorCode: appError.code,
    errorDetails: process.env.NODE_ENV === 'development' ? appError.details : undefined,
  };
}

/**
 * Wrap IPC handler with error boundary
 * Ensures all IPC handlers:
 * 1. Return consistent error format
 * 2. Log errors
 * 3. Report to renderer
 * 4. Never throw (always return response)
 *
 * @param {Function} handler - The IPC handler function
 * @param {string} handlerName - Name for logging
 * @param {Object} defaultResponse - Default values to include on error
 * @returns {Function} Wrapped handler
 */
function wrapIPCHandler(handler, handlerName, defaultResponse = {}) {
  return async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      if (safeLogRef.error) {
        safeLogRef.error(`IPC handler '${handlerName}' failed:`, error.message);
      } else {
        console.error(`IPC handler '${handlerName}' failed:`, error.message);
      }
      reportErrorToRenderer(error);
      return {
        ...defaultResponse,
        ...createErrorResponse(error),
      };
    }
  };
}

// =============================================================================
// GLOBAL ERROR HANDLERS
// =============================================================================

/**
 * Setup global error handlers for uncaught exceptions and unhandled rejections
 * Should be called during app initialization
 */
function setupGlobalErrorHandlers() {
  /**
   * Uncaught Exception Handler
   * Catches synchronous errors that weren't caught by try-catch
   */
  process.on('uncaughtException', (error, origin) => {
    const appError = new AppError(
      ErrorCode.UNCAUGHT_EXCEPTION,
      `Uncaught exception: ${error.message}`,
      { severity: ErrorSeverity.CRITICAL, origin, stack: error.stack }
    );

    if (safeLogRef.error) {
      safeLogRef.error('Uncaught exception:', error.message, { origin, stack: error.stack });
    } else {
      console.error('Uncaught exception:', error);
    }

    errorBuffer.add(appError);
    reportErrorToRenderer(appError);

    if (app && app.isReady() && mainWindowRef && !mainWindowRef.isDestroyed()) {
      dialog
        .showMessageBox(mainWindowRef, {
          type: 'error',
          title: 'Unexpected Error',
          message: 'An unexpected error occurred.',
          detail: `${error.message}\n\nThe app will attempt to continue, but you may want to restart.`,
          buttons: ['Continue', 'Restart App', 'Copy Error & Quit'],
          defaultId: 0,
        })
        .then(({ response }) => {
          if (response === 1) {
            app.relaunch();
            app.exit(0);
          } else if (response === 2) {
            clipboard.writeText(`Error: ${error.message}\n\nStack: ${error.stack}`);
            app.exit(1);
          }
        })
        .catch(() => {});
    }

    process.exitCode = 1;
  });

  /**
   * Unhandled Promise Rejection Handler
   * Catches async errors that weren't caught by try-catch or .catch()
   */
  process.on('unhandledRejection', (reason, _promise) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;

    const appError = new AppError(
      ErrorCode.UNHANDLED_REJECTION,
      `Unhandled promise rejection: ${message}`,
      { severity: ErrorSeverity.ERROR, stack }
    );

    if (safeLogRef.error) {
      safeLogRef.error('Unhandled promise rejection:', message, { stack });
    } else {
      console.error('Unhandled promise rejection:', reason);
    }

    errorBuffer.add(appError);
    reportErrorToRenderer(appError);
  });

  /**
   * Warning Handler - for Node.js warnings
   */
  process.on('warning', (warning) => {
    if (safeLogRef.warn) {
      safeLogRef.warn('Node.js warning:', warning.name, warning.message);
    } else {
      console.warn('Node.js warning:', warning);
    }

    errorBuffer.add(
      new AppError(ErrorCode.UNKNOWN, `Warning: ${warning.message}`, {
        severity: ErrorSeverity.WARNING,
        name: warning.name,
      })
    );
  });

  if (safeLogRef.log) {
    safeLogRef.log('Global error handlers initialized');
  }
}

// =============================================================================
// IPC HANDLERS FOR ERROR MANAGEMENT
// =============================================================================

/**
 * Setup IPC handlers for error management
 * @param {IpcMain} ipcMain - The ipcMain module
 */
function setupErrorIPC(ipcMain) {
  ipcMain.handle('get-recent-errors', async (_event, count = 10) => {
    try {
      return { success: true, errors: errorBuffer.getRecent(count) };
    } catch (error) {
      return { success: false, error: error.message, errors: [] };
    }
  });

  ipcMain.handle('get-all-errors', async () => {
    try {
      return { success: true, errors: errorBuffer.getAll() };
    } catch (error) {
      return { success: false, error: error.message, errors: [] };
    }
  });

  ipcMain.handle('get-unread-errors', async () => {
    try {
      return { success: true, errors: errorBuffer.getUnread() };
    } catch (error) {
      return { success: false, error: error.message, errors: [] };
    }
  });

  ipcMain.handle('mark-error-read', async (_event, id) => {
    try {
      errorBuffer.markAsRead(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('mark-all-errors-read', async () => {
    try {
      errorBuffer.markAllAsRead();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clear-errors', async () => {
    try {
      errorBuffer.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('copy-error-to-clipboard', async (_event, errorId) => {
    try {
      const entry = errorBuffer.getAll().find((e) => e.id === errorId);
      if (!entry) {
        return { success: false, error: 'Error not found' };
      }

      const errorText = [
        `Error: ${entry.error.message}`,
        `Code: ${entry.error.code}`,
        `Time: ${entry.error.timestamp}`,
        '',
        'Stack Trace:',
        entry.error.stack || 'No stack trace available',
      ].join('\n');

      clipboard.writeText(errorText);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  ErrorSeverity,
  ErrorCode,
  ErrorMessages,

  AppError,
  ErrorBuffer,

  errorBuffer,

  setMainWindow,
  setSafeLog,
  reportErrorToRenderer,
  createErrorResponse,
  wrapIPCHandler,
  setupGlobalErrorHandlers,
  setupErrorIPC,
};
