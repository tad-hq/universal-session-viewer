/**
 * Chain Fixture Factory Functions
 *
 * Generates complex continuation chain structures for testing edge cases:
 * - Linear chains of arbitrary length
 * - Branching chains (one parent, multiple children at each level)
 * - Circular chains (for validation testing)
 * - Orphan chains (children with missing parents)
 *
 * All factories return TypeScript-typed structures compatible with
 * session_continuations and continuation_chain_cache tables.
 */

/**
 * Type definition for a session in a continuation chain
 */
export interface ChainSession {
  id: string;
  parent: string | null;
  depth: number;
  continuationOrder?: number;
  timestamp?: string;
  childStartedTimestamp?: number;
  isOrphaned?: boolean;
}

/**
 * Type definition for a continuation relationship
 */
export interface ContinuationRelationship {
  child_session_id: string;
  parent_session_id: string;
  continuation_order: number;
  child_started_timestamp?: number;
  is_active_continuation?: boolean;
  is_orphaned?: boolean;
}

/**
 * Type definition for chain cache entry
 */
export interface ChainCacheEntry {
  session_id: string;
  root_session_id: string;
  depth_from_root: number;
  is_child: boolean;
  is_parent: boolean;
  child_count: number;
  has_multiple_children: boolean;
}

/**
 * Result type for chain factory functions
 */
export interface ChainFixture {
  sessions: ChainSession[];
  relationships: ContinuationRelationship[];
  cacheEntries: ChainCacheEntry[];
  rootSessionId: string;
  maxDepth: number;
  totalSessions: number;
}

/**
 * createLinearChain
 *
 * Generates a straight-line continuation chain of specified length.
 *
 * Example (length=5):
 * root → child1 → child2 → child3 → child4
 *
 * @param length - Number of sessions in the chain (minimum 1)
 * @returns ChainFixture with sessions, relationships, and cache entries
 *
 * @example
 * const chain = createLinearChain(10);
 * // Creates: root → c1 → c2 → c3 → c4 → c5 → c6 → c7 → c8 → c9
 */
export function createLinearChain(length: number): ChainFixture {
  if (length < 1) {
    throw new Error('Chain length must be at least 1');
  }

  const sessions: ChainSession[] = [];
  const relationships: ContinuationRelationship[] = [];
  const cacheEntries: ChainCacheEntry[] = [];

  const rootId = generateSessionId('root', 0);
  const baseTimestamp = Date.now() - length * 3600000; // Start N hours ago

  // Create root session
  sessions.push({
    id: rootId,
    parent: null,
    depth: 0,
    timestamp: new Date(baseTimestamp).toISOString(),
  });

  cacheEntries.push({
    session_id: rootId,
    root_session_id: rootId,
    depth_from_root: 0,
    is_child: false,
    is_parent: length > 1,
    child_count: length > 1 ? 1 : 0,
    has_multiple_children: false,
  });

  // Create child sessions
  for (let i = 1; i < length; i++) {
    const sessionId = generateSessionId('child', i);
    const parentId = i === 1 ? rootId : generateSessionId('child', i - 1);
    const timestamp = baseTimestamp + i * 3600000; // 1 hour apart

    sessions.push({
      id: sessionId,
      parent: parentId,
      depth: i,
      timestamp: new Date(timestamp).toISOString(),
      childStartedTimestamp: timestamp,
    });

    relationships.push({
      child_session_id: sessionId,
      parent_session_id: parentId,
      continuation_order: 0, // Only one child per parent in linear chain
      child_started_timestamp: timestamp,
      is_active_continuation: i === length - 1, // Last child is active
      is_orphaned: false,
    });

    cacheEntries.push({
      session_id: sessionId,
      root_session_id: rootId,
      depth_from_root: i,
      is_child: true,
      is_parent: i < length - 1,
      child_count: i < length - 1 ? 1 : 0,
      has_multiple_children: false,
    });
  }

  return {
    sessions,
    relationships,
    cacheEntries,
    rootSessionId: rootId,
    maxDepth: length - 1,
    totalSessions: length,
  };
}

/**
 * createBranchingChain
 *
 * Generates a tree structure with branching at each level.
 *
 * Example (depth=2, branchFactor=3):
 *           root
 *        /   |   \
 *      c1    c2   c3
 *     /|\   /|\   /|\
 *   gc1...gc3...gc9
 *
 * @param depth - Number of levels in the tree (minimum 1)
 * @param branchFactor - Number of children per parent (minimum 1)
 * @returns ChainFixture with branching structure
 *
 * @example
 * const chain = createBranchingChain(3, 2);
 * // Creates: root with 2 children, each with 2 children, etc.
 */
