/**
 * Zustand store for session continuation chain state management.
 *
 * This store manages continuation group data including expansion state,
 * loaded continuation chains, and lazy loading of continuation children.
 *
 * @remarks
 * Built on top of backend IPC methods:
 * - window.electronAPI.getContinuationChain(sessionId)
 * - window.electronAPI.getContinuationChildren(sessionId)
 * - window.electronAPI.getContinuationMetadata(sessionId)
 * - window.electronAPI.getContinuationStats()
 *
 * Design principles:
 * - Lazy loading: Only load continuation children when group is expanded
 * - Expansion state: Track which session groups are expanded in UI
 * - Caching: Cache loaded continuation data to avoid redundant IPC calls
 * - Reverse lookup: Map any session ID (parent or child) to its root session
 * - Performance: Memoized selectors to prevent unnecessary re-renders
 *
 * @example
 * ```tsx
 * // Check if session has continuations
 * const hasContinuations = useContinuationStore(
 *   state => state.getContinuationGroup(sessionId)?.continuations.length > 0
 * );
 *
 * // Toggle expansion
 * const toggleExpansion = useContinuationStore(state => state.toggleExpansion);
 * toggleExpansion(sessionId);
 *
 * // Check if any session is part of a chain (works for both parent and child)
 * const isPartOfChain = useContinuationStore(state => state.isPartOfChain(sessionId));
 * ```
 *
 * @module stores/continuationStore
 */

import { create } from 'zustand';

import { logger } from '@/utils/logger';

import type {
  Session,
  ContinuationMetadata,
  ContinuationStats,
  ContinuationGroup,
  ContinuationTreeNode,
  ContinuationDescendant,
  ContinuationPath,
  ContinuationBranchInfo,
} from '../types';

/**
 * Internal cache entry extending ContinuationGroup with load state.
 * This is the internal representation used by the store.
 */
export interface CachedContinuationGroup {
  /** ID of the parent session (root of the chain) */
  parentId: string;
  /** The root/parent session object */
  rootSession: Session | null;
  /** Array of child sessions (continuations) in chronological order */
  continuations: Session[];
  /** Metadata about the continuation chain */
  metadata: ContinuationMetadata | null;
  /** Whether this group's data has been fully loaded */
  isLoaded: boolean;
  /** Whether this group is currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Timestamp when this group was loaded (for cache invalidation) */
  loadedAt: number | null;
  /** All session IDs in this group (for reverse lookup) */
  memberIds: Set<string>;

  // ==========================================================================
  // NEW fields for tree support - Hybrid Continuation Chain System
  // ==========================================================================

  /** Built tree structure for recursive rendering */
  tree: ContinuationTreeNode | null;
  /** Flat descendants from backend with parentSessionId for tree building */
  flatDescendants: ContinuationDescendant[];
  /** Quick flag: true if chain contains branching points (one parent with multiple children) */
  hasBranches: boolean;
  /** O(1) lookup: child session ID -> parent session ID */
  parentMap: Map<string, string>;
  /** O(1) lookup: session ID -> tree node */
  nodeMap: Map<string, ContinuationTreeNode>;
  /**
   * Set of session IDs whose child branches are collapsed.
   * SPARSE STORAGE: Only contains collapsed nodes (expanded is default).
   * O(1) lookup via Set.has().
   */
  collapsedBranchNodes: Set<string>;
}

// =============================================================================
// Chain Highlight Types - SessionList Chain Visualization
// =============================================================================

/**
 * Relationship role of a session in the highlighted chain.
 */
export type ChainHighlightRole = 'clicked' | 'ancestor' | 'descendant' | 'sibling';

/**
 * Pre-computed chain data for O(1) lookups during highlight.
 * Computed once when setChainHighlight is called.
 */
export interface ChainHighlightData {
  /** Root session ID of the chain */
  rootId: string;
  /** The session that was clicked (origin of highlight) */
  clickedSessionId: string;
  /** Set of all session IDs in the chain for O(1) membership check */
  memberIds: Set<string>;
  /** Position of each session in the chain (1-indexed) */
  positionMap: Map<string, number>;
  /** Role of each session relative to the clicked session */
  roleMap: Map<string, ChainHighlightRole>;
  /** Distance from clicked session (0=clicked, negative=ancestor, positive=descendant) */
  distanceMap: Map<string, number>;
  /** Total number of sessions in the chain */
  totalCount: number;
}

/**
 * Highlight info returned for a specific session.
 */
export interface ChainHighlightInfo {
  /** Role in the chain relative to clicked session */
  role: ChainHighlightRole;
  /** Position in the chain (1-indexed) */
  position: number;
  /** Total sessions in chain */
  total: number;
  /** Distance from clicked (0=clicked, negative=ancestor, positive=descendant) */
  distance: number;
  /** Whether this is the root of the chain */
  isRoot: boolean;
}

/**
 * Continuation store state shape.
 */
interface ContinuationState {
  /** Map of root session ID to its cached continuation group data */
  continuationGroups: Map<string, CachedContinuationGroup>;

  /**
   * Reverse lookup: maps any session ID (parent or child) to its root session ID.
   * This enables O(1) lookups when given a child session ID.
   */
  sessionToRootMap: Map<string, string>;

  /** Set of session IDs that are currently expanded in the UI */
  expandedGroups: Set<string>;

  /** Global continuation statistics */
  stats: ContinuationStats | null;

  /** Whether stats are currently loading */
  isLoadingStats: boolean;

  /** Whether any continuation data is currently being loaded */
  isLoading: boolean;

  /** Error from last operation */
  error: string | null;

  // ==========================================================================
  // Chain Highlight State - SessionList Chain Visualization
  // ==========================================================================

  /** Session ID whose chain is currently highlighted (null = no highlight) */
  highlightedSessionId: string | null;

  /** Pre-computed chain data for O(1) lookups (null = no highlight) */
  highlightedChainData: ChainHighlightData | null;
}

/**
 * Continuation store actions.
 */
interface ContinuationActions {
  /**
   * Load continuation children for a session.
   * Called when user expands a session group or when needed for display.
   * Works with both parent and child session IDs.
   * @param sessionId - ID of any session in the chain
   * @param forceRefresh - If true, bypasses cache and reloads from backend
   */
  loadContinuations: (sessionId: string, forceRefresh?: boolean) => Promise<void>;

  /**
   * Load continuation metadata for a session.
   * Lighter-weight than loadContinuations, just gets metadata counts.
   * @param sessionId - ID of the session to get metadata for
   */
  loadContinuationMetadata: (sessionId: string) => Promise<ContinuationMetadata | null>;

