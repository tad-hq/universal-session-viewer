// ContinuationTimeline Component - Session Continuation Feature
//
// Purpose: Display a vertical timeline of continuation sessions
// with navigation capability between chapters.
//
// Design Requirements:
// - Vertical timeline with connecting line (left border)
// - Chapter dots/markers with numbers (1, 2, 3...)
// - Active indicator (highlighted marker on current chapter)
// - Click to navigate between continuations
// - Compact spacing (fits in sidebar)
// - Highlight chapter that contains search match with distinct styling
//
// WCAG 2.1 AA Accessibility:
// - Navigation role for timeline container
// - aria-label for timeline context
// - aria-current for active item
// - Keyboard navigation support (Enter/Space to select)
// - Focus management with visible focus rings

import { memo, useMemo, useCallback } from 'react';

import { CheckCircle, Search } from 'lucide-react';

import { cn, formatTimeAgo, extractShortTitle } from '../../utils';

import type { Session } from '../../types';

export interface ContinuationTimelineProps {
  /** Array of sessions in the continuation chain, ordered chronologically */
  continuations: Session[];
  /** ID of the currently active/selected session */
  activeSessionId: string;
  /** Callback when a continuation is selected */
  onSelectContinuation: (sessionId: string) => void;
  /** Optional className for custom styling */
  className?: string;
  /**
   * Chapter number (1-indexed) where search match was found.
   * When provided, that chapter will be highlighted with search-specific styling.
   */
  searchMatchChapter?: number;
}

interface TimelineItemProps {
  session: Session;
  index: number;
  isActive: boolean;
  isLast: boolean;
  onSelect: () => void;
  /** Whether this chapter contains the search match */
  isSearchMatch?: boolean;
}

/**
 * TimelineItem Component
 *
 * Renders a single item in the continuation timeline.
 * Includes the connecting line, marker, and session info.
 */
const TimelineItem = memo(function TimelineItem({
  session,
  index,
  isActive,
  isLast,
  onSelect,
  isSearchMatch = false,
}: TimelineItemProps) {
  // Extract display title from session
  const title = useMemo(() => {
    if (session.title || session.summary) {
      return extractShortTitle(session.title || session.summary);
    }
    return `Chapter ${index + 1}`;
  }, [session.title, session.summary, index]);

  // Format time for display
  const timeAgo = useMemo(() => {
    let date: Date;
    if (
      session.last_message_time !== undefined &&
      session.last_message_time !== null &&
      session.last_message_time !== ''
    ) {
      date = new Date(session.last_message_time);
    } else if (session.analysis_timestamp !== undefined && session.analysis_timestamp !== null) {
      date = new Date(session.analysis_timestamp * 1000);
    } else if (session.modified !== undefined && session.modified !== null) {
      date = new Date(session.modified);
    } else {
      return '';
    }
    return formatTimeAgo(date);
  }, [session.last_message_time, session.analysis_timestamp, session.modified]);

  // WCAG 2.1 AA: Accessible label for screen readers
  // Include search match indication in accessible label
  const accessibleLabel = useMemo(() => {
    const parts = [
      `Chapter ${index + 1}`,
      title,
      timeAgo,
      isSearchMatch ? 'contains search match' : null,
      isActive ? 'currently viewing' : 'click to view',
    ].filter(Boolean);
    return parts.join(', ');
  }, [index, title, timeAgo, isActive, isSearchMatch]);

  // Chapter number display (1-indexed for users)
  const chapterNumber = index + 1;

  return (
    <li className="relative">
      {/* Connecting line - extends from marker to next item */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-[11px] top-6 h-[calc(100%-8px)] w-0.5',
            // Muted line color, slightly highlighted if active
            isActive ? 'bg-primary/30' : 'bg-border'
          )}
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? 'step' : undefined}
        aria-label={accessibleLabel}
        className={cn(
          'flex w-full items-start gap-2 rounded-md p-1.5 text-left',
          // Interactive states
          'transition-colors duration-150',
          'hover:bg-accent/50',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          // Active state styling
          isActive && 'bg-accent',
          // Search match highlighting with distinct visual treatment
          isSearchMatch &&
            !isActive &&
            'bg-yellow-50/50 ring-2 ring-yellow-400/70 dark:bg-yellow-900/20'
        )}
      >
        {/* Marker/dot with chapter number */}
        <div
          className={cn(
            'relative flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
            // Active state: highlighted marker
            isActive
              ? 'bg-primary text-primary-foreground'
              : // Search match marker styling
                isSearchMatch
                ? 'bg-yellow-400 text-yellow-900 dark:bg-yellow-500 dark:text-yellow-950'
                : 'bg-muted text-muted-foreground'
          )}
          aria-hidden="true"
        >
          {isActive ? (
            // Active chapter shows check icon
            <CheckCircle className="size-4" />
          ) : isSearchMatch ? (
            // Search match chapter shows search icon
            <Search className="size-3" />
          ) : (
            // Inactive chapters show number
            <span>{chapterNumber}</span>
          )}
        </div>

        {/* Session info */}
        <div className="min-w-0 flex-1 pt-0.5">
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

        {/* Search match indicator badge */}
        {isSearchMatch && !isActive && (
          <div
            className="flex shrink-0 items-center gap-0.5 rounded bg-yellow-400/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-400"
            aria-hidden="true"
          >
            <Search className="size-2.5" />
            Match
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
    </li>
  );
});

