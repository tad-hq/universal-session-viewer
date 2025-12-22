/**
 * EdgeCaseFactory - Test data factory for edge case scenarios
 *
 * PRESERVES: Existing createMockSession in test/mocks/electronAPI.ts
 * ADDS: Edge case generators for boundary testing
 *
 * V1 Pattern Context:
 * - Long paths test UI truncation
 * - Unicode tests i18n support
 * - Empty/malformed data tests graceful degradation
 * - Boundary values test validation logic
 */

import { createMockSession } from '../mocks/electronAPI';
import type { Session } from '@/types/session';

/**
 * Create a session with a very long file path (edge case for UI truncation)
 * V1 Edge Case: Paths can exceed reasonable display width
 */
export function createVeryLongPathSession(overrides: Partial<Session> = {}): Session {
  const longPath =
    '/very/long/path/that/tests/truncation/logic/' +
    'nested/'.repeat(50) +
    'final-project-directory';

  return createMockSession({
    project_path: longPath,
    projectPath: longPath,
    project: 'final-project-directory',
    ...overrides,
  });
}

/**
 * Create a session with Unicode characters (edge case for i18n)
 * V1 Edge Case: Unicode should render correctly in all components
 */
export function createUnicodeSession(overrides: Partial<Session> = {}): Session {
  return createMockSession({
    title: '日本語のタイトル 🚀 with emoji and 中文',
    summary:
      '**Main Topic**: Testing Unicode: Ñoño, café, naïve, 你好世界\n\n**Key Points**:\n- Unicode in summaries\n- Emoji rendering 🎉',
    project: 'unicode-测试-プロジェクト',
    ...overrides,
  });
}

/**
 * Create a session with zero messages (edge case for empty state)
 * V1 Edge Case: Empty sessions should show appropriate UI
 */
export function createZeroMessageSession(overrides: Partial<Session> = {}): Session {
  return createMockSession({
    message_count: 0,
    messageCount: 0,
    title: null,
    summary: null,
    is_analyzed: 0,
    status: 'pending',
    ...overrides,
  });
}

/**
 * Create a session with extremely high message count
 * V1 Edge Case: Large message counts should be handled efficiently
 */
export function createHugeMessageCountSession(overrides: Partial<Session> = {}): Session {
  return createMockSession({
    message_count: 100000,
    messageCount: 100000,
    ...overrides,
  });
}

/**
 * Create a session with missing optional fields
 * V1 Edge Case: Missing fields should be handled gracefully
 */
export function createMinimalSession(): Partial<Session> {
  return {
    id: 'minimal-session',
    session_id: 'minimal-session',
    title: null,
    summary: null,
    modified: Date.now(),
    // Missing: project_path, messageCount, etc.
  };
}

/**
 * Create a session with dual ID fields (id + session_id)
 * V1 Edge Case: Both id and session_id must be handled transparently
 */
export function createDualIDSession(overrides: Partial<Session> = {}): Session {
  return createMockSession({
    id: 'id-field-value',
    session_id: 'session_id-field-value',
    ...overrides,
  });
}

/**
 * Create a malformed session (partial data)
 * V1 Edge Case: Corrupted data should fail gracefully
 */
export function createMalformedSession(): Partial<Session> {
  return {
    id: 'malformed',
    // Missing required fields - should trigger validation errors
    title: 'Malformed Session',
    // No summary, modified, or other required fields
  };
}

/**
 * Create a session with very old timestamp (edge case for date formatting)
 * V1 Edge Case: Old dates should format correctly
 */
export function createVeryOldSession(overrides: Partial<Session> = {}): Session {
  const fiveYearsAgo = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000;
  return createMockSession({
    modified: fiveYearsAgo,
    last_message_time: new Date(fiveYearsAgo).toISOString(),
    analysis_timestamp: Math.floor(fiveYearsAgo / 1000),
    ...overrides,
  });
}

/**
 * Create a session with very recent timestamp (edge case for "time ago" formatting)
 * V1 Edge Case: Recent dates should show "seconds ago"
 */
export function createVeryRecentSession(overrides: Partial<Session> = {}): Session {
  const now = Date.now();
  return createMockSession({
    modified: now,
    last_message_time: new Date(now).toISOString(),
    analysis_timestamp: Math.floor(now / 1000),
    ...overrides,
  });
}

/**
 * Create a session with special characters in title
 * V1 Edge Case: Special characters should be escaped correctly
 */
export function createSpecialCharactersSession(overrides: Partial<Session> = {}): Session {
  return createMockSession({
    title: '<script>alert("XSS")</script> & "quotes" & \'apostrophes\'',
    summary: '**Test**: <b>HTML</b> & special chars: &lt; &gt; &amp;',
    ...overrides,
  });
}

/**
 * Create a session with null title/summary but is_analyzed=1
 * V1 Edge Case: Inconsistent state should be handled
 */
export function createInconsistentStateSession(overrides: Partial<Session> = {}): Session {
  return createMockSession({
    title: null,
    summary: null,
    is_analyzed: 1, // Inconsistent: analyzed but no data
    status: 'completed',
    ...overrides,
  });
}

/**
 * Create a session with continuation metadata (for continuation chain tests)
 * V1 Edge Case: Continuation chains have special UI
 */
export function createContinuationSession(overrides: Partial<Session> = {}): Session {
  return createMockSession({
    continuation_of: 'parent-session-id',
    chain_position: 2,
    is_active_continuation: 1,
    continuation_count: 3,
    ...overrides,
  });
}

/**
 * Create a session with very long title
 * V1 Edge Case: Long titles should truncate with ellipsis
 */
export function createLongTitleSession(overrides: Partial<Session> = {}): Session {
  const longTitle = 'A'.repeat(500) + ' This is a very long title that should be truncated';
  return createMockSession({
    title: longTitle,
    ...overrides,
  });
}

/**
 * Create a session with whitespace-only title
 * V1 Edge Case: Whitespace should be trimmed or show fallback
 */
export function createWhitespaceTitleSession(overrides: Partial<Session> = {}): Session {
  return createMockSession({
    title: '   \n\t   ',
    summary: '   \n\t   ',
    ...overrides,
  });
}
