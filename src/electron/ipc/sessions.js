/**
 * Session IPC Handlers
 *
 * Extracted from: main.js.backup-20251215 lines 4694-4740
 * Handlers: renderer-ready, get-session-details, refresh-sessions,
 *           open-session-folder, get-available-prompts
 *
 * V1 Pattern Preservation:
 * - Renderer-ready handshake (race condition prevention - lines 4694-4703)
 * - Dual session ID handling (id OR session_id)
 * - Consistent error return format { success: false, error: message }
 */

const { ipcMain, shell } = require('electron');
const { safeLog } = require('../config');

/**
 * Register session-related IPC handlers
 * V1 Pattern: Lines 4691-4749 from backup
 *
 * @param {Object} appInstance - SessionViewerApp instance with all methods
 */
function register(appInstance) {
  // V1 Edge Case: Renderer-ready handshake prevents race condition
  // Main process MUST NOT send data before renderer is ready
  // Reference: BACKUP_MANIFEST.md Edge Case #1
  ipcMain.handle('renderer-ready', async () => {
    try {
      safeLog.log('Renderer is ready, loading sessions...');
      await appInstance.loadAndAnalyzeSessions();
      return { success: true };
    } catch (error) {
      safeLog.error('Error during renderer-ready initialization:', error);
      return { success: false, error: error.message };
    }
  });

  // V1 Edge Case: Dual session ID handling (id OR session_id)
  // Reference: BACKUP_MANIFEST.md Edge Case #9
  ipcMain.handle('get-session-details', async (event, sessionId, loadFullMessages = false) => {
    try {
      const sessionDetails = await appInstance.getSessionDetails(sessionId, loadFullMessages);
      if (sessionDetails) {
        return { success: true, session: sessionDetails };
      } else {
        return { success: false, error: 'Session not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('refresh-sessions', async () => {
    try {
      await appInstance.loadAndAnalyzeSessions();
      return { success: true };
    } catch (error) {
      safeLog.error('Error refreshing sessions:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-session-folder', async (event, sessionPath) => {
    try {
      await shell.showItemInFolder(sessionPath);
      return { success: true };
    } catch (error) {
      safeLog.error('Error opening session folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-available-prompts', async () => {
    try {
      return await appInstance.getAvailablePrompts();
    } catch (error) {
      safeLog.error('Error getting available prompts:', error);
      return [];
    }
  });
}

module.exports = { register };
