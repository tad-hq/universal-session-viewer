// ContinuationBadge Component - Session Continuation Feature
//
// Purpose: Display a clickable badge showing continuation chain count
// with expand/collapse functionality for viewing the timeline.
//
// Design Requirements:
// - BookOpen icon indicating multiple chapters/continuations
// - Shows continuation count (e.g., "3 chapters")
// - ChevronDown/Up indicates expansion state
// - Secondary variant (muted appearance)
// - Accessible with full aria context
// - Search variant shows "Found in Chapter X" indicator
// - Branch variant shows fork icon and path count
//
// WCAG 2.1 AA Accessibility:
// - aria-expanded for screen reader expansion state
// - aria-label provides full context
// - Button element for keyboard activation
// - Focus ring for keyboard navigation

import { memo, useMemo } from 'react';

import { BookOpen, ChevronDown, ChevronUp, GitFork, Search } from 'lucide-react';

import { cn } from '../../utils';
import { Badge } from '../ui/badge';

/**
 * Search match information for continuation chains.
 * When search matches are found in child continuations, this indicates
 * which chapter contains the match.
 */
export interface SearchMatchInfo {
  /** Chapter number where search matched (1-indexed) */
  matchedInChapter: number;
  /** Total number of chapters in the chain */
  totalChapters: number;
}

export interface ContinuationBadgeProps {
  /** Number of sessions in the continuation chain */
  continuationCount: number;
  /** Whether the timeline is currently expanded */
  isExpanded: boolean;
  /** Callback when badge is clicked to toggle expansion */
  onToggle: () => void;
  /** Optional className for custom styling */
  className?: string;
  /**
   * Search match information for displaying "Found in Chapter X"
   * When provided and matchedInChapter > 1, shows search-specific badge variant
   */
  searchMatch?: SearchMatchInfo;
  /**
   * Flag indicating the continuation chain has branches (multiple paths)
   * When true, shows a fork icon to indicate branching structure
   */
  hasBranches?: boolean;
  /**
   * Number of distinct branch paths in the continuation chain
   * When provided with hasBranches=true, shows "(X paths)" indicator
   * If not provided but hasBranches=true, only shows fork icon without count
   */
  branchCount?: number;
}

/**
 * ContinuationBadge Component
 *
 * Displays the number of continuations in a session chain and allows
 * toggling expansion of the ContinuationTimeline.
 *
 * Design:
 * - Uses secondary badge variant for muted appearance
 * - BookOpen icon suggests "chapters" metaphor
 * - Chevron indicates expandable content
 * - Search variant shows "Found in Chapter X" with search icon
 * - Branch variant shows GitFork icon and path count
 *
 * WCAG 2.1 AA:
 * - Button element for proper keyboard interaction
 * - aria-expanded communicates state to screen readers
 * - aria-label provides complete context
 */
