/**
 * Shared Test Helpers for Continuation Tests
 *
 * PURPOSE: Common assertions, fixtures, and utilities for continuation chain testing
 *
 * DEPENDENCIES:
 * - test/unit/electron/mocks/sqlite.ts (extended with CTE and orphan query support)
 * - src/electron/services/ContinuationChainService.js
 * - src/electron/utils/continuation-detection.js
 */

import { expect } from 'vitest';
import type { MockDatabase } from '../mocks/sqlite';
import {
  executeCTEChainQuery,
  executeOrphanQuery,
  buildChainFixture,
  triggerCacheInvalidation,
} from '../mocks/sqlite';

/**
 * CONTINUATION CHAIN TYPES
 */

export interface ContinuationMetadata {
  sessionId: string;
  isChild: boolean;
  isParent: boolean;
  parentSessionId?: string;
  compactBoundary?: {
    sessionId: string;
    timestamp: string;
    nextSessionId?: string;
  };
  childStartedTimestamp?: number;
}

export interface ChainNode {
  session_id: string;
  parent_session_id: string | null;
  depth: number;
  continuation_order?: number;
  is_active_continuation?: boolean;
}

export interface ChainStructure {
  root: ChainNode;
  children: ChainNode[];
  flatDescendants: ChainNode[];
  maxDepth: number;
  hasBranches: boolean;
}

/**
 * ASSERTION HELPERS
 */

/**
 * Assert that a session is a child in a continuation chain
 */
export function assertIsChild(
  metadata: ContinuationMetadata,
  expectedParent: string
): void {
  expect(metadata.isChild).toBe(true);
  expect(metadata.parentSessionId).toBe(expectedParent);
  expect(metadata.compactBoundary).toBeDefined();
  expect(metadata.compactBoundary?.sessionId).toBe(expectedParent);
}

/**
 * Assert that a session is a parent in a continuation chain
 */
export function assertIsParent(
  metadata: ContinuationMetadata,
  expectedChildren?: number
): void {
  expect(metadata.isParent).toBe(true);
  expect(metadata.compactBoundary).toBeDefined();
  if (expectedChildren !== undefined) {
    // Note: This would require querying children count separately
    // Use this for documentation purposes
  }
}

/**
 * Assert that a session is standalone (neither child nor parent)
 */
export function assertIsStandalone(metadata: ContinuationMetadata): void {
  expect(metadata.isChild).toBe(false);
  expect(metadata.isParent).toBe(false);
  expect(metadata.parentSessionId).toBeUndefined();
}

/**
 * Assert chain structure properties
 */
export function assertChainStructure(
  chain: ChainStructure,
  expected: {
    rootId: string;
    maxDepth: number;
    descendantCount: number;
    hasBranches?: boolean;
  }
): void {
  expect(chain.root.session_id).toBe(expected.rootId);
  expect(chain.maxDepth).toBe(expected.maxDepth);
  expect(chain.flatDescendants.length).toBe(expected.descendantCount);
  if (expected.hasBranches !== undefined) {
    expect(chain.hasBranches).toBe(expected.hasBranches);
  }
}

/**
 * Assert that chain nodes are ordered correctly
 */
export function assertChainOrdering(nodes: ChainNode[]): void {
  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];

    // Depth should be non-decreasing
    expect(curr.depth).toBeGreaterThanOrEqual(prev.depth);

    // If same depth, check continuation_order
    if (curr.depth === prev.depth && curr.continuation_order && prev.continuation_order) {
      expect(curr.continuation_order).toBeGreaterThanOrEqual(prev.continuation_order);
    }
  }
}

/**
 * DATABASE HELPERS
 */

/**
 * Setup continuation database tables in mock database
 */
export function setupContinuationTables(db: MockDatabase): void {
  // Initialize empty tables
  db._data.set('session_continuations', []);
  db._data.set('continuation_chain_cache', []);
  db._data.set('session_metadata', []);
  db._data.set('session_analysis_cache', []);
}

/**
 * Seed session metadata for testing
 */
