// SessionGroup Component - Session Continuation Feature Integration
//
// Purpose: Wrapper component that renders SessionCard with optional
// ContinuationBadge and expandable continuation visualization (timeline or tree).
//
// Design:
// - Wraps SessionCard with ContinuationBadge in footer
// - Shows continuation visualization below card when expanded
// - AUTO-DETECTS visualization mode based on chain structure:
//   - Linear timeline: Simple chains (each parent has at most one child)
//   - Tree view: Branching chains (one parent with multiple children)
// - Preserves all existing SessionCard functionality
// - Manages expansion state for continuation visualization
// - Shows "Found in Chapter X" when search matched in child
//
// Mode Detection:
// - Uses selectHasBranches(rootId) to detect branching chains
// - Uses selectTreeStructure(rootId) to get tree data for rendering
// - Falls back to linear timeline if tree data is not available
//
// Performance:
// - React.memo to prevent unnecessary re-renders
// - Memoized callbacks for child components
// - Efficient selector patterns for Zustand store access
// - Tree selectors only computed when needed (hasBranches is true)
//
// WCAG 2.1 AA Accessibility:
// - Preserves SessionCard accessibility features
// - aria-expanded on card when has continuations
// - Keyboard navigation for expand/collapse

import { memo, useCallback, useMemo } from 'react';

import { ChainHighlightBadge } from './ChainHighlightBadge';
import { ContinuationBadge } from './ContinuationBadge';
import { ContinuationBreadcrumb } from './ContinuationBreadcrumb';
import { ContinuationTimeline } from './ContinuationTimeline';
import { ContinuationTree } from './ContinuationTree';
import { SessionCard } from './SessionCard';
import {
  useContinuationStore,
  selectHasBranches,
  selectTreeStructure,
  selectLinearPath,
  selectChainHighlightInfo,
  selectIsChainHighlightActive,
} from '../../stores/continuationStore';
import { cn } from '../../utils';

import type { SearchMatchInfo } from './ContinuationBadge';
import type { Session } from '../../types';

/** Visualization mode for continuation chains */
type VisualizationMode = 'linear' | 'tree';

export interface SessionGroupProps {
  /** The session to display */
  session: Session;
  /** Whether this session is currently active/selected */
  isActive: boolean;
  /** Click handler when session card is clicked */
  onClick: () => void;
  /** Whether the continuation group is expanded (showing timeline) */
  isExpanded: boolean;
  /** Array of continuation sessions (children of this session) */
  continuations?: Session[];
  /** Toggle expansion of the continuation timeline */
  onToggleExpansion: () => void;
  /** Selection mode flag for multi-select */
  isSelectionMode?: boolean;
  /** Whether this session is selected */
  isSelected?: boolean;
  /** Callback for selection toggle */
  onToggleSelect?: (e: React.MouseEvent) => void;
  /** Handler for when user selects a continuation session from timeline */
  onSelectContinuation?: (sessionId: string) => void;
  /** Optional className for container styling */
  className?: string;
  /** Callback to filter list to show only related sessions (passed through to SessionCard) */
  onFilterRelated?: () => void;
}

/**
 * SessionGroup Component
 *
 * Wraps a SessionCard with continuation chain UI elements:
 * - ContinuationBadge in the card footer (shows continuation count)
 * - ContinuationTimeline below card (shows chain when expanded)
 *
 * Responsibilities:
 * - Render SessionCard with all its existing functionality
 * - Show ContinuationBadge if session has continuations
 * - Show ContinuationTimeline when expanded
 * - Handle expansion toggle interactions
 *
 * Does NOT:
 * - Manage expansion state (parent manages via props)
 * - Load continuation data (parent manages via store)
 * - Modify SessionCard internal behavior (props pass-through)
 */
