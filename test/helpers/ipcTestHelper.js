/**
 * IPC Test Helper
 *
 * Creates mock IPC infrastructure that loads real handlers from src/electron/ipc/
 * This allows integration tests to verify handler registration and behavior.
 */

import { vi } from 'vitest';

/**
 * Creates a mock IPC system that loads real handlers from src/electron/ipc/
 *
 * This allows integration tests to verify that IPC handlers are registered
 * correctly and call the right SessionViewerApp methods.
 *
 * @param {Object} mockApp - Mock SessionViewerApp instance
 * @returns {Promise<Object>} Mock IPC object with invoke method and handlers map
 */
async function createMockIPCWithRealHandlers(mockApp) {
  const handlers = new Map();

  // Mock ipcMain to capture registered handlers
  const mockIpcMain = {
    handle: (channel, handler) => {
      handlers.set(channel, handler);
    },
  };

  // Mock dialog for browse-directory tests
  const mockDialog = {
    showOpenDialog: vi.fn(async () => ({
      canceled: true,
      filePaths: [],
    })),
  };

  // Mock shell for open-session-folder tests
  const mockShell = {
    showItemInFolder: vi.fn(async () => {}),
  };

  // Replace ipcMain in the require cache
  const Module = await import('module');
  const originalRequire = Module.default.prototype.require;

  Module.default.prototype.require = function (id) {
    if (id === 'electron') {
      return {
        ipcMain: mockIpcMain,
        dialog: mockDialog,
        shell: mockShell,
        BrowserWindow: vi.fn(),
      };
    }
    return originalRequire.apply(this, arguments);
  };

  // Import and register all handlers
  const { registerAllHandlers } = await import('../../src/electron/ipc/index.js');
  registerAllHandlers(mockApp);

  // Restore original require
  Module.default.prototype.require = originalRequire;

  // Return mock IPC object
  return {
    invoke: async (channel, ...args) => {
      const handler = handlers.get(channel);
      if (!handler) {
        throw new Error(`IPC handler '${channel}' not registered`);
      }
      // Call handler with mock event object
      const mockEvent = {
        sender: {
          send: vi.fn(),
        },
      };
      return handler(mockEvent, ...args);
    },
    handlers,
  };
}

/**
 * Creates a minimal mock SessionViewerApp for testing
 *
 * Override methods as needed in your tests using vi.fn()
 *
 * @returns {Object} Mock app instance
 */
function createMockApp() {
  return {
    // Database
    db: {
      prepare: vi.fn(() => ({
        get: vi.fn(),
        all: vi.fn(() => []),
        run: vi.fn(),
      })),
      exec: vi.fn(),
    },

    // Services (used by handlers)
    continuationService: {
      getContinuationChain: vi.fn(),
      getContinuationChildren: vi.fn(),
      getContinuationMetadata: vi.fn(),
      getContinuationStats: vi.fn(),
      getSessionWithContinuations: vi.fn(),
      resolveContinuationChains: vi.fn(),
      healOrphanedContinuations: vi.fn(),
    },

    analysisService: {
      analyzeSessionWithHaiku: vi.fn(),
      cacheAnalysis: vi.fn(),
      getCachedAnalysis: vi.fn(),
    },

    // Methods that handlers call directly
    getContinuationChain: vi.fn(),
    getContinuationChildren: vi.fn(),
    getSessionWithContinuations: vi.fn(),
    getContinuationMetadata: vi.fn(),
    getContinuationStats: vi.fn(),
    resolveContinuationChains: vi.fn(),
    healOrphanedContinuations: vi.fn(),

    searchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
    loadSessionsPaginated: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
    getSessionCount: vi.fn().mockResolvedValue(0),
    getAvailableProjects: vi.fn().mockResolvedValue([]),

    loadAndAnalyzeSessions: vi.fn(),
    getSessionDetails: vi.fn(),
    getAvailablePrompts: vi.fn(),

    checkDailyQuota: vi.fn(),
    analyzeSessionWithHaiku: vi.fn(),
    cacheAnalysis: vi.fn(),
    getQuotaStats: vi.fn(),

    getAllSettings: vi.fn(),
    saveAllSettings: vi.fn(),
    setSetting: vi.fn(),
    expandPath: vi.fn((path) => path.replace('~', '/Users/test')),

    // Other methods used by handlers
    safeSend: vi.fn(),
    debugLog: vi.fn(),
  };
}

export { createMockIPCWithRealHandlers, createMockApp };
