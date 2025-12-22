/**
 * Database Test Fixtures
 *
 * PURPOSE: Setup and teardown utilities for database testing
 *
 * V1 PATTERN CONTEXT:
 * - Two-table schema: session_metadata + session_analysis_cache
 * - FTS5 virtual tables for search
 * - Continuation metadata tracking
 */

import type { MockDatabase } from '../mocks/sqlite';
import { seedTable } from '../mocks/sqlite';

/**
 * V1 Schema: session_metadata table structure
 */
export interface SessionMetadata {
  session_id: string;
  title: string | null;
  summary: string | null;
  project_path: string;
  project: string;
  modified: number;
  last_message_time: string;
  message_count: number;
  is_analyzed: number; // 0 or 1
  analysis_timestamp: number | null;
  content_hash: string | null;
  parent_session_id: string | null;
  has_children: number; // 0 or 1
  continuation_parent_id?: string | null; // For continuation tests
  [key: string]: any; // Allow dynamic properties for test flexibility
}

/**
 * V1 Schema: session_analysis_cache table structure
 */
export interface SessionAnalysisCache {
  session_id: string;
  summary: string;
  content_hash: string;
  created_at: number;
  analysis_timestamp: number;
}

/**
 * Create test session metadata
 *
 * V1 Pattern: Default values match main.js expectations
 */
export function createSessionMetadata(
  overrides: Partial<SessionMetadata> = {}
): SessionMetadata {
  const now = Date.now();
  const sessionId = overrides.session_id || `test-session-${Math.random().toString(36).substr(2, 9)}`;

  return {
    session_id: sessionId,
    title: overrides.title ?? 'Test Session',
    summary: overrides.summary ?? '**Main Topic**: Test\n\n**Key Points**:\n- Point 1',
    project_path: overrides.project_path ?? '/test/project',
    project: overrides.project ?? 'test-project',
    modified: overrides.modified ?? now,
    last_message_time: overrides.last_message_time ?? new Date(now).toISOString(),
    message_count: overrides.message_count ?? 10,
    is_analyzed: overrides.is_analyzed ?? 1,
    analysis_timestamp: overrides.analysis_timestamp ?? Math.floor(now / 1000),
    content_hash: overrides.content_hash ?? 'abc123',
    parent_session_id: overrides.parent_session_id ?? null,
    has_children: overrides.has_children ?? 0,
    ...overrides, // Allow test-specific fields like continuation_parent_id to pass through
  };
}

/**
 * Create test session analysis cache entry
 */
export function createSessionAnalysisCache(
  sessionId: string,
  overrides: Partial<SessionAnalysisCache> = {}
): SessionAnalysisCache {
  const now = Date.now();

  return {
    session_id: sessionId,
    summary: overrides.summary ?? '**Main Topic**: Test\n\n**Key Points**:\n- Point 1',
    content_hash: overrides.content_hash ?? 'abc123',
    created_at: overrides.created_at ?? Math.floor(now / 1000),
    analysis_timestamp: overrides.analysis_timestamp ?? Math.floor(now / 1000),
  };
}

/**
 * Seed database with test sessions
 *
 * V1 Pattern: Populates session_metadata table with realistic data
 */
export function seedSessionMetadata(
  db: MockDatabase,
  count: number = 10,
  overrides?: Partial<SessionMetadata>
): SessionMetadata[] {
  const sessions: SessionMetadata[] = [];

  for (let i = 0; i < count; i++) {
    const session = createSessionMetadata({
      session_id: `test-session-${i}`,
      title: `Test Session ${i}`,
      message_count: Math.floor(Math.random() * 100) + 5,
      modified: Date.now() - i * 3600000, // 1 hour apart
      ...overrides,
    });
    sessions.push(session);
  }

  seedTable(db, 'session_metadata', sessions);
  return sessions;
}

/**
 * Seed database with analysis cache entries
 *
 * V1 Pattern: Populates session_analysis_cache table
 */
