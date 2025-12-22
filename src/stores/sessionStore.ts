import { create } from 'zustand';

import type { Session, DateFilter, DateFilterPeriod, Project, SessionFilters } from '../types';

const PAGE_SIZE = 50;

interface SearchDeduplicationInfo {
  isGrouped: boolean;
  totalRawMatches: number;
  totalDeduplicatedResults: number;
  chainsGrouped: number;
}

interface SessionState {
  sessions: Session[];
  projects: Project[];

  currentPage: number;
  isLoading: boolean;
  hasMore: boolean;
  totalCount: number;
  displayedCount: number;

  isSearchMode: boolean;
  currentSearchQuery: string;
  currentProjectFilter: string | null;
  dateFilter: DateFilter;

  searchDeduplication: SearchDeduplicationInfo | null;
  relatedSessionsFilter: {
    triggerSessionId: string;
    chainSessionIds: string[];
  } | null;

  error: string | null;
}

interface SessionActions {
  loadMoreSessions: () => Promise<void>;
  resetPagination: () => void;
  searchSessions: (query: string) => Promise<void>;
  clearSearch: () => void;
  setProjectFilter: (path: string | null) => void;
  setDateFilter: (period: DateFilterPeriod) => void;
  loadProjects: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  setSessions: (sessions: Session[]) => void;
  appendSessions: (sessions: Session[]) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  updateSessionInList: (session: Session) => void;
  setRelatedSessionsFilter: (sessionId: string) => Promise<void>;
  clearRelatedSessionsFilter: () => void;
  setCurrentSearchQuery: (query: string) => void;
}

type SessionStore = SessionState & SessionActions;

