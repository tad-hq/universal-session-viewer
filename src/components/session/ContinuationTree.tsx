// ContinuationTree Component - Session Continuation Feature
//
// Purpose: Display a hierarchical tree visualization of branching continuation chains.
// Unlike ContinuationTimeline which shows a linear list, this component renders
// the full tree structure with branching paths and proper visual connectors.
//
// Design Requirements:
// - Recursive tree rendering with proper indentation
// - Branch connectors showing parent-child relationships
// - Active node highlighting with filled circle indicator
// - Inactive/alternate path nodes with hollow circle
// - Branch indicators when a node has multiple children
// - Compact spacing suitable for sidebar display
//
// WCAG 2.1 AA Accessibility (Full Compliance):
// - Navigation role with aria-label for tree container
// - Tree and treeitem roles for semantic structure
// - aria-level for depth indication
// - aria-expanded for collapsible nodes (if children exist)
// - aria-selected for active node
// - aria-setsize and aria-posinset for sibling position
// - aria-current for active item
// - Full keyboard navigation (Arrow keys, Enter, Space, Home, End)
// - Focus management with visible focus rings
// - Screen reader announcements via aria-live region

import { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';

import { Circle, GitBranch, CheckCircle, ChevronRight, ChevronDown } from 'lucide-react';

import {
  useContinuationStore,
  selectCollapsedBranches,
  selectActivePathSet,
} from '../../stores/continuationStore';
import { cn, formatTimeAgo, extractShortTitle } from '../../utils';

import type { ContinuationTreeNode } from '../../types';

/** Maximum depth for visual indentation. Nodes beyond this depth remain flat with depth badges. */
const MAX_INDENT_DEPTH = 5;

// =============================================================================
// Types
// =============================================================================

export interface ContinuationTreeProps {
  /** Root node of the tree structure */
  rootNode: ContinuationTreeNode;
  /** ID of the currently active/selected session */
  activeSessionId: string;
  /** Callback when a node is selected */
  onSelectNode: (sessionId: string) => void;
  /** Optional className for custom styling */
  className?: string;
}

interface TreeNodeProps {
  /** The tree node to render */
  node: ContinuationTreeNode;
  /** ID of the currently active/selected session */
  activeSessionId: string;
  /** Callback when a node is selected */
  onSelectNode: (sessionId: string) => void;
  /** Depth level for indentation (0 = root) */
  depth?: number;
  /** Whether this is the last sibling in its parent */
  isLastSibling?: boolean;
  /** ID of the currently focused node (for keyboard navigation) */
  focusedId: string | null;
  /** Callback to update focused node */
  onFocusChange: (sessionId: string | null) => void;
  /** Position among siblings (1-indexed for ARIA) */
  positionInSet: number;
  /** Total number of siblings at this level */
  setSize: number;
  /** Set of collapsed branch node IDs */
  collapsedBranches: Set<string>;
  /** Callback to toggle collapse state */
  onToggleBranchCollapse: (nodeId: string) => void;
  /** Pre-computed set of session IDs on the active path (for O(1) lookup) */
  activePathSet: Set<string>;
}

interface TreeNodeContentProps {
  /** The tree node data */
  node: ContinuationTreeNode;
  /** Whether this node is the active/selected one */
  isActive: boolean;
  /** Whether this node is on the active path (ancestor of active node) */
  isOnActivePath: boolean;
  /** Click handler for selection */
  onClick: () => void;
  /** Whether this node currently has keyboard focus */
  isFocused: boolean;
  /** Session ID for data attribute (focus targeting) */
  sessionId: string;
  /** Depth level for depth badge display */
  depth: number;
  /** Whether this node has children */
  hasChildren: boolean;
  /** Whether this node's children are collapsed */
  isCollapsed: boolean;
  /** Callback to toggle collapse state */
  onToggleBranchCollapse: (nodeId: string) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get session ID from a session object, handling dual ID fields.
 * IMPORTANT: Must match order used elsewhere (session_id first, then id)
 */
function getSessionId(session: ContinuationTreeNode['session']): string {
  return session.session_id || session.id || '';
}

/**
 * Count all descendants of a tree node recursively.
 */
function countDescendants(node: ContinuationTreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
}

/**
 * Flatten a tree structure into a sequential array for keyboard navigation.
 * Uses depth-first traversal to maintain visual order.
 *
 * WCAG Keyboard Navigation:
 * This flat list enables Up/Down arrow navigation through the tree
 * in the same order nodes appear visually on screen.
 */
function flattenTree(node: ContinuationTreeNode): ContinuationTreeNode[] {
  const result: ContinuationTreeNode[] = [node];
  for (const child of node.children) {
    result.push(...flattenTree(child));
  }
  return result;
}

/**
 * Find the parent node of a given node in the tree.
 * Returns null if the node is the root or not found.
 */
function findParentNode(root: ContinuationTreeNode, targetId: string): ContinuationTreeNode | null {
  function search(node: ContinuationTreeNode): ContinuationTreeNode | null {
    for (const child of node.children) {
      const childId = getSessionId(child.session);
      if (childId === targetId) {
        return node;
      }
      const found = search(child);
      if (found) return found;
    }
    return null;
  }
  return search(root);
}

/**
 * Find a node by its session ID in the tree.
 */
function findNodeById(root: ContinuationTreeNode, targetId: string): ContinuationTreeNode | null {
  const rootId = getSessionId(root.session);
  if (rootId === targetId) return root;

  for (const child of root.children) {
    const found = findNodeById(child, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * Extract display title from session data.
 * Falls back through title -> summary -> session ID prefix
 */
function getDisplayTitle(session: ContinuationTreeNode['session']): string {
  if (session.title || session.summary) {
    return extractShortTitle(session.title || session.summary);
  }
  const sessionId = getSessionId(session);
  return sessionId ? `Session ${sessionId.slice(0, 8)}...` : 'Untitled Session';
}

/**
 * Get time ago string from session timestamps.
 * Checks multiple timestamp fields in priority order.
 */
function getTimeAgo(session: ContinuationTreeNode['session']): string {
  let date: Date | null = null;

  if (
    session.last_message_time !== undefined &&
    session.last_message_time !== null &&
    session.last_message_time !== ''
  ) {
    date = new Date(session.last_message_time);
  } else if (session.analysis_timestamp !== undefined && session.analysis_timestamp !== null) {
    // analysis_timestamp is in seconds, not milliseconds
    date = new Date(session.analysis_timestamp * 1000);
  } else if (session.modified !== undefined && session.modified !== null) {
    date = new Date(session.modified);
  }

  return date ? formatTimeAgo(date) : '';
}

// =============================================================================
// TreeNodeContent Component
// =============================================================================

/**
 * TreeNodeContent - Renders the clickable content of a single tree node.
 * Displays the node indicator, title, and timestamp.
 *
 * WCAG 2.1 AA:
 * - data-session-id for programmatic focus targeting
 * - tabIndex managed for roving tabindex pattern
 * - aria-label with comprehensive context for screen readers
 * - Visual focus indicator via ring styles
 */
const TreeNodeContent = memo(function TreeNodeContent({
  node,
  isActive,
  isOnActivePath,
  onClick,
  isFocused,
  sessionId,
  depth,
  hasChildren,
  isCollapsed,
  onToggleBranchCollapse,
}: TreeNodeContentProps) {
  const session = node.session;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const title = useMemo(() => getDisplayTitle(session), [session]);
  const timeAgo = useMemo(() => getTimeAgo(session), [session]);
  const hasBranches = node.children.length > 1;

  // Focus the button when this node becomes focused via keyboard
  useEffect(() => {
    if (isFocused && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [isFocused]);

  // WCAG 2.1 AA: Comprehensive accessible label for screen readers
  const accessibleLabel = useMemo(() => {
    const parts = [
      title,
      timeAgo,
      isActive ? 'currently viewing' : 'press Enter to view',
      hasChildren
        ? `has ${node.children.length} continuation${node.children.length > 1 ? 's' : ''}`
        : null,
      hasBranches ? 'branch point' : null,
      depth > MAX_INDENT_DEPTH ? `level ${depth}` : null,
    ].filter(Boolean);
    return parts.join(', ');
  }, [title, timeAgo, isActive, hasChildren, hasBranches, node.children.length, depth]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      data-session-id={sessionId}
      tabIndex={isFocused ? 0 : -1}
      aria-current={isActive ? 'step' : undefined}
      aria-label={accessibleLabel}
      aria-expanded={hasChildren ? !isCollapsed : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
        // Interactive states
        'transition-colors duration-150',
        'hover:bg-accent/50',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        // Active state styling
        isActive && 'bg-accent',
        // On active path but not active: subtle highlight
        isOnActivePath && !isActive && 'bg-accent/30'
      )}
    >
      {/* Collapse/Expand toggle for nodes with children */}
      {hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBranchCollapse(sessionId);
          }}
          className="shrink-0 rounded p-0.5 transition-colors hover:bg-accent"
          aria-label={isCollapsed ? 'Expand branch' : 'Collapse branch'}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight className="size-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 text-muted-foreground" />
          )}
        </button>
      )}

      {/* Hidden children count badge when collapsed */}
      {isCollapsed && hasChildren && (
        <span
          className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary"
          aria-label={`${countDescendants(node)} hidden sessions`}
        >
          +{countDescendants(node)}
        </span>
      )}

      {/* Node indicator circle */}
      <div
        className={cn(
          'relative flex size-5 shrink-0 items-center justify-center rounded-full',
          isActive
            ? 'bg-primary text-primary-foreground'
            : isOnActivePath
              ? 'bg-primary/30 text-primary'
              : 'bg-muted text-muted-foreground'
        )}
        aria-hidden="true"
      >
        {isActive ? (
          <CheckCircle className="size-3.5" />
        ) : isOnActivePath ? (
          <Circle className="size-3 fill-current" />
        ) : (
          <Circle className="size-3" />
        )}
      </div>

      {/* Depth indicator badge (shown when beyond indent cap) */}
      {depth > MAX_INDENT_DEPTH && (
        <span
          className="shrink-0 rounded bg-muted/70 px-1 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
          aria-hidden="true"
        >
          [{depth}]
        </span>
      )}

      {/* Session info */}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate text-xs font-medium',
            isActive ? 'text-foreground' : 'text-muted-foreground'
          )}
          aria-hidden="true"
        >
          {title}
        </div>
        {timeAgo && (
          <div className="text-[10px] text-muted-foreground/70" aria-hidden="true">
            {timeAgo}
          </div>
        )}
      </div>

      {/* Branch indicator */}
      {hasBranches && (
        <div
          className="flex shrink-0 items-center gap-0.5 rounded bg-muted/50 px-1 py-0.5 text-[10px] font-medium text-muted-foreground"
          aria-hidden="true"
        >
          <GitBranch className="size-2.5" />
          {node.children.length}
        </div>
      )}

      {/* Active indicator badge */}
      {isActive && (
        <div
          className="shrink-0 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600"
          aria-hidden="true"
        >
          Active
        </div>
      )}
    </button>
  );
});