export function seedSessionMetadata(
  db: MockDatabase,
  sessions: Array<{ session_id: string; name?: string; message_count?: number }>
): void {
  const metadata = sessions.map(s => ({
    session_id: s.session_id,
    name: s.name || `Session ${s.session_id}`,
    message_count: s.message_count || 10,
    created_at: Date.now(),
    updated_at: Date.now(),
    file_path: `/path/to/${s.session_id}.jsonl`,
    project_path: '/path/to/project',
  }));

  db._data.set('session_metadata', metadata);
}

/**
 * Seed continuation cache entries
 */
export function seedContinuationCache(
  db: MockDatabase,
  cacheEntries: Array<{
    session_id: string;
    root_session_id: string;
    depth_from_root: number;
    is_child: boolean;
    is_parent: boolean;
    child_count?: number;
  }>
): void {
  const cache = cacheEntries.map(c => ({
    session_id: c.session_id,
    root_session_id: c.root_session_id,
    depth_from_root: c.depth_from_root,
    is_child: c.is_child,
    is_parent: c.is_parent,
    child_count: c.child_count || 0,
    has_multiple_children: (c.child_count || 0) > 1,
    populated_at: new Date().toISOString(),
  }));

  db._data.set('continuation_chain_cache', cache);
}

/**
 * CHAIN FIXTURE GENERATORS
 */

/**
 * Create a linear chain fixture
 *
 * @param length - Number of sessions in chain
 * @param prefix - Prefix for session IDs (default: 'session')
 * @returns Array of chain spec objects
 */
export function createLinearChain(
  length: number,
  prefix: string = 'session'
): Array<{ id: string; parent: string | null; order?: number }> {
  const chain: Array<{ id: string; parent: string | null; order?: number }> = [];

  for (let i = 0; i < length; i++) {
    chain.push({
      id: `${prefix}-${i}`,
      parent: i === 0 ? null : `${prefix}-${i - 1}`,
      order: i,
    });
  }

  return chain;
}

/**
 * Create a branching chain fixture
 *
 * Example: depth=2, branchFactor=3 creates:
 *       root
 *      / | \
 *    c1 c2 c3
 *   /|\ /|\ /|\
 * (9 grandchildren)
 *
 * @param depth - Maximum depth of tree
 * @param branchFactor - Number of children per parent
 * @returns Array of chain spec objects
 */
export function createBranchingChain(
  depth: number,
  branchFactor: number
): Array<{ id: string; parent: string | null; order?: number }> {
  const chain: Array<{ id: string; parent: string | null; order?: number }> = [];
  let nodeCounter = 0;

  function addNode(parentId: string | null, currentDepth: number): string {
    const nodeId = `node-${nodeCounter++}`;
    chain.push({ id: nodeId, parent: parentId });

    if (currentDepth < depth) {
      for (let i = 0; i < branchFactor; i++) {
        addNode(nodeId, currentDepth + 1);
      }
    }

    return nodeId;
  }

  addNode(null, 0);
  return chain;
}

/**
 * Create a circular chain fixture (for validation testing)
 *
 * Creates: A -> B -> C -> A
 *
 * @returns Array of chain spec objects
 */
export function createCircularChain(): Array<{ id: string; parent: string | null }> {
  return [
    { id: 'session-a', parent: 'session-c' },
    { id: 'session-b', parent: 'session-a' },
    { id: 'session-c', parent: 'session-b' },
  ];
}

/**
 * Create an orphaned chain fixture (child with missing parent)
 *
 * @returns Object with chain and orphan details
 */
export function createOrphanChain(): {
  chain: Array<{ id: string; parent: string | null }>;
  orphanId: string;
  missingParentId: string;
} {
  return {
    chain: [
      { id: 'root', parent: null },
      { id: 'child-1', parent: 'root' },
      { id: 'orphan', parent: 'missing-parent' }, // Orphan!
    ],
    orphanId: 'orphan',
    missingParentId: 'missing-parent',
  };
}

/**
 * QUERY EXECUTION HELPERS
 */

/**
 * Execute CTE chain query and return structured result
 */
