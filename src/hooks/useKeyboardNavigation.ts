/**
 * React hook for vim-style keyboard navigation in the session list.
 *
 * This hook provides keyboard shortcuts for navigating sessions without using
 * the mouse, following vim conventions for power users.
 *
 * @remarks
 * V1 Reference: index.html lines 1956-2042 (handleKeyboardNavigation)
 *
 * Keyboard shortcuts:
 * - `j` / `ArrowDown`: Navigate to next session
 * - `k` / `ArrowUp`: Navigate to previous session
 * - `Enter`: Select current session (accessibility)
 * - `/`: Focus search input
 * - `gg`: Jump to first session (1 second timeout for combo)
 * - `G`: Jump to last session
 * - `Escape`: Clear search when in search input, exit selection mode if active
 * - `Cmd/Ctrl+A`: Select all sessions (V2 enhancement)
 * - `Cmd/Ctrl+D`: Clear all selections (V2 enhancement)
 * - `Space`: Toggle selection on current session (V2 enhancement)
 * - `Shift+J`: Extend selection down (V2 enhancement)
 * - `Shift+K`: Extend selection up (V2 enhancement)
 *
 * Continuation navigation shortcuts:
 * - `ArrowRight`: Expand focused continuation group
 * - `ArrowLeft`: Collapse focused continuation group
 * - `Alt+ArrowRight`: Navigate to next session in continuation chain
 * - `Alt+ArrowLeft`: Navigate to previous session in continuation chain
 *
 * V1 patterns preserved:
 * - Don't handle navigation when typing in form inputs
 * - Escape clears search and blurs input
 * - g+g combo with 1 second timeout
 *
 * @example
 * ```tsx
 * function SessionListContainer() {
 *   const searchRef = useRef<HTMLInputElement>(null);
 *   const { sessions, currentSession } = useSessions();
 *   const { selectSession } = useSessionDetails();
 *
 *   useKeyboardNavigation({
 *     sessionIds: sessions.map(s => s.id),
 *     currentSessionId: currentSession?.id ?? null,
 *     onSelectSession: selectSession,
 *     searchInputRef: searchRef,
 *     onClearSearch: () => clearSearch(),
 *     enabled: !isModalOpen,
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 *
 * @param options - Configuration for keyboard navigation
 *
 * @module hooks/useKeyboardNavigation
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Configuration options for the useKeyboardNavigation hook.
 */
interface UseKeyboardNavigationOptions {
  /** Array of session IDs in display order */
  sessionIds: string[];
  /** Currently selected session ID, or null */
  currentSessionId: string | null;
  /**
   * Callback when a session is selected via keyboard.
   * @param sessionId - The ID of the selected session
   */
  onSelectSession: (sessionId: string) => void;

  /** Ref to the search input element for focus management */
  searchInputRef: React.RefObject<HTMLInputElement>;
  /** Callback to clear the search when Escape is pressed */
  onClearSearch: () => void;

  /**
   * Whether keyboard navigation is enabled.
   * Set to false when modals are open.
   * @default true
   */
  enabled?: boolean;

  // V2 Enhancement: Bulk selection callbacks
  /** Callback to select all sessions (Cmd/Ctrl+A) */
  onSelectAll?: () => void;
  /** Callback to clear all selections (Cmd/Ctrl+D) */
  onClearSelection?: () => void;
  /** Callback to toggle selection on current session (Space) */
  onToggleSelection?: (sessionId: string) => void;
  /** Callback to extend selection up/down (Shift+J/K) */
  onExtendSelection?: (direction: 'up' | 'down') => void;
  /** Callback to exit selection mode (Escape) */
  onExitSelectionMode?: () => void;
  /** Whether currently in selection mode */
  isSelectionMode?: boolean;

  // Continuation navigation callbacks
  /** Callback to expand a continuation group (ArrowRight) */
  onExpandGroup?: (sessionId: string) => void;
  /** Callback to collapse a continuation group (ArrowLeft) */
  onCollapseGroup?: (sessionId: string) => void;
  /** Check if a session group is expanded */
  isGroupExpanded?: (sessionId: string) => boolean;
  /** Get continuation group for navigation within chain */
  getContinuationGroup?: (sessionId: string) => {
    continuations: Array<{ id?: string; session_id?: string }>;
  } | null;
}

/**
 * Hook for vim-style keyboard navigation.
 *
 * @param options - Keyboard navigation configuration
 */
