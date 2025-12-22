/**
 * ContinuationBreadcrumb - Navigation breadcrumb for deep continuation trees
 *
 * Shows path from root to current session with clickable ancestors.
 * Collapses middle segments when path is long: Root > A > ... [+N] ... > Parent > Current
 *
 * WCAG 2.1 AA Accessibility:
 * - nav element with aria-label
 * - ol/li structure for ordered list semantics
 * - aria-current="page" for active item
 * - Keyboard accessible buttons
 */

import { memo, useMemo, useCallback } from 'react';

import { ChevronRight, Home, MoreHorizontal, GitBranch } from 'lucide-react';

import { useContinuationStore, selectLinearPath } from '../../stores/continuationStore';
import { cn } from '../../utils';

import type { ContinuationTreeNode, ContinuationPath } from '../../types/session';

// ============================================================================
// Types
// ============================================================================

export interface ContinuationBreadcrumbProps {
  /** Root session ID of the continuation chain */
  rootSessionId: string;
  /** Currently active/selected session ID */
  activeSessionId: string;
  /** Callback when user navigates to a breadcrumb segment */
  onNavigate: (sessionId: string) => void;
  /** Maximum visible segments before collapsing (default: 5) */
  maxVisibleSegments?: number;
  /** Optional className for container styling */
  className?: string;
}

