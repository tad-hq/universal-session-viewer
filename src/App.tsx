import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import { useShallow } from 'zustand/react/shallow';

import { Header } from './components/layout/Header';
import { ContinuationDetectionProgress } from './components/session/ContinuationDetectionProgress';
import { MainContent } from './components/session/MainContent';
import { SelectionToolbar } from './components/session/SelectionToolbar';
import { Sidebar } from './components/session/Sidebar';
import { SettingsModal } from './components/settings/SettingsModal';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './components/ui/dialog';
import { Toaster } from './components/ui/sonner';
import {
  useSessionDetails,
  useSettings,
  useCollapseState,
  useQuota,
  useIPC,
  useStatus,
  useKeyboardNavigation,
  useKeyboardShortcuts,
  useToast,
  useMainProcessErrors,
  useContinuationEvents,
  type StatusUpdate,
} from './hooks';
import { useBulkOperationsEvents } from './hooks/useBulkOperationsEvents';
import { useContinuationStore } from './stores/continuationStore';
import { useSelectionStore, selectSelectionCount } from './stores/selectionStore';
import { useSessionDetailStore } from './stores/sessionDetailStore';
import {
  useSessionStore,
  selectIsLoading,
  selectHasMore,
  selectIsSearchMode,
  selectProjects,
  selectError,
  selectFilteredSessions,
  selectIsRelatedFilterActive,
} from './stores/sessionStore';
import { debounce } from './utils';

import type { DateFilterPeriod, Session, AnalysisStatus, Settings } from './types';

