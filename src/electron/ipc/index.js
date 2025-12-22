/**
 * IPC Handler Registry
 *
 * Centralized registration of all 35 IPC handlers
 * Extracted from: main.js.backup-20251215 setupIPC function (lines 4691-5870)
 *
 * V1 Pattern Preservation:
 * - All 35 handlers preserved identically
 * - Error handling consistent across all handlers
 * - Delegates to SessionViewerApp instance methods
 *
 * Handler Groups:
 * - sessions.js: Session management (5 handlers)
 * - terminal.js: Terminal integration (7 handlers)
 * - settings.js: Settings & configuration (6 handlers)
 * - analysis.js: Analysis & quota (4 handlers)
 * - search.js: Search & pagination (4 handlers)
 * - continuation.js: Continuation chains (9 handlers)
 */

const { safeLog } = require('../config');

/**
 * Register all IPC handlers
 * V1 Pattern: Lines 4691-5870 from backup
 *
 * CRITICAL: All 35 handlers MUST be registered for app to function
 * Reference: BACKUP_MANIFEST.md - lists all 35 handlers
 *
 * @param {Object} appInstance - SessionViewerApp instance
 */
function registerAllHandlers(appInstance) {
  safeLog.log('Registering IPC handlers...');

  // Import and register handler modules
  const sessionHandlers = require('./sessions');
  const terminalHandlers = require('./terminal');
  const settingsHandlers = require('./settings');
  const analysisHandlers = require('./analysis');
  const searchHandlers = require('./search');
  const continuationHandlers = require('./continuation');

  // Register all handler groups
  sessionHandlers.register(appInstance);
  terminalHandlers.register(appInstance);
  settingsHandlers.register(appInstance);
  analysisHandlers.register(appInstance);
  searchHandlers.register(appInstance);
  continuationHandlers.register(appInstance);

  safeLog.log('All IPC handlers registered successfully');
}

module.exports = { registerAllHandlers };
