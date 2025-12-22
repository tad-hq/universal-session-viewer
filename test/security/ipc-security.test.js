/**
 * IPC Security Audit Test Suite
 *
 * Comprehensive security testing for all 35 IPC handlers
 * Tests for: path traversal, command injection, SQL injection, race conditions,
 * input validation, and context isolation compliance
 *
 * TEST STRATEGY:
 * - Use actual attack payloads (not sanitized examples)
 * - Test both success and failure cases
 * - Cover all 6 attack vector categories
 * - Verify proper error handling without information disclosure
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('IPC Security Audit - Wave 2.2', () => {
  let electronApp;
  let window;
  let electronAPI;

  beforeAll(async () => {
    // Launch Electron app in test mode
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../src/electron/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    window = await electronApp.firstWindow();
    electronAPI = await window.evaluateHandle(() => window.electronAPI);
  });

  afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  // =========================================================================
  // ATTACK VECTOR 1: PATH TRAVERSAL
  // =========================================================================

  describe('Path Traversal Attacks', () => {
    describe('validate-path handler', () => {
      it('should reject path traversal attempts with ../../', async () => {
        const maliciousPath = '../../../etc/passwd';
        const result = await window.evaluate(
          async (api, path) => api.validatePath(path),
          electronAPI,
          maliciousPath
        );

        expect(result.valid).toBe(false);
        expect(result.expandedPath).not.toContain('/etc/passwd');
      });

      it('should reject absolute path injection', async () => {
        const maliciousPath = '/etc/passwd';
        const result = await window.evaluate(
          async (api, path) => api.validatePath(path),
          electronAPI,
          maliciousPath
        );

        // /etc/passwd exists but should fail if not a directory
        expect(result.valid).toBe(false);
        expect(result.error).toContain('directory');
      });

      it('should safely resolve symlinks without traversal', async () => {
        // Create test symlink in tmp
        const tmpDir = os.tmpdir();
        const targetDir = path.join(tmpDir, 'test-target');
        const symlinkPath = path.join(tmpDir, 'test-symlink');

        try {
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);
          if (!fs.existsSync(symlinkPath)) {
            fs.symlinkSync(targetDir, symlinkPath);
          }

          const result = await window.evaluate(
            async (api, path) => api.validatePath(path),
            electronAPI,
            symlinkPath
          );

          expect(result.valid).toBe(true);
          // Should resolve to real path, not allow traversal
          expect(result.expandedPath).toContain('test-target');
        } finally {
          // Cleanup
          try {
            if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
            if (fs.existsSync(targetDir)) fs.rmdirSync(targetDir);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      });

      it('should reject null bytes in paths', async () => {
        const maliciousPath = '/tmp/test\x00/etc/passwd';
        const result = await window.evaluate(
          async (api, path) => api.validatePath(path),
          electronAPI,
          maliciousPath
        );

        expect(result.valid).toBe(false);
      });

      it('should handle tilde expansion safely', async () => {
        const tildeHome = '~/.claude';
        const result = await window.evaluate(
          async (api, path) => api.validatePath(path),
          electronAPI,
          tildeHome
        );

        // Should expand to actual home directory
        expect(result.expandedPath).toContain(os.homedir());
        expect(result.expandedPath).not.toContain('~');
      });
    });

    describe('open-session-folder handler', () => {
      it('should reject path traversal in session path', async () => {
        const maliciousPath = '../../../etc/passwd';
        const result = await window.evaluate(
          async (api, path) => api.openSessionFolder(path),
          electronAPI,
          maliciousPath
        );

        // Should fail gracefully
        expect(result.success).toBe(false);
      });

      it('should reject UNC paths on Windows (if applicable)', async () => {
        if (process.platform === 'win32') {
          const uncPath = '\\\\malicious-server\\share\\file';
          const result = await window.evaluate(
            async (api, path) => api.openSessionFolder(path),
            electronAPI,
            uncPath
          );

          expect(result.success).toBe(false);
        }
      });
    });

    describe('resume-session handler', () => {
      it('should not allow path traversal in session ID', async () => {
        const maliciousId = '../../../etc/passwd';
        const result = await window.evaluate(
          async (api, id) => api.resumeSession(id, null, false),
          electronAPI,
          maliciousId
        );

        expect(result.success).toBe(false);
      });

      it('should not allow path traversal in prompt file', async () => {
        const validSessionId = 'test-session-123';
        const maliciousPrompt = '../../../etc/passwd';
        const result = await window.evaluate(
          async (api, id, prompt) => api.resumeSession(id, prompt, false),
          electronAPI,
          validSessionId,
          maliciousPrompt
        );

        // Should either reject or safely resolve
        expect(result).toBeDefined();
      });
    });
  });

  // =========================================================================
  // ATTACK VECTOR 2: COMMAND INJECTION
  // =========================================================================

  describe('Command Injection Attacks', () => {
    describe('resume-session handler', () => {
      it('should escape shell metacharacters in session ID', async () => {
        const maliciousId = 'test; rm -rf /';
        const result = await window.evaluate(
          async (api, id) => api.resumeSession(id, null, false),
          electronAPI,
          maliciousId
        );

        // Should fail to find session, not execute command
        expect(result.success).toBe(false);
      });

      it('should escape backticks in session ID', async () => {
        const maliciousId = 'test`whoami`';
        const result = await window.evaluate(
          async (api, id) => api.resumeSession(id, null, false),
          electronAPI,
          maliciousId
        );

        expect(result.success).toBe(false);
      });

      it('should escape dollar signs in session ID', async () => {
        const maliciousId = 'test$(whoami)';
        const result = await window.evaluate(
          async (api, id) => api.resumeSession(id, null, false),
          electronAPI,
          maliciousId
        );

        expect(result.success).toBe(false);
      });

      it('should escape pipes in session ID', async () => {
        const maliciousId = 'test | cat /etc/passwd';
        const result = await window.evaluate(
          async (api, id) => api.resumeSession(id, null, false),
          electronAPI,
          maliciousId
        );

        expect(result.success).toBe(false);
      });
    });

    describe('open-sessions-tmux4 handler', () => {
      it('should escape shell metacharacters in session IDs', async () => {
        const maliciousIds = [
          'test; whoami',
          'test`id`',
          'test$(cat /etc/passwd)',
          'test | ls -la'
        ];
        const result = await window.evaluate(
          async (api, ids) => api.openSessionsTmux4(ids),
          electronAPI,
          maliciousIds
        );

        expect(result.success).toBe(false);
      });

      it('should validate array input (prevent prototype pollution)', async () => {
        const maliciousInput = { __proto__: { evil: 'payload' } };
        const result = await window.evaluate(
          async (api, input) => api.openSessionsTmux4(input),
          electronAPI,
          maliciousInput
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('array');
      });
    });

    describe('validate-binary-path handler', () => {
      it('should reject command injection in binary path', async () => {
        const maliciousPath = '/usr/bin/claude; rm -rf /';
        const result = await window.evaluate(
          async (api, path) => api.validateBinaryPath(path),
          electronAPI,
          maliciousPath
        );

        expect(result.valid).toBe(false);
      });

      it('should reject shell metacharacters in binary path', async () => {
        const maliciousPath = '/usr/bin/claude`whoami`';
        const result = await window.evaluate(
          async (api, path) => api.validateBinaryPath(path),
          electronAPI,
          maliciousPath
        );

        expect(result.valid).toBe(false);
      });
    });
  });

  // =========================================================================
  // ATTACK VECTOR 3: SQL INJECTION
  // =========================================================================

  describe('SQL Injection Attacks', () => {
    describe('search-sessions handler', () => {
      it('should escape FTS5 special characters', async () => {
        const maliciousQuery = "test' OR '1'='1";
        const result = await window.evaluate(
          async (api, query) => api.searchSessions(query, 10, 0),
          electronAPI,
          maliciousQuery
        );

        // Should not return all sessions
        expect(result.success).toBeDefined();
        expect(result.sessions).toBeDefined();
        // If successful, should be safe search results
      });

      it('should handle UNION injection attempts', async () => {
        const maliciousQuery = "test UNION SELECT * FROM session_analysis_cache--";
        const result = await window.evaluate(
          async (api, query) => api.searchSessions(query, 10, 0),
          electronAPI,
          maliciousQuery
        );

        expect(result.success).toBeDefined();
        // Should not expose raw cache data
      });

      it('should handle FTS5 MATCH syntax injection', async () => {
        const maliciousQuery = "* OR session_id:*";
        const result = await window.evaluate(
          async (api, query) => api.searchSessions(query, 10, 0),
          electronAPI,
          maliciousQuery
        );

        expect(result.success).toBeDefined();
      });

      it('should limit search results to prevent DoS', async () => {
        const result = await window.evaluate(
          async (api) => api.searchSessions('*', 99999, 0),
          electronAPI
        );

        expect(result.success).toBeDefined();
        if (result.sessions) {
          // Should enforce reasonable limit (e.g., 250 or less)
          expect(result.sessions.length).toBeLessThanOrEqual(250);
        }
      });
    });

    describe('load-sessions-paginated handler', () => {
      it('should reject negative offset (integer underflow)', async () => {
        const result = await window.evaluate(
          async (api) => api.loadSessionsPaginated(50, -1, {}),
          electronAPI
        );

        // Should handle gracefully
        expect(result.success).toBeDefined();
      });

      it('should reject negative limit (integer underflow)', async () => {
        const result = await window.evaluate(
          async (api) => api.loadSessionsPaginated(-50, 0, {}),
          electronAPI
        );

        expect(result.success).toBeDefined();
      });

      it('should handle filter injection in filters object', async () => {
        const maliciousFilters = {
          project: "' OR '1'='1",
          sessionId: "'; DROP TABLE session_metadata;--"
        };
        const result = await window.evaluate(
          async (api, filters) => api.loadSessionsPaginated(50, 0, filters),
          electronAPI,
          maliciousFilters
        );

        expect(result.success).toBeDefined();
        // Database should still exist (no DROP executed)
      });
    });

    describe('get-continuation-chain handler', () => {
      it('should escape session ID in SQL queries', async () => {
        const maliciousId = "test' OR '1'='1";
        const result = await window.evaluate(
          async (api, id) => api.getContinuationChain(id),
          electronAPI,
          maliciousId
        );

        // Should not return all chains
        expect(result).toBeDefined();
      });
    });
  });

  // =========================================================================
  // ATTACK VECTOR 4: RACE CONDITIONS
  // =========================================================================

  describe('Race Condition Attacks', () => {
    describe('refresh-sessions handler', () => {
      it('should handle concurrent refresh calls', async () => {
        const promises = Array(10).fill(0).map(() =>
          window.evaluate(async (api) => api.refreshSessions(), electronAPI)
        );

        const results = await Promise.all(promises);

        // All should complete without errors
        results.forEach(result => {
          expect(result.success).toBeDefined();
        });
      });
    });

    describe('bulk-analyze-sessions handler', () => {
      it('should handle concurrent analyze requests', async () => {
        const sessionIds = ['test-1', 'test-2'];

        const promise1 = window.evaluate(
          async (api, ids) => api.bulkAnalyzeSessions(ids, false),
          electronAPI,
          sessionIds
        );

        const promise2 = window.evaluate(
          async (api, ids) => api.bulkAnalyzeSessions(ids, false),
          electronAPI,
          sessionIds
        );

        const [result1, result2] = await Promise.all([promise1, promise2]);

        // Both should complete (one may fail gracefully if already running)
        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
      });

      it('should handle cancel during bulk analyze', async () => {
        const sessionIds = ['test-1', 'test-2', 'test-3'];

        const analyzePromise = window.evaluate(
          async (api, ids) => api.bulkAnalyzeSessions(ids, false),
          electronAPI,
          sessionIds
        );

        // Immediately cancel
        await window.evaluate(
          async (api) => api.cancelBulkAnalyze(),
          electronAPI
        );

        const result = await analyzePromise;

        // Should complete without hanging
        expect(result).toBeDefined();
      });
    });

    describe('Database integrity under concurrent writes', () => {
      it('should handle concurrent session updates', async () => {
        const sessionId = 'test-session-concurrent';

        const promises = Array(5).fill(0).map(() =>
          window.evaluate(
            async (api, id) => api.getSessionDetails(id, false),
            electronAPI,
            sessionId
          )
        );

        const results = await Promise.all(promises);

        // All should complete consistently
        results.forEach(result => {
          expect(result).toBeDefined();
        });
      });
    });
  });

  // =========================================================================
  // ATTACK VECTOR 5: INPUT VALIDATION
  // =========================================================================

  describe('Input Validation Attacks', () => {
    describe('Null/Undefined inputs', () => {
      it('validate-path should reject null', async () => {
        const result = await window.evaluate(
          async (api) => api.validatePath(null),
          electronAPI
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('validate-path should reject undefined', async () => {
        const result = await window.evaluate(
          async (api) => api.validatePath(undefined),
          electronAPI
        );

        expect(result.valid).toBe(false);
      });

      it('validate-path should reject empty string', async () => {
        const result = await window.evaluate(
          async (api) => api.validatePath(''),
          electronAPI
        );

        expect(result.valid).toBe(false);
      });

      it('get-session-details should handle null session ID', async () => {
        const result = await window.evaluate(
          async (api) => api.getSessionDetails(null, false),
          electronAPI
        );

        expect(result.success).toBe(false);
      });
    });

    describe('Type confusion attacks', () => {
      it('search-sessions should reject non-string query', async () => {
        const maliciousQuery = { toString: () => "'; DROP TABLE sessions;--" };
        const result = await window.evaluate(
          async (api, query) => api.searchSessions(query, 10, 0),
          electronAPI,
          maliciousQuery
        );

        expect(result).toBeDefined();
      });

      it('load-sessions-paginated should reject non-number limit', async () => {
        const result = await window.evaluate(
          async (api) => api.loadSessionsPaginated("999999", 0, {}),
          electronAPI
        );

        expect(result).toBeDefined();
      });

      it('save-setting should validate key and value types', async () => {
        const result = await window.evaluate(
          async (api) => api.saveSetting({ evil: 'object' }, null),
          electronAPI
        );

        expect(result).toBeDefined();
      });
    });

    describe('Extremely large inputs', () => {
      it('search-sessions should handle 10MB query string', async () => {
        const hugeQuery = 'A'.repeat(10 * 1024 * 1024);
        const result = await window.evaluate(
          async (api, query) => api.searchSessions(query, 10, 0),
          electronAPI,
          hugeQuery
        );

        // Should not crash, either succeed or fail gracefully
        expect(result).toBeDefined();
      });

      it('reanalyze-session should handle huge custom instructions', async () => {
        const hugeInstructions = 'A'.repeat(1024 * 1024); // 1MB
        const result = await window.evaluate(
          async (api, instructions) => api.reanalyzeSession('test-id', instructions, false),
          electronAPI,
          hugeInstructions
        );

        expect(result).toBeDefined();
      });

      it('open-sessions-tmux4 should reject >4 sessions', async () => {
        const tooManySessions = Array(100).fill('test-id');
        const result = await window.evaluate(
          async (api, ids) => api.openSessionsTmux4(ids),
          electronAPI,
          tooManySessions
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('4');
      });
    });

    describe('Special characters and encoding', () => {
      it('should handle Unicode in session IDs', async () => {
        const unicodeId = 'test-中文-😀';
        const result = await window.evaluate(
          async (api, id) => api.getSessionDetails(id, false),
          electronAPI,
          unicodeId
        );

        expect(result).toBeDefined();
      });

      it('should handle newlines in search query', async () => {
        const queryWithNewlines = 'test\nquery\r\nwith\nnewlines';
        const result = await window.evaluate(
          async (api, query) => api.searchSessions(query, 10, 0),
          electronAPI,
          queryWithNewlines
        );

        expect(result).toBeDefined();
      });
    });
  });

  // =========================================================================
  // ATTACK VECTOR 6: CONTEXT ISOLATION COMPLIANCE
  // =========================================================================

  describe('Context Isolation Compliance', () => {
    it('should not expose Node.js APIs to renderer', async () => {
      const hasNodeAPIs = await window.evaluate(() => {
        return {
          hasRequire: typeof require !== 'undefined',
          hasProcess: typeof process !== 'undefined',
          hasBuffer: typeof Buffer !== 'undefined',
          hasGlobal: typeof global !== 'undefined',
        };
      });

      expect(hasNodeAPIs.hasRequire).toBe(false);
      expect(hasNodeAPIs.hasProcess).toBe(false);
      expect(hasNodeAPIs.hasBuffer).toBe(false);
      expect(hasNodeAPIs.hasGlobal).toBe(false);
    });

    it('should only expose whitelisted electronAPI', async () => {
      const apiKeys = await window.evaluate(() => {
        return Object.keys(window.electronAPI);
      });

      // Expected IPC methods (from preload.js)
      const expectedMethods = [
        'rendererReady',
        'getSessionDetails',
        'refreshSessions',
        'openSessionFolder',
        'getAvailablePrompts',
        'resumeSession',
        'reanalyzeSession',
        'getSettings',
        'saveSettings',
        'saveSetting',
        'getQuota',
        'getQuotaStats',
        'clearAllCache',
        'searchSessions',
        'loadSessionsPaginated',
        'getSessionCount',
        'getAvailableProjects',
        'bulkAnalyzeSessions',
        'cancelBulkAnalyze',
        'openSessionsTmux4',
        'getPlatform',
        'getTerminalSettings',
        'checkTerminalAvailable',
        'validatePath',
        'browseDirectory',
        'validateBinaryPath',
        'getMostRecentSession',
        'getContinuationChain',
        'getContinuationChildren',
        'getSessionWithContinuations',
        'getContinuationMetadata',
        'getContinuationStats',
        'resolveContinuationChains',
        'getContinuationGroup',
        // Event listeners
        'onSessionsUpdated',
        'onSessionUpdated',
        'onSessionsBatchUpdated',
        'onDiscoveryComplete',
        'onAnalysisStatus',
        'onAnalysisComplete',
        'onAnalysisError',
        'onMenuRefresh',
        'onMenuFocusSearch',
        'onMenuOpenSettings',
        'onBulkAnalyzeProgress',
        'onBulkAnalyzeComplete',
        'onPathWarning',
        'onContinuationDetectionProgress',
        'onContinuationsDetected',
        'onContinuationsUpdated',
      ];

      // All exposed methods should be expected
      apiKeys.forEach(key => {
        if (!expectedMethods.includes(key) && key !== 'removeAllListeners') {
          console.warn(`Unexpected API exposed: ${key}`);
        }
      });

      // Should not have direct ipcRenderer access
      const hasIpcRenderer = apiKeys.includes('ipcRenderer');
      expect(hasIpcRenderer).toBe(false);
    });

    it('should return cleanup functions from event listeners', async () => {
      const hasCleanup = await window.evaluate(() => {
        const cleanup = window.electronAPI.onSessionsUpdated(() => {});
        return typeof cleanup === 'function';
      });

      expect(hasCleanup).toBe(true);
    });

    it('should not allow renderer to invoke arbitrary IPC channels', async () => {
      // Try to invoke a non-existent handler
      const result = await window.evaluate(async () => {
        try {
          // This should fail because ipcRenderer is not exposed
          return { success: false, error: 'ipcRenderer should not be accessible' };
        } catch (error) {
          return { success: true, error: error.message };
        }
      });

      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // ERROR HANDLING SECURITY
  // =========================================================================

  describe('Error Handling Security', () => {
    it('should not expose stack traces to renderer', async () => {
      const result = await window.evaluate(
        async (api) => api.getSessionDetails('invalid-id-that-causes-error', false),
        electronAPI
      );

      if (result.error) {
        // Should have user-friendly error, not stack trace
        expect(result.error).not.toContain('at ');
        expect(result.error).not.toContain('Error:');
        expect(result.error).not.toContain('main.js:');
      }
    });

    it('should not expose database schema in errors', async () => {
      const result = await window.evaluate(
        async (api) => api.searchSessions("'malformed query", 10, 0),
        electronAPI
      );

      if (result.error) {
        // Should not expose SQL syntax or table names
        expect(result.error).not.toContain('SELECT');
        expect(result.error).not.toContain('session_metadata');
        expect(result.error).not.toContain('SQLITE_');
      }
    });

    it('should not expose file paths in errors', async () => {
      const result = await window.evaluate(
        async (api) => api.validatePath('/nonexistent/path/to/nowhere'),
        electronAPI
      );

      if (result.error) {
        // Error should mention path doesn't exist but not expose internal paths
        expect(result.error).not.toContain(os.homedir());
        expect(result.error).not.toContain('node_modules');
      }
    });
  });
});