// =============================================================================
// TreeNode Component
// =============================================================================

/**
 * TreeNode - Recursive component that renders a node and all its children.
 * Handles proper indentation, connecting lines, and branch rendering.
 *
 * WCAG 2.1 AA:
 * - role="treeitem" with proper aria-level
 * - aria-setsize and aria-posinset for sibling position
 * - aria-expanded for nodes with children
 * - aria-selected for active node
 * - Passes focus state to content for roving tabindex
 */
const TreeNode = memo(function TreeNode({
  node,
  activeSessionId,
  onSelectNode,
  depth = 0,
  isLastSibling = true,
  focusedId,
  onFocusChange,
  positionInSet,
  setSize,
  collapsedBranches,
  onToggleBranchCollapse,
  activePathSet,
}: TreeNodeProps) {
  const sessionId = getSessionId(node.session);
  const isActive = sessionId === activeSessionId;
  const isFocused = sessionId === focusedId;
  const hasChildren = node.children.length > 0;
  const isCollapsed = hasChildren && collapsedBranches.has(sessionId);

  // O(1) lookup using pre-computed path set
  const isOnActivePath = isActive || activePathSet.has(sessionId);

  const handleSelect = useCallback(() => {
    onSelectNode(sessionId);
  }, [onSelectNode, sessionId]);

  // Handle focus when clicking (ensures focusedId stays in sync)
  const handleClick = useCallback(() => {
    onFocusChange(sessionId);
    handleSelect();
  }, [onFocusChange, sessionId, handleSelect]);

  return (
    <li
      role="treeitem"
      aria-level={depth + 1}
      aria-setsize={setSize}
      aria-posinset={positionInSet}
      aria-expanded={hasChildren ? !isCollapsed : undefined}
      aria-selected={isActive ? true : undefined}
      className={cn(
        'relative',
        // Indentation and left border for nested items
        depth > 0 && depth <= MAX_INDENT_DEPTH && 'ml-4'
      )}
    >
      {/* Vertical connecting line from parent - capped at MAX_INDENT_DEPTH */}
      {depth > 0 && depth <= MAX_INDENT_DEPTH && (
        <div
          className={cn(
            'absolute left-0 top-0 h-4 w-0.5',
            isOnActivePath ? 'bg-primary/30' : 'bg-border'
          )}
          style={{ marginLeft: '-1px' }}
          aria-hidden="true"
        />
      )}

      {/* Horizontal connecting line to this node - capped at MAX_INDENT_DEPTH */}
      {depth > 0 && depth <= MAX_INDENT_DEPTH && (
        <div
          className={cn(
            'absolute left-0 top-4 h-0.5 w-3',
            isOnActivePath ? 'bg-primary/30' : 'bg-border'
          )}
          style={{ marginLeft: '-1px' }}
          aria-hidden="true"
        />
      )}

      {/* Content wrapper with left border for children - capped at MAX_INDENT_DEPTH */}
      <div
        className={cn(
          depth > 0 && depth <= MAX_INDENT_DEPTH && 'pl-3',
          depth > 0 && depth <= MAX_INDENT_DEPTH && !isLastSibling && 'border-l border-border'
        )}
      >
        <TreeNodeContent
          node={node}
          isActive={isActive}
          isOnActivePath={isOnActivePath}
          onClick={handleClick}
          isFocused={isFocused}
          sessionId={sessionId}
          depth={depth}
          hasChildren={hasChildren}
          isCollapsed={isCollapsed}
          onToggleBranchCollapse={onToggleBranchCollapse}
        />

        {/* Render children recursively */}
        {hasChildren && !isCollapsed && (
          <ol role="group" className="mt-0.5 space-y-0.5">
            {node.children.map((child, index) => (
              <TreeNode
                key={getSessionId(child.session)}
                node={child}
                activeSessionId={activeSessionId}
                onSelectNode={onSelectNode}
                depth={depth + 1}
                isLastSibling={index === node.children.length - 1}
                focusedId={focusedId}
                onFocusChange={onFocusChange}
                positionInSet={index + 1}
                setSize={node.children.length}
                collapsedBranches={collapsedBranches}
                onToggleBranchCollapse={onToggleBranchCollapse}
                activePathSet={activePathSet}
              />
            ))}
          </ol>
        )}
      </div>
    </li>
  );
});

