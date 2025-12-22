/**
 * React hook for managing the session list with pagination, search, and filtering.
 *
 * This hook wraps the Zustand sessionStore and provides React-specific lifecycle
 * management including automatic loading on filter changes and initial mount.
 *
 * @remarks
 * V1 Reference: index.html lines 970-1169
 *
 * V1 patterns preserved:
 * - Pagination with 50 item page size
 * - Search mode disables pagination (loads all results at once)
 * - Project filter resets pagination
 * - Date filter clears search mode
 * - useEffect for initial load and filter change reactions
 *
 * @example
 * ```tsx
 * function SessionListContainer() {
 *   const {
 *     sessions,
 *     isLoading,
 *     hasMore,
 *     loadMoreSessions,
 *     searchSessions,
 *   } = useSessions();
 *
 *   return (
 *     <div>
 *       <SearchInput onSearch={searchSessions} />
 *       <SessionList sessions={sessions} />
 *       {hasMore && !isLoading && (
 *         <button onClick={loadMoreSessions}>Load More</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns Object containing session state and actions
 *
 * @module hooks/useSessions
 */

import { useEffect, useCallback } from 'react';

import { useSessionStore } from '../stores';

import type { DateFilterPeriod, Session, DateFilter, Project } from '../types';

/**
 * Return type for the useSessions hook.
 */
interface UseSessionsReturn {
  /** Array of loaded sessions */
  sessions: Session[];
  /** Whether sessions are currently being loaded */
  isLoading: boolean;
  /** Whether more sessions are available to load */
  hasMore: boolean;
  /** Total number of sessions matching current filters */
  totalCount: number;
  /** Number of sessions currently displayed */
  displayedCount: number;
  /** Whether search mode is active (disables pagination) */
  isSearchMode: boolean;
  /** Current search query string */
  currentSearchQuery: string;
  /** Current project filter path or null for all projects */
  currentProjectFilter: string | null;
  /** Current date filter range */
  dateFilter: DateFilter;
  /** Available projects for filtering */
  projects: Project[];

  /**
   * Resets pagination and loads the first page of sessions.
   * @returns Promise that resolves when loading completes
   */
  loadInitialSessions: () => Promise<void>;

  /**
   * Loads the next page of sessions (infinite scroll).
   * V1 Edge Case: Skips if already loading or no more data.
   * @returns Promise that resolves when loading completes
   */
  loadMoreSessions: () => Promise<void>;

  /**
   * Performs full-text search and loads all matching results.
   * V1 Pattern: Search disables pagination and loads all results.
   * @param query - Search query string
   * @returns Promise that resolves when search completes
   */
  searchSessions: (query: string) => Promise<void>;

  /**
   * Sets the project filter and resets pagination.
   * @param path - Project path to filter by, or null for all projects
   */
  setProjectFilter: (path: string | null) => void;

  /**
   * Sets the date filter and resets pagination.
   * V1 Pattern: Date filter clears search mode.
   * @param period - Date filter period ('today', 'week', 'month', 'quarter', 'all')
   */
  setDateFilter: (period: DateFilterPeriod) => void;

  /**
   * Resets pagination to initial state (clears sessions, resets page).
   */
  resetPagination: () => void;

  /**
   * Forces a full refresh of sessions from the filesystem.
   * @returns Promise that resolves when refresh completes
   */
  refreshSessions: () => Promise<void>;
}

/**
 * Hook for managing session list state with React lifecycle integration.
 *
 * @returns {UseSessionsReturn} Session state and actions
 */
export function useSessions(): UseSessionsReturn {
  // Get state and actions from Zustand store
  // BUG FIX: Removed loadProjects from destructuring - it's called in App.tsx instead
  const {
    sessions,
    isLoading,
    hasMore,
    totalCount,
    displayedCount,
    isSearchMode,
    currentSearchQuery,
    currentProjectFilter,
    dateFilter,
    projects,
    loadMoreSessions,
    resetPagination,
    searchSessions,
    setProjectFilter,
    setDateFilter,
    refreshSessions,
  } = useSessionStore();

  // V1 Reference: lines 970-973 (loadInitialSessions)
  // Wrapper that resets then loads
  const loadInitialSessions = useCallback(async () => {
    resetPagination();
    // Small delay to ensure state is reset (matches v1 behavior)
    await new Promise((resolve) => setTimeout(resolve, 0));
    await loadMoreSessions();
  }, [resetPagination, loadMoreSessions]);

  // BUG FIX: Removed duplicate loadProjects useEffect
  // loadProjects is already called in App.tsx lines 262-264 when dateFilter changes.
  // Having it in both places causes duplicate IPC calls.
  // The App.tsx version is preferred because it's part of the central initialization flow.

  // V1 Pattern: Auto-load when filters change and list is empty
  // V1 Reference: lines 226-231 (implicit in event handlers)
  // NOTE: This effect intentionally excludes `sessions`, `isLoading`, and `isSearchMode`
  // from dependencies to avoid infinite loops. We only want to trigger loading
  // when FILTER VALUES change, not when loading state changes.
  useEffect(() => {
    if (sessions.length === 0 && !isLoading && !isSearchMode) {
      void loadMoreSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: Only re-run when filter values change, not state
  }, [currentProjectFilter, dateFilter.from, dateFilter.to]);

  return {
    // State
    sessions,
    isLoading,
    hasMore,
    totalCount,
    displayedCount,
    isSearchMode,
    currentSearchQuery,
    currentProjectFilter,
    dateFilter,
    projects,

    // Actions
    loadInitialSessions,
    loadMoreSessions,
    searchSessions,
    setProjectFilter,
    setDateFilter,
    resetPagination,
    refreshSessions,
  };
}
