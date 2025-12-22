import { useEffect, useRef, useCallback, useMemo } from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { SessionGroup } from './SessionGroup';
import {
  useContinuationStore,
  selectExpandedGroups,
  selectIsChainHighlightActive,
} from '../../stores/continuationStore';
import { useSelectionStore, selectIsSelectionMode } from '../../stores/selectionStore';
import { useSessionStore, selectIsRelatedFilterActive } from '../../stores/sessionStore';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';

import type { Session } from '../../types';

export interface SessionListProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  isSearchMode: boolean;
  error?: string | null;
  onRetry?: () => void;
  onFilterRelated?: (sessionId: string) => void;
}

const ESTIMATED_ROW_HEIGHT = 88;
const TIMELINE_ITEM_HEIGHT = 40;
const OVERSCAN_COUNT = 5;

export function SessionList({
  sessions,
  currentSessionId,
  onSelectSession,
  hasMore,
  isLoading,
  onLoadMore,
  isSearchMode,
  error,
  onRetry,
  onFilterRelated,
}: SessionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const isFiltered = useSessionStore(selectIsRelatedFilterActive);

  const isSelectionMode = useSelectionStore(selectIsSelectionMode);
  const selectedSessionIds = useSelectionStore((state) => state.selectedSessionIds);
  const toggleSelection = useSelectionStore((state) => state.toggleSelection);
  const selectRange = useSelectionStore((state) => state.selectRange);

  const expandedGroups = useContinuationStore(selectExpandedGroups);
  const toggleExpansion = useContinuationStore((state) => state.toggleExpansion);
  const getContinuationGroup = useContinuationStore((state) => state.getContinuationGroup);
  const loadBulkMetadata = useContinuationStore((state) => state.loadBulkMetadata);

  const isChainHighlightActive = useContinuationStore(selectIsChainHighlightActive);
  const setChainHighlight = useContinuationStore((state) => state.setChainHighlight);
  const clearChainHighlight = useContinuationStore((state) => state.clearChainHighlight);

  const sessionIds = useMemo(() => {
    return sessions.map((s) => s.session_id || s.id);
  }, [sessions]);

  const getItemKey = useCallback(
    (index: number): string | number => {
      const session = sessions[index];
      if (session !== undefined) {
        return session.session_id || session.id || `session-${index}`;
      }
      return `pending-${index}`;
    },
    [sessions]
  );

  const estimateSize = useCallback(
    (index: number): number => {
      const session = sessions[index];
      if (session === undefined) return ESTIMATED_ROW_HEIGHT;

      const sessionId = session.session_id || session.id;
      const isExpanded = expandedGroups.has(sessionId);

      if (!isExpanded) {
        return ESTIMATED_ROW_HEIGHT;
      }

      const group = getContinuationGroup(sessionId);
      const continuationCount = group?.continuations?.length ?? session.continuation_count ?? 0;

      const timelineHeight = 32 + (continuationCount + 1) * TIMELINE_ITEM_HEIGHT + 16;

      return ESTIMATED_ROW_HEIGHT + timelineHeight;
    },
    [sessions, expandedGroups, getContinuationGroup]
  );

  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: OVERSCAN_COUNT,
    getItemKey,
  });

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      virtualizer.measure();
    });
    return () => cancelAnimationFrame(rafId);
  }, [expandedGroups, virtualizer]);

  useEffect(() => {
    const sessionsWithContinuations = sessions.filter((session) => {
      const count = session.continuation_count;
      return count !== undefined && count !== null && count > 0;
    });

    if (sessionsWithContinuations.length === 0) return;

    const idsToLoad = sessionsWithContinuations.map((s) => s.session_id || s.id);

    void loadBulkMetadata(idsToLoad);
  }, [sessions, loadBulkMetadata]);

  const expandGroup = useContinuationStore((state) => state.expandGroup);

  useEffect(() => {
    if (!isSearchMode || sessions.length === 0) return;

    sessions.forEach((session) => {
      const sessionId = session.session_id || session.id;

      if (
        session._searchMatchChapter !== undefined &&
        session._searchMatchChapter !== null &&
        session._searchMatchChapter > 1 &&
        session.continuation_count !== undefined &&
        session.continuation_count !== null &&
        session.continuation_count > 0
      ) {
        expandGroup(sessionId);
      }
    });
  }, [isSearchMode, sessions, expandGroup]);

  // Scroll to current session when user navigates (currentSessionId changes)
  // IMPORTANT: Do NOT add 'sessions' to dependencies - causes scroll reset during pagination
  useEffect(() => {
    if (!currentSessionId) return;

    const currentIndex = sessions.findIndex((s) => (s.session_id || s.id) === currentSessionId);

    if (currentIndex !== -1) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(currentIndex, {
          align: 'auto',
          behavior: 'auto',
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessions intentionally excluded to prevent scroll reset during pagination
  }, [currentSessionId, virtualizer]);

  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    if (isSearchMode) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;

      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      if (scrollPercentage > 0.8 && !isLoading && hasMore) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);

    handleScroll();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoading, hasMore, isSearchMode, onLoadMore]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      onSelectSession(sessionId);
      void setChainHighlight(sessionId);
    },
    [onSelectSession, setChainHighlight]
  );

  const handleToggleSelect = useCallback(
    (sessionId: string, event: React.MouseEvent) => {
      if (event.shiftKey) {
        selectRange(sessionId, sessionIds);
      } else {
        toggleSelection(sessionId);
      }
    },
    [selectRange, toggleSelection, sessionIds]
  );

  const handleToggleExpansion = useCallback(
    (sessionId: string) => {
      toggleExpansion(sessionId);
    },
    [toggleExpansion]
  );

  const handleSelectContinuation = useCallback(
    (sessionId: string) => {
      onSelectSession(sessionId);
    },
    [onSelectSession]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChainHighlightActive) {
        clearChainHighlight();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isChainHighlightActive, clearChainHighlight]);

  if (error) {
    return (
      <div
        className="flex flex-1 items-center justify-center p-4"
        role="alert"
        aria-live="assertive"
      >
        <Alert variant="destructive" className="max-w-sm">
          <AlertTriangle className="size-4" />
          <AlertTitle>Error loading sessions</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3 text-sm">{error}</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
                <RefreshCw className="size-4" />
                Try Again
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (sessions.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4" role="status" aria-live="polite">
        <div className="text-center text-muted-foreground">
          <p className="text-sm font-medium">No sessions found</p>
          <p className="mt-1 text-xs">Try adjusting your filters or search query</p>
        </div>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  const listLabel = isSearchMode
    ? `Search results: ${sessions.length} sessions found`
    : `Session list: ${sessions.length} sessions${hasMore ? ', more available' : ''}`;

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      style={{ contain: 'content' }}
      aria-live="polite"
      aria-atomic="false"
      tabIndex={0} // eslint-disable-line jsx-a11y/no-noninteractive-tabindex -- Virtual scrolling container requires keyboard focus per WAI-ARIA
      role="region"
      aria-label="Session list scroll area"
    >
      <div className="sr-only" role="status" aria-live="polite">
        {listLabel}
      </div>

      <div
        role={isSelectionMode ? 'listbox' : 'list'}
        aria-label={listLabel}
        aria-multiselectable={isSelectionMode ? 'true' : undefined}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const session = sessions[virtualRow.index];
            if (session === undefined) return null;

            const sessionId = session.session_id || session.id;
            const isExpanded = expandedGroups.has(sessionId);
            const group = getContinuationGroup(sessionId);

            return (
              <div
                key={virtualRow.key}
                role={isSelectionMode ? 'option' : 'listitem'}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                aria-selected={selectedSessionIds.has(sessionId) ? 'true' : undefined}
              >
                <SessionGroup
                  session={session}
                  isActive={sessionId === currentSessionId}
                  onClick={() => handleSelectSession(sessionId)}
                  isExpanded={isExpanded}
                  continuations={group?.continuations}
                  onToggleExpansion={() => handleToggleExpansion(sessionId)}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedSessionIds.has(sessionId)}
                  onToggleSelect={(e) => handleToggleSelect(sessionId, e)}
                  onSelectContinuation={handleSelectContinuation}
                  onFilterRelated={
                    !isFiltered && onFilterRelated ? () => onFilterRelated(sessionId) : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      {isLoading && sessions.length === 0 && (
        <div className="flex items-center justify-center p-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">Loading sessions...</span>
          </div>
        </div>
      )}
    </div>
  );
}