  /**
   * Toggle expansion state of a session group.
   * If collapsing, keeps cached data. If expanding, loads data if not already loaded.
   * @param sessionId - ID of the session group to toggle
   */
  toggleExpansion: (sessionId: string) => void;

  /**
   * Expand a specific session group.
   * @param sessionId - ID of the session group to expand
   */
  expandGroup: (sessionId: string) => void;

  /**
   * Collapse a specific session group.
   * @param sessionId - ID of the session group to collapse
   */
  collapseGroup: (sessionId: string) => void;

  /**
   * Collapse all expanded groups.
   */
  collapseAll: () => void;

  /**
   * Expand all loaded groups.
   */
  expandAll: () => void;

  /**
   * Get continuation group data for a session.
   * Returns the UI-facing ContinuationGroup or null if not loaded.
   * Works with both parent and child session IDs.
   * @param sessionId - ID of any session in the chain
   */
  getContinuationGroup: (sessionId: string) => ContinuationGroup | null;

  /**
   * Check if a session has continuations (child_count > 0).
   * Uses metadata if available, otherwise returns false.
   * @param sessionId - ID of the session to check
   */
  hasContinuations: (sessionId: string) => boolean;

  /**
   * Check if a session is part of a continuation chain.
   * This is a synchronous check against cached data.
   * @param sessionId - ID of the session to check
   */
  isPartOfChain: (sessionId: string) => boolean;

  /**
   * Check if a group is expanded.
   * @param sessionId - ID of any session in the group
   */
  isExpanded: (sessionId: string) => boolean;

  /**
   * Load global continuation statistics.
   */
  loadStats: () => Promise<void>;

  /**
   * Clear all cached continuation data.
   * Called on refresh or when session list changes significantly.
   */
  clearCache: () => void;

  /**
   * Remove a specific session's continuation data from cache.
   * @param sessionId - The session ID to remove
   */
  removeCachedSession: (sessionId: string) => void;

  /**
   * Set error state.
   * @param error - Error message or null to clear
   */
  setError: (error: string | null) => void;

  /**
   * Clear the error state.
   */
  clearError: () => void;

  /**
   * Bulk load continuation metadata for multiple sessions.
   * Optimized for initial list render.
   * @param sessionIds - Array of session IDs to load metadata for
   */
  loadBulkMetadata: (sessionIds: string[]) => Promise<void>;

  /**
   * Toggle collapse state of a specific tree node.
   * @param rootSessionId - Root of the continuation chain
   * @param branchNodeId - The node whose children should be toggled
   */
  toggleBranchCollapse: (rootSessionId: string, branchNodeId: string) => void;

  /**
   * Expand all ancestors of a session to reveal it.
   * O(depth) complexity - walks up the parentMap.
   * @param rootSessionId - Root of the continuation chain
   * @param targetSessionId - The session to reveal
   */
  expandPathToBranch: (rootSessionId: string, targetSessionId: string) => void;

  /**
   * Collapse all branches in a continuation tree.
   * @param rootSessionId - Root of the continuation chain
   */
  collapseAllBranches: (rootSessionId: string) => void;

  /**
   * Expand all branches in a continuation tree (clears collapsed set).
   * @param rootSessionId - Root of the continuation chain
   */
  expandAllBranches: (rootSessionId: string) => void;

  // ==========================================================================
  // Chain Highlight Actions - SessionList Chain Visualization
  // ==========================================================================

  /**
   * Activate chain highlight for a session.
   * Pre-computes all positions, roles, and distances for O(1) lookups.
   * @param sessionId - ID of the clicked session
   */
  setChainHighlight: (sessionId: string) => Promise<void>;

  /**
   * Clear the chain highlight.
   */
  clearChainHighlight: () => void;

  /**
   * Check if chain highlight is currently active.
   */
  isChainHighlightActive: () => boolean;

  /**
   * Get highlight info for a session. Returns null if session is not in highlighted chain.
   * @param sessionId - ID of session to check
   */
  getChainHighlightInfo: (sessionId: string) => ChainHighlightInfo | null;
}

/**
 * Combined continuation store type.
 */
type ContinuationStore = ContinuationState & ContinuationActions;

export type { ContinuationStore };

/**
 * Helper to get session ID from a Session object (handles dual ID fields).
 * IMPORTANT: Must match the order used in components (session_id first, then id)
 * to ensure consistent ID resolution across the app.
 */
function getSessionId(session: Session): string {
  return session.session_id || session.id || '';
}

// =============================================================================
// Tree Building Helpers - Hybrid Continuation Chain System
// =============================================================================

/**
 * Build a tree structure from flat descendants and root session.
 * Recursively constructs ContinuationTreeNode hierarchy.
 *
 * @param rootSession - The root/parent session
 * @param descendants - Flat array of descendants with parentSessionId
 * @returns Root tree node with children populated recursively
 */
function buildTreeFromDescendants(
  rootSession: Session,
  descendants: ContinuationDescendant[]
): ContinuationTreeNode {
  // Group descendants by their parent session ID for efficient lookup
  const childrenByParent = new Map<string, ContinuationDescendant[]>();
  for (const desc of descendants) {
    const parentId = desc.parentSessionId;
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId)!.push(desc);
  }

  // Sort children by continuationOrder within each parent group
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.continuationOrder - b.continuationOrder);
  }

  // Recursive function to build tree nodes
  function buildNode(
    session: Session,
    parentSessionId: string | null,
    depth: number,
    siblingIndex: number,
    siblingCount: number,
    isActivePath: boolean
  ): ContinuationTreeNode {
    const sessionId = getSessionId(session);
    const childDescendants = childrenByParent.get(sessionId) || [];

    // Determine active path: a node is on active path if it or any descendant is active
    const hasActiveChild = childDescendants.some((d) => d.isActiveContinuation);

    const children: ContinuationTreeNode[] = childDescendants.map((desc, idx) => {
      return buildNode(
        desc.session,
        sessionId,
        desc.depth,
        idx,
        childDescendants.length,
        isActivePath && (desc.isActiveContinuation || hasActiveChild)
      );
    });

    return {
      session,
      children,
      parentSessionId,
      depth,
      siblingIndex,
      siblingCount,
      isActivePath,
    };
  }

  // Build tree starting from root
  return buildNode(
    rootSession,
    null,
    0,
    0,
    1,
    true // Root is always on active path
  );
}

/**
 * Build parent lookup map from flat descendants.
 * Enables O(1) parent lookup for any session in the chain.
 *
 * @param _rootId - Root session ID (unused but kept for API consistency)
 * @param descendants - Flat array of descendants
 * @returns Map of child session ID -> parent session ID
 */
function buildParentMap(
  _rootId: string,
  descendants: ContinuationDescendant[]
): Map<string, string> {
  const parentMap = new Map<string, string>();

  for (const desc of descendants) {
    const childId = getSessionId(desc.session);
    parentMap.set(childId, desc.parentSessionId);
  }

  return parentMap;
}

