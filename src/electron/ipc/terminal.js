/**
 * Terminal IPC Handlers
 *
 * Task 4: Created terminal handler module following delegation pattern
 * Handlers: resume-session, open-sessions-tmux4, get-platform,
 *           get-terminal-settings, check-terminal-available,
 *           validate-binary-path, get-most-recent-session
 *
 * All complex handlers delegate to SessionViewerApp business logic methods
 */

const { ipcMain } = require('electron');
const { safeLog } = require('../config');
const { getTerminalSettings, TERMINAL_LAUNCH_COMMANDS } = require('../config/terminal');

/**
 * Register all terminal-related IPC handlers
 * @param {SessionViewerApp} appInstance - Main application instance
 */
function register(appInstance) {
  if (!appInstance) {
    throw new Error('appInstance is required for terminal handler registration');
  }

  // ==========================================================================
  // Complex handlers - Delegate to SessionViewerApp methods
  // ==========================================================================

  ipcMain.handle('resume-session', async (event, sessionId, promptFile, useTmuxOverride) => {
    return appInstance.handleResumeSession(sessionId, promptFile, useTmuxOverride);
  });

  ipcMain.handle('open-sessions-tmux4', async (event, sessionIds) => {
    return appInstance.handleOpenSessionsTmux4(sessionIds);
  });

  // ==========================================================================
  // Simple handlers - Implement inline (no business logic needed)
  // ==========================================================================

  ipcMain.handle('get-platform', async () => {
    return {
      success: true,
      platform: process.platform,
    };
  });

  ipcMain.handle('get-terminal-settings', async () => {
    try {
      const terminalSettings = getTerminalSettings(appInstance.db);
      return {
        success: true,
        terminal: terminalSettings,
        platform: process.platform,
      };
    } catch (error) {
      safeLog.error('Error getting terminal settings:', error);
      return {
        success: false,
        error: error.message,
        platform: process.platform,
      };
    }
  });

  ipcMain.handle('check-terminal-available', async (event, terminal) => {
    try {
      if (terminal === 'custom') {
        return { success: true, available: true };
      }

      const launcher = TERMINAL_LAUNCH_COMMANDS[terminal];
      if (!launcher) {
        return { success: true, available: false };
      }

      return { success: true, available: launcher.available() };
    } catch (error) {
      safeLog.error('Error checking terminal availability:', error);
      return { success: false, available: false, error: error.message };
    }
  });

  ipcMain.handle('validate-binary-path', async (event, binaryPath) => {
    const { execSync } = require('child_process');
    const fs = require('fs');

    if (!binaryPath || binaryPath === 'claude') {
      try {
        execSync('which claude', { stdio: 'pipe' });
        return { valid: true };
      } catch {
        return { valid: false, error: 'Claude CLI not found in PATH' };
      }
    }

    if (!fs.existsSync(binaryPath)) {
      return { valid: false, error: `Binary not found: ${binaryPath}` };
    }

    try {
      fs.accessSync(binaryPath, fs.constants.X_OK);
      return { valid: true };
    } catch {
      return { valid: false, error: `Binary not executable: ${binaryPath}` };
    }
  });

  ipcMain.handle('get-most-recent-session', async () => {
    try {
      if (!appInstance.db) {
        return { success: false, error: 'Database not initialized' };
      }

      const stmt = appInstance.db.prepare(`
        SELECT session_id, project_path, project_name
        FROM session_metadata
        WHERE is_valid = 1 AND is_empty = 0
        ORDER BY last_message_time DESC
        LIMIT 1
      `);

      const row = stmt.get();

      if (row) {
        return {
          success: true,
          session: {
            sessionId: row.session_id,
            projectPath: row.project_path,
            title: row.project_name,
          },
        };
      }

      return { success: true, session: null };
    } catch (error) {
      safeLog.error('Error getting most recent session:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { register };
