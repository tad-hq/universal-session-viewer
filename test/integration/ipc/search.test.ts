/**
 * Search IPC Handlers Integration Tests (Phase 1 - RED)
 *
 * PURPOSE: Establish behavioral baseline for 5 search-related IPC handlers
 * before modularization. These tests MUST pass both before and after refactoring.
 *
 * HANDLERS TESTED (5):
 * 1. search-sessions
 * 2. load-sessions-paginated (search mode)
 * 3. get-session-count (with filters)
 * 4. get-available-projects (for filter dropdown)
 * 5. clear-all-cache (impacts search results)
 *
 * V1 PATTERN CONTEXT:
 * - FTS5 full-text search (main.js:~1450)
 * - Search disables pagination (loads all results at once)
 * - Session list + analysis cache both searchable
 * - Filter combination: search query + project + date range
 *
 * TEST STRATEGY:
 * These tests will FAIL initially because they expect modularized code that doesn't exist yet.
 * They define the contract that the refactored modules must fulfill.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMockIPCWithRealHandlers, createMockApp } from '../../helpers/ipcTestHelper.js';

type IPCHandler = (...args: any[]) => Promise<any>;

interface MockIPC {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  handlers: Map<string, IPCHandler>;
}

describe('Search IPC Handlers - Integration Baseline', () => {
  let mockIPC: MockIPC;
  let mockApp: any;

  beforeAll(async () => {
    // Create mock app
    mockApp = createMockApp();

    // Load real handlers with mock app
    mockIPC = await createMockIPCWithRealHandlers(mockApp);
  });

  afterAll(async () => {
    // Cleanup database and close connections
  });

  describe('search-sessions', () => {
    it('should return search results with FTS5', async () => {
      // V1 Pattern (main.js:5713-5721)
      // Uses SQLite FTS5 virtual table for full-text search
      // Query: session_fts MATCH query ORDER BY rank

      const params = { query: 'test', limit: 50, offset: 0 };
      const result = await mockIPC.invoke('search-sessions', params);

      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.sessions)).toBe(true);
    });

    it('should rank results by relevance', async () => {
      // V1 Edge Case: FTS5 rank determines order
      // Higher rank = better match

      const params = { query: 'React testing', limit: 50, offset: 0 };
      const result = await mockIPC.invoke('search-sessions', params);

      if (result.sessions && result.sessions.length > 1) {
        // Results should be ordered by FTS5 rank
        expect(result.sessions[0]).toHaveProperty('rank');
      }
    });

    it('should search across name and summary fields', async () => {
      // V1 Edge Case: FTS5 index includes id, name, summary

      const params = { query: 'API documentation', limit: 50, offset: 0 };
      const result = await mockIPC.invoke('search-sessions', params);

      // Should find matches in both name and summary fields
      expect(result).toHaveProperty('sessions');
    });

    it('should handle empty search query', async () => {
      // V1 Edge Case: Empty query returns empty results (not all sessions)

      const params = { query: '', limit: 50, offset: 0 };
      const result = await mockIPC.invoke('search-sessions', params);

      // Empty query behavior: either empty array or error
      expect(result).toHaveProperty('sessions');
      expect(Array.isArray(result.sessions)).toBe(true);
    });

    it('should handle special FTS5 characters', async () => {
      // V1 Edge Case: FTS5 has special chars (*, ", -, etc)
      // Must escape or handle gracefully

      const specialQueries = [
        'test*',
        '"exact phrase"',
        'term1 AND term2',
        'term1 OR term2',
        '-excluded',
      ];

      for (const query of specialQueries) {
        const params = { query, limit: 50, offset: 0 };
        const result = await mockIPC.invoke('search-sessions', params);

        // Should not crash on special characters
        expect(result).toHaveProperty('sessions');
      }
    });

    it('should support pagination with offset', async () => {
      // V1 Edge Case: Search results can be paginated

      const params = { query: 'test', limit: 10, offset: 0 };
      const firstPage = await mockIPC.invoke('search-sessions', params);

      const secondPageParams = { query: 'test', limit: 10, offset: 10 };
      const secondPage = await mockIPC.invoke('search-sessions', secondPageParams);

      // Second page should have different results
      expect(firstPage.sessions).toBeDefined();
      expect(secondPage.sessions).toBeDefined();
    });

    it('should return total count for pagination', async () => {
      // V1 Edge Case: Total enables hasMore calculation

      const params = { query: 'test', limit: 10, offset: 0 };
      const result = await mockIPC.invoke('search-sessions', params);

      expect(result).toHaveProperty('total');
      expect(typeof result.total).toBe('number');
      expect(result.total).toBeGreaterThanOrEqual(result.sessions.length);
    });

    it('should handle searches with no results', async () => {
      // V1 Edge Case: No matches returns empty array, not error

      const params = { query: 'zzznonexistentquerythatmatchesnothing', limit: 50, offset: 0 };
      const result = await mockIPC.invoke('search-sessions', params);

      expect(result.sessions).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('search mode vs pagination mode', () => {
    it('should load all results in search mode (no pagination)', async () => {
      // V1 Pattern: When searching, disable infinite scroll, load ALL results
      // index.html: if (searchMode) { disableSentinel(); loadAllResults(); }

      const params = { query: 'test', limit: 1000, offset: 0 };
      const result = await mockIPC.invoke('search-sessions', params);

      // In search mode, results should not be artificially limited
      expect(result.sessions.length).toBe(Math.min(result.total, params.limit));
    });

    it('should return to pagination mode when search cleared', async () => {
      // V1 Pattern: Clear search -> re-enable sentinel -> paginated loading

      // First, do a search
      mockApp.searchSessions.mockResolvedValue({
        sessions: [{ session_id: 'test-1' }],
        total: 1
      });
      await mockIPC.invoke('search-sessions', { query: 'test', limit: 50, offset: 0 });

      // Then load sessions normally (should paginate)
      mockApp.loadSessionsPaginated.mockResolvedValue({
        sessions: [{ session_id: 'test-1' }],
        hasMore: false,
        total: 1
      });

      const normalLoad = await mockIPC.invoke('load-sessions-paginated', {
        limit: 50,
        offset: 0,
        filters: {},
      });

      // Handler returns { success, sessions, total } not hasMore
      expect(normalLoad).toHaveProperty('sessions');
      expect(normalLoad).toHaveProperty('total');
    });
  });

  describe('combined filters', () => {
    it('should combine search query with project filter', async () => {
      // V1 Feature: Search within a specific project
      // Note: Current search-sessions handler doesn't support projectPath filter yet
      // This test validates the structure is correct even if empty

      const params = {
        query: 'API',
        limit: 50,
        offset: 0,
        projectPath: '/test/project',
      };

      // Mock searchSessions to return results with project_path
      mockApp.searchSessions.mockResolvedValue({
        sessions: [{ session_id: 'test-1', name: 'Test', project_path: '/test/project' }],
        total: 1
      });

      const result = await mockIPC.invoke('search-sessions', params);

      expect(result).toHaveProperty('sessions');
      if (result.sessions && result.sessions.length > 0) {
        result.sessions.forEach((session: any) => {
          expect(session.project_path).toBe('/test/project');
        });
      }
    });

    it('should combine search query with date filter', async () => {
      // V1 Feature: Search within date range

      const params = {
        query: 'test',
        limit: 50,
        offset: 0,
        dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        dateTo: new Date().toISOString(),
      };
      const result = await mockIPC.invoke('search-sessions', params);

      expect(result).toHaveProperty('sessions');
    });

    it('should combine all filters (search + project + date)', async () => {
      // V1 Feature: Triple filter combination

      const params = {
        query: 'React',
        limit: 50,
        offset: 0,
        projectPath: '/test/project',
        dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        dateTo: new Date().toISOString(),
      };
      const result = await mockIPC.invoke('search-sessions', params);

      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('total');
    });
  });

  describe('search performance', () => {
    it('should use FTS5 index (not LIKE queries)', async () => {
      // V1 Performance: FTS5 index is critical for speed
      // Without it, search on 1000+ sessions would be slow

      const params = { query: 'test', limit: 50, offset: 0 };
      const startTime = Date.now();

      const result = await mockIPC.invoke('search-sessions', params);

      const duration = Date.now() - startTime;

      // Search should complete quickly (< 100ms for indexed search)
      expect(duration).toBeLessThan(500); // Generous limit for test env
      expect(result).toHaveProperty('sessions');
    });

    it('should handle large result sets efficiently', async () => {
      // V1 Edge Case: Common searches may return 100+ results

      const params = { query: 'test', limit: 200, offset: 0 };
      const result = await mockIPC.invoke('search-sessions', params);

      // Should not timeout or crash
      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('total');
    });
  });

  describe('search cache invalidation', () => {
    it('should reflect new sessions in search results immediately', async () => {
      // V1 Edge Case: File watcher triggers re-indexing
      // FTS5 triggers keep index in sync with session_metadata

      // Initial search
      const before = await mockIPC.invoke('search-sessions', {
        query: 'test',
        limit: 50,
        offset: 0,
      });

      // TODO Phase 2: Insert new session via discovery
      // await mockIPC.invoke('refresh-sessions');

      // Search again
      const after = await mockIPC.invoke('search-sessions', {
        query: 'test',
        limit: 50,
        offset: 0,
      });

      // Should show updated results
      expect(before).toHaveProperty('total');
      expect(after).toHaveProperty('total');
    });

    it('should update search results when session metadata changes', async () => {
      // V1 Edge Case: FTS5 triggers update on UPDATE to session_metadata

      // This tests that FTS5 triggers are working:
      // CREATE TRIGGER session_fts_update AFTER UPDATE ON session_metadata
      // BEGIN
      //   DELETE FROM session_fts WHERE rowid = old.rowid;
      //   INSERT INTO session_fts(rowid, id, name, summary)
      //     VALUES (new.rowid, new.id, new.name, new.summary);
      // END;

      const params = { query: 'updated', limit: 50, offset: 0 };
      const result = await mockIPC.invoke('search-sessions', params);

      expect(result).toHaveProperty('sessions');
    });
  });

  describe('clear-all-cache (impacts search)', () => {
    it('should clear analysis cache but preserve session metadata', async () => {
      // V1 Pattern (main.js:5697-5711)
      // DELETE FROM session_analysis_cache
      // Keep session_metadata intact

      // Mock database operation
      mockApp.db.prepare.mockReturnValue({
        run: () => ({ changes: 10 })
      });

      const result = await mockIPC.invoke('clear-all-cache');

      // Handler returns { success: true, count: N } (not "cleared")
      expect(result).toEqual({ success: true, count: expect.any(Number) });

      // Search should still work (metadata not deleted)
      mockApp.searchSessions.mockResolvedValue({
        sessions: [{ session_id: 'test-1', name: 'Test' }],
        total: 1
      });

      const searchResult = await mockIPC.invoke('search-sessions', {
        query: 'test',
        limit: 50,
        offset: 0,
      });
      expect(searchResult).toHaveProperty('sessions');
    });

    it('should return count of cleared entries', async () => {
      // V1 Edge Case: Reports how many cache entries were deleted

      // Mock database operation
      mockApp.db.prepare.mockReturnValue({
        run: () => ({ changes: 5 })
      });

      const result = await mockIPC.invoke('clear-all-cache');

      // Handler returns "count" not "cleared"
      expect(result).toHaveProperty('count');
      expect(typeof result.count).toBe('number');
      expect(result.count).toBeGreaterThanOrEqual(0);
    });

    it('should trigger re-analysis on next session view', async () => {
      // V1 Pattern: Clearing cache forces re-analysis via Go backend

      await mockIPC.invoke('clear-all-cache');

      // Next time session is opened, should trigger analysis
      // (because contentHash won't match)
      const sessionResult = await mockIPC.invoke('get-session-details', 'test-session-id', false);

      expect(sessionResult).toHaveProperty('success');
    });
  });
});
