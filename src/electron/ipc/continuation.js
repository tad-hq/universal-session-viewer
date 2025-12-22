/**
 * Continuation Chain IPC Handlers
 */

const { ipcMain } = require('electron');
const { safeLog } = require('../config');

function register(appInstance) {
  // All handlers return { success, data/error } format
  // Method calls match actual SessionViewerApp methods (no "handle" prefix)

  ipcMain.handle('get-continuation-chain', async (event, sessionId) => {
    try {
      const chain = await appInstance.getContinuationChain(sessionId);
      return { success: true, chain };
    } catch (error) {
      safeLog.error('Error getting continuation chain:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-continuation-children', async (event, sessionId) => {
    try {
      const children = await appInstance.getContinuationChildren(sessionId);
      return { success: true, children };
    } catch (error) {
      safeLog.error('Error getting continuation children:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    'get-session-with-continuations',
    async (event, sessionId, loadFullMessages = false) => {
      try {
        const session = await appInstance.getSessionWithContinuations(sessionId, loadFullMessages);
        return { success: true, session };
      } catch (error) {
        safeLog.error('Error getting session with continuations:', error);
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle('get-continuation-metadata', async (event, sessionId) => {
    try {
      const metadata = await appInstance.getContinuationMetadata(sessionId);
      return { success: true, metadata };
    } catch (error) {
      safeLog.error('Error getting continuation metadata:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-continuation-stats', async () => {
    try {
      const stats = await appInstance.getContinuationStats();
      return { success: true, stats };
    } catch (error) {
      safeLog.error('Error getting continuation stats:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('resolve-continuation-chains', async () => {
    try {
      const result = await appInstance.resolveContinuationChains();
      return { success: true, ...result };
    } catch (error) {
      safeLog.error('Error resolving continuation chains:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('heal-orphaned-continuations', async () => {
    try {
      const result = await appInstance.healOrphanedContinuations();
      return { success: true, ...result };
    } catch (error) {
      safeLog.error('Error healing orphaned continuations:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-continuation-group', async (event, sessionId) => {
    try {
      // Inline implementation from main.js setupIPC
      // Gets continuation chain and formats it as a group with root/children/active
      const chain = await appInstance.getContinuationChain(sessionId);
      return {
        success: true,
        rootSession: chain.parent,
        allSessions: [chain.parent, ...chain.children],
        activeChild: chain.children.find((c) => c.is_active_continuation),
        flatDescendants: chain.flatDescendants,
        hasBranches: chain.hasBranches,
      };
    } catch (error) {
      safeLog.error('Error getting continuation group:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { register };
