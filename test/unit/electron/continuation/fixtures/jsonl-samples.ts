/**
 * JSONL Test Fixtures for Continuation Chain Testing
 *
 * These fixtures represent real JSONL event structures from Claude Code sessions,
 * based on the patterns documented in JSONL-CONTINUATION-CHAIN-BEHAVIOR.md.
 *
 * Key Detection Pattern:
 * - Child sessions inherit parent's compact_boundary event
 * - event.sessionId differs from filename = child session
 * - event.sessionId equals filename = parent session
 */

/**
 * Type definition for compact_boundary events (modern format)
 */
export interface CompactBoundaryEvent {
  type: 'system';
  subtype: 'compact_boundary';
  sessionId: string;
  logicalParentUuid?: string;
  uuid: string;
  timestamp: string;
  content: string;
  compactMetadata?: {
    trigger: string;
    preTokens: number;
  };
  level?: string;
  isMeta?: boolean;
}

/**
 * Type definition for compact_boundary events (legacy format)
 */
export interface LegacyCompactBoundaryEvent {
  type: 'compact_boundary';
  sessionId: string;
  timestamp: string;
  message?: {
    role: string;
    content: string;
  };
}

/**
 * Type definition for compact summary messages
 */
export interface CompactSummaryMessage {
  type: 'user';
  sessionId: string;
  uuid: string;
  parentUuid: string;
  isCompactSummary: true;
  isVisibleInTranscriptOnly: boolean;
  message: {
    role: 'user';
    content: string;
  };
  timestamp: string;
}

/**
 * SAMPLE_CHILD_SESSION
 *
 * Represents a child session that inherited its parent's compact_boundary event.
 * This is the PRIMARY test case for child session detection.
 *
 * Detection pattern:
 * - Filename: bfb0e536-1923-4ee4-a306-49c1b3bca8e9.jsonl
 * - Event sessionId: 17b7a5b6-8e1f-45c5-bc88-87fd0810da5a
 * - Mismatch = CHILD, event.sessionId = PARENT
 */
export const SAMPLE_CHILD_SESSION = {
  filename: 'bfb0e536-1923-4ee4-a306-49c1b3bca8e9.jsonl',
  sessionId: 'bfb0e536-1923-4ee4-a306-49c1b3bca8e9',
  parentSessionId: '17b7a5b6-8e1f-45c5-bc88-87fd0810da5a',
  content: [
    {
      type: 'system',
      subtype: 'compact_boundary',
      sessionId: '17b7a5b6-8e1f-45c5-bc88-87fd0810da5a', // Parent's session ID!
      logicalParentUuid: '6b7f196e-0ce9-43fe-b7da-b4f2d8d885e2',
      uuid: '70bc5cfe-2ec7-4929-aa76-67b53f6a852c',
      timestamp: '2025-11-29T03:43:28.703Z',
      content: 'Conversation compacted',
      compactMetadata: {
        trigger: 'auto',
        preTokens: 155090,
      },
      level: 'info',
      isMeta: false,
    } as CompactBoundaryEvent,
    {
      type: 'user',
      sessionId: 'bfb0e536-1923-4ee4-a306-49c1b3bca8e9', // Child's session ID
      uuid: 'b3cb20bb-0fad-40b1-a7af-e1bb8814c05f',
      parentUuid: '70bc5cfe-2ec7-4929-aa76-67b53f6a852c',
      isCompactSummary: true,
      isVisibleInTranscriptOnly: true,
      message: {
        role: 'user',
        content:
          'This session is being continued from a previous conversation that ran out of context. The conversation is summarized below:\n\n[CONTEXT SUMMARY]',
      },
      timestamp: '2025-11-29T03:43:35.030Z',
    } as CompactSummaryMessage,
  ],
};

/**
 * SAMPLE_PARENT_SESSION
 *
 * Represents a parent session that spawned a child.
 * The compact_boundary event's sessionId MATCHES the filename.
 */
export const SAMPLE_PARENT_SESSION = {
  filename: '17b7a5b6-8e1f-45c5-bc88-87fd0810da5a.jsonl',
  sessionId: '17b7a5b6-8e1f-45c5-bc88-87fd0810da5a',
  parentSessionId: null, // This is a root session
  content: [
    {
      type: 'system',
      subtype: 'compact_boundary',
      sessionId: '17b7a5b6-8e1f-45c5-bc88-87fd0810da5a', // Matches filename = PARENT
      logicalParentUuid: '6b7f196e-0ce9-43fe-b7da-b4f2d8d885e2',
      uuid: '70bc5cfe-2ec7-4929-aa76-67b53f6a852c',
      timestamp: '2025-11-29T03:43:28.703Z',
      content: 'Conversation compacted',
      compactMetadata: {
        trigger: 'auto',
        preTokens: 155090,
      },
      level: 'info',
      isMeta: false,
    } as CompactBoundaryEvent,
  ],
};

