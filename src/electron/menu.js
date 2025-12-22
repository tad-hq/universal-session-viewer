// Native Menu Bar for Universal Session Viewer
// Full native menu with keyboard shortcuts
//
// Menu Structure:
// - App Menu (macOS only): About, Settings, Quit
// - File: Refresh, Close Window
// - Edit: Standard edit menu (Cut, Copy, Paste, Select All)
// - View: Reload, DevTools
// - Window: Minimize, Zoom, Close
// - Help: Documentation, Report Issue

const { app, Menu, shell, BrowserWindow } = require('electron');

// Detect platform
const isMac = process.platform === 'darwin';

/**
 * Create the application menu
 * @param {Object} appInstance - The SessionViewerApp instance for callbacks
 * @returns {Menu} The constructed menu
 */
function createApplicationMenu(_appInstance) {
  const template = [
    // macOS App Menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: 'About Universal Session Viewer',
                role: 'about',
              },
              { type: 'separator' },
              {
                label: 'Settings...',
                accelerator: 'Cmd+,',
                click: () => {
                  sendToRenderer('menu:open-settings');
                },
              },
              { type: 'separator' },
              {
                label: 'Services',
                role: 'services',
              },
              { type: 'separator' },
              {
                label: 'Hide Universal Session Viewer',
                role: 'hide',
              },
              {
                label: 'Hide Others',
                role: 'hideOthers',
              },
              {
                label: 'Show All',
                role: 'unhide',
              },
              { type: 'separator' },
              {
                label: 'Quit Universal Session Viewer',
                role: 'quit',
              },
            ],
          },
        ]
      : []),

    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Refresh Sessions',
          accelerator: isMac ? 'Cmd+R' : 'Ctrl+R',
          click: () => {
            sendToRenderer('menu:refresh');
          },
        },
        { type: 'separator' },
        {
          label: 'Search Sessions',
          accelerator: isMac ? 'Cmd+K' : 'Ctrl+K',
          click: () => {
            sendToRenderer('menu:focus-search');
          },
        },
        { type: 'separator' },
        ...(isMac
          ? [
              {
                label: 'Close Window',
                accelerator: 'Cmd+W',
                role: 'close',
              },
            ]
          : [
              {
                label: 'Settings',
                accelerator: 'Ctrl+,',
                click: () => {
                  sendToRenderer('menu:open-settings');
                },
              },
              { type: 'separator' },
              {
                label: 'Exit',
                accelerator: 'Alt+F4',
                role: 'quit',
              },
            ]),
      ],
    },

    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo' },
        { label: 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        ...(isMac
          ? [
              { label: 'Paste and Match Style', role: 'pasteAndMatchStyle' },
              { label: 'Delete', role: 'delete' },
              { label: 'Select All', role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [
                  { label: 'Start Speaking', role: 'startSpeaking' },
                  { label: 'Stop Speaking', role: 'stopSpeaking' },
                ],
              },
            ]
          : [
              { label: 'Delete', role: 'delete' },
              { type: 'separator' },
              { label: 'Select All', role: 'selectAll' },
            ]),
      ],
    },

    // View Menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: isMac ? 'Cmd+Shift+R' : 'Ctrl+Shift+R',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.reload();
            }
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.toggleDevTools();
            }
          },
        },
        { type: 'separator' },
        { label: 'Actual Size', role: 'resetZoom' },
        { label: 'Zoom In', role: 'zoomIn' },
        { label: 'Zoom Out', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', role: 'togglefullscreen' },
      ],
    },

    // Window Menu
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', role: 'minimize' },
        { label: 'Zoom', role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { label: 'Bring All to Front', role: 'front' },
              { type: 'separator' },
              { label: 'Window', role: 'window' },
            ]
          : [{ label: 'Close', role: 'close' }]),
      ],
    },

    // Help Menu
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'View Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/tad-hq/universal-session-viewer');
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/tad-hq/universal-session-viewer/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'View Logs',
          click: async () => {
            const os = require('os');
            const path = require('path');
            const logPath = path.join(os.homedir(), '.universal-session-viewer');
            await shell.openPath(logPath);
          },
        },
        { type: 'separator' },
        {
          label: 'About Universal Session Viewer',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              type: 'info',
              title: 'About Universal Session Viewer',
              message: 'Universal Session Viewer',
              detail: `Version: ${app.getVersion()}\n\nA desktop application for viewing and analyzing Claude Code sessions.\n\nBuilt with Electron, React, and TypeScript.`,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * Send a message to the renderer process via IPC
 * @param {string} channel - The IPC channel name
 * @param {any} data - Optional data to send
 */
function sendToRenderer(channel, data) {
  const win = BrowserWindow.getFocusedWindow();
  if (win && win.webContents) {
    win.webContents.send(channel, data);
  }
}

/**
 * Initialize the application menu
 * @param {Object} appInstance - The SessionViewerApp instance
 */
function initializeMenu(_appInstance) {
  const menu = createApplicationMenu(_appInstance);
  Menu.setApplicationMenu(menu);
}

module.exports = {
  createApplicationMenu,
  initializeMenu,
};
