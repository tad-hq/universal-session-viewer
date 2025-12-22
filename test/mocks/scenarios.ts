/**
 * Pre-configured mock scenarios for common test cases
 *
 * PRESERVES: test/mocks/electronAPI.ts (no modifications)
 * ADDS: High-level scenario helpers for quick test setup
 *
 * V1 Pattern Context:
 * - Scenarios represent common UI states
 * - Used for integration tests and E2E tests
 * - Provides consistent, repeatable test data
 */

import {
  configureMockResponses,
  createMockSession,
  createMockQuotaInfo,
} from './electronAPI';
import { createManySessions } from '../factories/SessionFactory';
import type { Session } from '@/types/session';

/**
 * Scenario: Empty state (no sessions)
 * V1 Pattern: index.html shows empty state when no sessions exist
 */
export function mockEmptyState(): void {
  configureMockResponses({
    sessions: [],
    projects: [],
    searchResults: [],
  });
}

/**
 * Scenario: Loading state (useful for testing loading indicators)
 * Note: This doesn't simulate delay - use vi.useFakeTimers for that
 */
export function mockLoadingState(): void {
  configureMockResponses({
    sessions: [],
    projects: [],
  });
  // In actual test, wrap IPC calls with delay:
  // window.electronAPI.loadSessionsPaginated = vi.fn().mockImplementation(
  //   () => new Promise(resolve => setTimeout(() => resolve(...), 2000))
  // );
}

/**
 * Scenario: Large session list (pagination testing)
 * V1 Pattern: Infinite scroll requires testing with 100+ sessions
 */
export function mockLargeSessionList(count: number = 1000): void {
  configureMockResponses({
    sessions: createManySessions(count),
  });
}

/**
 * Scenario: Database connection failure
 * V1 Pattern: main.js handles DB errors gracefully
 */
export function mockDatabaseError(): void {
  configureMockResponses({
    errors: {
      getSessions: 'Database connection failed: SQLITE_CANTOPEN',
      getSessionDetails: 'Database connection failed: SQLITE_CANTOPEN',
      search: 'Database connection failed: SQLITE_CANTOPEN',
      saveSettings: 'Database connection failed: SQLITE_CANTOPEN',
    },
  });
}

/**
 * Scenario: Quota exceeded (daily analysis limit reached)
 * V1 Pattern: main.js enforces quota limits
 */
export function mockQuotaExceeded(): void {
  configureMockResponses({
    quota: createMockQuotaInfo({
      current: 100,
      limit: 100,
      allowed: false,
      message: 'Daily analysis limit reached (100/100). Resets at midnight.',
    }),
  });
}

/**
 * Scenario: Quota almost exceeded (95% usage)
 * V1 Pattern: UI shows warning when quota is low
 */
export function mockQuotaAlmostExceeded(): void {
  configureMockResponses({
    quota: createMockQuotaInfo({
      current: 95,
      limit: 100,
      allowed: true,
      message: 'Quota usage: 95/100 (5 analyses remaining)',
    }),
  });
}

/**
 * Scenario: Mixed analyzed/unanalyzed sessions
 * V1 Pattern: index.html shows both analyzed and unanalyzed sessions
 */
export function mockMixedAnalysisState(): void {
  const sessions = Array.from({ length: 50 }, (_, i) =>
    createMockSession({
      id: `session-${i}`,
      is_analyzed: i % 3 === 0 ? 1 : 0, // Every 3rd session analyzed
      title: i % 3 === 0 ? `Analyzed Session ${i}` : null,
      summary: i % 3 === 0 ? `**Topic**: Session ${i} Summary` : null,
      status: i % 3 === 0 ? 'completed' : 'pending',
    })
  );

  configureMockResponses({ sessions });
}

/**
 * Scenario: All sessions in progress (analyzing state)
 * V1 Pattern: UI shows loading indicators for in-progress sessions
 */
export function mockAllInProgress(): void {
  const sessions = Array.from({ length: 10 }, (_, i) =>
    createMockSession({
      id: `session-${i}`,
      is_analyzed: 0,
      title: null,
      summary: null,
      status: 'in_progress',
    })
  );

  configureMockResponses({ sessions });
}