export function executeChainQuery(
  db: MockDatabase,
  rootSessionId: string
): ChainStructure {
  const chain = executeCTEChainQuery(db, rootSessionId);

  const root = chain.find(n => n.depth === 0)!;
  const children = chain.filter(n => n.depth === 1);
  const flatDescendants = chain.filter(n => n.depth > 0);
  const maxDepth = Math.max(...chain.map(n => n.depth), 0);

  // Detect branches: parent with multiple children at same level
  const parentGroups = new Map<string, number>();
  for (const node of flatDescendants) {
    if (node.parent_session_id) {
      const count = parentGroups.get(node.parent_session_id) || 0;
      parentGroups.set(node.parent_session_id, count + 1);
    }
  }
  const hasBranches = Array.from(parentGroups.values()).some(count => count > 1);

  return {
    root,
    children,
    flatDescendants,
    maxDepth,
    hasBranches,
  };
}

/**
 * Find orphaned continuations using LEFT JOIN query
 */
export function findOrphans(db: MockDatabase): any[] {
  return executeOrphanQuery(db, 'session_continuations', 'session_metadata');
}

/**
 * JSONL FIXTURE HELPERS
 */

/**
 * Create JSONL compact_boundary event (modern format)
 */
export function createCompactBoundaryEvent(
  sessionId: string,
  timestamp: string,
  nextSessionId?: string
): any {
  return {
    type: 'system',
    subtype: 'compact_boundary',
    sessionId,
    timestamp,
    content: nextSessionId
      ? `Continuing in new session: ${nextSessionId}`
      : 'Conversation compacted',
    compactMetadata: {
      trigger: 'auto',
      preTokens: 150000,
    },
  };
}

/**
 * Create JSONL compact_boundary event (legacy format)
 */
export function createLegacyCompactBoundaryEvent(
  sessionId: string,
  timestamp: string
): any {
  return {
    type: 'compact_boundary',
    sessionId,
    timestamp,
    content: 'Conversation compacted',
  };
}

/**
 * Create user message event
 */
export function createUserMessageEvent(
  sessionId: string,
  content: string,
  isCompactSummary: boolean = false
): any {
  return {
    type: 'user',
    sessionId,
    timestamp: new Date().toISOString(),
    isCompactSummary,
    message: {
      role: 'user',
      content: [{ type: 'text', text: content }],
    },
  };
}

/**
 * Create assistant message event
 */
export function createAssistantMessageEvent(
  sessionId: string,
  content: string
): any {
  return {
    type: 'assistant',
    sessionId,
    timestamp: new Date().toISOString(),
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: content }],
    },
  };
}

/**
 * CACHE MANAGEMENT HELPERS
 */

/**
 * Clear continuation cache
 */
export function clearCache(db: MockDatabase): void {
  triggerCacheInvalidation(db);
}

/**
 * Verify cache was invalidated
 */
export function assertCacheCleared(db: MockDatabase): void {
  const cache = db._data.get('continuation_chain_cache') || [];
  expect(cache).toHaveLength(0);
}

/**
 * Verify cache entry exists for session
 */
export function assertCacheExists(
  db: MockDatabase,
  sessionId: string,
  expectedRoot: string
): void {
  const cache = db._data.get('continuation_chain_cache') || [];
  const entry = cache.find(c => c.session_id === sessionId);

  expect(entry).toBeDefined();
  expect(entry?.root_session_id).toBe(expectedRoot);
}

/**
 * TEST DATA PRESETS
 */

/**
 * 6-session linear chain from docs (real-world example)
 */
export const SAMPLE_6_SESSION_CHAIN = [
  { id: '6c8cb2f2', parent: null },
  { id: '17b7a5b6', parent: '6c8cb2f2' },
  { id: 'bfb0e536', parent: '17b7a5b6' },
  { id: '16f675dd', parent: 'bfb0e536' },
  { id: 'd7114302', parent: '16f675dd' },
  { id: '2203d0f8', parent: 'd7114302' },
];

/**
 * Branching chain with multiple children
 */
export const SAMPLE_BRANCHING_CHAIN = [
  { id: 'root', parent: null },
  { id: 'c1', parent: 'root' },
  { id: 'c2', parent: 'root' },
  { id: 'c3', parent: 'root' },
  { id: 'gc1', parent: 'c1' }, // Grandchild
];
