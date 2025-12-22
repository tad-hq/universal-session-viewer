/**
 * File System Test Fixtures
 *
 * PURPOSE: Setup and teardown utilities for JSONL file testing
 *
 * V1 PATTERN CONTEXT:
 * - Session files are JSONL (newline-delimited JSON)
 * - Each line has: uuid, sessionId, timestamp, message
 * - Message has: role (user/assistant), content array
 */

import type { MockFileSystem } from '../mocks/fs';

/**
 * JSONL entry structure
 *
 * V1 Pattern: Matches Claude Code session file format
 */
export interface SessionEntry {
  uuid: string;
  sessionId: string;
  timestamp: string;
  parentUuid?: string;
  message: {
    role: 'user' | 'assistant';
    content: Array<{
      type: string;
      text?: string;
      [key: string]: any;
    }>;
  };
}

/**
 * Create session entry
 */
export function createSessionEntry(
  sessionId: string,
  index: number,
  overrides?: Partial<SessionEntry>
): SessionEntry {
  const timestamp = new Date(Date.now() - (100 - index) * 60000).toISOString();

  return {
    uuid: `msg-${index}`,
    sessionId,
    timestamp,
    message: {
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: [
        { type: 'text', text: `Message ${index} content` }
      ],
    },
    ...overrides,
  };
}

/**
 * Create JSONL file content
 *
 * V1 Pattern: Newline-delimited JSON, one entry per line
 */
export function createSessionJSONL(
  sessionId: string,
  messageCount: number = 10,
  entriesOverride?: Partial<SessionEntry>[]
): string {
  const entries: SessionEntry[] = [];

  for (let i = 0; i < messageCount; i++) {
    const overrides = entriesOverride?.[i] || {};
    entries.push(createSessionEntry(sessionId, i, overrides));
  }

  return entries.map(e => JSON.stringify(e)).join('\n');
}

/**
 * Create conversation with specific pattern
 *
 * V1 Pattern: User asks, assistant responds
 */
export function createConversation(
  sessionId: string,
  exchanges: Array<{ user: string; assistant: string }>
): string {
  const entries: SessionEntry[] = [];
  let index = 0;

  for (const { user, assistant } of exchanges) {
    // User message
    entries.push(createSessionEntry(sessionId, index++, {
      message: {
        role: 'user',
        content: [{ type: 'text', text: user }],
      },
    }));

    // Assistant message
    entries.push(createSessionEntry(sessionId, index++, {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: assistant }],
      },
    }));
  }

  return entries.map(e => JSON.stringify(e)).join('\n');
}

/**
 * Create malformed JSONL
 *
 * V1 Edge Case: Handles invalid JSON lines gracefully
 */
export function createMalformedJSONL(): string {
  return [
    '{"valid": "json"}',
    'invalid json line',
    '{"another": "valid"}',
    '',
    '{"final": "line"}',
  ].join('\n');
}

/**
 * Create empty session file
 *
 * V1 Edge Case: Empty files should be skipped (< 100 bytes)
 */
export function createEmptySession(): string {
  return '';
}

/**
 * Create large session file
 *
 * V1 Edge Case: Large files require chunked reading
 */
export function createLargeSession(
  sessionId: string,
  messageCount: number = 10000
): string {
  return createSessionJSONL(sessionId, messageCount);
}

/**
 * Setup file system with session files
 *
 * @param fs - Mock file system
 * @param sessions - Array of { sessionId, messageCount } objects
 */
export function setupSessionFiles(
  fs: MockFileSystem,
  sessions: Array<{ sessionId: string; messageCount: number; path: string }>
): void {
  for (const { sessionId, messageCount, path } of sessions) {
    const content = createSessionJSONL(sessionId, messageCount);
    fs.addFile(path, content, content.length);
  }
}

/**
 * Create Claude projects directory structure
 *
 * V1 Pattern: ~/.claude/projects/<project-id>/<session-id>.jsonl
 */
export function createClaudeProjectsStructure(fs: MockFileSystem): {
  projectPath: string;
  sessionPaths: string[];
} {
  const projectPath = '/Users/test/.claude/projects/test-project';
  const sessionIds = ['session-1', 'session-2', 'session-3'];
  const sessionPaths: string[] = [];

  fs.addDirectory(projectPath, sessionIds.map(id => `${id}.jsonl`));

  for (const sessionId of sessionIds) {
    const path = `${projectPath}/${sessionId}.jsonl`;
    const content = createSessionJSONL(sessionId, 10);
    fs.addFile(path, content);
    sessionPaths.push(path);
  }

  return { projectPath, sessionPaths };
}
