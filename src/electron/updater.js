/**
 * Auto-Update Module for Universal Session Viewer
 *
 * Implements automatic update checking and installation using electron-updater.
 * Integrates with GitHub Releases as the update source.
 *
 * Features:
 *   - Automatic update checks on app startup
 *   - User notifications for available updates
 *   - Download progress tracking
 *   - One-click install and restart
 *   - Manual update check trigger via IPC
 *
 * v1 Pattern Reference:
 *   - No direct v1 equivalent (v1 was manually distributed)
 *   - Implements Electron best practices for auto-updates
 */

const { app, ipcMain, dialog } = require('electron');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

/**
 * AutoUpdater class - manages the complete update lifecycle
 */
class AppUpdater {
  constructor() {
    this.mainWindow = null;
    this.updateAvailable = false;
    this.downloadProgress = 0;
    this.updateDownloaded = false;

    this.configureUpdater();
    this.setupEventListeners();
    this.setupIpcHandlers();
  }

  /**
   * Configure the auto-updater settings
   */
  configureUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
  }

  /**
   * Set the main window reference for sending update notifications
   * @param {BrowserWindow} window - The main application window
   */
  setMainWindow(window) {
    this.mainWindow = window;
  }

  /**
   * Set up auto-updater event listeners
   */
  setupEventListeners() {
    autoUpdater.on('checking-for-update', () => {
      log.info('[Updater] Checking for updates...');
      this.sendStatusToWindow('checking-for-update');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('[Updater] Update available:', info.version);
      this.updateAvailable = true;
      this.sendStatusToWindow('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });

      this.showUpdateAvailableDialog(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('[Updater] No update available. Current version is up to date.');
      this.sendStatusToWindow('update-not-available', {
        version: info.version,
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.downloadProgress = progressObj.percent;
      log.info(`[Updater] Download progress: ${progressObj.percent.toFixed(1)}%`);

      this.sendStatusToWindow('download-progress', {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('[Updater] Update downloaded:', info.version);
      this.updateDownloaded = true;
      this.sendStatusToWindow('update-downloaded', {
        version: info.version,
      });

      this.showUpdateReadyDialog(info);
    });

    autoUpdater.on('error', (error) => {
      log.error('[Updater] Error:', error);
      this.sendStatusToWindow('error', {
        message: error.message,
      });
    });
  }

  /**
   * Set up IPC handlers for renderer communication
   */
  setupIpcHandlers() {
    ipcMain.handle('updater:check', async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        return {
          success: true,
          data: result
            ? {
                version: result.updateInfo.version,
                releaseDate: result.updateInfo.releaseDate,
              }
            : null,
        };
      } catch (error) {
        log.error('[Updater] Check failed:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    ipcMain.handle('updater:download', async () => {
      if (!this.updateAvailable) {
        return { success: false, error: 'No update available' };
      }

      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (error) {
        log.error('[Updater] Download failed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('updater:install', async () => {
      if (!this.updateDownloaded) {
        return { success: false, error: 'No update downloaded' };
      }

      autoUpdater.quitAndInstall(false, true);
      return { success: true };
    });

    ipcMain.handle('updater:version', () => {
      return {
        version: app.getVersion(),
        name: app.getName(),
      };
    });

    ipcMain.handle('updater:status', () => {
      return {
        updateAvailable: this.updateAvailable,
        updateDownloaded: this.updateDownloaded,
        downloadProgress: this.downloadProgress,
      };
    });
  }

  /**
   * Send update status to the renderer process
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  sendStatusToWindow(event, data = {}) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status', {
        event,
        ...data,
      });
    }
  }

  /**
   * Show dialog when update is available
   * @param {Object} info - Update info
   */
  async showUpdateAvailableDialog(info) {
    const dialogOpts = {
      type: 'info',
      buttons: ['Download Update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Available',
      message: `A new version of Universal Session Viewer is available!`,
      detail: `Version ${info.version} is now available. You have version ${app.getVersion()}.\n\nWould you like to download it now?`,
    };

    const { response } = await dialog.showMessageBox(this.mainWindow, dialogOpts);

    if (response === 0) {
      log.info('[Updater] User initiated download');
      autoUpdater.downloadUpdate();
    } else {
      log.info('[Updater] User postponed update');
    }
  }

  /**
   * Show dialog when update is ready to install
   * @param {Object} info - Update info
   */
  async showUpdateReadyDialog(info) {
    const dialogOpts = {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Ready',
      message: 'Update Downloaded',
      detail: `Version ${info.version} has been downloaded and is ready to install.\n\nRestart the application to apply the update.`,
    };

    const { response } = await dialog.showMessageBox(this.mainWindow, dialogOpts);

    if (response === 0) {
      log.info('[Updater] User initiated restart for update');
      autoUpdater.quitAndInstall(false, true);
    } else {
      log.info('[Updater] User postponed restart');
    }
  }

  /**
   * Check for updates (called on app startup)
   */
  async checkForUpdates() {
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      log.info('[Updater] Skipping update check in development mode');
      return;
    }

    try {
      log.info('[Updater] Checking for updates on startup...');
      await autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('[Updater] Startup update check failed:', error);
    }
  }
}

const appUpdater = new AppUpdater();

/**
 * Initialize the updater with the main window
 * Call this from main.js after creating the window
 *
 * @param {BrowserWindow} mainWindow - The main application window
 */
function initializeUpdater(mainWindow) {
  appUpdater.setMainWindow(mainWindow);

  setTimeout(() => {
    appUpdater.checkForUpdates();
  }, 5000);
}

/**
 * Manually trigger an update check
 * Can be called from menu items or IPC handlers
 */
async function checkForUpdates() {
  return await appUpdater.checkForUpdates();
}

module.exports = {
  initializeUpdater,
  checkForUpdates,
  appUpdater,
};