export function seedAnalysisCache(
  db: MockDatabase,
  sessions: SessionMetadata[]
): SessionAnalysisCache[] {
  const cacheEntries: SessionAnalysisCache[] = sessions
    .filter(s => s.is_analyzed === 1)
    .map(s => createSessionAnalysisCache(s.session_id));

  seedTable(db, 'session_analysis_cache', cacheEntries);
  return cacheEntries;
}

/**
 * Create continuation chain test data
 *
 * V1 Pattern: Parent-child relationships via parent_session_id
 */
export function createContinuationChain(
  db: MockDatabase,
  chainLength: number = 3
): SessionMetadata[] {
  const sessions: SessionMetadata[] = [];
  let parentId: string | null = null;

  for (let i = 0; i < chainLength; i++) {
    const session = createSessionMetadata({
      session_id: `chain-session-${i}`,
      title: `Chain Session ${i}`,
      parent_session_id: parentId,
      has_children: i < chainLength - 1 ? 1 : 0,
    });
    sessions.push(session);
    parentId = session.session_id;
  }

  seedTable(db, 'session_metadata', sessions);
  return sessions;
}

/**
 * Create unanalyzed session test data
 *
 * V1 Edge Case: Sessions without analysis have null title/summary
 */
export function createUnanalyzedSessions(
  db: MockDatabase,
  count: number = 5
): SessionMetadata[] {
  return seedSessionMetadata(db, count, {
    is_analyzed: 0,
    title: null,
    summary: null,
    analysis_timestamp: null,
    content_hash: null,
  });
}

/**
 * Setup database with realistic test data
 *
 * Combined fixture for common test scenarios
 */
export function setupDatabaseFixtures(db: MockDatabase): {
  analyzed: SessionMetadata[];
  unanalyzed: SessionMetadata[];
  chain: SessionMetadata[];
} {
  const analyzed = seedSessionMetadata(db, 20, { is_analyzed: 1 });
  const unanalyzed = createUnanalyzedSessions(db, 5);
  const chain = createContinuationChain(db, 3);

  seedAnalysisCache(db, analyzed);

  return { analyzed, unanalyzed, chain };
}

/**
 * Seed api_quota table with test data
 *
 * V1 Pattern: Quota tracking for daily analysis limits
 */
export function seedApiQuota(
  db: MockDatabase,
  days: number = 7
): any[] {
  const quotaData = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(2025, 11, 17 - i);
    quotaData.push({
      date: date.toISOString().split('T')[0],
      // Reverse order: newest date (i=0) gets highest value (16)
      // This ensures ORDER BY date DESC returns the highest value first
      analyses_performed: 10 + (days - 1 - i),
      analyses_succeeded: 9 + (days - 1 - i),
      analyses_failed: 1,
    });
  }
  seedTable(db, 'api_quota', quotaData);
  return quotaData;
}

/**
 * Continuation chain test data interface
 */
export interface ContinuationRelationship {
  child_session_id: string;
  parent_session_id: string;
  continuation_order?: number;
  is_active_continuation?: number; // 0 or 1
  is_orphaned?: number; // 0 or 1
  detected_at?: string;
  child_started_timestamp?: number;
}

/**
 * Scenario 1: Simple Linear Chain (A → B → C)
 *
 * Creates a linear continuation chain without branching.
 * Tests: Chain building, root finding, depth calculation
 *
 * @param db - Mock database instance
 * @param sessions - Array of session IDs in chain order (e.g., ['session-a', 'session-b', 'session-c'])
 * @returns Array of continuation relationships
 */