/**
 * Build node lookup map from tree structure.
 * Enables O(1) node lookup by session ID.
 *
 * @param tree - Root tree node
 * @returns Map of session ID -> tree node
 */
function buildNodeMap(tree: ContinuationTreeNode): Map<string, ContinuationTreeNode> {
  const nodeMap = new Map<string, ContinuationTreeNode>();

  function traverse(node: ContinuationTreeNode): void {
    const sessionId = getSessionId(node.session);
    nodeMap.set(sessionId, node);
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(tree);
  return nodeMap;
}

/**
 * Create the continuation store with all state and actions.
 */
export const useContinuationStore = create<ContinuationStore>((set, get) => ({
  // Initial state
  continuationGroups: new Map(),
  sessionToRootMap: new Map(),
  expandedGroups: new Set(),
  stats: null,
  isLoadingStats: false,
  isLoading: false,
  error: null,
  // Chain highlight state
  highlightedSessionId: null,
  highlightedChainData: null,

  // Load continuation chain for a session (works with parent or child ID)
  loadContinuations: async (sessionId: string, forceRefresh: boolean = false) => {
    const state = get();

    // Check if we already know the root for this session
    const existingRootId = state.sessionToRootMap.get(sessionId);
    const rootIdToCheck = existingRootId || sessionId;
    const existingGroup = state.continuationGroups.get(rootIdToCheck);

    // Skip if already loaded or currently loading (unless force refresh)
    if (!forceRefresh && (existingGroup?.isLoaded || existingGroup?.isLoading)) {
      return;
    }

    // Update state to show loading
    set({ isLoading: true });

    const updatedGroups = new Map(state.continuationGroups);
    updatedGroups.set(rootIdToCheck, {
      parentId: rootIdToCheck,
      rootSession: existingGroup?.rootSession || null,
      continuations: existingGroup?.continuations || [],
      metadata: existingGroup?.metadata || null,
      isLoaded: false,
      isLoading: true,
      error: null,
      loadedAt: null,
      memberIds: existingGroup?.memberIds || new Set([rootIdToCheck]),
      // Tree fields - preserve existing or initialize empty
      tree: existingGroup?.tree || null,
      flatDescendants: existingGroup?.flatDescendants || [],
      hasBranches: existingGroup?.hasBranches || false,
      parentMap: existingGroup?.parentMap || new Map<string, string>(),
      nodeMap: existingGroup?.nodeMap || new Map<string, ContinuationTreeNode>(),
      collapsedBranchNodes: existingGroup?.collapsedBranchNodes || new Set<string>(),
    });
    set({ continuationGroups: updatedGroups });

    try {
      // Use getContinuationChain to get the full chain (parent + children)
      const result = await window.electronAPI.getContinuationChain(sessionId);

      if (result.success && result.chain) {
        const chain = result.chain;
        const rootId = getSessionId(chain.parent);

        // Build member IDs set for reverse lookup
        const memberIds = new Set<string>();
        memberIds.add(rootId);
        chain.children.forEach((child) => {
          const childId = getSessionId(child);
          if (childId) {
            memberIds.add(childId);
          }
        });

        // =================================================================
        // NEW: Build tree structures from backend data
        // =================================================================

        // Extract flatDescendants and hasBranches from backend response
        // Backend returns these in the chain object
        const flatDescendants: ContinuationDescendant[] = chain.flatDescendants || [];
        const hasBranches: boolean = chain.hasBranches || false;

        // Build parent map for O(1) parent lookups
        const parentMap = buildParentMap(rootId, flatDescendants);

        // Build tree structure from flat descendants
        const tree = buildTreeFromDescendants(chain.parent, flatDescendants);

        // Build node map for O(1) node lookups by session ID
        const nodeMap = buildNodeMap(tree);

        // Create cached group
        const cachedGroup: CachedContinuationGroup = {
          parentId: rootId,
          rootSession: chain.parent,
          continuations: chain.children,
          metadata: null, // Will be loaded separately if needed
          isLoaded: true,
          isLoading: false,
          error: null,
          loadedAt: Date.now(),
          memberIds,
          // NEW: Tree structure fields
          tree,
          flatDescendants,
          hasBranches,
          parentMap,
          nodeMap,
          collapsedBranchNodes: new Set<string>(),
        };

        // Update state with new group and reverse lookup
        set((prev) => {
          const newGroups = new Map(prev.continuationGroups);
          // Remove old entry if we were using sessionId as key but root is different
          if (rootIdToCheck !== rootId) {
            newGroups.delete(rootIdToCheck);
          }
          newGroups.set(rootId, cachedGroup);

          const newSessionToRoot = new Map(prev.sessionToRootMap);
          memberIds.forEach((memberId) => {
            newSessionToRoot.set(memberId, rootId);
          });

          return {
            continuationGroups: newGroups,
            sessionToRootMap: newSessionToRoot,
            isLoading: false,
            error: null,
          };
        });
      } else {
        // No chain found - this session might not be part of a chain
        const errorMessage = result.error || 'No chain data returned';
        logger.warn(`[ContinuationStore] No chain found for ${sessionId}:`, errorMessage);
        const currentGroups = new Map(get().continuationGroups);
        const currentGroup = currentGroups.get(rootIdToCheck);

        if (currentGroup) {
          currentGroups.set(rootIdToCheck, {
            ...currentGroup,
            isLoaded: true,
            isLoading: false,
            error: errorMessage,
          });
        }

        set({
          continuationGroups: currentGroups,
          isLoading: false,
          error: errorMessage,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading continuations';
      logger.error(
        `[ContinuationStore] Error loading chain for ${sessionId}:`,
        errorMessage,
        error
      );
      const currentGroups = new Map(get().continuationGroups);
      const currentGroup = currentGroups.get(rootIdToCheck);

      if (currentGroup) {
        currentGroups.set(rootIdToCheck, {
          ...currentGroup,
          isLoaded: false,
          isLoading: false,
          error: errorMessage,
        });
      }

      set({
        continuationGroups: currentGroups,
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  // Load continuation metadata for a session
  loadContinuationMetadata: async (sessionId: string) => {
    try {
      const result = await window.electronAPI.getContinuationMetadata(sessionId);

      if (result.success && result.metadata) {
        const currentGroups = new Map(get().continuationGroups);
        const existingGroup = currentGroups.get(sessionId);

        currentGroups.set(sessionId, {
          parentId: sessionId,
          rootSession: existingGroup?.rootSession || null,
          continuations: existingGroup?.continuations || [],
          metadata: result.metadata,
          isLoaded: existingGroup?.isLoaded || false,
          isLoading: existingGroup?.isLoading || false,
          error: existingGroup?.error || null,
          loadedAt: existingGroup?.loadedAt ?? null,
          memberIds: existingGroup?.memberIds || new Set([sessionId]),
          // Tree fields - preserve existing or initialize empty
          tree: existingGroup?.tree || null,
          flatDescendants: existingGroup?.flatDescendants || [],
          hasBranches: existingGroup?.hasBranches || false,
          parentMap: existingGroup?.parentMap || new Map<string, string>(),
          nodeMap: existingGroup?.nodeMap || new Map<string, ContinuationTreeNode>(),
          collapsedBranchNodes: existingGroup?.collapsedBranchNodes || new Set<string>(),
        });
        set({ continuationGroups: currentGroups });
        return result.metadata;
      }
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading metadata';
      set({ error: errorMessage });
      return null;
    }
  },

  // Toggle expansion state
  toggleExpansion: (sessionId: string) => {
    const state = get();
    const newExpandedGroups = new Set(state.expandedGroups);

    if (newExpandedGroups.has(sessionId)) {
      // Collapse
      newExpandedGroups.delete(sessionId);
      set({ expandedGroups: newExpandedGroups });
    } else {
      // Expand - also trigger loading if not already loaded
      newExpandedGroups.add(sessionId);
      set({ expandedGroups: newExpandedGroups });

      // Load continuations if not already loaded
      const group = state.continuationGroups.get(sessionId);
      if (!group?.isLoaded && !group?.isLoading) {
        void get().loadContinuations(sessionId);
      }
    }
  },

  // Expand a specific group
  expandGroup: (sessionId: string) => {
    const state = get();
    if (!state.expandedGroups.has(sessionId)) {
      const newExpandedGroups = new Set(state.expandedGroups);
      newExpandedGroups.add(sessionId);
      set({ expandedGroups: newExpandedGroups });

      // Load continuations if not already loaded
      const group = state.continuationGroups.get(sessionId);
      if (!group?.isLoaded && !group?.isLoading) {
        void get().loadContinuations(sessionId);
      }
    }
  },

  // Collapse a specific group
  collapseGroup: (sessionId: string) => {
    const state = get();
    if (state.expandedGroups.has(sessionId)) {
      const newExpandedGroups = new Set(state.expandedGroups);
      newExpandedGroups.delete(sessionId);
      set({ expandedGroups: newExpandedGroups });
    }
  },

  // Collapse all groups (interface method)
  collapseAll: () => {
    set({ expandedGroups: new Set() });
  },

  // Alias for backward compatibility
  collapseAllGroups: () => {
    set({ expandedGroups: new Set() });
  },

  // Expand all loaded groups
  expandAll: () => {
    const state = get();
    const allSessionIds = Array.from(state.continuationGroups.keys());
    const newExpandedGroups = new Set(allSessionIds);
    set({ expandedGroups: newExpandedGroups });
  },

  // Check if session is part of any chain
  isPartOfChain: (sessionId: string) => {
    const state = get();
    // Check reverse lookup map first (O(1))
    if (state.sessionToRootMap.has(sessionId)) {
      return true;
    }
    // Check if it's a parent (has continuation group)
    if (state.continuationGroups.has(sessionId)) {
      return true;
    }
    return false;
  },

  // Check if a session group is expanded
  isExpanded: (sessionId: string) => {
    return get().expandedGroups.has(sessionId);
  },

  // Remove a specific session from cache
  removeCachedSession: (sessionId: string) => {
    const state = get();
    const rootId = state.sessionToRootMap.get(sessionId) || sessionId;
    const currentGroups = new Map(state.continuationGroups);
    const currentSessionToRoot = new Map(state.sessionToRootMap);

    // Get the group to find all member IDs
    const group = currentGroups.get(rootId);
    if (group?.memberIds) {
      group.memberIds.forEach((memberId) => {
        currentSessionToRoot.delete(memberId);
      });
    }

    currentGroups.delete(rootId);
    set({
      continuationGroups: currentGroups,
      sessionToRootMap: currentSessionToRoot,
    });
  },

  // Clear error state
  clearError: () => set({ error: null }),

  // Get continuation group data (converts internal cache to UI-facing ContinuationGroup)
  getContinuationGroup: (sessionId: string): ContinuationGroup | null => {
    const state = get();

    // Find the root ID for this session (handles both parent and child IDs)
    const rootId = state.sessionToRootMap.get(sessionId) || sessionId;
    const cachedGroup = state.continuationGroups.get(rootId);

    if (!cachedGroup || !cachedGroup.rootSession) {
      return null;
    }

    // Convert internal CachedContinuationGroup to UI-facing ContinuationGroup
    return {
      rootSession: cachedGroup.rootSession,
      continuations: cachedGroup.continuations,
      isExpanded: state.expandedGroups.has(rootId),
      totalCount: 1 + cachedGroup.continuations.length,
    };
  },

  // Check if session has continuations (is a parent with children)
  hasContinuations: (sessionId: string) => {
    const state = get();
    // First check if this session is the root of any chain
    const group = state.continuationGroups.get(sessionId);
    if (group?.metadata) {
      return group.metadata.child_count > 0;
    }
    if (group?.continuations) {
      return group.continuations.length > 0;
    }
    // Check if it's in sessionToRootMap as a root (key === value means it's the root)
    const rootId = state.sessionToRootMap.get(sessionId);
    if (rootId === sessionId) {
      const rootGroup = state.continuationGroups.get(rootId);
      return (rootGroup?.continuations?.length ?? 0) > 0;
    }
    return false;
  },

  // Load global statistics
  loadStats: async () => {
    set({ isLoadingStats: true });

    try {
      const result = await window.electronAPI.getContinuationStats();

      if (result.success && result.stats) {
        set({ stats: result.stats, isLoadingStats: false, error: null });
      } else {
        const errorMessage = result.error || 'Failed to load continuation stats';
        set({ isLoadingStats: false, error: errorMessage });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading stats';
      set({ isLoadingStats: false, error: errorMessage });
    }
  },

  // Clear all cached data
  clearCache: () => {
    set({
      continuationGroups: new Map(),
      sessionToRootMap: new Map(),
      expandedGroups: new Set(),
      stats: null,
      isLoading: false,
      error: null,
    });
  },

  // Set error state
  setError: (error: string | null) => set({ error }),

  // Bulk load metadata for multiple sessions (optimized for list rendering)
  loadBulkMetadata: async (sessionIds: string[]) => {
    const state = get();

    // Filter to only sessions we haven't loaded metadata for
    const toLoad = sessionIds.filter((id) => {
      const group = state.continuationGroups.get(id);
      return !group?.metadata;
    });

    if (toLoad.length === 0) return;

    // Load metadata in parallel with limited concurrency
    const BATCH_SIZE = 10;
    for (let i = 0; i < toLoad.length; i += BATCH_SIZE) {
      const batch = toLoad.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((id) => get().loadContinuationMetadata(id)));
    }
  },

  toggleBranchCollapse: (rootSessionId: string, branchNodeId: string) => {
    const state = get();
    const group = state.continuationGroups.get(rootSessionId);
    if (!group) return;

    const newCollapsed = new Set(group.collapsedBranchNodes);
    if (newCollapsed.has(branchNodeId)) {
      newCollapsed.delete(branchNodeId); // Expand
    } else {
      newCollapsed.add(branchNodeId); // Collapse
    }

    const updatedGroups = new Map(state.continuationGroups);
    updatedGroups.set(rootSessionId, {
      ...group,
      collapsedBranchNodes: newCollapsed,
    });
    set({ continuationGroups: updatedGroups });
  },

  expandPathToBranch: (rootSessionId: string, targetSessionId: string) => {
    const state = get();
    const group = state.continuationGroups.get(rootSessionId);
    if (!group || group.parentMap.size === 0) return;

    const newCollapsed = new Set(group.collapsedBranchNodes);

    // Walk up the parent chain, removing each ancestor from collapsed set
    let currentId: string | undefined = targetSessionId;
    while (currentId && group.parentMap.has(currentId)) {
      const parentId = group.parentMap.get(currentId);
      if (parentId) {
        newCollapsed.delete(parentId);
      }
      currentId = parentId;
    }

    const updatedGroups = new Map(state.continuationGroups);
    updatedGroups.set(rootSessionId, {
      ...group,
      collapsedBranchNodes: newCollapsed,
    });
    set({ continuationGroups: updatedGroups });
  },

  collapseAllBranches: (rootSessionId: string) => {
    const state = get();
    const group = state.continuationGroups.get(rootSessionId);
    if (!group || group.nodeMap.size === 0) return;

    // Find all branch nodes (nodes with children > 0)
    const branchNodes = new Set<string>();
    group.nodeMap.forEach((node, sessionId) => {
      if (node.children.length > 0) {
        branchNodes.add(sessionId);
      }
    });

    const updatedGroups = new Map(state.continuationGroups);
    updatedGroups.set(rootSessionId, {
      ...group,
      collapsedBranchNodes: branchNodes,
    });
    set({ continuationGroups: updatedGroups });
  },

  expandAllBranches: (rootSessionId: string) => {
    const state = get();
    const group = state.continuationGroups.get(rootSessionId);
    if (!group) return;

    const updatedGroups = new Map(state.continuationGroups);
    updatedGroups.set(rootSessionId, {
      ...group,
      collapsedBranchNodes: new Set<string>(),
    });
    set({ continuationGroups: updatedGroups });
  },

  // ==========================================================================
  // Chain Highlight Actions - SessionList Chain Visualization
  // ==========================================================================

  setChainHighlight: async (sessionId: string) => {
    const state = get();

    // First, ensure the chain is loaded
    const existingRootId = state.sessionToRootMap.get(sessionId);
    if (!existingRootId) {
      // Need to load the chain first
      await get().loadContinuations(sessionId);
    }

    // Re-get state after potential load
    const currentState = get();
    const rootId = currentState.sessionToRootMap.get(sessionId) || sessionId;
    const cachedGroup = currentState.continuationGroups.get(rootId);

    if (!cachedGroup) {
      logger.warn(`[ChainHighlight] No chain data found for session: ${sessionId}`);
      set({ highlightedSessionId: null, highlightedChainData: null });
      return;
    }

    // Pre-compute all highlight data for O(1) lookups
    const memberIds = new Set<string>(cachedGroup.memberIds);
    const positionMap = new Map<string, number>();
    const roleMap = new Map<string, ChainHighlightRole>();
    const distanceMap = new Map<string, number>();

    // Capture parentMap at top level for TypeScript null-safety in nested function
    const parentMap = cachedGroup.parentMap;

    // Build linear path from root to clicked session to determine positions
    const pathToClicked: string[] = [];
    let currentId: string | undefined = sessionId;

    // Walk up from clicked to root
    while (currentId) {
      pathToClicked.unshift(currentId);
      currentId = parentMap.get(currentId);
    }

    // Find clicked position in the active path (depth from root)
    const clickedDepth = pathToClicked.length - 1; // 0-indexed depth
    const clickedPosition = pathToClicked.indexOf(sessionId);

    // Now traverse the entire tree to assign positions and roles
    let globalPosition = 0;

    function traverseTree(node: ContinuationTreeNode, depth: number): void {
      const nodeSessionId = getSessionId(node.session);
      globalPosition++;
      positionMap.set(nodeSessionId, globalPosition);

      // Determine role relative to clicked session
      if (nodeSessionId === sessionId) {
        roleMap.set(nodeSessionId, 'clicked');
        distanceMap.set(nodeSessionId, 0);
      } else if (pathToClicked.includes(nodeSessionId)) {
        // It's an ancestor of clicked
        const ancestorIndex = pathToClicked.indexOf(nodeSessionId);
        roleMap.set(nodeSessionId, 'ancestor');
        distanceMap.set(nodeSessionId, ancestorIndex - clickedPosition); // Negative
      } else {
        // Check if this is a descendant of clicked
        let isDescendant = false;
        let checkId: string | undefined = nodeSessionId;
        let descendantDistance = 0;

        while (checkId) {
          descendantDistance++;
          checkId = parentMap.get(checkId);
          if (checkId === sessionId) {
            isDescendant = true;
            break;
          }
        }

        if (isDescendant) {
          roleMap.set(nodeSessionId, 'descendant');
          distanceMap.set(nodeSessionId, descendantDistance);
        } else {
          // Check if sibling (shares same parent as clicked)
          const clickedParent = parentMap.get(sessionId);
          const nodeParent = parentMap.get(nodeSessionId);
          if (clickedParent && clickedParent === nodeParent) {
            roleMap.set(nodeSessionId, 'sibling');
            distanceMap.set(nodeSessionId, 0);
          } else {
            // It's somewhere else in the tree - treat as sibling for now
            roleMap.set(nodeSessionId, 'sibling');
            distanceMap.set(nodeSessionId, depth - clickedDepth);
          }
        }
      }

      // Recurse to children
      for (const child of node.children) {
        traverseTree(child, depth + 1);
      }
    }

    // Start traversal from tree root
    if (cachedGroup.tree) {
      traverseTree(cachedGroup.tree, 0);
    }

    const highlightData: ChainHighlightData = {
      rootId,
      clickedSessionId: sessionId,
      memberIds,
      positionMap,
      roleMap,
      distanceMap,
      totalCount: memberIds.size,
    };

    set({
      highlightedSessionId: sessionId,
      highlightedChainData: highlightData,
    });
  },

  clearChainHighlight: () => {
    set({
      highlightedSessionId: null,
      highlightedChainData: null,
    });
  },

  isChainHighlightActive: () => {
    return get().highlightedSessionId !== null;
  },

  getChainHighlightInfo: (sessionId: string): ChainHighlightInfo | null => {
    const state = get();
    const { highlightedChainData } = state;

    if (!highlightedChainData) {
      return null;
    }

    if (!highlightedChainData.memberIds.has(sessionId)) {
      return null;
    }

    const role = highlightedChainData.roleMap.get(sessionId) || 'sibling';
    const position = highlightedChainData.positionMap.get(sessionId) ?? 0;
    const distance = highlightedChainData.distanceMap.get(sessionId) ?? 0;
    const isRoot = sessionId === highlightedChainData.rootId;

    return {
      role,
      position,
      total: highlightedChainData.totalCount,
      distance,
      isRoot,
    };
  },
}));

// ============================================================================
// Selectors for optimized component subscriptions
// ============================================================================

/**
 * Selector for the expanded groups set.
 * @param state - Continuation store state
 * @returns Set of expanded session IDs
 */
export const selectExpandedGroups = (state: ContinuationStore): Set<string> => state.expandedGroups;

/**
 * Selector for checking if a specific session group is expanded.
 * @param sessionId - ID of the session to check
 * @returns Selector function
 */
export const selectIsExpanded =
  (sessionId: string) =>
  (state: ContinuationStore): boolean =>
    state.expandedGroups.has(sessionId);

/**
 * Selector factory for getting continuation group for a session.
 * Converts internal CachedContinuationGroup to UI-facing ContinuationGroup.
 * @param sessionId - ID of the session
 * @returns Selector function
 */
export const selectContinuationGroup =
  (sessionId: string) =>
  (state: ContinuationStore): ContinuationGroup | null => {
    // Find the root ID for this session (handles both parent and child IDs)
    const rootId = state.sessionToRootMap.get(sessionId) || sessionId;
    const cachedGroup = state.continuationGroups.get(rootId);

    if (!cachedGroup || !cachedGroup.rootSession) {
      return null;
    }

    // Convert internal CachedContinuationGroup to UI-facing ContinuationGroup
    return {
      rootSession: cachedGroup.rootSession,
      continuations: cachedGroup.continuations,
      isExpanded: state.expandedGroups.has(rootId),
      totalCount: 1 + cachedGroup.continuations.length,
    };
  };

/**
 * Selector for continuation statistics.
 * @param state - Continuation store state
 * @returns Continuation stats or null
 */
export const selectStats = (state: ContinuationStore): ContinuationStats | null => state.stats;

/**
 * Selector for error state.
 * @param state - Continuation store state
 * @returns Error message or null
 */
export const selectError = (state: ContinuationStore): string | null => state.error;

/**
 * Selector for loading state of stats.
 * @param state - Continuation store state
 * @returns Whether stats are loading
 */
export const selectIsLoadingStats = (state: ContinuationStore): boolean => state.isLoadingStats;

/**
 * Selector for global loading state.
 * @param state - Continuation store state
 * @returns Whether any continuation data is loading
 */
export const selectIsLoading = (state: ContinuationStore): boolean => state.isLoading;

/**
 * Selector for the number of loaded continuation groups.
 * @param state - Continuation store state
 * @returns Number of cached groups
 */
export const selectGroupCount = (state: ContinuationStore): number => state.continuationGroups.size;

/**
 * Selector for the number of expanded groups.
 * @param state - Continuation store state
 * @returns Number of expanded groups
 */
export const selectExpandedCount = (state: ContinuationStore): number => state.expandedGroups.size;

/**
 * Selector factory for checking if a specific session is part of a chain.
 * Returns a memoizable selector function.
 *
 * @param sessionId - The session ID to check
 * @returns Selector function
 *
 * @example
 * ```tsx
 * const isInChain = useContinuationStore(selectIsPartOfChain(session.id));
 * ```
 */
export const selectIsPartOfChain =
  (sessionId: string) =>
  (state: ContinuationStore): boolean =>
    state.sessionToRootMap.has(sessionId) || state.continuationGroups.has(sessionId);

/**
 * Selector for getting all expanded group IDs.
 * @param state - Continuation store state
 * @returns Array of expanded root session IDs
 */
export const selectExpandedGroupIds = (state: ContinuationStore): string[] =>
  Array.from(state.expandedGroups);

/**
 * Selector for getting all loaded group root IDs.
 * @param state - Continuation store state
 * @returns Array of all loaded root session IDs
 */
export const selectAllGroupIds = (state: ContinuationStore): string[] =>
  Array.from(state.continuationGroups.keys());

/**
 * Selector for the session-to-root mapping.
 * Useful for bulk operations that need to resolve child IDs to root IDs.
 * @param state - Continuation store state
 * @returns Map of session ID to root session ID
 */
export const selectSessionToRootMap = (state: ContinuationStore): Map<string, string> =>
  state.sessionToRootMap;

/**
 * Selector factory for checking if a specific session's chain is loading.
 * @param sessionId - The session ID to check
 * @returns Selector function
 */
export const selectIsGroupLoading =
  (sessionId: string) =>
  (state: ContinuationStore): boolean => {
    const rootId = state.sessionToRootMap.get(sessionId) || sessionId;
    const group = state.continuationGroups.get(rootId);
    return group?.isLoading ?? false;
  };

/**
 * Selector factory for getting the internal cached group (for advanced use cases).
 * Most components should use selectContinuationGroup instead.
 * @param sessionId - The session ID
 * @returns Selector function
 */
export const selectCachedGroup =
  (sessionId: string) =>
  (state: ContinuationStore): CachedContinuationGroup | null => {
    const rootId = state.sessionToRootMap.get(sessionId) || sessionId;
    return state.continuationGroups.get(rootId) || null;
  };

// =============================================================================
// Tree-Based Selectors - Hybrid Continuation Chain System
// =============================================================================

/**
 * Get the linear path from root to a specified session.
 * Walks up the tree from target session to root, then reverses to get path.
 *
 * @param rootId - The root session ID of the chain
 * @param targetSessionId - The session ID to get path to
 * @returns Selector function that returns ContinuationPath or null
 *
 * @example
 * ```tsx
 * const path = useContinuationStore(selectLinearPath(rootId, selectedSessionId));
 * if (path) {
 *   console.log(`Path length: ${path.length}, active: ${path.isActivePath}`);
 * }
 * ```
 */
export const selectLinearPath =
  (rootId: string, targetSessionId: string) =>
  (state: ContinuationStore): ContinuationPath | null => {
    const cachedGroup = state.continuationGroups.get(rootId);
    if (!cachedGroup || !cachedGroup.tree || cachedGroup.nodeMap.size === 0) {
      return null;
    }

    const { nodeMap } = cachedGroup;
    const targetNode = nodeMap.get(targetSessionId);

    if (!targetNode) {
      return null;
    }

    // Walk up from target to root, collecting nodes
    const pathNodes: ContinuationTreeNode[] = [];
    const sessionIds: string[] = [];
    const branchPoints: ContinuationBranchInfo[] = [];

    let currentNode: ContinuationTreeNode | null = targetNode;
    let isActivePath = true;

    while (currentNode) {
      pathNodes.unshift(currentNode);
      const currentSessionId = currentNode.session.session_id || currentNode.session.id || '';
      sessionIds.unshift(currentSessionId);

      // Track if we're on active path
      if (!currentNode.isActivePath) {
        isActivePath = false;
      }

      // Check for branch point (sibling count > 1 means this node has siblings)
      if (currentNode.siblingCount > 1 && currentNode.parentSessionId) {
        const parentNode = nodeMap.get(currentNode.parentSessionId);
        if (parentNode) {
          branchPoints.unshift({
            branchPointId: currentNode.parentSessionId,
            branchCount: currentNode.siblingCount,
            siblingIds: parentNode.children.map(
              (child) => child.session.session_id || child.session.id || ''
            ),
            depth: parentNode.depth,
          });
        }
      }

      // Move to parent
      if (currentNode.parentSessionId) {
        currentNode = nodeMap.get(currentNode.parentSessionId) || null;
      } else {
        currentNode = null;
      }
    }

    return {
      sessionIds,
      nodes: pathNodes,
      length: pathNodes.length,
      isActivePath,
      branchPoints,
    };
  };

/**
 * Check if a continuation chain has branches.
 * Uses the cached hasBranches flag from backend for O(1) lookup.
 *
 * @param rootId - The root session ID of the chain
 * @returns Selector function that returns boolean
 *
 * @example
 * ```tsx
 * const hasBranches = useContinuationStore(selectHasBranches(rootId));
 * if (hasBranches) {
 *   // Show tree view instead of linear list
 * }
 * ```
 */
export const selectHasBranches =
  (rootId: string) =>
  (state: ContinuationStore): boolean => {
    const cachedGroup = state.continuationGroups.get(rootId);
    return cachedGroup?.hasBranches ?? false;
  };

/**
 * Get branch information for a specific session.
 * Returns information about the session's siblings and branch point.
 *
 * @param rootId - The root session ID of the chain
 * @param sessionId - The session ID to get branch info for
 * @returns Selector function that returns ContinuationBranchInfo or null
 *
 * @example
 * ```tsx
 * const branchInfo = useContinuationStore(selectBranchInfo(rootId, sessionId));
 * if (branchInfo && branchInfo.branchCount > 1) {
 *   console.log(`Session has ${branchInfo.branchCount - 1} siblings`);
 * }
 * ```
 */
export const selectBranchInfo =
  (rootId: string, sessionId: string) =>
  (state: ContinuationStore): ContinuationBranchInfo | null => {
    const cachedGroup = state.continuationGroups.get(rootId);
    if (!cachedGroup || cachedGroup.nodeMap.size === 0) {
      return null;
    }

    const { nodeMap } = cachedGroup;
    const node = nodeMap.get(sessionId);

    if (!node) {
      return null;
    }

    // If this node has no siblings (siblingCount === 1), no branch info
    if (node.siblingCount <= 1) {
      return null;
    }

    // Get parent node to find siblings
    const parentId = node.parentSessionId;
    if (!parentId) {
      return null;
    }

    const parentNode = nodeMap.get(parentId);
    if (!parentNode) {
      return null;
    }

    const siblingIds = parentNode.children.map(
      (child) => child.session.session_id || child.session.id || ''
    );

    return {
      branchPointId: parentId,
      branchCount: node.siblingCount,
      siblingIds,
      depth: parentNode.depth,
    };
  };

/**
 * Get the full tree structure for a continuation chain.
 * Returns the root ContinuationTreeNode with all children populated.
 *
 * @param rootId - The root session ID of the chain
 * @returns Selector function that returns ContinuationTreeNode or null
 *
 * @example
 * ```tsx
 * const tree = useContinuationStore(selectTreeStructure(rootId));
 * if (tree) {
 *   // Recursively render tree
 *   return <TreeView node={tree} />;
 * }
 * ```
 */
export const selectTreeStructure =
  (rootId: string) =>
  (state: ContinuationStore): ContinuationTreeNode | null => {
    const cachedGroup = state.continuationGroups.get(rootId);
    return cachedGroup?.tree ?? null;
  };

/**
 * Get the parent session ID for a given session.
 * Uses the parentMap for O(1) lookup.
 *
 * @param rootId - The root session ID of the chain
 * @param sessionId - The session ID to get parent for
 * @returns Selector function that returns parent session ID or null
 *
 * @example
 * ```tsx
 * const parentId = useContinuationStore(selectParentSessionId(rootId, sessionId));
 * if (parentId) {
 *   // Navigate to parent session
 * }
 * ```
 */
export const selectParentSessionId =
  (rootId: string, sessionId: string) =>
  (state: ContinuationStore): string | null => {
    const cachedGroup = state.continuationGroups.get(rootId);
    if (!cachedGroup || cachedGroup.parentMap.size === 0) {
      return null;
    }

    return cachedGroup.parentMap.get(sessionId) ?? null;
  };

/**
 * Get a specific tree node by session ID.
 * Uses the nodeMap for O(1) lookup.
 *
 * @param rootId - The root session ID of the chain
 * @param sessionId - The session ID to get node for
 * @returns Selector function that returns ContinuationTreeNode or null
 *
 * @example
 * ```tsx
 * const node = useContinuationStore(selectTreeNode(rootId, sessionId));
 * if (node) {
 *   console.log(`Depth: ${node.depth}, Children: ${node.children.length}`);
 * }
 * ```
 */
export const selectTreeNode =
  (rootId: string, sessionId: string) =>
  (state: ContinuationStore): ContinuationTreeNode | null => {
    const cachedGroup = state.continuationGroups.get(rootId);
    if (!cachedGroup || cachedGroup.nodeMap.size === 0) {
      return null;
    }

    return cachedGroup.nodeMap.get(sessionId) ?? null;
  };

/**
 * Get the flat descendants array for a chain.
 * Useful for linear iteration over all descendants.
 *
 * @param rootId - The root session ID of the chain
 * @returns Selector function that returns ContinuationDescendant array
 *
 * @example
 * ```tsx
 * const descendants = useContinuationStore(selectFlatDescendants(rootId));
 * descendants.forEach(desc => {
 *   console.log(`${desc.session.session_id} -> parent: ${desc.parentSessionId}`);
 * });
 * ```
 */
export const selectFlatDescendants =
  (rootId: string) =>
  (state: ContinuationStore): ContinuationDescendant[] => {
    const cachedGroup = state.continuationGroups.get(rootId);
    return cachedGroup?.flatDescendants ?? [];
  };

/**
 * Get all branch points in a continuation chain.
 * Returns information about every point where the chain branches.
 *
 * @param rootId - The root session ID of the chain
 * @returns Selector function that returns array of ContinuationBranchInfo
 *
 * @example
 * ```tsx
 * const branchPoints = useContinuationStore(selectAllBranchPoints(rootId));
 * branchPoints.forEach(bp => {
 *   console.log(`Branch at depth ${bp.depth} with ${bp.branchCount} branches`);
 * });
 * ```
 */
export const selectAllBranchPoints =
  (rootId: string) =>
  (state: ContinuationStore): ContinuationBranchInfo[] => {
    const cachedGroup = state.continuationGroups.get(rootId);
    if (!cachedGroup || !cachedGroup.tree || cachedGroup.nodeMap.size === 0) {
      return [];
    }

    const branchPoints: ContinuationBranchInfo[] = [];

    // Traverse tree to find all branch points
    function findBranchPoints(node: ContinuationTreeNode): void {
      if (node.children.length > 1) {
        const sessionId = node.session.session_id || node.session.id || '';
        branchPoints.push({
          branchPointId: sessionId,
          branchCount: node.children.length,
          siblingIds: node.children.map(
            (child) => child.session.session_id || child.session.id || ''
          ),
          depth: node.depth,
        });
      }

      for (const child of node.children) {
        findBranchPoints(child);
      }
    }

    findBranchPoints(cachedGroup.tree);
    return branchPoints;
  };

/**
 * Check if a branch node is collapsed.
 * O(1) via Set.has().
 */
export const selectIsBranchCollapsed =
  (rootSessionId: string, branchNodeId: string) =>
  (state: ContinuationStore): boolean => {
    const group = state.continuationGroups.get(rootSessionId);
    if (!group) return false; // Default to expanded
    return group.collapsedBranchNodes.has(branchNodeId);
  };

/**
 * Get the Set of collapsed branch nodes for a chain.
 */
export const selectCollapsedBranches =
  (rootSessionId: string) =>
  (state: ContinuationStore): Set<string> => {
    const group = state.continuationGroups.get(rootSessionId);
    return group?.collapsedBranchNodes ?? new Set();
  };

/**
 * Get the Set of session IDs that form the path from root to active session.
 * Pre-computed for O(1) lookup instead of O(n) traversal per node.
 * Walk UP from active to root once = O(depth), not O(n²)
 */
export const selectActivePathSet =
  (rootSessionId: string, activeSessionId: string) =>
  (state: ContinuationStore): Set<string> => {
    const cachedGroup = state.continuationGroups.get(rootSessionId);
    if (!cachedGroup?.parentMap || !activeSessionId) return new Set();

    const pathSet = new Set<string>();
    let currentId: string | undefined = activeSessionId;

    // Walk up the parent chain
    while (currentId) {
      pathSet.add(currentId);
      currentId = cachedGroup.parentMap.get(currentId);
    }

    return pathSet;
  };

// =============================================================================
// Chain Highlight Selectors - SessionList Chain Visualization
// =============================================================================

/**
 * Check if chain highlight is currently active.
 * @param state - Continuation store state
 * @returns Whether any chain is highlighted
 */
export const selectIsChainHighlightActive = (state: ContinuationStore): boolean =>
  state.highlightedSessionId !== null;

/**
 * Get the highlighted session ID.
 * @param state - Continuation store state
 * @returns The session ID that was clicked, or null
 */
export const selectHighlightedSessionId = (state: ContinuationStore): string | null =>
  state.highlightedSessionId;

/**
 * Get the full highlight data object.
 * @param state - Continuation store state
 * @returns ChainHighlightData or null
 */
export const selectHighlightedChainData = (state: ContinuationStore): ChainHighlightData | null =>
  state.highlightedChainData;

/**
 * Selector factory for getting chain highlight info for a specific session.
 * Returns highlight info if session is in highlighted chain, null otherwise.
 * O(1) lookup via pre-computed Maps.
 *
 * @param sessionId - The session ID to check
 * @returns Selector function that returns ChainHighlightInfo or null
 *
 * @example
 * ```tsx
 * const highlightInfo = useContinuationStore(selectChainHighlightInfo(sessionId));
 * if (highlightInfo) {
 *   // Session is in highlighted chain
 *   console.log(`Role: ${highlightInfo.role}, Position: ${highlightInfo.position}/${highlightInfo.total}`);
 * }
 * ```
 */
export const selectChainHighlightInfo =
  (sessionId: string) =>
  (state: ContinuationStore): ChainHighlightInfo | null => {
    const { highlightedChainData } = state;

    if (!highlightedChainData) {
      return null;
    }

    if (!highlightedChainData.memberIds.has(sessionId)) {
      return null;
    }

    const role = highlightedChainData.roleMap.get(sessionId) || 'sibling';
    const position = highlightedChainData.positionMap.get(sessionId) ?? 0;
    const distance = highlightedChainData.distanceMap.get(sessionId) ?? 0;
    const isRoot = sessionId === highlightedChainData.rootId;

    return {
      role,
      position,
      total: highlightedChainData.totalCount,
      distance,
      isRoot,
    };
  };

/**
 * Check if a session is part of the currently highlighted chain.
 * O(1) lookup via Set.has().
 *
 * @param sessionId - The session ID to check
 * @returns Selector function that returns boolean
 */
export const selectIsInHighlightedChain =
  (sessionId: string) =>
  (state: ContinuationStore): boolean => {
    const { highlightedChainData } = state;
    if (!highlightedChainData) return false;
    return highlightedChainData.memberIds.has(sessionId);
  };

/**
 * Get the role of a session in the highlighted chain.
 * Returns null if session is not in highlighted chain.
 *
 * @param sessionId - The session ID to check
 * @returns Selector function that returns ChainHighlightRole or null
 */
export const selectChainHighlightRole =
  (sessionId: string) =>
  (state: ContinuationStore): ChainHighlightRole | null => {
    const { highlightedChainData } = state;
    if (!highlightedChainData) return null;
    if (!highlightedChainData.memberIds.has(sessionId)) return null;
    return highlightedChainData.roleMap.get(sessionId) || null;
  };
