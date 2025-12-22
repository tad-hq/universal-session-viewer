/**
 * Analysis & Quota IPC Handlers
 */

const { ipcMain } = require('electron');
const { safeLog } = require('../config');

// Bulk analysis state (shared across handlers)
let bulkAnalyzeCancelled = false;

function register(appInstance) {
  // Reanalyze session with extensive edge case handling
  // Preserves all implementation details from main.js setupIPC lines 3124-3191
  ipcMain.handle(
    'reanalyze-session',
    async (_event, sessionId, customInstructions, bypassQuota = false) => {
      try {
        safeLog.log(
          `Re-analyzing session ${sessionId}, Custom Instructions: ${customInstructions ? 'Yes' : 'No'}, Bypass Quota: ${bypassQuota}`
        );

        // Check daily quota before re-analysis (unless bypassed)
        if (!bypassQuota) {
          const quota = appInstance.checkDailyQuota();
          if (!quota.allowed) {
            safeLog.log(`Re-analysis blocked by quota: ${quota.message}`);
            return {
              success: false,
              error: `Daily analysis limit reached (${quota.current}/${quota.limit}). Enable "Bypass quota on force analyze" in settings to override.`,
            };
          }
        } else {
          safeLog.log('Bypassing quota check for manual re-analysis (setting enabled)');
        }

        // Delete cache entry to force re-analysis
        if (appInstance.db) {
          const stmt = appInstance.db.prepare(
            'DELETE FROM session_analysis_cache WHERE session_id = ?'
          );
          stmt.run(sessionId);
          appInstance.debugLog(`Cleared cache for session ${sessionId}`);
        }

        // Query session from database
        if (!appInstance.db) {
          return { success: false, error: 'Database not initialized' };
        }

        const sessionRow = appInstance.db
          .prepare(
            `
        SELECT
          m.session_id as id,
          m.file_path as filePath,
          m.project_path as project,
          m.project_path as projectPath,
          m.project_name as projectName,
          m.message_count as messageCount,
          m.last_message_time as modified,
          c.title,
          c.summary
        FROM session_metadata m
        LEFT JOIN session_analysis_cache c ON m.session_id = c.session_id
        WHERE m.session_id = ?
      `
          )
          .get(sessionId);

        const session = sessionRow;

        if (!session) {
          return { success: false, error: 'Session not found' };
        }

        // Re-analyze the session (cacheAnalysis is called internally by analyzeSessionWithHaiku)
        const result = await appInstance.analyzeSessionWithHaiku(
          session,
          bypassQuota,
          customInstructions
        );

        // Update session object with new summary for UI
        if (result.summary) {
          session.summary = result.summary;
        }

        // Send session-updated event
        if (appInstance.mainWindow && appInstance.mainWindow.webContents) {
          appInstance.mainWindow.webContents.send('session-updated', session);
        }

        // Return the new summary so renderer can update immediately
        return {
          success: true,
          summary: result.summary || null,
          title: session.title || null,
        };
      } catch (error) {
        safeLog.error('Error re-analyzing session:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Bulk analyze sessions with extensive inline logic
  // Preserves all implementation details from main.js lines 3196-3340
  ipcMain.handle('bulk-analyze-sessions', async (_event, sessionIds, bypassQuota = false) => {
    try {
      safeLog.log(
        `Starting bulk analysis for ${sessionIds.length} sessions, Bypass Quota: ${bypassQuota}`
      );
      bulkAnalyzeCancelled = false;

      if (!appInstance.db) {
        return { success: false, error: 'Database not initialized' };
      }

      // Track results
      let completed = 0;
      let failed = 0;
      let skipped = 0;
      const errors = [];

      // Process sessions sequentially (one at a time to avoid overwhelming system)
      for (let i = 0; i < sessionIds.length; i++) {
        // Check for cancellation
        if (bulkAnalyzeCancelled) {
          safeLog.log('Bulk analysis cancelled by user');
          break;
        }

        const sessionId = sessionIds[i];

        try {
          // Check quota (unless bypassed)
          if (!bypassQuota) {
            const quota = appInstance.checkDailyQuota();
            if (!quota.allowed) {
              // Quota exceeded - skip remaining sessions
              safeLog.log(`Quota exceeded: ${quota.message}`);
              const remaining = sessionIds.length - i;
              skipped += remaining;

              // Send progress event for skipped sessions
              if (appInstance.mainWindow && appInstance.mainWindow.webContents) {
                appInstance.mainWindow.webContents.send('bulk-analyze-progress', {
                  current: i + 1,
                  total: sessionIds.length,
                  sessionId,
                  status: 'skipped',
                  error: quota.message,
                });
              }
              break;
            }
          }

          // Send analyzing status
          if (appInstance.mainWindow && appInstance.mainWindow.webContents) {
            appInstance.mainWindow.webContents.send('bulk-analyze-progress', {
              current: i + 1,
              total: sessionIds.length,
              sessionId,
              status: 'analyzing',
            });
          }

          // Delete cache entry to force re-analysis
          const deleteStmt = appInstance.db.prepare(
            'DELETE FROM session_analysis_cache WHERE session_id = ?'
          );
          deleteStmt.run(sessionId);

          // Query session from database
          const sessionRow = appInstance.db
            .prepare(
              `
            SELECT
              session_id as id,
              file_path as filePath,
              project_path as project,
              project_path as projectPath,
              project_name as projectName
            FROM session_metadata
            WHERE session_id = ?
          `
            )
            .get(sessionId);

          if (!sessionRow) {
            throw new Error('Session not found');
          }

          // Analyze the session (cacheAnalysis is called internally by analyzeSessionWithHaiku)
          const result = await appInstance.analyzeSessionWithHaiku(sessionRow);

          // Update session object with new summary for UI
          if (result.summary) {
            sessionRow.summary = result.summary;
          }

          // Update session in UI
          if (appInstance.mainWindow && appInstance.mainWindow.webContents) {
            appInstance.mainWindow.webContents.send('session-updated', sessionRow);
          }

          // Send success progress event
          if (appInstance.mainWindow && appInstance.mainWindow.webContents) {
            appInstance.mainWindow.webContents.send('bulk-analyze-progress', {
              current: i + 1,
              total: sessionIds.length,
              sessionId,
              status: 'success',
            });
          }

          completed++;

          // Small delay to prevent overwhelming the system
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          safeLog.error(`Error analyzing session ${sessionId}:`, error);
          failed++;
          errors.push({ sessionId, error: error.message });

          // Send failed progress event
          if (appInstance.mainWindow && appInstance.mainWindow.webContents) {
            appInstance.mainWindow.webContents.send('bulk-analyze-progress', {
              current: i + 1,
              total: sessionIds.length,
              sessionId,
              status: 'failed',
              error: error.message,
            });
          }
        }
      }

      // Send completion event
      if (appInstance.mainWindow && appInstance.mainWindow.webContents) {
        appInstance.mainWindow.webContents.send('bulk-analyze-complete', {
          total: sessionIds.length,
          completed,
          failed,
          skipped,
          errors,
        });
      }

      safeLog.log(
        `Bulk analysis complete: ${completed} succeeded, ${failed} failed, ${skipped} skipped`
      );
      return { success: true };
    } catch (error) {
      safeLog.error('Error in bulk analysis:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cancel-bulk-analyze', async () => {
    bulkAnalyzeCancelled = true;
    safeLog.log('Bulk analysis cancellation requested');
    return { success: true };
  });

  // Simple handlers that call SessionViewerApp methods directly
  ipcMain.handle('get-quota', async () => {
    try {
      const quota = appInstance.checkDailyQuota();
      return { success: true, quota };
    } catch (error) {
      safeLog.error('Error getting quota:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-quota-stats', async (_event, days = 7) => {
    try {
      const stats = appInstance.getQuotaStats(days);
      return { success: true, stats };
    } catch (error) {
      safeLog.error('Error getting quota stats:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clear-all-cache', async () => {
    try {
      if (appInstance.db) {
        const stmt = appInstance.db.prepare('DELETE FROM session_analysis_cache');
        const result = stmt.run();
        appInstance.debugLog(`Cleared ${result.changes} cache entries`);
        return { success: true, count: result.changes };
      }
      return { success: false, error: 'Database not initialized' };
    } catch (error) {
      safeLog.error('Error clearing cache:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { register };