export type { SessionStore };

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  projects: [],
  currentPage: 0,
  isLoading: false,
  hasMore: true,
  totalCount: 0,
  displayedCount: 0,
  isSearchMode: false,
  currentSearchQuery: '',
  currentProjectFilter: null,
  dateFilter: { from: null, to: null },
  searchDeduplication: null,
  relatedSessionsFilter: null,
  error: null,

  resetPagination: () => {
    set({
      currentPage: 0,
      hasMore: true,
      sessions: [],
      displayedCount: 0,
    });
  },

  loadMoreSessions: async () => {
    const state = get();

    if (state.isLoading || !state.hasMore) {
      return;
    }

    set({ isLoading: true });

    const filters: SessionFilters = {
      projectPath: state.currentProjectFilter,
      dateFrom: state.dateFilter.from,
      dateTo: state.dateFilter.to,
      chainSessionIds: state.relatedSessionsFilter?.chainSessionIds || null,
    };

    const offset = state.currentPage * PAGE_SIZE;

    try {
      const result = await window.electronAPI.loadSessionsPaginated(PAGE_SIZE, offset, filters);

      if (result.success) {
        const newSessions = result.sessions;

        if (newSessions.length === 0) {
          set({ hasMore: false, isLoading: false, error: null });
          return;
        }

        set((prev) => ({
          sessions: [...prev.sessions, ...newSessions],
          totalCount: result.total || 0,
          displayedCount: prev.displayedCount + newSessions.length,
          hasMore: result.hasMore !== false,
          currentPage: prev.currentPage + 1,
          isLoading: false,
          error: null,
        }));
      } else {
        const errorMessage = result.error || 'Failed to load sessions';
        set({ hasMore: false, isLoading: false, error: errorMessage });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading sessions';
      set({ hasMore: false, isLoading: false, error: errorMessage });
    }
  },

  searchSessions: async (query: string) => {
    if (!query || query.trim() === '') {
      get().clearSearch();
      return;
    }

    if (get().relatedSessionsFilter) {
      set({ relatedSessionsFilter: null });
    }

    set({
      isSearchMode: true,
      currentSearchQuery: query,
      isLoading: true,
    });

    try {
      const result = await window.electronAPI.searchSessions(query, 200, 0);

      if (result.success) {
        set({
          sessions: result.sessions,
          totalCount: result.total || 0,
          displayedCount: result.sessions.length,
          hasMore: false,
          isLoading: false,
          error: null,
        });
      } else {
        const errorMessage = result.error || 'Search failed';
        set({ isLoading: false, error: errorMessage });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error searching sessions';
      set({ isLoading: false, error: errorMessage });
    }
  },

  clearSearch: () => {
    set({
      isSearchMode: false,
      currentSearchQuery: '',
      searchDeduplication: null,
    });
    get().resetPagination();
    setTimeout(() => void get().loadMoreSessions(), 0);
  },

  setProjectFilter: (path: string | null) => {
    set({ currentProjectFilter: path });
    get().resetPagination();
    setTimeout(() => void get().loadMoreSessions(), 0);
  },

  setDateFilter: (period: DateFilterPeriod) => {
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;

    set({
      isSearchMode: false,
      currentSearchQuery: '',
    });

    switch (period) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        from = new Date(now);
        from.setDate(from.getDate() - 7);
        from.setHours(0, 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'month':
        from = new Date(now);
        from.setDate(from.getDate() - 30);
        from.setHours(0, 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'quarter':
        from = new Date(now);
        from.setDate(from.getDate() - 90);
        from.setHours(0, 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'all':
      default:
        set({ dateFilter: { from: null, to: null } });
        get().resetPagination();
        setTimeout(() => void get().loadMoreSessions(), 0);
        return;
    }

    set({
      dateFilter: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
    get().resetPagination();
    setTimeout(() => void get().loadMoreSessions(), 0);
  },

  loadProjects: async () => {
    const state = get();
    try {
      const filters = {
        dateFrom: state.dateFilter.from,
        dateTo: state.dateFilter.to,
      };
      const result = await window.electronAPI.getAvailableProjects(filters);

      if (result.success) {
        set({ projects: result.projects, error: null });

        if (state.currentProjectFilter) {
          const stillExists = result.projects.some(
            (p) => p.project_path === state.currentProjectFilter
          );
          if (!stillExists) {
            set({ currentProjectFilter: null });
          }
        }
      } else {
        const errorMessage = result.error || 'Failed to load projects';
        set({ error: errorMessage });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading projects';
      set({ error: errorMessage });
    }
  },

  refreshSessions: async () => {
    const { resetPagination, loadMoreSessions, loadProjects } = get();
    try {
      await window.electronAPI.refreshSessions();
      resetPagination();
      await loadMoreSessions();
      await loadProjects();
      set({ error: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error refreshing sessions';
      set({ error: errorMessage });
      throw error;
    }
  },

  setSessions: (sessions: Session[]) => set({ sessions }),
  appendSessions: (sessions: Session[]) =>
    set((prev) => ({ sessions: [...prev.sessions, ...sessions] })),

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),

  updateSessionInList: (updatedSession: Session) => {
    const updatedId = updatedSession.id || updatedSession.session_id;
    if (!updatedId) return;

    set((prev) => ({
      sessions: prev.sessions.map((session) => {
        const sessionId = session.id || session.session_id;
        if (sessionId === updatedId) {
          return { ...session, ...updatedSession };
        }
        return session;
      }),
    }));
  },

  setRelatedSessionsFilter: async (sessionId: string) => {
    set({ isLoading: true });

    try {
      const chainResult = await window.electronAPI.getContinuationChain(sessionId);

      if (!chainResult.success) {
        const errorMessage = chainResult.error || 'Failed to load continuation chain';
        set({ error: errorMessage, isLoading: false });
        return;
      }

      const chain = chainResult.chain;
      if (!chain) {
        set({ error: 'Continuation chain not found', isLoading: false });
        return;
      }

      const chainSessionIds: string[] = [];

      const parentId = chain.parent.id || chain.parent.session_id;
      if (parentId) chainSessionIds.push(parentId);

      chain.children.forEach((child) => {
        const childId = child.id || child.session_id;
        if (childId) chainSessionIds.push(childId);
      });

      if (chain.flatDescendants && Array.isArray(chain.flatDescendants)) {
        chain.flatDescendants.forEach((descendant) => {
          const descId = descendant.session?.id || descendant.session?.session_id;
          if (descId && !chainSessionIds.includes(descId)) {
            chainSessionIds.push(descId);
          }
        });
      }

      const uniqueChainIds = Array.from(new Set(chainSessionIds));

      // Set the filter and reset pagination to load all chain sessions
      // This follows the same pattern as setProjectFilter and clearRelatedSessionsFilter
      set({
        relatedSessionsFilter: {
          triggerSessionId: sessionId,
          chainSessionIds: uniqueChainIds,
        },
        isLoading: false,
        error: null,
      });

      // Reset pagination and reload sessions with the filter applied
      get().resetPagination();
      setTimeout(() => void get().loadMoreSessions(), 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error loading continuation chain';
      set({ error: errorMessage, isLoading: false });
    }
  },

  clearRelatedSessionsFilter: () => {
    set({ relatedSessionsFilter: null });
    get().resetPagination();
    setTimeout(() => void get().loadMoreSessions(), 0);
  },

  setCurrentSearchQuery: (query: string) => {
    set({ currentSearchQuery: query });
  },
}));

export const selectSessions = (state: SessionStore): Session[] => state.sessions;

export const selectIsLoading = (state: SessionStore): boolean => state.isLoading;

export const selectHasMore = (state: SessionStore): boolean => state.hasMore;

export const selectIsSearchMode = (state: SessionStore): boolean => state.isSearchMode;

export const selectProjects = (state: SessionStore): Project[] => state.projects;

export const selectFilters = (
  state: SessionStore
): {
  projectFilter: string | null;
  dateFilter: { from: string | null; to: string | null };
  searchQuery: string;
} => ({
  projectFilter: state.currentProjectFilter,
  dateFilter: state.dateFilter,
  searchQuery: state.currentSearchQuery,
});

export const selectError = (state: SessionStore): string | null => state.error;

export const selectSearchDeduplication = (state: SessionStore): SearchDeduplicationInfo | null =>
  state.searchDeduplication;

export const selectIsRelatedFilterActive = (state: SessionStore): boolean =>
  state.relatedSessionsFilter !== null;

export const selectRelatedFilterTriggerSessionId = (state: SessionStore): string | null =>
  state.relatedSessionsFilter?.triggerSessionId || null;

export const selectFilteredSessions = (state: SessionStore): Session[] => {
  const { sessions, relatedSessionsFilter } = state;

  if (relatedSessionsFilter) {
    const { chainSessionIds } = relatedSessionsFilter;
    return sessions.filter((session) => {
      const sessionId = session.id || session.session_id;
      return sessionId && chainSessionIds.includes(sessionId);
    });
  }

  return sessions;
};

export type { SearchDeduplicationInfo };