export function useKeyboardNavigation({
  sessionIds,
  currentSessionId,
  onSelectSession,
  searchInputRef,
  onClearSearch,
  enabled = true,
  onSelectAll,
  onClearSelection,
  onToggleSelection,
  onExtendSelection,
  onExitSelectionMode,
  isSelectionMode = false,
  // Continuation navigation
  onExpandGroup,
  onCollapseGroup,
  isGroupExpanded,
  getContinuationGroup,
}: UseKeyboardNavigationOptions): void {
  // V1 Pattern: Track pending 'g' key for g+g combo
  // V1 Reference: lines 2019-2031 - 1 second timeout for combo
  const pendingGRef = useRef<boolean>(false);
  const gTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const searchInput = searchInputRef.current;
      const isInSearchInput = document.activeElement === searchInput;

      // V1 Pattern: Don't handle navigation if user is typing in search
      // V1 Reference: lines 1961-1977
      // Exception: Escape key clears search
      if (isInSearchInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClearSearch();
          searchInput?.blur();
        }
        return;
      }

      // V1 Pattern: Don't handle if in other form inputs
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      ) {
        return;
      }

      // V2 Enhancement: Bulk selection shortcuts
      // Cmd/Ctrl+A: Select all sessions
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && onSelectAll) {
        e.preventDefault();
        onSelectAll();
        return;
      }

      // Cmd/Ctrl+D: Clear all selections
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && onClearSelection) {
        e.preventDefault();
        onClearSelection();
        return;
      }

      // V1 Reference: line 1981 - no sessions, no navigation
      if (sessionIds.length === 0) return;

      // V1 Reference: lines 1983-1984 - find current index
      const currentIndex = currentSessionId ? sessionIds.indexOf(currentSessionId) : -1;

      // V2 Enhancement: Space - Toggle selection on current session
      if (e.key === ' ' && currentSessionId && onToggleSelection) {
        e.preventDefault();
        onToggleSelection(currentSessionId);
        return;
      }

      // V2 Enhancement: Shift+J - Extend selection down
      if (e.shiftKey && e.key === 'J' && onExtendSelection) {
        e.preventDefault();
        onExtendSelection('down');
        return;
      }

      // V2 Enhancement: Shift+K - Extend selection up
      if (e.shiftKey && e.key === 'K' && onExtendSelection) {
        e.preventDefault();
        onExtendSelection('up');
        return;
      }

      // Continuation navigation with arrow keys
      // ArrowRight: Expand focused group (without Alt)
      // ArrowLeft: Collapse focused group (without Alt)
      // Alt+ArrowRight: Navigate to next continuation in chain
      // Alt+ArrowLeft: Navigate to previous continuation in chain
      if (currentSessionId && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        // Alt+Arrow: Navigate within continuation chain
        if (e.altKey && getContinuationGroup) {
          const group = getContinuationGroup(currentSessionId);
          if (group && group.continuations.length > 0) {
            // Build full chain: we need to include the root session too
            // The group.continuations are the children, but we need the full chain
            // For simplicity, find current position in continuations array
            const currentIndex = group.continuations.findIndex(
              (s) => (s.id || s.session_id) === currentSessionId
            );

            if (e.key === 'ArrowRight') {
              // Navigate to next continuation
              if (currentIndex < group.continuations.length - 1) {
                const nextSession = group.continuations[currentIndex + 1];
                const nextId = nextSession.id || nextSession.session_id;
                if (nextId) {
                  e.preventDefault();
                  onSelectSession(nextId);
                  return;
                }
              }
            } else {
              // ArrowLeft - Navigate to previous continuation
              if (currentIndex > 0) {
                const prevSession = group.continuations[currentIndex - 1];
                const prevId = prevSession.id || prevSession.session_id;
                if (prevId) {
                  e.preventDefault();
                  onSelectSession(prevId);
                  return;
                }
              }
            }
          }
          // If we have alt but no valid navigation, don't fall through
          return;
        }

        // Without Alt: Expand/Collapse group
        if (!e.altKey && isGroupExpanded) {
          const isExpanded = isGroupExpanded(currentSessionId);

          if (e.key === 'ArrowRight' && !isExpanded && onExpandGroup) {
            // Expand group
            e.preventDefault();
            onExpandGroup(currentSessionId);
            return;
          } else if (e.key === 'ArrowLeft' && isExpanded && onCollapseGroup) {
            // Collapse group
            e.preventDefault();
            onCollapseGroup(currentSessionId);
            return;
          }
        }
      }

      switch (e.key) {
        // V1 Pattern: j/ArrowDown - navigate down
        // V1 Reference: lines 1987-1994
        // V2 Enhancement: When no session selected (currentIndex = -1),
        // select the first session for consistent vim-style navigation
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex === -1) {
            // No session selected - start at first session (vim-style)
            if (sessionIds[0]) {
              onSelectSession(sessionIds[0]);
            }
          } else {
            const nextIndex = Math.min(currentIndex + 1, sessionIds.length - 1);
            if (sessionIds[nextIndex]) {
              onSelectSession(sessionIds[nextIndex]);
              // Scroll into view handled by component
            }
          }
          break;

        // V1 Pattern: k/ArrowUp - navigate up
        // V1 Reference: lines 1997-2004
        // V2 Enhancement: When no session selected (currentIndex = -1),
        // select the LAST session for consistent vim-style navigation
        // This mirrors vim behavior where 'k' from nowhere goes to bottom
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex === -1) {
            // No session selected - start at last session (vim-style)
            // This is consistent with vim where 'k' goes up, so starting
            // from "nothing" conceptually means starting from below the list
            const lastIndex = sessionIds.length - 1;
            if (sessionIds[lastIndex]) {
              onSelectSession(sessionIds[lastIndex]);
            }
          } else {
            const prevIndex = Math.max(currentIndex - 1, 0);
            if (sessionIds[prevIndex]) {
              onSelectSession(sessionIds[prevIndex]);
            }
          }
          break;

        // V1 Pattern: Enter - select/activate current session
        // V1 Reference: lines 2007-2011
        // V2 Implementation: Essential for keyboard-only navigation and WCAG compliance
        // When a session is already selected via arrow keys, Enter confirms selection
        // This triggers the same action as clicking the session
        case 'Enter':
          if (currentSessionId && currentIndex !== -1) {
            e.preventDefault();
            // Re-select the current session to trigger any "open" behavior
            // In V2, this ensures keyboard-only users can activate a session
            // just like clicking would. The parent component decides what
            // "selecting an already-selected session" means (e.g., open details)
            onSelectSession(currentSessionId);
          }
          break;

        // V1 Pattern: / - focus search input
        // V1 Reference: lines 2014-2016
        case '/':
          e.preventDefault();
          searchInput?.focus();
          break;

        // V1 Pattern: g+g combo - jump to first
        // V1 Reference: lines 2019-2031
        case 'g':
          if (e.repeat) return; // Ignore held keys

          if (pendingGRef.current) {
            // Second 'g' pressed - jump to first
            e.preventDefault();
            if (sessionIds[0]) {
              onSelectSession(sessionIds[0]);
            }
            pendingGRef.current = false;
            if (gTimeoutRef.current) {
              clearTimeout(gTimeoutRef.current);
              gTimeoutRef.current = null;
            }
          } else {
            // First 'g' pressed - wait for second
            pendingGRef.current = true;
            // V1 Pattern: 1 second timeout for combo
            gTimeoutRef.current = setTimeout(() => {
              pendingGRef.current = false;
              gTimeoutRef.current = null;
            }, 1000);
          }
          break;

        // V1 Pattern: G (Shift+G) - jump to last
        // V1 Reference: lines 2034-2039
        case 'G':
          e.preventDefault();
          const lastIndex = sessionIds.length - 1;
          if (sessionIds[lastIndex]) {
            onSelectSession(sessionIds[lastIndex]);
          }
          break;

        // V1 Pattern: Escape - clear search/deselect
        // V1 Reference: lines 1964-1976
        // V2 Enhancement: Also exit selection mode if active
        case 'Escape':
          // Clear any pending g combo
          pendingGRef.current = false;
          if (gTimeoutRef.current) {
            clearTimeout(gTimeoutRef.current);
            gTimeoutRef.current = null;
          }
          // V2 Enhancement: Exit selection mode if active
          if (isSelectionMode && onExitSelectionMode) {
            e.preventDefault();
            onExitSelectionMode();
          }
          break;
      }
    },
    [
      enabled,
      sessionIds,
      currentSessionId,
      onSelectSession,
      searchInputRef,
      onClearSearch,
      onSelectAll,
      onClearSelection,
      onToggleSelection,
      onExtendSelection,
      onExitSelectionMode,
      isSelectionMode,
      // Continuation navigation dependencies
      onExpandGroup,
      onCollapseGroup,
      isGroupExpanded,
      getContinuationGroup,
    ]
  );

  // V1 Reference: line 916 - document.addEventListener('keydown', handleKeyboardNavigation)
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Cleanup any pending timeout
      if (gTimeoutRef.current) {
        clearTimeout(gTimeoutRef.current);
      }
    };
  }, [enabled, handleKeyDown]);
}