interface BreadcrumbSegment {
  type: 'visible' | 'collapsed';
  node?: ContinuationTreeNode;
  isRoot?: boolean;
  isCurrent?: boolean;
  isBranchPoint?: boolean;
  hiddenCount?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSessionId(session: { session_id?: string; id: string }): string {
  return session.session_id || session.id || '';
}

function getDisplayTitle(session: ContinuationTreeNode['session']): string {
  if (session.title || session.summary) {
    const text = session.title || session.summary || '';
    // Truncate to ~20 chars
    return text.length > 20 ? text.slice(0, 18) + '...' : text;
  }
  const sessionId = getSessionId(session);
  return sessionId ? `${sessionId.slice(0, 8)}...` : 'Untitled';
}

function computeVisibleSegments(path: ContinuationPath, maxVisible: number): BreadcrumbSegment[] {
  const nodes = path.nodes;
  const len = nodes.length;
  const branchPointIds = new Set(path.branchPoints?.map((bp) => bp.branchPointId) ?? []);

  // Path fits within limit - show all
  if (len <= maxVisible) {
    return nodes.map((node, idx) => ({
      type: 'visible' as const,
      node,
      isRoot: idx === 0,
      isCurrent: idx === len - 1,
      isBranchPoint: branchPointIds.has(getSessionId(node.session)),
    }));
  }

  // Need to collapse middle
  // Show: [Root] [...+N...] [Parent] [Current]
  const segments: BreadcrumbSegment[] = [];

  // Always show root
  segments.push({
    type: 'visible',
    node: nodes[0],
    isRoot: true,
    isBranchPoint: branchPointIds.has(getSessionId(nodes[0].session)),
  });

  // Collapsed section (all middle nodes)
  const hiddenCount = len - 3; // All except root, parent, current
  if (hiddenCount > 0) {
    segments.push({
      type: 'collapsed',
      hiddenCount,
    });
  }

  // Parent (second to last) if exists and different from root
  if (len > 2) {
    segments.push({
      type: 'visible',
      node: nodes[len - 2],
      isBranchPoint: branchPointIds.has(getSessionId(nodes[len - 2].session)),
    });
  }

  // Current (last)
  segments.push({
    type: 'visible',
    node: nodes[len - 1],
    isCurrent: true,
    isBranchPoint: branchPointIds.has(getSessionId(nodes[len - 1].session)),
  });

  return segments;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SegmentButtonProps {
  node: ContinuationTreeNode;
  isRoot?: boolean;
  isCurrent?: boolean;
  isBranchPoint?: boolean;
  onClick: () => void;
}

const SegmentButton = memo(function SegmentButton({
  node,
  isRoot,
  isCurrent,
  isBranchPoint,
  onClick,
}: SegmentButtonProps) {
  const title = useMemo(() => getDisplayTitle(node.session), [node.session]);

  const accessibleLabel = useMemo(() => {
    const parts = [
      isRoot ? 'Root session' : '',
      title,
      isBranchPoint ? 'branch point' : '',
      isCurrent ? 'current location' : 'click to navigate',
    ].filter(Boolean);
    return parts.join(', ');
  }, [isRoot, title, isBranchPoint, isCurrent]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={accessibleLabel}
      disabled={isCurrent}
      className={cn(
        'inline-flex max-w-[100px] items-center gap-1 rounded-md px-2 py-1 text-xs',
        'transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isCurrent && 'cursor-default bg-primary font-medium text-primary-foreground',
        !isCurrent && 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      {isRoot && <Home className="size-3 shrink-0" aria-hidden="true" />}
      {isBranchPoint && !isRoot && <GitBranch className="size-3 shrink-0" aria-hidden="true" />}
      <span className="truncate">{title}</span>
    </button>
  );
});

interface CollapsedIndicatorProps {
  count: number;
}

const CollapsedIndicator = memo(function CollapsedIndicator({ count }: CollapsedIndicatorProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5',
        'rounded bg-muted/50 text-[10px] text-muted-foreground'
      )}
      aria-label={`${count} sessions hidden`}
    >
      <MoreHorizontal className="size-3" aria-hidden="true" />
      <span>+{count}</span>
    </span>
  );
});

const Separator = memo(function Separator() {
  return <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />;
});

// ============================================================================
// Main Component
// ============================================================================

function ContinuationBreadcrumbComponent({
  rootSessionId,
  activeSessionId,
  onNavigate,
  maxVisibleSegments = 5,
  className,
}: ContinuationBreadcrumbProps) {
  // Get the linear path from store
  const path = useContinuationStore(
    useCallback(
      (state) => selectLinearPath(rootSessionId, activeSessionId)(state),
      [rootSessionId, activeSessionId]
    )
  );

  // Compute visible segments
  const segments = useMemo(() => {
    if (!path || path.length <= 1) {
      return null;
    }
    return computeVisibleSegments(path, maxVisibleSegments);
  }, [path, maxVisibleSegments]);

  // Navigation handler
  const handleNavigate = useCallback(
    (sessionId: string) => {
      onNavigate(sessionId);
    },
    [onNavigate]
  );

  // Don't render if no meaningful path
  if (!segments || segments.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label={`Breadcrumb navigation: ${path?.length ?? 0} levels deep`}
      className={cn(
        'flex items-center gap-1 px-2 py-1.5',
        'rounded-md border border-border/30 bg-muted/20',
        'overflow-x-auto',
        className
      )}
    >
      <ol className="flex items-center gap-1">
        {segments.map((segment, index) => (
          <li
            key={segment.type === 'collapsed' ? 'collapsed' : getSessionId(segment.node!.session)}
            className="flex items-center gap-1"
          >
            {/* Separator before non-first items */}
            {index > 0 && <Separator />}

            {segment.type === 'visible' && segment.node && (
              <SegmentButton
                node={segment.node}
                isRoot={segment.isRoot}
                isCurrent={segment.isCurrent}
                isBranchPoint={segment.isBranchPoint}
                onClick={() => handleNavigate(getSessionId(segment.node!.session))}
              />
            )}

            {segment.type === 'collapsed' && segment.hiddenCount !== undefined && (
              <CollapsedIndicator count={segment.hiddenCount} />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ============================================================================
// Export with Memoization
// ============================================================================

export const ContinuationBreadcrumb = memo(ContinuationBreadcrumbComponent, (prev, next) => {
  return (
    prev.rootSessionId === next.rootSessionId &&
    prev.activeSessionId === next.activeSessionId &&
    prev.onNavigate === next.onNavigate &&
    prev.maxVisibleSegments === next.maxVisibleSegments &&
    prev.className === next.className
  );
});

export default ContinuationBreadcrumb;