export function seedLinearChain(
  db: MockDatabase,
  sessions: string[]
): ContinuationRelationship[] {
  if (sessions.length < 2) {
    throw new Error('Linear chain requires at least 2 sessions');
  }

  const continuations: ContinuationRelationship[] = [];
  const now = Date.now();

  // Create session metadata for all sessions
  const sessionMetadata = sessions.map((sessionId, index) =>
    createSessionMetadata({
      session_id: sessionId,
      title: `Session ${sessionId}`,
      parent_session_id: index > 0 ? sessions[index - 1] : null,
      has_children: index < sessions.length - 1 ? 1 : 0,
    })
  );
  seedTable(db, 'session_metadata', sessionMetadata);

  // Create continuation relationships (each session continues from previous)
  for (let i = 1; i < sessions.length; i++) {
    continuations.push({
      child_session_id: sessions[i],
      parent_session_id: sessions[i - 1],
      continuation_order: i,
      is_active_continuation: 1,
      is_orphaned: 0,
      detected_at: new Date(now + i * 1000).toISOString(),
      child_started_timestamp: Math.floor((now + i * 1000) / 1000),
    });
  }

  seedTable(db, 'session_continuations', continuations);
  return continuations;
}

/**
 * Scenario 2: Branching Chain (parent → [child1, child2, child3])
 *
 * Creates a parent session with multiple children (branching).
 * Tests: Branch detection, has_multiple_children flag, child ordering
 *
 * @param db - Mock database instance
 * @param parentId - Parent session ID
 * @param childrenIds - Array of child session IDs
 * @returns Array of continuation relationships
 */
export function seedBranchingChain(
  db: MockDatabase,
  parentId: string,
  childrenIds: string[]
): ContinuationRelationship[] {
  if (childrenIds.length === 0) {
    throw new Error('Branching chain requires at least 1 child');
  }

  const continuations: ContinuationRelationship[] = [];
  const now = Date.now();

  // Create parent session metadata
  const parentSession = createSessionMetadata({
    session_id: parentId,
    title: `Parent Session ${parentId}`,
    parent_session_id: null,
    has_children: 1,
  });

  // Create child session metadata
  const childSessions = childrenIds.map((childId) =>
    createSessionMetadata({
      session_id: childId,
      title: `Child Session ${childId}`,
      parent_session_id: parentId,
      has_children: 0,
    })
  );

  seedTable(db, 'session_metadata', [parentSession, ...childSessions]);

  // Create continuation relationships (all children point to same parent)
  childrenIds.forEach((childId, index) => {
    continuations.push({
      child_session_id: childId,
      parent_session_id: parentId,
      continuation_order: index + 1,
      is_active_continuation: index === childrenIds.length - 1 ? 1 : 0, // Last child is active
      is_orphaned: 0,
      detected_at: new Date(now + index * 1000).toISOString(),
      child_started_timestamp: Math.floor((now + index * 1000) / 1000),
    });
  });

  seedTable(db, 'session_continuations', continuations);
  return continuations;
}

/**
 * Scenario 3: Deep Multi-Level with Branching (Complex Tree)
 *
 * Creates a complex tree structure:
 * root → [1a, 1b] → [2a, 2b] (from 1a), 2c (from 1b)
 *
 * Tests: Deep chain traversal, mixed depth calculations, flatDescendants ordering
 *
 * @param db - Mock database instance
 * @returns Array of continuation relationships
 */
export function seedComplexTree(db: MockDatabase): ContinuationRelationship[] {
  const continuations: ContinuationRelationship[] = [];
  const now = Date.now();

  // Define tree structure
  const sessions = [
    { id: 'root', parent: null, depth: 0 },
    { id: '1a', parent: 'root', depth: 1 },
    { id: '1b', parent: 'root', depth: 1 },
    { id: '2a', parent: '1a', depth: 2 },
    { id: '2b', parent: '1a', depth: 2 },
    { id: '2c', parent: '1b', depth: 2 },
  ];

  // Create session metadata
  const sessionMetadata = sessions.map((session) => {
    const hasChildren = sessions.some(s => s.parent === session.id);
    return createSessionMetadata({
      session_id: session.id,
      title: `Session ${session.id}`,
      parent_session_id: session.parent,
      has_children: hasChildren ? 1 : 0,
    });
  });
  seedTable(db, 'session_metadata', sessionMetadata);

  // Create continuation relationships
  let orderCounter = 1;
  sessions.forEach((session, index) => {
    if (session.parent) {
      // Count siblings to determine if this is the last child (active)
      const siblings = sessions.filter(s => s.parent === session.parent);
      const isLastSibling = siblings[siblings.length - 1].id === session.id;

      continuations.push({
        child_session_id: session.id,
        parent_session_id: session.parent,
        continuation_order: orderCounter++,
        is_active_continuation: isLastSibling ? 1 : 0,
        is_orphaned: 0,
        detected_at: new Date(now + index * 1000).toISOString(),
        child_started_timestamp: Math.floor((now + index * 1000) / 1000),
      });
    }
  });

  seedTable(db, 'session_continuations', continuations);
  return continuations;
}