export function createBranchingChain(depth: number, branchFactor: number): ChainFixture {
  if (depth < 1 || branchFactor < 1) {
    throw new Error('Depth and branchFactor must be at least 1');
  }

  const sessions: ChainSession[] = [];
  const relationships: ContinuationRelationship[] = [];
  const cacheEntries: ChainCacheEntry[] = [];

  const rootId = generateSessionId('root', 0);
  const baseTimestamp = Date.now() - depth * 3600000;

  // Track sessions at each level for building next level
  let currentLevel: ChainSession[] = [];
  let nextLevel: ChainSession[] = [];

  // Create root
  const rootSession: ChainSession = {
    id: rootId,
    parent: null,
    depth: 0,
    timestamp: new Date(baseTimestamp).toISOString(),
  };
  sessions.push(rootSession);
  currentLevel.push(rootSession);

  // Build tree level by level
  for (let level = 1; level <= depth; level++) {
    nextLevel = [];
    const levelTimestamp = baseTimestamp + level * 3600000;

    for (const parentSession of currentLevel) {
      for (let childIndex = 0; childIndex < branchFactor; childIndex++) {
        const sessionId = generateSessionId(`l${level}c${childIndex}`, sessions.length);
        const timestamp = levelTimestamp + childIndex * 60000; // 1 minute apart

        const childSession: ChainSession = {
          id: sessionId,
          parent: parentSession.id,
          depth: level,
          continuationOrder: childIndex,
          timestamp: new Date(timestamp).toISOString(),
          childStartedTimestamp: timestamp,
        };

        sessions.push(childSession);
        nextLevel.push(childSession);

        relationships.push({
          child_session_id: sessionId,
          parent_session_id: parentSession.id,
          continuation_order: childIndex,
          child_started_timestamp: timestamp,
          is_active_continuation: childIndex === branchFactor - 1, // Last child is active
          is_orphaned: false,
        });
      }
    }

    currentLevel = nextLevel;
  }

  // Build cache entries
  for (const session of sessions) {
    const childrenCount = relationships.filter((r) => r.parent_session_id === session.id).length;

    cacheEntries.push({
      session_id: session.id,
      root_session_id: rootId,
      depth_from_root: session.depth,
      is_child: session.parent !== null,
      is_parent: childrenCount > 0,
      child_count: childrenCount,
      has_multiple_children: childrenCount > 1,
    });
  }

  return {
    sessions,
    relationships,
    cacheEntries,
    rootSessionId: rootId,
    maxDepth: depth,
    totalSessions: sessions.length,
  };
}

/**
 * createCircularChain
 *
 * Generates a circular reference chain for validation testing.
 * This should NEVER happen in production, but defensive code should detect it.
 *
 * Structure: A → B → C → A (circular)
 *
 * @returns ChainFixture with circular reference
 *
 * @example
 * const chain = createCircularChain();
 * // validateContinuationChain(chain) should return { isValid: false, error: "Circular reference detected" }
 */
export function createCircularChain(): ChainFixture {
  const sessionA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const sessionB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const sessionC = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const baseTimestamp = Date.now() - 3600000;

  const sessions: ChainSession[] = [
    {
      id: sessionA,
      parent: sessionC, // Circular: A → C
      depth: -1, // Depth is undefined in circular chains
      timestamp: new Date(baseTimestamp).toISOString(),
    },
    {
      id: sessionB,
      parent: sessionA, // B → A
      depth: -1,
      timestamp: new Date(baseTimestamp + 3600000).toISOString(),
    },
    {
      id: sessionC,
      parent: sessionB, // C → B
      depth: -1,
      timestamp: new Date(baseTimestamp + 7200000).toISOString(),
    },
  ];

  const relationships: ContinuationRelationship[] = [
    {
      child_session_id: sessionA,
      parent_session_id: sessionC,
      continuation_order: 0,
      is_orphaned: false,
    },
    {
      child_session_id: sessionB,
      parent_session_id: sessionA,
      continuation_order: 0,
      is_orphaned: false,
    },
    {
      child_session_id: sessionC,
      parent_session_id: sessionB,
      continuation_order: 0,
      is_orphaned: false,
    },
  ];

  // Cache entries shouldn't exist for circular chains
  // (they can't be properly populated due to infinite loop)
  const cacheEntries: ChainCacheEntry[] = [];

  return {
    sessions,
    relationships,
    cacheEntries,
    rootSessionId: sessionA, // Arbitrary root (circular has no true root)
    maxDepth: -1,
    totalSessions: 3,
  };
}

/**
 * createOrphanChain
 *
 * Generates a chain with orphaned children (parents missing).
 *
 * Structure:
 * - Child 1 → [MISSING PARENT 1]
 * - Child 2 → [MISSING PARENT 2]
 * - Child 3 → Existing Parent → [MISSING GRANDPARENT]
 *
 * @returns ChainFixture with orphaned sessions
 *
 * @example
 * const chain = createOrphanChain();
 * // detectOrphanedContinuations() should find children 1, 2, and the existing parent
 */