/**
 * SAMPLE_LEGACY_FORMAT_SESSION
 *
 * Represents a child session using the legacy compact_boundary format.
 * Detection should handle both modern and legacy formats.
 */
export const SAMPLE_LEGACY_FORMAT_SESSION = {
  filename: 'd7114302-77c8-480c-bed2-43c460abed58.jsonl',
  sessionId: 'd7114302-77c8-480c-bed2-43c460abed58',
  parentSessionId: '16f675dd-ec34-4a4d-aaaa-e0ed9f0a7383',
  content: [
    {
      type: 'compact_boundary',
      sessionId: '16f675dd-ec34-4a4d-aaaa-e0ed9f0a7383', // Parent in legacy format
      timestamp: '2025-11-29T21:16:20.711Z',
      message: {
        role: 'system',
        content:
          'Context window approaching limit. Continuing in new session: d7114302-77c8-480c-bed2-43c460abed58',
      },
    } as LegacyCompactBoundaryEvent,
  ],
};

/**
 * SAMPLE_6_SESSION_CHAIN
 *
 * Real-world example from JSONL-CONTINUATION-CHAIN-BEHAVIOR.md Section 6.1
 * A 6-session deep chain demonstrating multi-level inheritance.
 *
 * Chain structure:
 * 6c8cb2f2 (depth 0)
 *   → 17b7a5b6 (depth 1)
 *     → bfb0e536 (depth 2)
 *       → 16f675dd (depth 3)
 *         → d7114302 (depth 4)
 *           → 2203d0f8 (depth 5)
 */
export const SAMPLE_6_SESSION_CHAIN = {
  description: 'Real-world 6-session continuation chain',
  rootSessionId: '6c8cb2f2-4288-4145-8a0b-1b7f7d51dcb1',
  sessions: [
    {
      id: '6c8cb2f2-4288-4145-8a0b-1b7f7d51dcb1',
      parent: null,
      depth: 0,
      timestamp: '2025-11-28T18:16:07.423Z',
    },
    {
      id: '17b7a5b6-8e1f-45c5-bc88-87fd0810da5a',
      parent: '6c8cb2f2-4288-4145-8a0b-1b7f7d51dcb1',
      depth: 1,
      timestamp: '2025-11-28T22:22:31.099Z',
    },
    {
      id: 'bfb0e536-1923-4ee4-a306-49c1b3bca8e9',
      parent: '17b7a5b6-8e1f-45c5-bc88-87fd0810da5a',
      depth: 2,
      timestamp: '2025-11-29T03:43:35.030Z',
    },
    {
      id: '16f675dd-ec34-4a4d-aaaa-e0ed9f0a7383',
      parent: 'bfb0e536-1923-4ee4-a306-49c1b3bca8e9',
      depth: 3,
      timestamp: '2025-11-29T03:43:28.703Z',
    },
    {
      id: 'd7114302-77c8-480c-bed2-43c460abed58',
      parent: '16f675dd-ec34-4a4d-aaaa-e0ed9f0a7383',
      depth: 4,
      timestamp: '2025-11-29T03:43:28.703Z',
    },
    {
      id: '2203d0f8-3761-4c1b-8e7a-7afb37db0093',
      parent: 'd7114302-77c8-480c-bed2-43c460abed58',
      depth: 5,
      timestamp: '2025-11-29T03:43:28.703Z',
    },
  ],
};

/**
 * SAMPLE_CIRCULAR_CHAIN
 *
 * Edge case: Circular reference detection (should never happen, but defensive)
 * Chain: A → B → C → A
 *
 * Detection should:
 * - Detect circular reference using visited Set
 * - Return validation error or break at cycle point
 */
export const SAMPLE_CIRCULAR_CHAIN = {
  description: 'Circular reference edge case (A→B→C→A)',
  sessions: [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      parent: 'cccccccc-cccc-cccc-cccc-cccccccccccc', // Points to C
      depth: null, // Depth is undefined in circular chains
    },
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      parent: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // Points to A
      depth: null,
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      parent: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // Points to B
      depth: null,
    },
  ],
};

/**
 * SAMPLE_BRANCHING_CHAIN
 *
 * Edge case: One parent with multiple children (forked continuations)
 *
 * Structure:
 *       root
 *      / | \
 *    c1 c2 c3
 *   /
 * gc1
 *
 * Happens when user opens same session in multiple terminals or branches conversation.
 */