// =============================================================================
// ContinuationTree Component
// =============================================================================

/**
 * ContinuationTree Component
 *
 * Displays a hierarchical tree visualization of session continuation chains
 * with branching support. Unlike the linear ContinuationTimeline, this component
 * shows the full tree structure with proper visual connectors and branch indicators.
 *
 * Visual Design:
 * ```
 * [*] Session A (root)
 *  |
 *  +--[*] Session B
 *  |   |
 *  |   +--[o] Session C -------- [Active]
 *  |   |   |
 *  |   |   +--[ ] Session E
 *  |   |
 *  |   +--[ ] Session D (alternate path)
 *  |
 *  +--[ ] Session F
 * ```
 *
 * Legend:
 * - [*] = On active path (filled circle)
 * - [o] = Currently active/selected (checkmark)
 * - [ ] = Inactive/alternate path (hollow circle)
 *
 * WCAG 2.1 AA Accessibility (Full Compliance):
 * - Uses nav element with descriptive aria-label
 * - Tree role for hierarchical structure
 * - Treeitem role with aria-level for depth
 * - aria-setsize and aria-posinset for sibling position
 * - aria-expanded for nodes with children
 * - aria-selected for active node
 * - aria-current for the currently active step
 * - aria-live region for screen reader announcements
 * - Roving tabindex pattern for focus management
 * - Visible focus rings meeting color contrast requirements
 *
 * Keyboard Navigation:
 * - ArrowUp: Move to previous node in visual order
 * - ArrowDown: Move to next node in visual order
 * - ArrowLeft: Collapse if expanded with children, otherwise go to parent node
 * - ArrowRight: Expand if collapsed with children, otherwise go to first child node
 * - Enter/Space: Select/activate the focused node
 * - Home: Go to first node in tree
 * - End: Go to last node in tree
 *
 * Performance:
 * - React.memo on all components
 * - useMemo for expensive computations
 * - useCallback for stable callback references
 * - Efficient recursive rendering
 */