export function App(): JSX.Element {
  const sessions = useSessionStore(selectFilteredSessions);
  const isLoading = useSessionStore(selectIsLoading);
  const hasMore = useSessionStore(selectHasMore);
  const isSearchMode = useSessionStore(selectIsSearchMode);
  const projects = useSessionStore(selectProjects);
  const sessionError = useSessionStore(selectError);
  const isRelatedFilterActive = useSessionStore(selectIsRelatedFilterActive);

  const { totalCount, displayedCount } = useSessionStore(
    useShallow((state) => ({
      totalCount: state.totalCount,
      displayedCount: state.displayedCount,
    }))
  );

  const { currentSearchQuery, currentProjectFilter, dateFilter } = useSessionStore(
    useShallow((state) => ({
      currentSearchQuery: state.currentSearchQuery,
      currentProjectFilter: state.currentProjectFilter,
      dateFilter: state.dateFilter,
    }))
  );

  const {
    loadMoreSessions,
    searchSessions,
    setCurrentSearchQuery,
    setProjectFilter,
    setDateFilter,
    resetPagination,
    refreshSessions,
    loadProjects,
    setRelatedSessionsFilter,
    clearRelatedSessionsFilter,
  } = useSessionStore(
    useShallow((state) => ({
      loadMoreSessions: state.loadMoreSessions,
      searchSessions: state.searchSessions,
      setCurrentSearchQuery: state.setCurrentSearchQuery,
      setProjectFilter: state.setProjectFilter,
      setDateFilter: state.setDateFilter,
      resetPagination: state.resetPagination,
      refreshSessions: state.refreshSessions,
      loadProjects: state.loadProjects,
      setRelatedSessionsFilter: state.setRelatedSessionsFilter,
      clearRelatedSessionsFilter: state.clearRelatedSessionsFilter,
    }))
  );

  const isSelectionMode = useSelectionStore((state) => state.isSelectionMode);
  const selectionCount = useSelectionStore(selectSelectionCount);
  const selectedSessionIds = useSelectionStore((state) => state.selectedSessionIds);
  const { toggleSelection, selectAll, clearSelection, selectRange, exitSelectionMode } =
    useSelectionStore(
      useShallow((state) => ({
        toggleSelection: state.toggleSelection,
        selectAll: state.selectAll,
        clearSelection: state.clearSelection,
        selectRange: state.selectRange,
        exitSelectionMode: state.exitSelectionMode,
      }))
    );

  const loadInitialSessions = useCallback(async () => {
    resetPagination();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await loadMoreSessions();
  }, [resetPagination, loadMoreSessions]);

  const {
    currentSession,
    isLoadingDetails,
    prompts,
    error: detailError,
    selectSession,
    loadFullMessages,
    reanalyzeSession,
    resumeSession,
    copySessionId,
  } = useSessionDetails();

  const { settings, isSettingsOpen, openSettings, closeSettings, saveSettings, clearCache } =
    useSettings();

  const { toggleSection, isCollapsed } = useCollapseState();
  const { quota, updateQuota } = useQuota();
  const { status, updateStatus } = useStatus();
  const toast = useToast();

  useMainProcessErrors();
  useBulkOperationsEvents();
  useContinuationEvents();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateFilterPeriod, setDateFilterPeriod] = useState<DateFilterPeriod>('all');
  const [formData, setFormData] = useState<Settings>(settings);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);

  const [autoResumeDialog, setAutoResumeDialog] = useState<{
    isOpen: boolean;
    session: { sessionId: string; projectPath: string; title: string | null } | null;
  }>({ isOpen: false, session: null });

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      void selectSession(sessionId, sessions);
    },
    [selectSession, sessions]
  );

  const handleSelectAll = useCallback(() => {
    const sessionIds = sessions.map((s) => s.session_id || s.id);
    selectAll(sessionIds);
  }, [sessions, selectAll]);

  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleExitSelectionMode = useCallback(() => {
    exitSelectionMode();
  }, [exitSelectionMode]);

  const handleToggleSelect = useCallback(
    (sessionId: string) => {
      toggleSelection(sessionId);
    },
    [toggleSelection]
  );

  const handleExtendSelection = useCallback(
    (direction: 'up' | 'down') => {
      if (!currentSession) return;

      const currentIndex = sessions.findIndex(
        (s) => (s.session_id || s.id) === (currentSession.session_id || currentSession.id)
      );
      if (currentIndex === -1) return;

      const sessionIds = sessions.map((s) => s.session_id || s.id);
      const targetIndex =
        direction === 'down'
          ? Math.min(currentIndex + 1, sessions.length - 1)
          : Math.max(currentIndex - 1, 0);

      const targetId = sessionIds[targetIndex];
      if (targetId) {
        selectRange(targetId, sessionIds);
        void selectSession(targetId, sessions);
      }
    },
    [currentSession, sessions, selectRange, selectSession]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    updateStatus('loading', 'Refreshing sessions...');
    try {
      await refreshSessions();
      updateStatus('ready', 'Sessions refreshed');
      toast.success('Sessions refreshed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh';
      updateStatus('error', message);
      toast.error('Failed to refresh sessions', { description: message });
    }
    setIsRefreshing(false);
  }, [refreshSessions, updateStatus, toast]);

  const handleDateFilterChange = useCallback(
    (period: DateFilterPeriod) => {
      setDateFilterPeriod(period);
      setDateFilter(period);
    },
    [setDateFilter]
  );

  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        if (query.length > 2) {
          void searchSessions(query);
        } else if (query === '') {
          void searchSessions('');
        }
      }, 300),
    [searchSessions]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setCurrentSearchQuery(query);

      if (query === '') {
        debouncedSearch.cancel();
        void searchSessions('');
      } else {
        debouncedSearch(query);
      }
    },
    [debouncedSearch, searchSessions, setCurrentSearchQuery]
  );

  const handleSessionUpdated = useCallback(
    (updatedSession: Session) => {
      const currentId = currentSession?.id || currentSession?.session_id;
      const updatedId = updatedSession.id || updatedSession.session_id;

      if (currentId && updatedId && currentId === updatedId) {
        const { setCurrentSession } = useSessionDetailStore.getState();
        setCurrentSession({
          ...updatedSession,
          fullMessagesLoaded: currentSession?.fullMessagesLoaded || false,
        });
      }

      const { updateSessionInList } = useSessionStore.getState();
      updateSessionInList(updatedSession);
    },
    [currentSession]
  );

  const handleAnalysisStatus = useCallback(
    (data: AnalysisStatus) => {
      if (data.status === 'analyzing') {
        updateStatus('analyzing', `${data.message} (${data.current}/${data.total})`);
      } else {
        updateStatus('loading', data.message);
      }
    },
    [updateStatus]
  );

  const handleAnalysisComplete = useCallback(
    (message: string) => {
      updateStatus('ready', message);
      void updateQuota();
    },
    [updateStatus, updateQuota]
  );

  const handleAnalysisError = useCallback(
    (error: string) => {
      updateStatus('error', `Error: ${error}`);
    },
    [updateStatus]
  );

  const handleDiscoveryComplete = useCallback(
    (data: { message: string }) => {
      updateStatus('ready', data.message);
    },
    [updateStatus]
  );

  useIPC({
    onSessionUpdated: handleSessionUpdated,
    onAnalysisStatus: handleAnalysisStatus,
    onAnalysisComplete: handleAnalysisComplete,
    onAnalysisError: handleAnalysisError,
    onDiscoveryComplete: handleDiscoveryComplete,
  });

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    const initializeApp = async (): Promise<void> => {
      try {
        await window.electronAPI.rendererReady();
        await loadInitialSessions();
        await updateQuota();
        await loadProjects();

        setTimeout(() => {
          const currentSettings = settings;
          if (currentSettings?.claudeCode?.autoResume) {
            void (async () => {
              try {
                const result = await window.electronAPI.getMostRecentSession();
                if (result.success && result.session) {
                  setAutoResumeDialog({ isOpen: true, session: result.session });
                }
              } catch (error) {
                console.error('Failed to get most recent session for auto-resume:', error);
              }
            })();
          }
        }, 500);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to initialize app';
        toast.error('Application initialization failed', { description: message });
        updateStatus('error', `Initialization failed: ${message}`);
      }
    };
    void initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects, dateFilter.from, dateFilter.to]);

  useEffect(() => {
    if (isSelectionMode) {
      clearSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSearchQuery, currentProjectFilter, dateFilter.from, dateFilter.to]);

  useEffect(() => {
    if (sessions.length === 0 && !isLoading && !isSearchMode) {
      void loadMoreSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectFilter, dateFilter.from, dateFilter.to]);

  const sessionIds = useMemo(() => sessions.map((s) => s.session_id || s.id), [sessions]);

  const handleClearSearch = useCallback(() => {
    debouncedSearch.cancel();
    void searchSessions('');
  }, [debouncedSearch, searchSessions]);

  const expandGroup = useContinuationStore((state) => state.expandGroup);
  const collapseGroup = useContinuationStore((state) => state.collapseGroup);
  const isExpanded = useContinuationStore((state) => state.isExpanded);
  const getContinuationGroup = useContinuationStore((state) => state.getContinuationGroup);

  useKeyboardNavigation({
    sessionIds,
    currentSessionId: currentSession?.id || null,
    onSelectSession: handleSelectSession,
    searchInputRef,
    onClearSearch: handleClearSearch,
    enabled: !isSettingsOpen,
    onSelectAll: handleSelectAll,
    onClearSelection: handleClearSelection,
    onToggleSelection: handleToggleSelect,
    onExtendSelection: handleExtendSelection,
    onExitSelectionMode: handleExitSelectionMode,
    isSelectionMode,
    onExpandGroup: expandGroup,
    onCollapseGroup: collapseGroup,
    isGroupExpanded: isExpanded,
    getContinuationGroup,
  });

  useKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onRefresh: () => void handleRefresh(),
    onOpenSettings: () => void openSettings(),
    onClearRelatedFilter: clearRelatedSessionsFilter,
    isRelatedFilterActive,
    enabled: !isSettingsOpen,
  });

  return (
    <div className="flex h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={(e) => {
          e.preventDefault();
          const mainContent = document.getElementById('main-content');
          if (mainContent) {
            mainContent.focus({ preventScroll: true });
            mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      >
        Skip to main content
      </a>
      <a
        href="#session-search"
        className="sr-only focus:not-sr-only focus:absolute focus:left-44 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={(e) => {
          e.preventDefault();
          searchInputRef.current?.focus({ preventScroll: true });
        }}
      >
        Skip to search
      </a>

      <Header
        sessionCount={{ displayed: displayedCount, total: totalCount }}
        status={status}
        quota={{
          current: quota.current,
          limit: quota.limit,
          allowed: quota.allowed,
        }}
        onRefresh={handleRefresh}
        onOpenSettings={openSettings}
        isRefreshing={isRefreshing}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          ref={searchInputRef}
          sessions={sessions}
          currentSessionId={currentSession?.id || null}
          onSelectSession={handleSelectSession}
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={loadMoreSessions}
          isSearchMode={isSearchMode}
          searchQuery={currentSearchQuery}
          onSearchChange={handleSearchChange}
          projectFilter={currentProjectFilter}
          projects={projects}
          onProjectChange={setProjectFilter}
          dateFilter={dateFilterPeriod}
          onDateFilterChange={handleDateFilterChange}
          error={sessionError}
          onRetry={loadMoreSessions}
          onClearRelatedFilter={clearRelatedSessionsFilter}
          onFilterRelated={setRelatedSessionsFilter}
        />

        <MainContent
          session={currentSession}
          isLoading={isLoadingDetails}
          prompts={prompts}
          summaryCollapsed={isCollapsed('summary')}
          resumeCollapsed={isCollapsed('resume')}
          onToggleSummary={() => toggleSection('summary')}
          onToggleResume={() => toggleSection('resume')}
          onCopySessionId={(id) => copySessionId(id)}
          onReanalyze={(useExt) =>
            reanalyzeSession(useExt, undefined, (status: StatusUpdate) =>
              updateStatus(status.type, status.message)
            )
          }
          onResume={(tmux, prompt) =>
            resumeSession(tmux, prompt, (status: StatusUpdate) =>
              updateStatus(status.type, status.message)
            )
          }
          onLoadFullMessages={loadFullMessages}
          error={detailError}
          onRetry={currentSession ? () => selectSession(currentSession.id, sessions) : undefined}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        settings={settings}
        formData={formData}
        onFormDataChange={setFormData}
        isSaving={isSettingsSaving}
        onSave={async (data) => {
          setIsSettingsSaving(true);
          const success = await saveSettings(data);
          setIsSettingsSaving(false);
          if (success) {
            toast.success('Settings saved');
          } else {
            toast.error('Failed to save settings');
          }
          return success;
        }}
        onClearCache={async () => {
          try {
            const result = await clearCache();
            if (result.success) {
              toast.success(`Cache cleared (${result.cleared} entries)`);
            } else {
              toast.error('Failed to clear cache');
            }
            return result;
          } catch (error) {
            toast.error('Failed to clear cache');
            return { success: false, cleared: 0 };
          }
        }}
      />

      {isSelectionMode && selectionCount > 0 && (
        <SelectionToolbar
          selectedCount={selectionCount}
          totalCount={sessions.length}
          selectedSessionIds={Array.from(selectedSessionIds)}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onExitSelectionMode={handleExitSelectionMode}
        />
      )}

      <ContinuationDetectionProgress />

      <Dialog
        open={autoResumeDialog.isOpen}
        onOpenChange={(open) => !open && setAutoResumeDialog({ isOpen: false, session: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resume Last Session?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-muted-foreground">
              Would you like to resume your most recent Claude Code session?
            </p>
            {autoResumeDialog.session && (
              <div className="rounded-md bg-muted p-3">
                <p className="font-medium">
                  {autoResumeDialog.session.title || 'Untitled Session'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {autoResumeDialog.session.projectPath}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-3 sm:gap-3">
            <Button
              variant="secondary"
              onClick={() => setAutoResumeDialog({ isOpen: false, session: null })}
            >
              Not Now
            </Button>
            <Button
              onClick={async () => {
                if (autoResumeDialog.session) {
                  const sessionToResume = autoResumeDialog.session;
                  setAutoResumeDialog({ isOpen: false, session: null });
                  try {
                    updateStatus('loading', 'Resuming session...');
                    const result = await window.electronAPI.resumeSession(
                      sessionToResume.sessionId,
                      undefined,
                      settings?.terminal?.useTmux || false
                    );
                    if (result.success) {
                      updateStatus('ready', 'Session resumed in terminal');
                      toast.success('Session resumed in terminal');
                    } else {
                      updateStatus('error', result.error || 'Failed to resume session');
                      toast.error('Failed to resume session', { description: result.error });
                    }
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    updateStatus('error', `Failed to resume: ${message}`);
                    toast.error('Failed to resume session', { description: message });
                  }
                }
              }}
            >
              Resume Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
