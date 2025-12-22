/**
 * Mock Electron APIs for Main Process Testing
 *
 * PURPOSE: Provide mock implementations of Electron APIs (ipcMain, dialog, shell, BrowserWindow)
 * for testing main process code without launching a real Electron instance.
 *
 * V1 PATTERN CONTEXT:
 * - Main process uses ipcMain.handle() for all IPC (no ipcMain.on())
 * - dialog.showOpenDialog() for directory selection
 * - shell.showItemInFolder() for opening Finder
 * - BrowserWindow for window management
 */

import { vi } from 'vitest';

export interface MockIpcMainHandler {
  (event: MockIpcEvent, ...args: any[]): Promise<any>;
}

export interface MockIpcEvent {
  sender: {
    send: ReturnType<typeof vi.fn>;
  };
}

export interface MockIpcMain {
  handle: ReturnType<typeof vi.fn>;
  handlers: Map<string, MockIpcMainHandler>;
  removeHandler: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
}

export interface MockDialog {
  showOpenDialog: ReturnType<typeof vi.fn>;
  showSaveDialog: ReturnType<typeof vi.fn>;
  showMessageBox: ReturnType<typeof vi.fn>;
  showErrorBox: ReturnType<typeof vi.fn>;
}

export interface MockShell {
  showItemInFolder: ReturnType<typeof vi.fn>;
  openPath: ReturnType<typeof vi.fn>;
  openExternal: ReturnType<typeof vi.fn>;
}

export interface MockBrowserWindow {
  webContents: {
    send: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    openDevTools: ReturnType<typeof vi.fn>;
  };
  on: ReturnType<typeof vi.fn>;
  loadURL: ReturnType<typeof vi.fn>;
  loadFile: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  isDestroyed: ReturnType<typeof vi.fn>;
}

export interface MockApp {
  getPath: ReturnType<typeof vi.fn>;
  getVersion: ReturnType<typeof vi.fn>;
  getName: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  whenReady: ReturnType<typeof vi.fn>;
}

/**
 * Create mock ipcMain with handler registration tracking
 *
 * V1 Pattern (main.js): All handlers use ipcMain.handle(), no ipcMain.on()
 * This mock captures registered handlers so tests can invoke them directly.
 */
export function createMockIpcMain(): MockIpcMain {
  const handlers = new Map<string, MockIpcMainHandler>();

  const mockIpcMain: MockIpcMain = {
    handle: vi.fn((channel: string, handler: MockIpcMainHandler) => {
      handlers.set(channel, handler);
    }),
    handlers,
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
    on: vi.fn(),
    once: vi.fn(),
  };

  return mockIpcMain;
}

/**
 * Create mock event object for IPC handlers
 *
 * V1 Pattern: Handlers receive (event, ...args) where event.sender.send()
 * is used for bidirectional communication
 */
export function createMockIpcEvent(): MockIpcEvent {
  return {
    sender: {
      send: vi.fn(),
    },
  };
}

/**
 * Create mock dialog with default responses
 *
 * V1 Pattern (main.js:4850): browse-directory handler uses dialog.showOpenDialog()
 * Default: canceled=true (user cancels), override in tests as needed
 */
export function createMockDialog(): MockDialog {
  return {
    showOpenDialog: vi.fn().mockResolvedValue({
      canceled: true,
      filePaths: [],
    }),
    showSaveDialog: vi.fn().mockResolvedValue({
      canceled: true,
      filePath: undefined,
    }),
    showMessageBox: vi.fn().mockResolvedValue({
      response: 0,
      checkboxChecked: false,
    }),
    showErrorBox: vi.fn(),
  };
}

/**
 * Create mock shell for file operations
 *
 * V1 Pattern (main.js:4794): open-session-folder handler uses shell.showItemInFolder()
 */
export function createMockShell(): MockShell {
  return {
    showItemInFolder: vi.fn(),
    openPath: vi.fn().mockResolvedValue(''),
    openExternal: vi.fn().mockResolvedValue(),
  };
}

/**
 * Create mock BrowserWindow
 *
 * V1 Pattern: Main window stored in SessionViewerApp.mainWindow
 * Used for sending events to renderer (mainWindow.webContents.send())
 */
export function createMockBrowserWindow(): MockBrowserWindow {
  return {
    webContents: {
      send: vi.fn(),
      on: vi.fn(),
      openDevTools: vi.fn(),
    },
    on: vi.fn(),
    loadURL: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
  };
}

/**
 * Create mock Electron app
 *
 * V1 Pattern: app.getPath('userData') used for database location
 */
export function createMockApp(userDataPath: string = '/tmp/test-app-data'): MockApp {
  return {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return userDataPath;
      if (name === 'home') return '/Users/test';
      return '/tmp/test';
    }),
    getVersion: vi.fn().mockReturnValue('2.0.0-test'),
    getName: vi.fn().mockReturnValue('universal-session-viewer-test'),
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create complete mock Electron module
 *
 * Usage in tests:
 * ```typescript
 * vi.mock('electron', () => createMockElectron());
 * ```
 */
export function createMockElectron(userDataPath?: string) {
  const ipcMain = createMockIpcMain();
  const dialog = createMockDialog();
  const shell = createMockShell();
  const app = createMockApp(userDataPath);

  // BrowserWindow constructor mock
  const BrowserWindow = vi.fn(() => createMockBrowserWindow());
  BrowserWindow.getAllWindows = vi.fn(() => []);
  BrowserWindow.getFocusedWindow = vi.fn(() => null);

  return {
    ipcMain,
    dialog,
    shell,
    app,
    BrowserWindow,
  };
}

/**
 * Helper to invoke IPC handler directly (bypassing real Electron)
 *
 * @param ipcMain - Mock ipcMain instance
 * @param channel - IPC channel name
 * @param args - Arguments to pass to handler
 * @returns Handler response
 */
export async function invokeHandler(
  ipcMain: MockIpcMain,
  channel: string,
  ...args: any[]
): Promise<any> {
  const handler = ipcMain.handlers.get(channel);
  if (!handler) {
    throw new Error(`IPC handler '${channel}' not registered`);
  }

  const mockEvent = createMockIpcEvent();
  return handler(mockEvent, ...args);
}