function ContinuationBadgeComponent({
  continuationCount,
  isExpanded,
  onToggle,
  className,
  searchMatch,
  hasBranches,
  branchCount,
}: ContinuationBadgeProps) {
  // Determine if we should show search match variant
  // Show search badge when match is in a child continuation (chapter > 1)
  const showSearchMatch = searchMatch && searchMatch.matchedInChapter > 1;

  // Determine if we should show branch indicator
  // Only show when hasBranches is explicitly true and not in search mode
  const showBranchIndicator = hasBranches === true && !showSearchMatch;

  // WCAG 2.1 AA: Memoize accessible label for screen readers
  // Note: Hooks must be called before any early returns (React rules of hooks)
  const accessibleLabel = useMemo(() => {
    if (showSearchMatch) {
      return `Search match found in chapter ${searchMatch.matchedInChapter} of ${searchMatch.totalChapters}, click to ${isExpanded ? 'collapse' : 'expand'} timeline`;
    }
    const chapterText = continuationCount === 1 ? 'chapter' : 'chapters';
    const stateText = isExpanded ? 'collapse' : 'expand';
    // Include branch info in accessible label
    const branchText = showBranchIndicator
      ? (branchCount ?? 0) > 1
        ? ` with ${branchCount} paths`
        : ' with branches'
      : '';
    return `${continuationCount} ${chapterText}${branchText} in continuation chain, click to ${stateText} timeline`;
  }, [
    continuationCount,
    isExpanded,
    showSearchMatch,
    searchMatch,
    showBranchIndicator,
    branchCount,
  ]);

  // Text display for the badge
  const displayText = useMemo(() => {
    if (showSearchMatch) {
      return `Found in Ch. ${searchMatch.matchedInChapter}`;
    }
    const chapterText = continuationCount === 1 ? 'chapter' : 'chapters';
    // Add path count when branches exist
    const branchSuffix =
      showBranchIndicator && (branchCount ?? 0) > 1 ? ` (${branchCount} paths)` : '';
    return `${continuationCount} ${chapterText}${branchSuffix}`;
  }, [continuationCount, showSearchMatch, searchMatch, showBranchIndicator, branchCount]);

  // Don't render if there's only one session (no chain)
  // Moved after hooks to comply with React rules of hooks
  if (continuationCount <= 1) {
    return null;
  }

  const ChevronIcon = isExpanded ? ChevronUp : ChevronDown;

  // Use Search icon for search match variant
  // Use GitFork icon for branch variant, BookOpen for linear chains
  const Icon = showSearchMatch ? Search : showBranchIndicator ? GitFork : BookOpen;

  return (
    <button
      type="button"
      onClick={(e) => {
        // Prevent event from bubbling to parent card click handlers
        e.stopPropagation();
        onToggle();
      }}
      aria-expanded={isExpanded}
      aria-label={accessibleLabel}
      className={cn(
        // Reset button styles
        'inline-flex items-center',
        // Focus ring for keyboard navigation
        'rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
    >
      <Badge
        variant={showSearchMatch ? 'outline' : 'secondary'}
        className={cn(
          'h-5 cursor-pointer px-2 py-0.5 text-xs font-normal',
          // Prevent text wrapping - fixes "32 chapters" stacking vertically
          'shrink-0 whitespace-nowrap',
          // Hover state for interactive feedback
          'transition-colors hover:bg-secondary/80',
          // Subtle border for better definition
          'border border-transparent hover:border-border/50',
          // Highlight search match variant with distinct styling
          showSearchMatch && 'border-primary/50 bg-primary/5 text-primary hover:bg-primary/10'
        )}
      >
        <Icon className="mr-1.5 size-3 shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">{displayText}</span>
        <ChevronIcon className="ml-1 size-3 shrink-0" aria-hidden="true" />
      </Badge>
    </button>
  );
}

// PERFORMANCE: React.memo prevents unnecessary re-renders
// Only re-renders when continuationCount, isExpanded, onToggle, searchMatch, hasBranches, or branchCount changes
export const ContinuationBadge = memo(ContinuationBadgeComponent, (prevProps, nextProps) => {
  // Check primitive props and callbacks
  if (
    prevProps.continuationCount !== nextProps.continuationCount ||
    prevProps.isExpanded !== nextProps.isExpanded ||
    prevProps.onToggle !== nextProps.onToggle ||
    prevProps.className !== nextProps.className ||
    // Check branch-related props
    prevProps.hasBranches !== nextProps.hasBranches ||
    prevProps.branchCount !== nextProps.branchCount
  ) {
    return false;
  }

  // Check searchMatch prop
  const prevMatch = prevProps.searchMatch;
  const nextMatch = nextProps.searchMatch;

  // Both undefined - equal
  if (!prevMatch && !nextMatch) return true;
  // One undefined, other defined - not equal
  if (!prevMatch || !nextMatch) return false;
  // Both defined - compare values
  return (
    prevMatch.matchedInChapter === nextMatch.matchedInChapter &&
    prevMatch.totalChapters === nextMatch.totalChapters
  );
});