/**
 * ContinuationTimeline Component
 *
 * Displays a vertical timeline showing all sessions in a continuation chain.
 * Allows navigation between continuations by clicking on timeline items.
 *
 * Design:
 * - Vertical layout with connecting line
 * - Numbered markers for each chapter
 * - Highlighted active chapter with "Active" badge
 * - Compact design suitable for sidebar
 *
 * WCAG 2.1 AA:
 * - Uses nav element with aria-label
 * - List structure for proper semantic meaning
 * - aria-current="step" for active item
 * - Keyboard navigation with focus rings
 */
function ContinuationTimelineComponent({
  continuations,
  activeSessionId,
  onSelectContinuation,
  className,
  searchMatchChapter,
}: ContinuationTimelineProps) {
  // WCAG 2.1 AA: Accessible label for the timeline navigation
  // Note: Hooks must be called before any early returns (React rules of hooks)
  const navLabel = useMemo(() => {
    return `Continuation timeline with ${continuations?.length ?? 0} chapters`;
  }, [continuations?.length]);

  // Find active session helper - considers both id and session_id fields
  const getSessionId = useCallback((session: Session): string => {
    return session.session_id || session.id;
  }, []);

  // Don't render if there's only one or no sessions
  // Moved after hooks to comply with React rules of hooks
  if (continuations.length <= 1) {
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
      {/* Timeline header */}
      <div className="px-1.5 pb-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Continuation Chain
        </h3>
      </div>

      {/* Timeline list */}
      <ol className="space-y-0.5">
        {continuations.map((session, index) => {
          const sessionId = getSessionId(session);
          const isActive = sessionId === activeSessionId;
          // Chapter numbers are 1-indexed, index is 0-indexed
          const chapterNumber = index + 1;
          const isSearchMatch = searchMatchChapter === chapterNumber;

          return (
            <TimelineItem
              key={sessionId}
              session={session}
              index={index}
              isActive={isActive}
              isLast={index === continuations.length - 1}
              onSelect={() => onSelectContinuation(sessionId)}
              isSearchMatch={isSearchMatch}
            />
          );
        })}
      </ol>
    </nav>
  );
}

// PERFORMANCE: React.memo prevents unnecessary re-renders
// Compares continuations array by reference and activeSessionId by value
export const ContinuationTimeline = memo(ContinuationTimelineComponent, (prevProps, nextProps) => {
  // Quick check for reference equality
  if (
    prevProps.continuations === nextProps.continuations &&
    prevProps.activeSessionId === nextProps.activeSessionId &&
    prevProps.onSelectContinuation === nextProps.onSelectContinuation &&
    prevProps.className === nextProps.className &&
    prevProps.searchMatchChapter === nextProps.searchMatchChapter
  ) {
    return true;
  }

  // If activeSessionId changed, re-render
  if (prevProps.activeSessionId !== nextProps.activeSessionId) {
    return false;
  }

  // If callback changed, re-render
  if (prevProps.onSelectContinuation !== nextProps.onSelectContinuation) {
    return false;
  }

  // If className changed, re-render
  if (prevProps.className !== nextProps.className) {
    return false;
  }

  // If searchMatchChapter changed, re-render
  if (prevProps.searchMatchChapter !== nextProps.searchMatchChapter) {
    return false;
  }

  // Deep compare continuations array
  if (prevProps.continuations.length !== nextProps.continuations.length) {
    return false;
  }

  // Compare each session by id
  for (let i = 0; i < prevProps.continuations.length; i++) {
    const prevSession = prevProps.continuations[i];
    const nextSession = nextProps.continuations[i];
    if ((prevSession.session_id || prevSession.id) !== (nextSession.session_id || nextSession.id)) {
      return false;
    }
  }

  return true;
});