function ContinuationTreeComponent({
  rootNode,
  activeSessionId,
  onSelectNode,
  className,
}: ContinuationTreeProps) {
  // Focus state for keyboard navigation
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const treeRef = useRef<HTMLOListElement>(null);

  // Announcement for screen readers
  const [announcement, setAnnouncement] = useState<string>('');

  // Get root session ID and collapse state from store
  const rootSessionId = rootNode.session.session_id || rootNode.session.id || '';
  const toggleBranchCollapse = useContinuationStore((state) => state.toggleBranchCollapse);
  const collapsedBranches = useContinuationStore(
    useCallback((state) => selectCollapsedBranches(rootSessionId)(state), [rootSessionId])
  );

  // Pre-compute active path once for O(1) lookups
  const activePathSet = useContinuationStore(
    useCallback(
      (state) => selectActivePathSet(rootSessionId, activeSessionId)(state),
      [rootSessionId, activeSessionId]
    )
  );

  // Build flat list for keyboard navigation (depth-first order matches visual)
  const flatNodes = useMemo(() => flattenTree(rootNode), [rootNode]);

  // Count total nodes for accessible label
  const totalCount = flatNodes.length;

  // WCAG 2.1 AA: Accessible label for the tree navigation
  const navLabel = useMemo(() => {
    return `Continuation chain tree with ${totalCount} session${totalCount !== 1 ? 's' : ''}. Use arrow keys to navigate.`;
  }, [totalCount]);

  // Initialize focus to active session when tree first renders
  useEffect(() => {
    if (focusedId === null && activeSessionId) {
      setFocusedId(activeSessionId);
    }
  }, [activeSessionId, focusedId]);

  /**
   * Keyboard navigation handler implementing WCAG tree pattern.
   *
   * Arrow Up/Down: Navigate through flat list (visual order)
   * Arrow Left: Collapse if expanded with children, otherwise go to parent
   * Arrow Right: Expand if collapsed with children, otherwise go to first child
   * Enter/Space: Select node
   * Home: First node
   * End: Last node
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!focusedId) {
        // If nothing focused, focus the first node
        if (flatNodes.length > 0) {
          const firstId = getSessionId(flatNodes[0].session);
          setFocusedId(firstId);
        }
        return;
      }

      const currentIndex = flatNodes.findIndex((n) => getSessionId(n.session) === focusedId);
      const currentNode = flatNodes[currentIndex];
      let handled = true;
      let newFocusId: string | null = null;

      switch (event.key) {
        case 'ArrowUp':
          // Move to previous node in visual order
          if (currentIndex > 0) {
            newFocusId = getSessionId(flatNodes[currentIndex - 1].session);
          }
          break;

        case 'ArrowDown':
          // Move to next node in visual order
          if (currentIndex < flatNodes.length - 1) {
            newFocusId = getSessionId(flatNodes[currentIndex + 1].session);
          }
          break;

        case 'ArrowLeft':
          // Collapse if expanded with children, otherwise navigate to parent
          if (currentNode !== undefined) {
            const currentSessionId = getSessionId(currentNode.session);
            const hasChildren = currentNode.children.length > 0;

            // If node has children and is expanded, collapse it first
            if (hasChildren && !collapsedBranches.has(currentSessionId)) {
              event.preventDefault();
              toggleBranchCollapse(rootSessionId, currentSessionId);
              setAnnouncement('Collapsed branch');
              return; // Don't navigate, just collapse
            }

            // Otherwise, navigate to parent (existing behavior)
            const parent = findParentNode(rootNode, focusedId);
            if (parent) {
              newFocusId = getSessionId(parent.session);
            }
          }
          break;

        case 'ArrowRight':
          // Expand if collapsed with children, otherwise navigate to first child
          if (currentNode !== undefined) {
            const currentSessionId = getSessionId(currentNode.session);
            const hasChildren = currentNode.children.length > 0;

            // If node has children and is collapsed, expand it first
            if (hasChildren && collapsedBranches.has(currentSessionId)) {
              event.preventDefault();
              toggleBranchCollapse(rootSessionId, currentSessionId);
              setAnnouncement('Expanded branch');
              return; // Don't navigate, just expand
            }

            // Otherwise, navigate to first child (existing behavior)
            if (hasChildren) {
              newFocusId = getSessionId(currentNode.children[0].session);
            }
          }
          break;

        case 'Enter':
        case ' ':
          // Select/activate the focused node
          if (focusedId) {
            onSelectNode(focusedId);
            const node = findNodeById(rootNode, focusedId);
            if (node) {
              const title = getDisplayTitle(node.session);
              setAnnouncement(`Selected ${title}`);
            }
          }
          break;

        case 'Home':
          // Go to first node in tree
          if (flatNodes.length > 0) {
            newFocusId = getSessionId(flatNodes[0].session);
          }
          break;

        case 'End':
          // Go to last node in tree
          if (flatNodes.length > 0) {
            newFocusId = getSessionId(flatNodes[flatNodes.length - 1].session);
          }
          break;

        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (newFocusId && newFocusId !== focusedId) {
        setFocusedId(newFocusId);
        // Announce the new focus for screen readers
        const node = findNodeById(rootNode, newFocusId);
        if (node) {
          const title = getDisplayTitle(node.session);
          const nodeDepth = node.depth + 1;
          setAnnouncement(`${title}, level ${nodeDepth}`);
        }
      }
    },
    [
      flatNodes,
      focusedId,
      onSelectNode,
      rootNode,
      collapsedBranches,
      toggleBranchCollapse,
      rootSessionId,
      setAnnouncement,
    ]
  );

  // Handle initial focus when tree container is focused
  const handleTreeFocus = useCallback(() => {
    if (!focusedId && flatNodes.length > 0) {
      // Focus the active session if exists, otherwise first node
      const activeIndex = flatNodes.findIndex((n) => getSessionId(n.session) === activeSessionId);
      const targetNode = activeIndex >= 0 ? flatNodes[activeIndex] : flatNodes[0];
      setFocusedId(getSessionId(targetNode.session));
    }
  }, [focusedId, flatNodes, activeSessionId]);

  // Don't render if there's only the root node with no children
  if (rootNode.children.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={navLabel}
      className={cn(
        // Container styling
        'px-1 py-2',
        // Border to separate from surrounding content
        'border-t border-border/50',
        className
      )}
    >
      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Tree header */}
      <div className="px-1.5 pb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <GitBranch className="size-3" aria-hidden="true" />
          Continuation Tree
        </h3>
      </div>

      {/* Tree structure with keyboard navigation */}
      <ol
        ref={treeRef}
        role="tree"
        aria-label="Session continuation tree"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={handleTreeFocus}
        className="space-y-0.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <TreeNode
          node={rootNode}
          activeSessionId={activeSessionId}
          onSelectNode={onSelectNode}
          depth={0}
          isLastSibling={true}
          focusedId={focusedId}
          onFocusChange={setFocusedId}
          positionInSet={1}
          setSize={1}
          collapsedBranches={collapsedBranches}
          onToggleBranchCollapse={(nodeId) => toggleBranchCollapse(rootSessionId, nodeId)}
          activePathSet={activePathSet}
        />
      </ol>

      {/* Keyboard navigation hint for screen readers */}
      <div className="sr-only" id="tree-instructions">
        Use arrow keys to navigate. Press Enter or Space to select.
      </div>
    </nav>
  );
}