export function createOrphanChain(): ChainFixture {
  const orphanChild1 = 'orphan01-0000-0000-0000-000000000001';
  const orphanChild2 = 'orphan02-0000-0000-0000-000000000002';
  const existingChild = 'existing-0000-0000-0000-000000000003';
  const existingParent = 'exparent-0000-0000-0000-000000000004';

  const missingParent1 = 'missing1-0000-0000-0000-000000000001';
  const missingParent2 = 'missing2-0000-0000-0000-000000000002';
  const missingGrandparent = 'missingg-0000-0000-0000-000000000003';

  const baseTimestamp = Date.now() - 3600000;

  const sessions: ChainSession[] = [
    {
      id: orphanChild1,
      parent: missingParent1,
      depth: 1,
      timestamp: new Date(baseTimestamp).toISOString(),
      isOrphaned: true,
    },
    {
      id: orphanChild2,
      parent: missingParent2,
      depth: 1,
      timestamp: new Date(baseTimestamp + 3600000).toISOString(),
      isOrphaned: true,
    },
    {
      id: existingParent,
      parent: missingGrandparent,
      depth: 1,
      timestamp: new Date(baseTimestamp + 7200000).toISOString(),
      isOrphaned: true, // Parent exists, but its parent is missing
    },
    {
      id: existingChild,
      parent: existingParent,
      depth: 2,
      timestamp: new Date(baseTimestamp + 10800000).toISOString(),
      isOrphaned: false, // Not orphaned (parent exists)
    },
  ];

  const relationships: ContinuationRelationship[] = [
    {
      child_session_id: orphanChild1,
      parent_session_id: missingParent1,
      continuation_order: 0,
      is_orphaned: true,
    },
    {
      child_session_id: orphanChild2,
      parent_session_id: missingParent2,
      continuation_order: 0,
      is_orphaned: true,
    },
    {
      child_session_id: existingParent,
      parent_session_id: missingGrandparent,
      continuation_order: 0,
      is_orphaned: true,
    },
    {
      child_session_id: existingChild,
      parent_session_id: existingParent,
      continuation_order: 0,
      is_orphaned: false,
    },
  ];

  const cacheEntries: ChainCacheEntry[] = [
    // Only existing sessions have cache entries
    {
      session_id: existingParent,
      root_session_id: existingParent, // Acts as root (no parent exists)
      depth_from_root: 0,
      is_child: false, // Parent missing, so treated as root
      is_parent: true,
      child_count: 1,
      has_multiple_children: false,
    },
    {
      session_id: existingChild,
      root_session_id: existingParent,
      depth_from_root: 1,
      is_child: true,
      is_parent: false,
      child_count: 0,
      has_multiple_children: false,
    },
  ];

  return {
    sessions,
    relationships,
    cacheEntries,
    rootSessionId: existingParent, // Existing parent acts as root
    maxDepth: 2,
    totalSessions: sessions.length,
  };
}

/**
 * Helper: Generate a session UUID with predictable pattern
 *
 * @param prefix - Prefix for the UUID (for readability in tests)
 * @param index - Numeric index
 * @returns UUID-formatted string
 */
function generateSessionId(prefix: string, index: number): string {
  const paddedPrefix = prefix.padEnd(8, '0').substring(0, 8);
  const paddedIndex = index.toString().padStart(4, '0');
  return `${paddedPrefix}-${paddedIndex}-0000-0000-000000000000`;
}

/**
 * Helper: Create a realistic compact_boundary event for a child session
 *
 * @param childSessionId - The child session's ID
 * @param parentSessionId - The parent session's ID
 * @param timestamp - ISO 8601 timestamp
 * @returns compact_boundary event object
 */
export function createCompactBoundaryEvent(
  childSessionId: string,
  parentSessionId: string,
  timestamp: string = new Date().toISOString()
) {
  return {
    type: 'system' as const,
    subtype: 'compact_boundary' as const,
    sessionId: parentSessionId, // KEY: Parent's ID, not child's
    uuid: `compact-${childSessionId}`,
    timestamp,
    content: 'Conversation compacted',
    compactMetadata: {
      trigger: 'auto',
      preTokens: 155000 + Math.floor(Math.random() * 1000),
    },
    level: 'info',
    isMeta: false,
  };
}

/**
 * Helper: Create a complete JSONL fixture for a child session
 *
 * @param session - ChainSession object
 * @returns Array of JSONL events as strings
 */
export function createJSONLFixture(session: ChainSession): string[] {
  const lines: string[] = [];

  if (session.parent) {
    // Add inherited compact_boundary event
    const compactBoundary = createCompactBoundaryEvent(
      session.id,
      session.parent,
      session.timestamp || new Date().toISOString()
    );
    lines.push(JSON.stringify(compactBoundary));

    // Add compact summary message
    const summary = {
      type: 'user',
      sessionId: session.id,
      uuid: `summary-${session.id}`,
      parentUuid: compactBoundary.uuid,
      isCompactSummary: true,
      isVisibleInTranscriptOnly: true,
      message: {
        role: 'user',
        content: `This session is being continued from a previous conversation (depth ${session.depth}).`,
      },
      timestamp: session.timestamp || new Date().toISOString(),
    };
    lines.push(JSON.stringify(summary));
  }

  return lines;
}