export const SAMPLE_BRANCHING_CHAIN = {
  description: 'Branching chain: one parent, multiple children',
  rootSessionId: 'root0000-0000-0000-0000-000000000000',
  sessions: [
    {
      id: 'root0000-0000-0000-0000-000000000000',
      parent: null,
      depth: 0,
      hasMultipleChildren: true,
    },
    {
      id: 'child001-0000-0000-0000-000000000001',
      parent: 'root0000-0000-0000-0000-000000000000',
      depth: 1,
      continuationOrder: 0,
    },
    {
      id: 'child002-0000-0000-0000-000000000002',
      parent: 'root0000-0000-0000-0000-000000000000',
      depth: 1,
      continuationOrder: 1,
    },
    {
      id: 'child003-0000-0000-0000-000000000003',
      parent: 'root0000-0000-0000-0000-000000000000',
      depth: 1,
      continuationOrder: 2,
    },
    {
      id: 'gchild01-0000-0000-0000-000000000011',
      parent: 'child001-0000-0000-0000-000000000001',
      depth: 2,
      continuationOrder: 0,
    },
  ],
};

/**
 * SAMPLE_ORPHAN_CHAIN
 *
 * Edge case: Child session whose parent file no longer exists
 * Should be marked as is_orphaned: true in database
 */
export const SAMPLE_ORPHAN_CHAIN = {
  description: 'Orphaned child session (parent deleted)',
  orphanSessionId: 'orphan00-0000-0000-0000-000000000000',
  missingParentId: 'missing0-0000-0000-0000-000000000000',
  content: [
    {
      type: 'system',
      subtype: 'compact_boundary',
      sessionId: 'missing0-0000-0000-0000-000000000000', // Parent doesn't exist
      uuid: 'orphan-compact-boundary-uuid',
      timestamp: '2025-12-01T00:00:00.000Z',
      content: 'Conversation compacted',
      compactMetadata: {
        trigger: 'auto',
        preTokens: 155000,
      },
    } as CompactBoundaryEvent,
  ],
};

/**
 * SAMPLE_MALFORMED_JSONL
 *
 * Edge case: Malformed JSON lines that should be skipped gracefully
 */
export const SAMPLE_MALFORMED_JSONL = {
  description: 'Malformed JSONL that should be handled gracefully',
  filename: 'malform0-0000-0000-0000-000000000000.jsonl',
  content: [
    '{ "type": "user", "message": "valid line" }',
    '{ invalid json without closing brace',
    '', // Empty line
    '   ', // Whitespace-only line
    '{ "type": "system", "subtype": "compact_boundary" }', // Missing sessionId field
    '{ "type": "system", "subtype": "compact_boundary", "sessionId": "parent00-0000-0000-0000-000000000000" }', // Valid
  ],
};

/**
 * SAMPLE_MULTIPLE_COMPACTIONS
 *
 * Edge case: Session with multiple compact_boundary events
 * Only the FIRST mismatch indicates the parent (inherited event)
 * Subsequent events are internal compactions or child spawns
 */
export const SAMPLE_MULTIPLE_COMPACTIONS = {
  description: 'Session with multiple compact_boundary events',
  filename: 'abcd1234-0000-0000-0000-000000000000.jsonl',
  sessionId: 'abcd1234-0000-0000-0000-000000000000',
  parentSessionId: 'cafe0000-0000-0000-0000-000000000000',
  content: [
    {
      type: 'system',
      subtype: 'compact_boundary',
      sessionId: 'cafe0000-0000-0000-0000-000000000000', // FIRST mismatch = PARENT
      uuid: 'inherited-compact-boundary-uuid',
      timestamp: '2025-12-01T00:00:00.000Z',
      content: 'Conversation compacted',
      compactMetadata: {
        trigger: 'auto',
        preTokens: 155000,
      },
    } as CompactBoundaryEvent,
    {
      type: 'system',
      subtype: 'compact_boundary',
      sessionId: 'abcd1234-0000-0000-0000-000000000000', // Matches filename = internal compaction
      uuid: 'internal-compact-boundary-uuid',
      timestamp: '2025-12-01T12:00:00.000Z',
      content: 'Conversation compacted',
      compactMetadata: {
        trigger: 'auto',
        preTokens: 155000,
      },
    } as CompactBoundaryEvent,
    {
      type: 'system',
      subtype: 'compact_boundary',
      sessionId: 'abcd1234-0000-0000-0000-000000000000', // Spawning a child
      uuid: 'child-spawn-compact-boundary-uuid',
      timestamp: '2025-12-01T23:00:00.000Z',
      content: 'Conversation compacted',
      compactMetadata: {
        trigger: 'auto',
        preTokens: 155000,
      },
    } as CompactBoundaryEvent,
  ],
};