// =============================================================================
// Export with Memoization
// =============================================================================

/**
 * PERFORMANCE: React.memo prevents unnecessary re-renders.
 * Custom equality function compares:
 * - rootNode by reference (tree structure changes are rare)
 * - activeSessionId by value
 * - onSelectNode by reference
 * - className by value
 */
export const ContinuationTree = memo(ContinuationTreeComponent, (prevProps, nextProps) => {
  // Quick reference equality check
  if (
    prevProps.rootNode === nextProps.rootNode &&
    prevProps.activeSessionId === nextProps.activeSessionId &&
    prevProps.onSelectNode === nextProps.onSelectNode &&
    prevProps.className === nextProps.className
  ) {
    return true; // Props are equal, skip re-render
  }

  // If activeSessionId changed, always re-render
  if (prevProps.activeSessionId !== nextProps.activeSessionId) {
    return false;
  }

  // If callback changed, re-render
  if (prevProps.onSelectNode !== nextProps.onSelectNode) {
    return false;
  }

  // If className changed, re-render
  if (prevProps.className !== nextProps.className) {
    return false;
  }

  // If rootNode reference changed, check if structure actually changed
  // by comparing root session ID (tree rebuilds would change this reference)
  const prevRootId = getSessionId(prevProps.rootNode.session);
  const nextRootId = getSessionId(nextProps.rootNode.session);
  if (prevRootId !== nextRootId) {
    return false;
  }

  // Compare children count at root level as a quick heuristic
  if (prevProps.rootNode.children.length !== nextProps.rootNode.children.length) {
    return false;
  }

  // Deep comparison of children IDs
  for (let i = 0; i < prevProps.rootNode.children.length; i++) {
    const prevChildId = getSessionId(prevProps.rootNode.children[i].session);
    const nextChildId = getSessionId(nextProps.rootNode.children[i].session);
    if (prevChildId !== nextChildId) {
      return false;
    }
  }

  return true; // Props are equal
});

// Default export for convenience
export default ContinuationTree;