function SessionGroupComponent({
  session,
  isActive,
  onClick,
  isExpanded,
  continuations,
  onToggleExpansion,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onSelectContinuation: onSelectContinuationProp,
  className,
  onFilterRelated,
}: SessionGroupProps) {
  // Get session ID (handles dual ID field pattern from V1)
  const sessionId = useMemo(() => {
    return session.session_id || session.id;
  }, [session.session_id, session.id]);

  // Get the internal cached continuation group from store
  // We use the internal CachedContinuationGroup to access metadata and isLoading
  const cachedGroup = useContinuationStore(
    useCallback(
      (state) => {
        const rootId = state.sessionToRootMap.get(sessionId) || sessionId;
        return state.continuationGroups.get(rootId) || null;
      },
      [sessionId]
    )
  );

  // Get the root session ID for this continuation chain
  // Used for tree-based selectors that need the chain root
  const rootSessionId = useContinuationStore(
    useCallback(
      (state) => {
        return state.sessionToRootMap.get(sessionId) || sessionId;
      },
      [sessionId]
    )
  );

  // ==========================================================================
  // Mode Detection: Linear vs Tree Visualization
  // ==========================================================================
  // Detect if this continuation chain has branches (multiple children at any node)
  // If it has branches, we need to render a tree view instead of linear timeline
  const hasBranches = useContinuationStore(
    useCallback((state) => selectHasBranches(rootSessionId)(state), [rootSessionId])
  );

  // Get the tree structure for tree visualization mode
  // Only computed when hasBranches is true (tree view needed)
  const treeNode = useContinuationStore(
    useCallback((state) => selectTreeStructure(rootSessionId)(state), [rootSessionId])
  );

  // Determine effective visualization mode:
  // - 'tree' if the chain has branches (one parent with multiple children)
  // - 'linear' for simple chains (each parent has at most one child)
  const visualizationMode: VisualizationMode = hasBranches ? 'tree' : 'linear';

  // Get path to determine if breadcrumb should show
  const path = useContinuationStore(
    useCallback(
      (state) => selectLinearPath(rootSessionId, sessionId)(state),
      [rootSessionId, sessionId]
    )
  );

  // Show breadcrumb for deep trees (depth > 3) when expanded and in tree mode
  const shouldShowBreadcrumb = useMemo(() => {
    if (!path || !isExpanded) return false;
    if (visualizationMode !== 'tree') return false;
    return path.length > 3;
  }, [path, isExpanded, visualizationMode]);

  // ==========================================================================
  // Chain Highlight Feature - SessionList Chain Visualization
  // ==========================================================================
  // Check if any chain is highlighted (used for dimming non-chain sessions)
  const isChainHighlightActive = useContinuationStore(selectIsChainHighlightActive);

  // Get highlight info for this specific session (O(1) lookup)
  const highlightInfo = useContinuationStore(
    useCallback((state) => selectChainHighlightInfo(sessionId)(state), [sessionId])
  );

  // Whether this session is in the highlighted chain
  const isInHighlightedChain = highlightInfo !== null;

  // Whether this session should be dimmed (highlight active but not in chain)
  const shouldDim = isChainHighlightActive && !isInHighlightedChain;

  // Determine if this session has continuations
  // Check both provided continuations prop and store metadata
  const continuationCount = useMemo((): number => {
    // PRIORITY 1: Direct prop (full chain from store)
    // continuations.length = other sessions, +1 for current session
    if (continuations && continuations.length > 0) {
      return continuations.length + 1;
    }
    // PRIORITY 2: SQL subquery - total chain size (CORRECT SOURCE)
    // continuation_count = other sessions in chain, +1 for current session
    if ((session.continuation_count ?? 0) > 0) {
      return session.continuation_count! + 1;
    }
    // PRIORITY 3: Cached continuations array (full chain)
    // cached continuations = other sessions, +1 for current session
    if (cachedGroup?.continuations && cachedGroup.continuations.length > 0) {
      return cachedGroup.continuations.length + 1;
    }
    // PRIORITY 4: Cached child_count (direct children only - last resort)
    // child_count = direct children, +1 to include parent (current session)
    if ((cachedGroup?.metadata?.child_count ?? 0) > 0) {
      return cachedGroup!.metadata!.child_count + 1;
    }

    // No continuations found
    return 0;
  }, [continuations, cachedGroup, session.continuation_count]);

  // Whether to show the continuation badge
  const hasContinuations = continuationCount > 0;

  // Compute search match info for continuation badge
  // When _searchMatchChapter is set on the session, show "Found in Chapter X" badge
  const searchMatch: SearchMatchInfo | undefined = useMemo(() => {
    if ((session._searchMatchChapter ?? 0) > 0 && (session._searchMatchTotalChapters ?? 0) > 0) {
      return {
        matchedInChapter: session._searchMatchChapter!,
        totalChapters: session._searchMatchTotalChapters!,
      };
    }
    return undefined;
  }, [session._searchMatchChapter, session._searchMatchTotalChapters]);

  // Build continuation chain for timeline (parent + children)
  // Timeline shows ALL sessions in the chain including the parent
  //
  // FIX: Deduplicate to prevent React key warnings when clicking middle-of-chain sessions
  // When a user clicks a session that's in the middle of a continuation chain,
  // that session may already exist in the `continuations` array (which contains the
  // full chain from root). Without deduplication, we'd have the same session twice:
  // once as `session` (prepended) and once in `continuations`.
  //
  // FUTURE ENHANCEMENT: Once store selectors are ready, use selectLinearPath for properly ordered
  // chain from root to clicked session. This would be Option B - the preferred approach.
  const timelineChain = useMemo(() => {
    if (!continuations || continuations.length === 0) {
      return [session]; // Single session, no chain
    }

    // Build a Set of all session IDs in the continuations array
    const continuationIds = new Set(continuations.map((c) => c.session_id || c.id));

    // Only prepend session if it's NOT already in continuations
    // This prevents duplicate keys when clicking a middle-of-chain session
    if (continuationIds.has(sessionId)) {
      return continuations;
    }

    // Session is not in continuations, prepend it (root session case)
    return [session, ...continuations];
  }, [session, sessionId, continuations]);

  // Handle toggle callback (memoized to prevent re-renders)
  const handleToggleExpansion = useCallback(() => {
    onToggleExpansion();
  }, [onToggleExpansion]);

  // Handle selection of a continuation session (linear timeline)
  const handleSelectContinuation = useCallback(
    (continuationSessionId: string) => {
      // Call provided handler or fallback to logging
      if (onSelectContinuationProp) {
        onSelectContinuationProp(continuationSessionId);
      }
    },
    [onSelectContinuationProp]
  );

  // Handle selection of a tree node (tree visualization)
  // Same callback signature as handleSelectContinuation for consistency
  const handleSelectTreeNode = useCallback(
    (selectedSessionId: string) => {
      if (onSelectContinuationProp) {
        onSelectContinuationProp(selectedSessionId);
      }
    },
    [onSelectContinuationProp]
  );

  // Check if timeline data is loading (CachedContinuationGroup has isLoading)
  const isTimelineLoading = cachedGroup?.isLoading ?? false;

  // Check if there was an error loading continuations
  const loadError = cachedGroup?.error ?? null;

  // Check if continuations have been loaded (even if empty)
  const isLoaded = cachedGroup?.isLoaded ?? false;

  // Determine if we should show "no data" state
  // This happens when: expanded, not loading, loaded, but no timeline data
  const hasTimelineData = timelineChain.length > 1; // Need parent + at least 1 child

  return (
    <div
      className={cn(
        'session-group relative',
        // Add visual indication when expanded
        isExpanded && hasContinuations && 'session-group--expanded',
        // Chain Highlight Feature: Apply highlight styles based on role
        // Clicked session: Ring + glow
        highlightInfo?.role === 'clicked' && 'rounded-lg bg-primary/10 ring-2 ring-primary',
        // Ancestor session: Amber left border + tint
        highlightInfo?.role === 'ancestor' &&
          'rounded-r-lg border-l-4 border-amber-500 bg-amber-500/5',
        // Descendant session: Cyan left border + tint
        highlightInfo?.role === 'descendant' &&
          'rounded-r-lg border-l-4 border-cyan-400 bg-cyan-400/5',
        // Sibling session: Violet left border + tint
        highlightInfo?.role === 'sibling' &&
          'rounded-r-lg border-l-4 border-violet-500 bg-violet-500/5',
        // Dim non-chain sessions when highlight is active
        shouldDim && 'opacity-50 transition-opacity duration-200',
        className
      )}
      // WCAG 2.1 AA: Indicate expandable content and highlight status
      aria-expanded={hasContinuations ? isExpanded : undefined}
      aria-describedby={highlightInfo ? `highlight-badge-${sessionId}` : undefined}
    >
      {/* Chain Highlight Badge - shows position and relationship indicator */}
      {highlightInfo && (
        <div id={`highlight-badge-${sessionId}`} className="absolute right-1 top-1 z-10">
          <ChainHighlightBadge sessionId={sessionId} highlightInfo={highlightInfo} />
        </div>
      )}

      {/* Main session card with continuation badge in footer */}
      <SessionCard
        session={session}
        isActive={isActive}
        onClick={onClick}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        // Pass continuation badge to render in SessionCard footer
        // Pass searchMatch to show "Found in Chapter X" when search matched in child
        continuationBadge={
          hasContinuations ? (
            <ContinuationBadge
              continuationCount={continuationCount} // No +1 - handled in useMemo
              isExpanded={isExpanded}
              onToggle={handleToggleExpansion}
              searchMatch={searchMatch}
            />
          ) : undefined
        }
        // Pass filter handler to enable related sessions filtering
        onFilterRelated={onFilterRelated}
      />

      {/* Expanded continuation timeline */}
      {hasContinuations && isExpanded && (
        <div
          className={cn(
            'continuation-timeline-container',
            'ml-2 border-l-2 border-primary/20 bg-muted/30'
          )}
        >
          {isTimelineLoading ? (
            // Loading state
            <div className="px-4 py-3 text-xs text-muted-foreground">
              <span className="animate-pulse">Loading continuations...</span>
            </div>
          ) : loadError ? (
            // Error state - show error message
            <div className="px-4 py-3 text-xs text-destructive">
              <span>Failed to load chain: {loadError}</span>
            </div>
          ) : !hasTimelineData && isLoaded ? (
            // Empty state - loaded but no timeline data available
            // This can happen when continuation_count > 0 but chain data couldn't be built
            <div className="px-4 py-3 text-xs text-muted-foreground">
              <span>No continuation chain data available</span>
            </div>
          ) : hasTimelineData ? (
            // Render based on visualization mode:
            // - 'tree' for branching chains (shows tree structure)
            // - 'linear' for simple chains (shows timeline)
            visualizationMode === 'tree' && treeNode ? (
              <>
                {/* Breadcrumb for deep trees */}
                {shouldShowBreadcrumb && (
                  <div className="border-b border-border/30 px-2 pt-2">
                    <ContinuationBreadcrumb
                      rootSessionId={rootSessionId}
                      activeSessionId={sessionId}
                      onNavigate={handleSelectTreeNode}
                      maxVisibleSegments={5}
                    />
                  </div>
                )}
                {/* Tree view for branching continuation chains */}
                <ContinuationTree
                  rootNode={treeNode}
                  activeSessionId={sessionId}
                  onSelectNode={handleSelectTreeNode}
                />
              </>
            ) : (
              // Linear timeline for simple chains (no branches)
              // Pass search match chapter to highlight matched continuation
              <ContinuationTimeline
                continuations={timelineChain}
                activeSessionId={sessionId}
                onSelectContinuation={handleSelectContinuation}
                searchMatchChapter={session._searchMatchChapter}
              />
            )
          ) : (
            // Fallback: not loaded yet but not loading either - trigger load
            <div className="px-4 py-3 text-xs text-muted-foreground">
              <span className="animate-pulse">Loading...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// PERFORMANCE: React.memo with custom comparison
// Only re-render when relevant props change
export const SessionGroup = memo(SessionGroupComponent, (prevProps, nextProps) => {
  // Fast path: reference equality
  if (
    prevProps.session === nextProps.session &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.continuations === nextProps.continuations &&
    prevProps.onToggleExpansion === nextProps.onToggleExpansion &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.onToggleSelect === nextProps.onToggleSelect
  ) {
    return true; // Props are equal, don't re-render
  }

  // Check primitive props
  if (
    prevProps.isActive !== nextProps.isActive ||
    prevProps.isExpanded !== nextProps.isExpanded ||
    prevProps.isSelectionMode !== nextProps.isSelectionMode ||
    prevProps.isSelected !== nextProps.isSelected
  ) {
    return false; // Props changed, re-render
  }

  // Check callbacks
  if (
    prevProps.onClick !== nextProps.onClick ||
    prevProps.onToggleExpansion !== nextProps.onToggleExpansion ||
    prevProps.onToggleSelect !== nextProps.onToggleSelect
  ) {
    return false;
  }

  // Deep compare session (only fields we care about)
  const prevSession = prevProps.session;
  const nextSession = nextProps.session;
  if (
    prevSession.id !== nextSession.id ||
    prevSession.session_id !== nextSession.session_id ||
    prevSession.continuation_count !== nextSession.continuation_count ||
    // Check search match fields
    prevSession._searchMatchChapter !== nextSession._searchMatchChapter ||
    prevSession._searchMatchTotalChapters !== nextSession._searchMatchTotalChapters
  ) {
    return false;
  }

  // Compare continuations array
  if (prevProps.continuations !== nextProps.continuations) {
    // If one is undefined and other isn't
    if (!prevProps.continuations || !nextProps.continuations) {
      return false;
    }
    // Length check
    if (prevProps.continuations.length !== nextProps.continuations.length) {
      return false;
    }
    // Quick ID comparison
    for (let i = 0; i < prevProps.continuations.length; i++) {
      const prevCont = prevProps.continuations[i];
      const nextCont = nextProps.continuations[i];
      if ((prevCont.session_id || prevCont.id) !== (nextCont.session_id || nextCont.id)) {
        return false;
      }
    }
  }

  return true; // Props are equivalent, don't re-render
});
