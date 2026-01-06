/**
 * Settings IPC Handler - Session Rediscovery Integration Test
 *
 * This is a simple integration test that verifies the session rediscovery
 * logic works correctly when additionalDiscoveryPaths change.
 *
 * NOTE: This uses a simpler CommonJS-compatible approach since the main
 * settings.js module uses CommonJS require().
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

describe('Session Rediscovery Integration', () => {
  let mockAppInstance;
  let mockIpcMain;
  let saveSettingsHandler;

  beforeEach(() => {
    // Track registered handlers
    const handlers = new Map();

    // Mock ipcMain
    mockIpcMain = {
      handle: (channel, handler) => {
        handlers.set(channel, handler);
      },
    };

    // Mock dialog
    const mockDialog = {
      showOpenDialog: () => Promise.resolve({ canceled: true }),
    };

    // Mock safeLog
    const mockSafeLog = {
      log: () => {},
      error: () => {},
    };

    // Mock expandPath
    const mockExpandPath = (p) => p;

    // Mock appInstance
    mockAppInstance = {
      getAllSettings: () => ({
        paths: {
          additionalDiscoveryPaths: [],
        },
      }),
      saveAllSettings: () => {},
      stopFileWatcher: () => {},
      startFileWatcher: () => Promise.resolve(),
      findAllSessions: () => Promise.resolve([
        { id: 'session-1', project: 'test' },
        { id: 'session-2', project: 'test' },
      ]),
    };

    // Mock electron module
    require.cache[require.resolve('electron')] = {
      exports: {
        ipcMain: mockIpcMain,
        dialog: mockDialog,
      },
    };

    // Mock config module
    require.cache[require.resolve('../../../src/electron/config')] = {
      exports: {
        safeLog: mockSafeLog,
      },
    };

    // Mock security utils
    require.cache[require.resolve('../../../src/electron/utils/security')] = {
      exports: {
        expandPath: mockExpandPath,
      },
    };

    // Load settings module (will use our mocks)
    delete require.cache[require.resolve('../../../src/electron/ipc/settings.js')];
    const settingsModule = require('../../../src/electron/ipc/settings.js');

    // Register handlers
    settingsModule.register(mockAppInstance);

    // Get the save-settings handler
    saveSettingsHandler = handlers.get('save-settings');
  });

  it('should call findAllSessions when additionalDiscoveryPaths change', async () => {
    let findAllSessionsCalled = false;

    mockAppInstance.findAllSessions = () => {
      findAllSessionsCalled = true;
      return Promise.resolve([
        { id: 'session-1', project: 'test' },
        { id: 'session-2', project: 'test' },
      ]);
    };

    const newSettings = {
      paths: {
        additionalDiscoveryPaths: ['/new/path'],
      },
    };

    const result = await saveSettingsHandler(null, newSettings);

    assert.strictEqual(findAllSessionsCalled, true, 'findAllSessions should be called');
    assert.deepStrictEqual(result, { success: true });
  });

  it('should NOT call findAllSessions when paths unchanged', async () => {
    let findAllSessionsCalled = false;

    mockAppInstance.getAllSettings = () => ({
      paths: {
        additionalDiscoveryPaths: ['/path/a'],
      },
    });

    mockAppInstance.findAllSessions = () => {
      findAllSessionsCalled = true;
      return Promise.resolve([]);
    };

    const newSettings = {
      paths: {
        additionalDiscoveryPaths: ['/path/a'],
      },
      analysis: {
        dailyQuota: 20,
      },
    };

    const result = await saveSettingsHandler(null, newSettings);

    assert.strictEqual(findAllSessionsCalled, false, 'findAllSessions should NOT be called');
    assert.deepStrictEqual(result, { success: true });
  });

  it('should handle findAllSessions errors gracefully', async () => {
    mockAppInstance.findAllSessions = () => {
      return Promise.reject(new Error('Failed to read directory'));
    };

    const newSettings = {
      paths: {
        additionalDiscoveryPaths: ['/new/path'],
      },
    };

    const result = await saveSettingsHandler(null, newSettings);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Failed to read directory');
  });
});
