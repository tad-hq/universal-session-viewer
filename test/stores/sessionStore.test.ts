import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  useSessionStore,
  selectSessions,
  selectIsLoading,
  selectHasMore,
  selectIsSearchMode,
  selectFilters,
} from '@/stores/sessionStore';
import {
  createMockSession,
  createMockProject,
  configureMockResponses,
  resetMockResponses,
} from '../mocks/electronAPI';

function resetStore() {
  useSessionStore.setState({
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
  });
}

describe('sessionStore', () => {
  beforeEach(() => {
    resetStore();
    resetMockResponses();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useSessionStore.getState();

      expect(state.sessions).toEqual([]);
      expect(state.projects).toEqual([]);
      expect(state.currentPage).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.hasMore).toBe(true);
      expect(state.totalCount).toBe(0);
      expect(state.displayedCount).toBe(0);
      expect(state.isSearchMode).toBe(false);
      expect(state.currentSearchQuery).toBe('');
      expect(state.currentProjectFilter).toBeNull();
      expect(state.dateFilter).toEqual({ from: null, to: null });
    });
  });

  describe('loadMoreSessions', () => {
    it('should load sessions and update state', async () => {
      const mockSessions = [
        createMockSession({ id: '1' }),
        createMockSession({ id: '2' }),
      ];

      configureMockResponses({
        sessions: mockSessions,
      });

      await act(async () => {
        await useSessionStore.getState().loadMoreSessions();
      });

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);
      expect(state.isLoading).toBe(false);
      expect(state.currentPage).toBe(1);
    });

    it('should append sessions for infinite scroll', async () => {
      const batch1 = [createMockSession({ id: '1' })];
      const batch2 = [createMockSession({ id: '2' })];

      useSessionStore.setState({
        sessions: batch1,
        currentPage: 1,
        hasMore: true,
        isLoading: false,
      });

      configureMockResponses({
        sessions: [...batch1, ...batch2],
      });

      window.electronAPI.loadSessionsPaginated = vi.fn().mockResolvedValue({
        success: true,
        sessions: batch2,
        total: 2,
        hasMore: false,
      });

      await act(async () => {
        await useSessionStore.getState().loadMoreSessions();
      });

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);
      expect(state.sessions[0].id).toBe('1');
      expect(state.sessions[1].id).toBe('2');
    });

    it('should skip loading if already loading', async () => {
      useSessionStore.setState({ isLoading: true });

      await act(async () => {
        await useSessionStore.getState().loadMoreSessions();
      });

      expect(window.electronAPI.loadSessionsPaginated).not.toHaveBeenCalled();
    });

    it('should skip loading if hasMore is false', async () => {
      useSessionStore.setState({ hasMore: false });

      await act(async () => {
        await useSessionStore.getState().loadMoreSessions();
      });

      expect(window.electronAPI.loadSessionsPaginated).not.toHaveBeenCalled();
    });

    it('should set hasMore to false on empty result', async () => {
      configureMockResponses({
        sessions: [],
      });

      await act(async () => {
        await useSessionStore.getState().loadMoreSessions();
      });

      const state = useSessionStore.getState();
      expect(state.hasMore).toBe(false);
    });

    it('should handle IPC errors gracefully', async () => {
      configureMockResponses({
        sessions: [],
        errors: {
          getSessions: 'Database connection failed',
          getSessionDetails: null,
          search: null,
          saveSettings: null,
        },
      });

      await act(async () => {
        await useSessionStore.getState().loadMoreSessions();
      });

      const state = useSessionStore.getState();
      expect(state.hasMore).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('searchSessions', () => {
    it('should search and disable pagination', async () => {
      const searchResults = [
        createMockSession({ id: 'result-1', title: 'Test Search Result' }),
      ];

      configureMockResponses({
        searchResults,
      });

      window.electronAPI.searchSessions = vi.fn().mockResolvedValue({
        success: true,
        sessions: searchResults,
        total: 1,
      });

      await act(async () => {
        await useSessionStore.getState().searchSessions('test query');
      });

      const state = useSessionStore.getState();
      expect(state.isSearchMode).toBe(true);
      expect(state.currentSearchQuery).toBe('test query');
      expect(state.hasMore).toBe(false);
      expect(state.sessions).toHaveLength(1);
    });

    it('should clear search on empty query', async () => {
      useSessionStore.setState({
        isSearchMode: true,
        currentSearchQuery: 'previous',
        sessions: [createMockSession()],
      });

      await act(async () => {
        await useSessionStore.getState().searchSessions('');
      });

      const state = useSessionStore.getState();
      expect(state.isSearchMode).toBe(false);
      expect(state.currentSearchQuery).toBe('');
    });

    it('should handle whitespace-only query as empty', async () => {
      useSessionStore.setState({
        isSearchMode: true,
        currentSearchQuery: 'previous',
      });

      await act(async () => {
        await useSessionStore.getState().searchSessions('   ');
      });

      const state = useSessionStore.getState();
      expect(state.isSearchMode).toBe(false);
    });
  });

  describe('clearSearch', () => {
    it('should reset search state and reload sessions', async () => {
      useSessionStore.setState({
        isSearchMode: true,
        currentSearchQuery: 'test',
        sessions: [createMockSession({ title: 'Search Result' })],
      });

      configureMockResponses({
        sessions: [createMockSession({ title: 'Normal Session' })],
      });

      await act(async () => {
        useSessionStore.getState().clearSearch();
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const state = useSessionStore.getState();
      expect(state.isSearchMode).toBe(false);
      expect(state.currentSearchQuery).toBe('');
    });
  });

  describe('setProjectFilter', () => {
    it('should set project filter and reset pagination', () => {
      useSessionStore.setState({
        sessions: [createMockSession()],
        currentPage: 3,
        hasMore: false,
      });

      act(() => {
        useSessionStore.getState().setProjectFilter('/test/project');
      });

      const state = useSessionStore.getState();
      expect(state.currentProjectFilter).toBe('/test/project');
      expect(state.currentPage).toBe(0);
      expect(state.hasMore).toBe(true);
      expect(state.sessions).toHaveLength(0);
    });

    it('should allow clearing project filter', () => {
      useSessionStore.setState({
        currentProjectFilter: '/some/project',
      });

      act(() => {
        useSessionStore.getState().setProjectFilter(null);
      });

      expect(useSessionStore.getState().currentProjectFilter).toBeNull();
    });
  });

  describe('setDateFilter', () => {
    it('should clear search mode when setting date filter', () => {
      useSessionStore.setState({
        isSearchMode: true,
        currentSearchQuery: 'test',
      });

      act(() => {
        useSessionStore.getState().setDateFilter('week');
      });

      const state = useSessionStore.getState();
      expect(state.isSearchMode).toBe(false);
      expect(state.currentSearchQuery).toBe('');
    });

    it('should set correct date range for "today"', () => {
      act(() => {
        useSessionStore.getState().setDateFilter('today');
      });

      const state = useSessionStore.getState();
      expect(state.dateFilter.from).not.toBeNull();
      expect(state.dateFilter.to).not.toBeNull();

      const from = new Date(state.dateFilter.from!);
      const to = new Date(state.dateFilter.to!);

      expect(from.getHours()).toBe(0);
      expect(from.getMinutes()).toBe(0);
      expect(to.getHours()).toBe(23);
      expect(to.getMinutes()).toBe(59);
    });

    it('should set correct date range for "week"', () => {
      act(() => {
        useSessionStore.getState().setDateFilter('week');
      });

      const state = useSessionStore.getState();
      const from = new Date(state.dateFilter.from!);
      const now = new Date();

      const diffDays = Math.round(
        (now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(8);
    });

    it('should set correct date range for "month"', () => {
      act(() => {
        useSessionStore.getState().setDateFilter('month');
      });

      const state = useSessionStore.getState();
      const from = new Date(state.dateFilter.from!);
      const now = new Date();

      const diffDays = Math.round(
        (now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('should set correct date range for "quarter"', () => {
      act(() => {
        useSessionStore.getState().setDateFilter('quarter');
      });

      const state = useSessionStore.getState();
      const from = new Date(state.dateFilter.from!);
      const now = new Date();

      const diffDays = Math.round(
        (now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBeGreaterThanOrEqual(89);
      expect(diffDays).toBeLessThanOrEqual(92);
    });

    it('should clear date filter for "all"', () => {
      useSessionStore.setState({
        dateFilter: {
          from: new Date().toISOString(),
          to: new Date().toISOString(),
        },
      });

      act(() => {
        useSessionStore.getState().setDateFilter('all');
      });

      const state = useSessionStore.getState();
      expect(state.dateFilter.from).toBeNull();
      expect(state.dateFilter.to).toBeNull();
    });

    it('should reset pagination when changing date filter', () => {
      useSessionStore.setState({
        sessions: [createMockSession()],
        currentPage: 5,
      });

      act(() => {
        useSessionStore.getState().setDateFilter('week');
      });

      const state = useSessionStore.getState();
      expect(state.currentPage).toBe(0);
      expect(state.sessions).toHaveLength(0);
    });
  });

  describe('loadProjects', () => {
    it('should load projects from IPC', async () => {
      const mockProjects = [
        createMockProject({ project_path: '/project/a', session_count: 5 }),
        createMockProject({ project_path: '/project/b', session_count: 3 }),
      ];

      configureMockResponses({
        projects: mockProjects,
      });

      await act(async () => {
        await useSessionStore.getState().loadProjects();
      });

      const state = useSessionStore.getState();
      expect(state.projects).toHaveLength(2);
      expect(state.projects[0].project_path).toBe('/project/a');
    });

    it('should clear filter if current project no longer exists', async () => {
      useSessionStore.setState({
        currentProjectFilter: '/old/project',
      });

      configureMockResponses({
        projects: [createMockProject({ project_path: '/new/project' })],
      });

      await act(async () => {
        await useSessionStore.getState().loadProjects();
      });

      const state = useSessionStore.getState();
      expect(state.currentProjectFilter).toBeNull();
    });

    it('should keep filter if current project still exists', async () => {
      useSessionStore.setState({
        currentProjectFilter: '/existing/project',
      });

      configureMockResponses({
        projects: [
          createMockProject({ project_path: '/existing/project' }),
          createMockProject({ project_path: '/other/project' }),
        ],
      });

      await act(async () => {
        await useSessionStore.getState().loadProjects();
      });

      const state = useSessionStore.getState();
      expect(state.currentProjectFilter).toBe('/existing/project');
    });
  });

  describe('refreshSessions', () => {
    it('should refresh sessions via IPC', async () => {
      configureMockResponses({
        sessions: [createMockSession()],
        projects: [createMockProject()],
      });

      await act(async () => {
        await useSessionStore.getState().refreshSessions();
      });

      expect(window.electronAPI.refreshSessions).toHaveBeenCalled();
    });

    it('should reset pagination and reload', async () => {
      useSessionStore.setState({
        sessions: [createMockSession()],
        currentPage: 5,
      });

      configureMockResponses({
        sessions: [createMockSession({ id: 'new' })],
        projects: [],
      });

      await act(async () => {
        await useSessionStore.getState().refreshSessions();
      });

      const state = useSessionStore.getState();
      expect(state.currentPage).toBe(1);
    });
  });

  describe('resetPagination', () => {
    it('should reset all pagination state', () => {
      useSessionStore.setState({
        sessions: [createMockSession()],
        currentPage: 10,
        hasMore: false,
        displayedCount: 500,
      });

      act(() => {
        useSessionStore.getState().resetPagination();
      });

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(0);
      expect(state.currentPage).toBe(0);
      expect(state.hasMore).toBe(true);
      expect(state.displayedCount).toBe(0);
    });
  });

  describe('setSessions', () => {
    it('should replace sessions array', () => {
      const sessions = [
        createMockSession({ id: '1' }),
        createMockSession({ id: '2' }),
      ];

      act(() => {
        useSessionStore.getState().setSessions(sessions);
      });

      expect(useSessionStore.getState().sessions).toEqual(sessions);
    });
  });

  describe('appendSessions', () => {
    it('should append to existing sessions', () => {
      useSessionStore.setState({
        sessions: [createMockSession({ id: '1' })],
      });

      act(() => {
        useSessionStore.getState().appendSessions([
          createMockSession({ id: '2' }),
        ]);
      });

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);
      expect(state.sessions[1].id).toBe('2');
    });
  });

  describe('selectors', () => {
    it('selectSessions should return sessions array', () => {
      const sessions = [createMockSession()];
      useSessionStore.setState({ sessions });

      expect(selectSessions(useSessionStore.getState())).toBe(sessions);
    });

    it('selectIsLoading should return loading state', () => {
      useSessionStore.setState({ isLoading: true });

      expect(selectIsLoading(useSessionStore.getState())).toBe(true);
    });

    it('selectHasMore should return hasMore state', () => {
      useSessionStore.setState({ hasMore: false });

      expect(selectHasMore(useSessionStore.getState())).toBe(false);
    });

    it('selectIsSearchMode should return search mode state', () => {
      useSessionStore.setState({ isSearchMode: true });

      expect(selectIsSearchMode(useSessionStore.getState())).toBe(true);
    });

    it('selectFilters should return filter state', () => {
      useSessionStore.setState({
        currentProjectFilter: '/test',
        dateFilter: { from: '2024-01-01', to: '2024-01-31' },
        currentSearchQuery: 'query',
      });

      const filters = selectFilters(useSessionStore.getState());

      expect(filters.projectFilter).toBe('/test');
      expect(filters.dateFilter).toEqual({ from: '2024-01-01', to: '2024-01-31' });
      expect(filters.searchQuery).toBe('query');
    });
  });
});
