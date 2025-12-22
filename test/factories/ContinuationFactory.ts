/**
 * ContinuationFactory - Test data factory for continuation chain structures
 *
 * PRESERVES: Existing SessionFactory patterns
 * ADDS: Specialized continuation tree and chain generators
 *
 * V1 Pattern Context:
 * - Continuation chains have parent-child relationships
 * - Trees can branch (multiple children)
 * - Chains have linear paths from root to leaf
 * - Sessions have continuation_of, chain_position, is_active_continuation
 */

import { createMockSession } from '../mocks/electronAPI';
import type { Session, ContinuationTreeNode } from '@/types/session';

/**
 * Create a continuation tree node from a session
 */
export function createTreeNode(
  session: Session,
  children: ContinuationTreeNode[] = []
): ContinuationTreeNode {
  return {
    session,
    children,
    depth: 0, // Will be computed during tree traversal
  };
}

/**
 * Create a linear continuation chain (no branches)
 * V1 Edge Case: Linear chains are most common pattern
 */
export function createLinearChain(count: number = 3): Session[] {
  const sessions: Session[] = [];

  for (let i = 0; i < count; i++) {
    const id = `session-${i}`;
    sessions.push(
      createMockSession({
        id,
        session_id: id,
        title: `Session ${i + 1}`,
        summary: `**Main Topic**: Chain session ${i + 1}`,
        continuation_of: i > 0 ? `session-${i - 1}` : undefined,
        chain_position: i + 1,
        is_active_continuation: i === count - 1 ? 1 : 0,
        continuation_count: i < count - 1 ? count - i : 0,
        modified: Date.now() - (count - i) * 60000,
      })
    );
  }

  return sessions;
}

/**
 * Create a branching continuation tree
 * V1 Edge Case: Branches occur when multiple sessions continue from same parent
 *
 * Structure:
 *   root
 *   ├── child1
 *   │   └── child1a
 *   └── child2
 */
export function createBranchingTree(): ContinuationTreeNode {
  const root = createMockSession({
    id: 'root',
    session_id: 'root',
    title: 'Root Session',
    continuation_count: 3,
  });

  const child1 = createMockSession({
    id: 'child1',
    session_id: 'child1',
    title: 'Branch 1',
    continuation_of: 'root',
    chain_position: 2,
  });

  const child1a = createMockSession({
    id: 'child1a',
    session_id: 'child1a',
    title: 'Branch 1 Continuation',
    continuation_of: 'child1',
    chain_position: 3,
  });

  const child2 = createMockSession({
    id: 'child2',
    session_id: 'child2',
    title: 'Branch 2',
    continuation_of: 'root',
    chain_position: 2,
  });

  return createTreeNode(root, [
    createTreeNode(child1, [createTreeNode(child1a)]),
    createTreeNode(child2),
  ]);
}

/**
 * Create a deep continuation tree (many levels)
 * V1 Edge Case: Deep trees test UI depth limits (MAX_INDENT_DEPTH)
 */
export function createDeepTree(depth: number = 10): ContinuationTreeNode {
  let current: ContinuationTreeNode | null = null;

  for (let i = depth - 1; i >= 0; i--) {
    const session = createMockSession({
      id: `level-${i}`,
      session_id: `level-${i}`,
      title: `Level ${i}`,
      continuation_of: i > 0 ? `level-${i - 1}` : undefined,
      chain_position: i + 1,
    });

    current = createTreeNode(session, current ? [current] : []);
  }

  return current!;
}

/**
 * Create a wide tree (many siblings at root)
 * V1 Edge Case: Wide trees test horizontal layout and scrolling
 */
export function createWideTree(siblingCount: number = 10): ContinuationTreeNode {
  const root = createMockSession({
    id: 'root',
    session_id: 'root',
    title: 'Root Session',
    continuation_count: siblingCount,
  });

  const children = Array.from({ length: siblingCount }, (_, i) =>
    createTreeNode(
      createMockSession({
        id: `child-${i}`,
        session_id: `child-${i}`,
        title: `Child ${i + 1}`,
        continuation_of: 'root',
        chain_position: 2,
      })
    )
  );

  return createTreeNode(root, children);
}

/**
 * Create a single-node tree (no continuations)
 * V1 Edge Case: Single nodes should not show continuation UI
 */
export function createSingleNodeTree(): ContinuationTreeNode {
  return createTreeNode(
    createMockSession({
      id: 'single',
      session_id: 'single',
      title: 'Single Session',
      continuation_count: 0,
    })
  );
}

/**
 * Create tree with mixed analyzed/unanalyzed sessions
 * V1 Edge Case: Continuation chains can have mixed analysis states
 */
export function createMixedAnalysisTree(): ContinuationTreeNode {
  const root = createMockSession({
    id: 'root',
    session_id: 'root',
    title: 'Analyzed Root',
    is_analyzed: 1,
  });

  const child1 = createMockSession({
    id: 'child1',
    session_id: 'child1',
    title: null,
    summary: null,
    is_analyzed: 0, // Unanalyzed
    continuation_of: 'root',
  });

  const child2 = createMockSession({
    id: 'child2',
    session_id: 'child2',
    title: 'Analyzed Child',
    is_analyzed: 1,
    continuation_of: 'root',
  });

  return createTreeNode(root, [
    createTreeNode(child1),
    createTreeNode(child2),
  ]);
}

/**
 * Create orphaned continuation (parent missing)
 * V1 Edge Case: Orphaned sessions should be handled gracefully
 */
export function createOrphanedContinuation(): Session {
  return createMockSession({
    id: 'orphan',
    session_id: 'orphan',
    title: 'Orphaned Session',
    continuation_of: 'missing-parent-id', // Parent doesn't exist
    chain_position: 5, // Implies there were 4 before it
  });
}

/**
 * Create circular reference (invalid but must handle)
 * V1 Edge Case: Circular refs should be detected and prevented
 */
export function createCircularReference(): Session[] {
  const session1 = createMockSession({
    id: 'session1',
    session_id: 'session1',
    continuation_of: 'session2', // Points to next
  });

  const session2 = createMockSession({
    id: 'session2',
    session_id: 'session2',
    continuation_of: 'session1', // Points back - circular!
  });

  return [session1, session2];
}

/**
 * Create continuation chain for search match testing
 * V1 Edge Case: Search matches in child continuations need highlighting
 */
export function createSearchMatchChain(): Session[] {
  return createLinearChain(5).map((session, index) => ({
    ...session,
    // Mark chapter 3 as having search match
    searchMatch: index === 2 ? { matchedInChapter: 3, totalChapters: 5 } : undefined,
  }));
}

/**
 * Create path structure for breadcrumb testing
 */
export function createBreadcrumbPath(depth: number = 7): ContinuationTreeNode {
  return createDeepTree(depth);
}