/**
 * Scenario 4: Orphaned Continuations
 *
 * Creates a child session with a missing parent.
 * Tests: Orphan detection, healing flow, error handling
 *
 * @param db - Mock database instance
 * @param childId - Child session ID
 * @param missingParentId - Non-existent parent session ID
 * @returns Array with single orphaned continuation relationship
 */
export function seedOrphan(
  db: MockDatabase,
  childId: string,
  missingParentId: string
): ContinuationRelationship[] {
  const now = Date.now();

  // Create only the child session metadata (parent does not exist)
  const childSession = createSessionMetadata({
    session_id: childId,
    title: `Orphan Session ${childId}`,
    parent_session_id: missingParentId,
    has_children: 0,
  });

  seedTable(db, 'session_metadata', [childSession]);

  // Create continuation relationship with is_orphaned flag
  const continuation: ContinuationRelationship = {
    child_session_id: childId,
    parent_session_id: missingParentId,
    continuation_order: 1,
    is_active_continuation: 1,
    is_orphaned: 1, // Marked as orphaned
    detected_at: new Date(now).toISOString(),
    child_started_timestamp: Math.floor(now / 1000),
  };

  seedTable(db, 'session_continuations', [continuation]);
  return [continuation];
}

/**
 * Scenario 5: Circular Reference (Invalid)
 *
 * Creates a circular chain: A → B → C → A
 * Tests: Circular detection, findRootParent behavior, error handling
 *
 * @param db - Mock database instance
 * @returns Array of continuation relationships forming a cycle
 */
export function seedCircularChain(db: MockDatabase): ContinuationRelationship[] {
  const continuations: ContinuationRelationship[] = [];
  const now = Date.now();

  // Define circular structure
  const sessions = [
    { id: 'session-a', parent: 'session-c' },
    { id: 'session-b', parent: 'session-a' },
    { id: 'session-c', parent: 'session-b' },
  ];

  // Create session metadata
  const sessionMetadata = sessions.map((session) =>
    createSessionMetadata({
      session_id: session.id,
      title: `Session ${session.id}`,
      parent_session_id: session.parent,
      has_children: 1, // All have children in circular chain
    })
  );
  seedTable(db, 'session_metadata', sessionMetadata);

  // Create continuation relationships forming a cycle
  sessions.forEach((session, index) => {
    continuations.push({
      child_session_id: session.id,
      parent_session_id: session.parent,
      continuation_order: index + 1,
      is_active_continuation: 1,
      is_orphaned: 0,
      detected_at: new Date(now + index * 1000).toISOString(),
      child_started_timestamp: Math.floor((now + index * 1000) / 1000),
    });
  });

  seedTable(db, 'session_continuations', continuations);
  return continuations;
}

/**
 * Scenario 6: Standalone Sessions (No Continuations)
 *
 * Creates a standalone session with no parent and no children.
 * Tests: Empty results, metadata flags (is_child=false, is_parent=false)
 *
 * @param db - Mock database instance
 * @param sessionId - Standalone session ID
 * @returns Empty array (no continuation relationships)
 */
export function seedStandaloneSession(
  db: MockDatabase,
  sessionId: string
): ContinuationRelationship[] {
  // Create standalone session metadata
  const session = createSessionMetadata({
    session_id: sessionId,
    title: `Standalone Session ${sessionId}`,
    parent_session_id: null,
    has_children: 0,
  });

  seedTable(db, 'session_metadata', [session]);

  // No continuation relationships for standalone session
  return [];
}
