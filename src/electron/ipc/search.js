/**
 * Search & Pagination IPC Handlers
 */

const { ipcMain } = require('electron');
const { safeLog } = require('../config');

function register(appInstance) {
  // These methods exist on SessionViewerApp (lines 1656-1959)
  // Call them directly with proper error handling

  ipcMain.handle('search-sessions', async (_event, { query, limit = 50, offset = 0 }) => {
    try {
      const results = await appInstance.searchSessions(query, limit, offset);
      return { success: true, sessions: results.sessions, total: results.total };
    } catch (error) {
      safeLog.error('Error searching sessions:', error);
      return { success: false, error: error.message, sessions: [], total: 0 };
    }
  });

  ipcMain.handle(
    'load-sessions-paginated',
    async (_event, { limit = 50, offset = 0, filters = {} }) => {
      try {
        const results = await appInstance.loadSessionsPaginated(limit, offset, filters);
        return { success: true, sessions: results.sessions, total: results.total };
      } catch (error) {
        safeLog.error('Error loading paginated sessions:', error);
        return { success: false, error: error.message, sessions: [], total: 0 };
      }
    }
  );

  ipcMain.handle('get-session-count', async (_event, filters = {}) => {
    try {
      const count = await appInstance.getSessionCount(filters);
      return { success: true, count };
    } catch (error) {
      safeLog.error('Error getting session count:', error);
      return { success: false, error: error.message, count: 0 };
    }
  });

  ipcMain.handle('get-available-projects', async (event, filters = {}) => {
    try {
      const projects = await appInstance.getAvailableProjects(filters);
      return { success: true, projects };
    } catch (error) {
      safeLog.error('Error getting available projects:', error);
      return { success: false, error: error.message, projects: [] };
    }
  });
}

module.exports = { register };
