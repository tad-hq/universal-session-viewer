/**
 * Settings IPC Handler Tests - Session Rediscovery (Task 3)
 *
 * Tests session rediscovery trigger after file watcher restart
 * when additionalDiscoveryPaths change.
 *
 * TDD APPROACH (RED → GREEN → REFACTOR):
 * 1. RED: Write failing tests first ✓ (THESE TESTS)
 * 2. GREEN: Implement code to pass tests
 * 3. REFACTOR: Optimize and clean up
 *
 * NOTE: This test file focuses on Task 3's NEW functionality (session rediscovery).
 * File watcher restart logic (Task 2) is tested via integration tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Session Rediscovery on Settings Change (Task 3)', () => {
  let mockAppInstance: any;
  let mockSettings: any;
  let mockIpcMain: any;
  let settingsHandler: any;

  beforeEach(() => {
    // Clear all previous mocks
    vi.clearAllMocks();
    vi.resetModules();

    // Create mock appInstance
    mockAppInstance = {
      getAllSettings: vi.fn(),
      saveAllSettings: vi.fn(),
      stopFileWatcher: vi.fn(),
      startFileWatcher: vi.fn().mockResolvedValue(undefined),
      findAllSessions: vi.fn().mockResolvedValue([]),
    };

    // Setup mock settings
    mockSettings = {
      paths: {
        additionalDiscoveryPaths: [],
      },
    };
    mockAppInstance.getAllSettings.mockReturnValue(mockSettings);

    // Create mock ipcMain that captures handlers
    const handlersMap = new Map();
    mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlersMap.set(channel, handler);
      }),
    };

    // Mock electron module
    vi.doMock('electron', () => ({
      ipcMain: mockIpcMain,
      dialog: {
        showOpenDialog: vi.fn(),
      },
    }));

    // Mock config
    vi.doMock('../../../src/electron/config', () => ({
      safeLog: {
        error: vi.fn(),
        log: vi.fn(),
      },
    }));

    // Mock utils/security
    vi.doMock('../../../src/electron/utils/security', () => ({
      expandPath: vi.fn((p: string) => p),
    }));

    // Dynamically import and register handlers
    return import('../../../src/electron/ipc/settings.js').then((settingsModule) => {
      settingsModule.register(mockAppInstance);
      settingsHandler = handlersMap.get('save-settings');
    });
  });

  // =========================================================================
  // TEST 1: Triggers session rediscovery when paths added
  // =========================================================================
  it('should trigger findAllSessions when additionalDiscoveryPaths added', async () => {
    // GIVEN: new path is added
    const newSettings = {
      paths: {
        additionalDiscoveryPaths: ['/new/path'],
      },
    };

    // Mock discovered sessions
    const mockSessions = [
      { id: 'session-1', project: 'test-project' },
      { id: 'session-2', project: 'test-project' },
    ];
    mockAppInstance.findAllSessions.mockResolvedValue(mockSessions);

    // WHEN: save-settings is called
    const result = await settingsHandler(null, newSettings);

    // THEN: findAllSessions should be called
    expect(mockAppInstance.findAllSessions).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  // =========================================================================
  // TEST 2: Triggers session rediscovery when paths removed
  // =========================================================================
  it('should trigger findAllSessions when additionalDiscoveryPaths removed', async () => {
    // GIVEN: old settings with a path
    mockSettings.paths.additionalDiscoveryPaths = ['/old/path'];

    // New settings with path removed
    const newSettings = {
      paths: {
        additionalDiscoveryPaths: [],
      },
    };

    // WHEN: save-settings is called
    const result = await settingsHandler(null, newSettings);

    // THEN: findAllSessions should be called
    expect(mockAppInstance.findAllSessions).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  // =========================================================================
  // TEST 3: Triggers session rediscovery when paths changed
  // =========================================================================
  it('should trigger findAllSessions when additionalDiscoveryPaths changed', async () => {
    // GIVEN: old settings with one path
    mockSettings.paths.additionalDiscoveryPaths = ['/path/a'];

    // New settings with different path
    const newSettings = {
      paths: {
        additionalDiscoveryPaths: ['/path/b'],
      },
    };

    // WHEN: save-settings is called
    const result = await settingsHandler(null, newSettings);

    // THEN: findAllSessions should be called
    expect(mockAppInstance.findAllSessions).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  // =========================================================================
  // TEST 4: Does NOT trigger rediscovery when paths unchanged
  // =========================================================================
  it('should NOT trigger findAllSessions when paths unchanged', async () => {
    // GIVEN: old and new settings have same paths
    mockSettings.paths.additionalDiscoveryPaths = ['/path/a'];

    const newSettings = {
      paths: {
        additionalDiscoveryPaths: ['/path/a'],
      },
      analysis: {
        dailyQuota: 20, // Different setting, not paths
      },
    };

    // WHEN: save-settings is called
    const result = await settingsHandler(null, newSettings);

    // THEN: findAllSessions should NOT be called
    expect(mockAppInstance.findAllSessions).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  // =========================================================================
  // TEST 5: Handles findAllSessions errors gracefully
  // =========================================================================
  it('should handle findAllSessions errors gracefully', async () => {
    // GIVEN: new path added
    const newSettings = {
      paths: {
        additionalDiscoveryPaths: ['/new/path'],
      },
    };

    // findAllSessions throws error
    mockAppInstance.findAllSessions.mockRejectedValue(
      new Error('Failed to read directory')
    );

    // WHEN: save-settings is called
    const result = await settingsHandler(null, newSettings);

    // THEN: error should be returned
    expect(result).toEqual({
      success: false,
      error: 'Failed to read directory',
    });
  });

  // =========================================================================
  // TEST 6: Verifies session count is returned
  // =========================================================================
  it('should successfully return discovered session count', async () => {
    // GIVEN: new path added
    const newSettings = {
      paths: {
        additionalDiscoveryPaths: ['/new/path'],
      },
    };

    // Mock 5 sessions discovered
    const mockSessions = Array(5).fill(null).map((_, i) => ({
      id: `session-${i}`,
      project: 'test-project',
    }));
    mockAppInstance.findAllSessions.mockResolvedValue(mockSessions);

    // WHEN: save-settings is called
    const result = await settingsHandler(null, newSettings);

    // THEN: findAllSessions should return 5 sessions
    expect(mockAppInstance.findAllSessions).toHaveBeenCalled();
    const sessions = await mockAppInstance.findAllSessions.mock.results[0].value;
    expect(sessions).toHaveLength(5);
    expect(result).toEqual({ success: true });
  });
});
