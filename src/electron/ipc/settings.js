/**
 * Settings IPC Handlers
 */

const { ipcMain, dialog } = require('electron');
const { safeLog } = require('../config');
const { expandPath } = require('../utils/security');

function register(appInstance) {
  ipcMain.handle('get-settings', async () => {
    try {
      const settings = appInstance.getAllSettings();
      return { success: true, settings };
    } catch (error) {
      safeLog.error('Error getting settings:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-settings', async (_event, settings) => {
    try {
      await appInstance.saveAllSettings(settings);
      return { success: true };
    } catch (error) {
      safeLog.error('Error saving settings:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-setting', async (_event, key, value) => {
    try {
      appInstance.setSetting(key, value);
      return { success: true };
    } catch (error) {
      safeLog.error('Error saving setting:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('validate-path', async (_event, inputPath) => {
    // Inline implementation from setupIPC (main.js lines 2869-2915)
    try {
      const fs = require('fs');

      if (!inputPath || typeof inputPath !== 'string') {
        return {
          valid: false,
          expandedPath: '',
          error: 'Path is required',
        };
      }

      // Expand tilde and environment variables
      const expandedPath = expandPath(inputPath);

      // Check if path exists
      if (!fs.existsSync(expandedPath)) {
        return {
          valid: false,
          expandedPath,
          error: 'Path does not exist',
        };
      }

      // Get stats to check if directory
      const stats = fs.statSync(expandedPath);

      if (!stats.isDirectory()) {
        // Check if it's a symlink pointing to a directory
        if (stats.isSymbolicLink()) {
          try {
            const realPath = fs.realpathSync(expandedPath);
            const realStats = fs.statSync(realPath);
            if (!realStats.isDirectory()) {
              return {
                valid: false,
                expandedPath,
                error: 'Path must be a directory',
              };
            }
          } catch (error) {
            return {
              valid: false,
              expandedPath,
              error: `Invalid symlink: ${error.message}`,
            };
          }
        } else {
          return {
            valid: false,
            expandedPath,
            error: 'Path must be a directory',
          };
        }
      }

      // Path is valid
      return {
        valid: true,
        expandedPath,
      };
    } catch (error) {
      safeLog.error('Error validating path:', error);
      return {
        valid: false,
        expandedPath: '',
        error: error.message,
      };
    }
  });

  ipcMain.handle('browse-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Directory',
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      safeLog.error('Error browsing directory:', error);
      return { success: false, error: error.message };
    }
  });

  // Note: get-platform handler is registered in index.js (terminal handlers)
}

module.exports = { register };
