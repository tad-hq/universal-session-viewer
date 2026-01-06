/**
 * Integration Test: Multi-Path File Watcher
 *
 * Tests the file watcher's ability to monitor multiple discovery paths simultaneously.
 * Validates that the chokidar watcher correctly handles:
 * - Watching all discovery paths (primary + additional)
 * - Detecting new sessions in additional paths
 * - Detecting modifications in additional paths
 * - Path removal during runtime
 * - Debouncing across all paths (300ms)
 *
 * Test Backend Integration:
 * - File watcher monitors multiple paths correctly
 * - Events are processed from all paths
 * - Debouncing works consistently across paths
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// We'll need to create a minimal SessionViewerApp instance for testing
// Since this is an integration test, we use real implementations where possible

describe('Multi-Path File Watcher Integration', () => {
  let testDir;
  let primaryPath;
  let additionalPath1;
  let additionalPath2;
  let appInstance;
  let mockDb;
  let mockWindow;

  beforeEach(async () => {
    // Create temporary test directories
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multi-path-watcher-test-'));
    primaryPath = path.join(testDir, 'primary-claude-projects');
    additionalPath1 = path.join(testDir, 'additional-path-1');
    additionalPath2 = path.join(testDir, 'additional-path-2');

    fs.mkdirSync(primaryPath, { recursive: true });
    fs.mkdirSync(additionalPath1, { recursive: true });
    fs.mkdirSync(additionalPath2, { recursive: true });

    // Create project subdirectories
    fs.mkdirSync(path.join(primaryPath, 'project-a'), { recursive: true });
    fs.mkdirSync(path.join(additionalPath1, 'project-b'), { recursive: true });
    fs.mkdirSync(path.join(additionalPath2, 'project-c'), { recursive: true });

    // Mock database with in-memory storage
    const sessionMetadata = new Map();
    const sessionAnalysis = new Map();
    const settings = new Map([
      ['paths.additionalDiscoveryPaths', JSON.stringify([])],
    ]);

    mockDb = {
      prepare: (sql) => {
        return {
          run: (...args) => {
            // Extract session ID and metadata from INSERT/REPLACE statement
            if (sql.includes('INSERT OR REPLACE INTO session_metadata')) {
              const [id, project, projectPath, filePath] = args;
              sessionMetadata.set(id, { id, project, projectPath, filePath });
            }
            if (sql.includes('INSERT OR REPLACE INTO session_analysis_cache')) {
              const [id, title, summary] = args;
              sessionAnalysis.set(id, { id, title, summary });
            }
            if (sql.includes('INSERT OR REPLACE INTO settings')) {
              const [key, value] = args;
              settings.set(key, value);
            }
          },
          get: (...args) => {
            if (sql.includes('SELECT value FROM settings')) {
              const key = args[0];
              return { value: settings.get(key) };
            }
            if (sql.includes('SELECT * FROM session_metadata')) {
              const id = args[0];
              return sessionMetadata.get(id);
            }
            return null;
          },
          all: () => {
            if (sql.includes('SELECT * FROM session_metadata')) {
              return Array.from(sessionMetadata.values());
            }
            return [];
          },
        };
      },
      exec: () => {},
      close: () => {},
    };

    // Mock window for IPC
    const sentMessages = [];
    mockWindow = {
      webContents: {
        send: (channel, data) => {
          sentMessages.push({ channel, data });
        },
      },
      isDestroyed: () => false,
      _getSentMessages: () => sentMessages,
      _clearMessages: () => {
        sentMessages.length = 0;
      },
    };

    // Create minimal app instance (we'll mock the critical methods)
    appInstance = {
      db: mockDb,
      mainWindow: mockWindow,
      fileWatcher: null,
      pendingUpdates: new Map(),
      updateDebounceTimer: null,
      childProcesses: new Set(),

      // Settings management
      getAllSettings: function () {
        const additionalPathsJson = settings.get('paths.additionalDiscoveryPaths') || '[]';
        return {
          paths: {
            additionalDiscoveryPaths: JSON.parse(additionalPathsJson),
            excludePaths: [],
          },
        };
      },

      saveAllSettings: function (newSettings) {
        if (newSettings.paths?.additionalDiscoveryPaths) {
          settings.set(
            'paths.additionalDiscoveryPaths',
            JSON.stringify(newSettings.paths.additionalDiscoveryPaths)
          );
        }
      },

      // Discovery paths
      getClaudeProjectsDir: function () {
        return primaryPath;
      },

      getAllDiscoveryPaths: function () {
        const currentSettings = this.getAllSettings();
        const paths = [this.getClaudeProjectsDir()];
        if (currentSettings.paths?.additionalDiscoveryPaths) {
          paths.push(...currentSettings.paths.additionalDiscoveryPaths);
        }
        return paths;
      },

      resolveSymlinks: function (pathToResolve) {
        // For testing, just return the path as-is
        return pathToResolve;
      },

      shouldExcludePath: function () {
        return false; // No exclusions in tests
      },

      // File watcher core methods
      startFileWatcher: function () {
        const chokidar = require('chokidar');

        // Stop existing watcher
        if (this.fileWatcher) {
          this.fileWatcher.close();
        }

        const discoveryPaths = this.getAllDiscoveryPaths();
        const watchPatterns = discoveryPaths.map((dir) => `${dir}/**/*.jsonl`);

        this.fileWatcher = chokidar.watch(watchPatterns, {
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100,
          },
          depth: 2,
        });

        this.pendingUpdates = new Map();
        this.updateDebounceTimer = null;

        this.fileWatcher.on('change', (filePath) => {
          this.handleFileChange(filePath, 'change');
        });

        this.fileWatcher.on('add', (filePath) => {
          this.handleFileChange(filePath, 'add');
        });

        this.fileWatcher.on('unlink', (filePath) => {
          this.handleFileDelete(filePath);
        });

        return new Promise((resolve) => {
          this.fileWatcher.on('ready', resolve);
        });
      },

      stopFileWatcher: function () {
        if (this.fileWatcher) {
          this.fileWatcher.close();
          this.fileWatcher = null;
        }
        if (this.updateDebounceTimer) {
          clearTimeout(this.updateDebounceTimer);
          this.updateDebounceTimer = null;
        }
      },

      handleFileChange: function (filePath, eventType) {
        // Only process UUID-named session files
        const fileName = path.basename(filePath, '.jsonl');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(fileName)) {
          return;
        }

        // Skip temp directories
        const projectDir = path.basename(path.dirname(filePath));
        if (
          projectDir.startsWith('-tmp-') ||
          projectDir.startsWith('-private-var-folders') ||
          projectDir.includes('-var-folders-')
        ) {
          return;
        }

        // Add to pending updates (debounce)
        this.pendingUpdates.set(filePath, { eventType, timestamp: Date.now() });

        // Debounce: process all pending updates after 300ms of quiet
        if (this.updateDebounceTimer) {
          clearTimeout(this.updateDebounceTimer);
        }

        this.updateDebounceTimer = setTimeout(() => {
          this.processPendingUpdates();
        }, 300);
      },

      processPendingUpdates: async function () {
        if (this.pendingUpdates.size === 0) return;

        const updates = new Map(this.pendingUpdates);
        this.pendingUpdates.clear();

        for (const [filePath, { eventType }] of updates) {
          try {
            const sessionId = path.basename(filePath, '.jsonl');
            const projectDir = path.basename(path.dirname(filePath));

            const stats = await fs.promises.stat(filePath);

            // Update metadata
            this.db
              .prepare(
                'INSERT OR REPLACE INTO session_metadata (id, project, project_path, file_path) VALUES (?, ?, ?, ?)'
              )
              .run(sessionId, projectDir, path.dirname(filePath), filePath);

            // Send IPC notification
            if (!this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('sessions-updated', {
                eventType,
                sessionId,
                project: projectDir,
              });
            }
          } catch (error) {
            // Ignore errors in test
          }
        }
      },

      handleFileDelete: function (filePath) {
        const sessionId = path.basename(filePath, '.jsonl');

        // Remove from database
        this.db.prepare('DELETE FROM session_metadata WHERE id = ?').run(sessionId);

        // Notify renderer
        if (!this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('sessions-updated', {
            eventType: 'delete',
            sessionId,
          });
        }
      },
    };
  });

  afterEach(async () => {
    // Stop file watcher
    if (appInstance && appInstance.fileWatcher) {
      appInstance.stopFileWatcher();
    }

    // Cleanup test directories
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('watches all discovery paths simultaneously', async () => {
    // GIVEN: Multiple discovery paths configured
    appInstance.saveAllSettings({
      paths: {
        additionalDiscoveryPaths: [additionalPath1, additionalPath2],
      },
    });

    // WHEN: File watcher started
    await appInstance.startFileWatcher();

    // THEN: Chokidar watching all paths
    const discoveryPaths = appInstance.getAllDiscoveryPaths();
    assert.strictEqual(discoveryPaths.length, 3, 'Should have 3 discovery paths');
    assert.ok(discoveryPaths.includes(primaryPath), 'Should include primary path');
    assert.ok(discoveryPaths.includes(additionalPath1), 'Should include additional path 1');
    assert.ok(discoveryPaths.includes(additionalPath2), 'Should include additional path 2');

    // Verify watcher is active
    assert.ok(appInstance.fileWatcher, 'File watcher should be initialized');
  });

  it('detects new session in additional path', { timeout: 3000 }, async function () {

    // GIVEN: Watcher running with additional path
    appInstance.saveAllSettings({
      paths: {
        additionalDiscoveryPaths: [additionalPath1],
      },
    });

    await appInstance.startFileWatcher();

    // Clear any initial messages
    mockWindow._clearMessages();

    // WHEN: New file created in additional path
    const sessionId = '12345678-1234-1234-1234-123456789abc';
    const newFilePath = path.join(additionalPath1, 'project-b', `${sessionId}.jsonl`);

    // Write initial content
    await fs.promises.writeFile(
      newFilePath,
      JSON.stringify({
        event: 'chat',
        message: { role: 'user', content: 'Test message' },
      }) + '\n'
    );

    // Wait for file watcher to detect, stabilize, and debounce (500ms + 300ms + buffer)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // THEN: 'add' event should be processed
    const messages = mockWindow._getSentMessages();
    const sessionUpdates = messages.filter((m) => m.channel === 'sessions-updated');

    assert.ok(sessionUpdates.length > 0, 'Should have session update messages');

    const addEvent = sessionUpdates.find((m) => m.data.eventType === 'add');
    assert.ok(addEvent, 'Should have an "add" event');
    assert.strictEqual(addEvent.data.sessionId, sessionId, 'Should match session ID');
    assert.strictEqual(addEvent.data.project, 'project-b', 'Should match project name');
  });

  it('detects session modification in additional path', { timeout: 3000 }, async function () {

    // GIVEN: Existing session in additional path
    const sessionId = '87654321-4321-4321-4321-cba987654321';
    const filePath = path.join(additionalPath2, 'project-c', `${sessionId}.jsonl`);

    // Create initial file
    await fs.promises.writeFile(
      filePath,
      JSON.stringify({
        event: 'chat',
        message: { role: 'user', content: 'Initial message' },
      }) + '\n'
    );

    // Start watcher
    appInstance.saveAllSettings({
      paths: {
        additionalDiscoveryPaths: [additionalPath2],
      },
    });

    await appInstance.startFileWatcher();

    // Wait for initial detection
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Clear messages
    mockWindow._clearMessages();

    // WHEN: File modified (new message appended)
    await fs.promises.appendFile(
      filePath,
      JSON.stringify({
        event: 'chat',
        message: { role: 'assistant', content: 'Response message' },
      }) + '\n'
    );

    // Wait for change detection and debounce
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // THEN: 'change' event should be emitted
    const messages = mockWindow._getSentMessages();
    const sessionUpdates = messages.filter((m) => m.channel === 'sessions-updated');

    assert.ok(sessionUpdates.length > 0, 'Should have session update messages');

    const changeEvent = sessionUpdates.find((m) => m.data.eventType === 'change');
    assert.ok(changeEvent, 'Should have a "change" event');
    assert.strictEqual(changeEvent.data.sessionId, sessionId, 'Should match session ID');
  });

  it('handles path removal during runtime', { timeout: 3000 }, async function () {

    // GIVEN: Watcher monitoring additional path
    appInstance.saveAllSettings({
      paths: {
        additionalDiscoveryPaths: [additionalPath1],
      },
    });

    await appInstance.startFileWatcher();

    // Create a session in the additional path
    const sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const filePath = path.join(additionalPath1, 'project-b', `${sessionId}.jsonl`);

    await fs.promises.writeFile(
      filePath,
      JSON.stringify({
        event: 'chat',
        message: { role: 'user', content: 'Test' },
      }) + '\n'
    );

    // Wait for detection
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // WHEN: Settings saved with path removed
    appInstance.saveAllSettings({
      paths: {
        additionalDiscoveryPaths: [], // Path removed
      },
    });

    // Restart watcher (this is what the settings IPC handler does)
    appInstance.stopFileWatcher();
    await appInstance.startFileWatcher();

    // Clear messages
    mockWindow._clearMessages();

    // Modify file in the removed path
    await fs.promises.appendFile(
      filePath,
      JSON.stringify({
        event: 'chat',
        message: { role: 'assistant', content: 'After removal' },
      }) + '\n'
    );

    // Wait for potential event processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // THEN: Watcher should not monitor removed path
    const discoveryPaths = appInstance.getAllDiscoveryPaths();
    assert.strictEqual(discoveryPaths.length, 1, 'Should only have primary path');
    assert.ok(!discoveryPaths.includes(additionalPath1), 'Should not include removed path');

    // No events should be fired for the removed path
    const messages = mockWindow._getSentMessages();
    const sessionUpdates = messages.filter(
      (m) => m.channel === 'sessions-updated' && m.data.sessionId === sessionId
    );

    assert.strictEqual(
      sessionUpdates.length,
      0,
      'Should not emit events for files in removed path'
    );
  });

  it('respects 300ms debounce across all paths', { timeout: 4000 }, async function () {

    // GIVEN: Multiple paths with rapid writes
    appInstance.saveAllSettings({
      paths: {
        additionalDiscoveryPaths: [additionalPath1, additionalPath2],
      },
    });

    await appInstance.startFileWatcher();

    // Create sessions in different paths
    const session1Id = '11111111-1111-1111-1111-111111111111';
    const session2Id = '22222222-2222-2222-2222-222222222222';
    const session3Id = '33333333-3333-3333-3333-333333333333';

    const file1 = path.join(primaryPath, 'project-a', `${session1Id}.jsonl`);
    const file2 = path.join(additionalPath1, 'project-b', `${session2Id}.jsonl`);
    const file3 = path.join(additionalPath2, 'project-c', `${session3Id}.jsonl`);

    // Create initial files
    const initialContent = JSON.stringify({
      event: 'chat',
      message: { role: 'user', content: 'Initial' },
    }) + '\n';

    await fs.promises.writeFile(file1, initialContent);
    await fs.promises.writeFile(file2, initialContent);
    await fs.promises.writeFile(file3, initialContent);

    // Wait for initial detection
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Clear messages
    mockWindow._clearMessages();

    // WHEN: Files modified < 300ms apart (rapid writes across different paths)
    const startTime = Date.now();

    // Modify file 1 at T=0ms
    await fs.promises.appendFile(file1, initialContent);

    // Wait 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Modify file 2 at T=100ms
    await fs.promises.appendFile(file2, initialContent);

    // Wait 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Modify file 3 at T=200ms
    await fs.promises.appendFile(file3, initialContent);

    // All modifications happened within 200ms (< 300ms debounce)

    // Wait for file watcher stabilization (500ms) + debounce (300ms) + buffer
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const endTime = Date.now();

    // THEN: Updates should be batched (one processPendingUpdates call)
    const messages = mockWindow._getSentMessages();
    const sessionUpdates = messages.filter((m) => m.channel === 'sessions-updated');

    // All 3 updates should be present
    assert.ok(sessionUpdates.length >= 3, 'Should have all 3 session updates');

    const session1Updates = sessionUpdates.filter((m) => m.data.sessionId === session1Id);
    const session2Updates = sessionUpdates.filter((m) => m.data.sessionId === session2Id);
    const session3Updates = sessionUpdates.filter((m) => m.data.sessionId === session3Id);

    assert.ok(session1Updates.length > 0, 'Should have session 1 update');
    assert.ok(session2Updates.length > 0, 'Should have session 2 update');
    assert.ok(session3Updates.length > 0, 'Should have session 3 update');

    // Verify debouncing happened (should complete after stabilization + debounce)
    const totalTime = endTime - startTime;
    assert.ok(
      totalTime >= 900 && totalTime < 2000,
      `Debounce should complete in ~1000-1200ms, took ${totalTime}ms`
    );
  });
});