/**
 * Scenario: All sessions failed
 * V1 Pattern: UI shows retry buttons for failed sessions
 */
export function mockAllFailed(): void {
  const sessions = Array.from({ length: 10 }, (_, i) =>
    createMockSession({
      id: `session-${i}`,
      is_analyzed: 0,
      title: null,
      summary: null,
      status: 'failed',
    })
  );

  configureMockResponses({ sessions });
}

/**
 * Scenario: Multiple projects (for project filter testing)
 * V1 Pattern: index.html filters by project path
 */
export function mockMultipleProjects(): void {
  const projects = [
    '/Users/test/project-a',
    '/Users/test/project-b',
    '/Users/test/project-c',
  ];

  const sessions: Session[] = [];
  projects.forEach((projectPath, projectIndex) => {
    // Create 20 sessions per project
    for (let i = 0; i < 20; i++) {
      sessions.push(
        createMockSession({
          id: `${projectPath}-session-${i}`,
          project_path: projectPath,
          projectPath: projectPath,
          project: projectPath.split('/').pop() || 'unknown',
        })
      );
    }
  });

  configureMockResponses({
    sessions,
    projects: projects.map((project_path) => ({
      project_path,
      session_count: 20,
    })),
  });
}

/**
 * Scenario: Sessions with continuation chains
 * V1 Pattern: Continuation chains show parent-child relationships
 */
export function mockContinuationChains(): void {
  const rootSession = createMockSession({
    id: 'root-session',
    title: 'Root Session',
    continuation_count: 3,
  });

  const child1 = createMockSession({
    id: 'child1-session',
    title: 'Continuation 1',
    continuation_of: 'root-session',
    chain_position: 1,
    is_active_continuation: 0,
  });

  const child2 = createMockSession({
    id: 'child2-session',
    title: 'Continuation 2',
    continuation_of: 'root-session',
    chain_position: 2,
    is_active_continuation: 0,
  });

  const child3 = createMockSession({
    id: 'child3-session',
    title: 'Continuation 3 (Active)',
    continuation_of: 'root-session',
    chain_position: 3,
    is_active_continuation: 1,
  });

  configureMockResponses({
    sessions: [rootSession, child1, child2, child3],
  });
}

/**
 * Scenario: Search results with matches
 * V1 Pattern: index.html highlights search results
 */
export function mockSearchResults(query: string = 'test'): void {
  const sessions = Array.from({ length: 5 }, (_, i) =>
    createMockSession({
      id: `search-result-${i}`,
      title: `Search result ${i} matching "${query}"`,
      summary: `**Topic**: This session matches the query "${query}"`,
    })
  );

  configureMockResponses({
    searchResults: sessions,
  });
}

/**
 * Scenario: Empty search results
 * V1 Pattern: index.html shows "No results found" message
 */
export function mockEmptySearchResults(): void {
  configureMockResponses({
    searchResults: [],
  });
}

/**
 * Reset to default scenario (single session, normal state)
 * V1 Pattern: Clean slate for new tests
 */
export function mockDefaultState(): void {
  configureMockResponses({
    sessions: [createMockSession()],
    projects: [{ project_path: '/Users/test/project', session_count: 1 }],
    quota: createMockQuotaInfo(),
    errors: {
      getSessions: null,
      getSessionDetails: null,
      search: null,
      saveSettings: null,
    },
  });
}

/**
 * Scenario: Stale sessions (need reanalysis due to cache invalidation)
 * V1 Pattern: main.js uses SHA-256 hash + mtime for cache invalidation
 */
export function mockStaleSessions(): void {
  const sessions = Array.from({ length: 10 }, (_, i) =>
    createMockSession({
      id: `stale-${i}`,
      is_analyzed: 1,
      title: `Stale Session ${i}`,
      // Very old analysis timestamp suggests cache might be stale
      analysis_timestamp: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000),
    })
  );

  configureMockResponses({ sessions });
}
