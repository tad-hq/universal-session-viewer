// System Tray Integration for Universal Session Viewer
// macOS menu bar icon with quick actions
//
// Features:
// - Menu bar icon (macOS) / System tray (Windows/Linux)
// - Quick actions menu: Show window, Refresh, Settings, Quit
// - Click to show/hide window
// - Tooltip with session count

const path = require('path');

const { Tray, Menu, nativeImage, app, BrowserWindow } = require('electron');

// Store tray reference to prevent garbage collection
let tray = null;

/**
 * Create a simple tray icon programmatically
 * Uses a simple "C" for Claude as a placeholder
 * In production, replace with actual icon file
 * @returns {nativeImage} The tray icon
 */
function createTrayIcon() {
  // For macOS, tray icons should be 16x16 or 22x22 (with @2x variants)
  // We'll create a simple template image (works with dark/light mode)

  // Try to load icon from assets first
  const iconPaths = [
    path.join(__dirname, '../../assets/tray-icon.png'),
    path.join(__dirname, '../../assets/tray-iconTemplate.png'),
    path.join(__dirname, '../../assets/icon.png'),
  ];

  for (const iconPath of iconPaths) {
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        // Resize for tray (16x16 base, macOS will use @2x automatically)
        return icon.resize({ width: 16, height: 16 });
      }
    } catch {
      // Continue to next path
    }
  }

  // Fallback: Create a simple programmatic icon
  // This creates a small filled circle as a placeholder
  // Base64 encoded 16x16 PNG of a simple circle
  const base64Icon =
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA' +
    'VklEQVQ4jWNgGAWjYBSMglEwCogDjIyM/xkYGP6T4wJGRsb/DAwM/8nRAQMDA8P/////k+MCRkbG' +
    '/wwMDP8Z////T44LGBkZ/zMwMPxn+P//P1kOGOkAAEVyFpJhAEwrAAAAAElFTkSuQmCC';

  return nativeImage.createFromDataURL(`data:image/png;base64,${base64Icon}`);
}

/**
 * Create and configure the system tray
 * @param {Object} appInstance - The SessionViewerApp instance
 * @returns {Tray} The created tray instance
 */
function createTray(appInstance) {
  // Create tray with icon
  const icon = createTrayIcon();

  // On macOS, use template image for proper appearance
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);

  // Set tooltip
  tray.setToolTip('Universal Session Viewer');

  // Build context menu
  const contextMenu = buildTrayMenu(appInstance);
  tray.setContextMenu(contextMenu);

  // Click behavior
  // macOS: Click shows context menu (standard behavior)
  // Windows/Linux: Click shows/hides window
  if (process.platform !== 'darwin') {
    tray.on('click', () => {
      toggleWindow(appInstance);
    });
  }

  // Double-click to show window (all platforms)
  tray.on('double-click', () => {
    showWindow(appInstance);
  });

  // Use electron-log for safe logging (prevents EPIPE errors)
  const log = require('electron-log');
  log.info('System tray initialized');
  return tray;
}

/**
 * Build the tray context menu
 * @param {Object} appInstance - The SessionViewerApp instance
 * @returns {Menu} The context menu
 */
function buildTrayMenu(appInstance) {
  const isMac = process.platform === 'darwin';

  return Menu.buildFromTemplate([
    {
      label: 'Show Universal Session Viewer',
      click: () => showWindow(appInstance),
    },
    { type: 'separator' },
    {
      label: 'Refresh Sessions',
      accelerator: isMac ? 'Cmd+R' : 'Ctrl+R',
      click: () => {
        showWindow(appInstance);
        sendToRenderer('menu:refresh');
      },
    },
    {
      label: 'Search Sessions',
      accelerator: isMac ? 'Cmd+K' : 'Ctrl+K',
      click: () => {
        showWindow(appInstance);
        sendToRenderer('menu:focus-search');
      },
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      accelerator: isMac ? 'Cmd+,' : 'Ctrl+,',
      click: () => {
        showWindow(appInstance);
        sendToRenderer('menu:open-settings');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: isMac ? 'Cmd+Q' : 'Alt+F4',
      click: () => {
        app.quit();
      },
    },
  ]);
}

/**
 * Show the main window
 * @param {Object} appInstance - The SessionViewerApp instance
 */
function showWindow(appInstance) {
  const mainWindow = appInstance?.mainWindow || BrowserWindow.getAllWindows()[0];

  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();

    // On macOS, also show in dock
    if (process.platform === 'darwin' && app.dock) {
      app.dock.show();
    }
  }
}

/**
 * Hide the main window (minimize to tray)
 * @param {Object} appInstance - The SessionViewerApp instance
 */
function hideWindow(appInstance) {
  const mainWindow = appInstance?.mainWindow || BrowserWindow.getAllWindows()[0];

  if (mainWindow) {
    mainWindow.hide();

    // On macOS, hide from dock when minimized to tray
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide();
    }
  }
}

/**
 * Toggle window visibility
 * @param {Object} appInstance - The SessionViewerApp instance
 */
function toggleWindow(appInstance) {
  const mainWindow = appInstance?.mainWindow || BrowserWindow.getAllWindows()[0];

  if (mainWindow) {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      hideWindow(appInstance);
    } else {
      showWindow(appInstance);
    }
  }
}

/**
 * Update the tray tooltip with session count
 * @param {number} sessionCount - Number of sessions
 */
function updateTrayTooltip(sessionCount) {
  if (tray) {
    const tooltip =
      sessionCount > 0
        ? `Universal Session Viewer - ${sessionCount} sessions`
        : 'Universal Session Viewer';
    tray.setToolTip(tooltip);
  }
}

/**
 * Send a message to the renderer process
 * @param {string} channel - IPC channel
 * @param {any} data - Data to send
 */
function sendToRenderer(channel, data) {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (win && win.webContents) {
    win.webContents.send(channel, data);
  }
}

/**
 * Destroy the tray icon
 */
function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/**
 * Get the current tray instance
 * @returns {Tray|null}
 */
function getTray() {
  return tray;
}

module.exports = {
  createTray,
  destroyTray,
  getTray,
  showWindow,
  hideWindow,
  toggleWindow,
  updateTrayTooltip,
};
