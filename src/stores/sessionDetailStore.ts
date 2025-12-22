import { create } from 'zustand';

import type { Session, SessionDetails, PromptFile } from '../types';

export interface ButtonState {
  disabled: boolean;
  text: string;
  opacity: number;
}

export interface CopyFeedback {
  text: string;
  color: string;
  duration: number;
}

export interface StatusUpdate {
  type: 'loading' | 'success' | 'error' | 'ready';
  message: string;
  autoClearMs?: number;
}

interface SessionDetailState {
  currentSession: SessionDetails | null;
  isLoadingDetails: boolean;
  prompts: PromptFile[];

  isReanalyzing: boolean;
  isResuming: boolean;

  error: string | null;
}

interface SessionDetailActions {
  selectSession: (sessionId: string, sessions: Session[]) => Promise<void>;
  loadFullMessages: () => Promise<void>;
  loadAvailablePrompts: () => Promise<void>;
  reanalyzeSession: (
    customInstructions?: string,
    onStateChange?: (state: ButtonState) => void,
    onStatusChange?: (status: StatusUpdate) => void
  ) => Promise<void>;

  resumeSession: (
    useTmux: boolean,
    promptFile?: string,
    onStatusChange?: (status: StatusUpdate) => void
  ) => Promise<void>;

  copySessionId: (
    sessionId: string,
    onFeedback?: (feedback: CopyFeedback) => void
  ) => Promise<void>;

  clearCurrentSession: () => void;
  setCurrentSession: (session: SessionDetails | null) => void;

  setError: (error: string | null) => void;
  clearError: () => void;
}

type SessionDetailStore = SessionDetailState & SessionDetailActions;

export type { SessionDetailStore };

export const useSessionDetailStore = create<SessionDetailStore>((set, get) => ({
  currentSession: null,
  isLoadingDetails: false,
  prompts: [],
  isReanalyzing: false,
  isResuming: false,
  error: null,

  selectSession: async (sessionId: string, sessions: Session[]) => {
    const state = get();

    const currentId = state.currentSession?.id || state.currentSession?.session_id;
    if (currentId === sessionId) {
      return;
    }

    set({ isLoadingDetails: true });

    const session = sessions.find((s) => (s.session_id || s.id) === sessionId);

    if (session) {
      set({
        currentSession: {
          ...session,
          fullMessagesLoaded: false,
        },
      });
    }

    try {
      const response = await window.electronAPI.getSessionDetails(sessionId);

      if (response.success && response.session) {
        set({
          currentSession: {
            ...response.session,
            fullMessagesLoaded: false,
          },
          error: null,
        });

        await get().loadAvailablePrompts();
      } else {
        const errorMessage = response?.error || 'Failed to load session';
        set({ error: errorMessage });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading session details';
      set({ error: errorMessage });
    } finally {
      set({ isLoadingDetails: false });
    }
  },

  loadFullMessages: async () => {
    const state = get();

    if (!state.currentSession || state.currentSession.fullMessagesLoaded) {
      return;
    }

    try {
      const response = await window.electronAPI.getSessionDetails(state.currentSession.id, true);

      if (response.success && response.session) {
        set((prev) => ({
          currentSession: prev.currentSession
            ? {
                ...prev.currentSession,
                messages: response.session?.messages,
                fullMessagesLoaded: true,
              }
            : null,
          error: null,
        }));
      } else {
        const errorMessage = response?.error || 'Failed to load full messages';
        set({ error: errorMessage });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading full messages';
      set({ error: errorMessage });
    }
  },

  loadAvailablePrompts: async () => {
    try {
      const promptList = await window.electronAPI.getAvailablePrompts();
      set({ prompts: promptList, error: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load prompts';
      set({ error: errorMessage });
    }
  },

  reanalyzeSession: async (
    customInstructions?: string,
    onStateChange?: (state: ButtonState) => void,
    onStatusChange?: (status: StatusUpdate) => void
  ) => {
    const state = get();

    if (!state.currentSession?.id) {
      return;
    }

    set({ isReanalyzing: true });

    try {
      const originalText = '🔄 Re-analyze Summary';

      onStateChange?.({
        disabled: true,
        text: '🔄 Analyzing...',
        opacity: 0.6,
      });

      onStatusChange?.({
        type: 'loading',
        message: customInstructions
          ? 'Re-analyzing with custom instructions...'
          : 'Re-analyzing summary...',
      });

      const settingsResponse = await window.electronAPI.getSettings();
      const bypassQuota = settingsResponse.success
        ? settingsResponse.settings.bypassQuotaOnForceAnalyze
        : false;

      const result = await window.electronAPI.reanalyzeSession(
        state.currentSession.id,
        customInstructions,
        bypassQuota
      );

      if (result.success) {
        onStatusChange?.({
          type: 'success',
          message: 'Analysis complete! Refreshing...',
        });

        if (result.summary) {
          const newSummary: string = result.summary;
          const newTitle: string | null = result.title ?? null;
          set((prev) => ({
            currentSession: prev.currentSession
              ? {
                  ...prev.currentSession,
                  summary: newSummary,
                  title: newTitle ?? prev.currentSession.title,
                }
              : null,
          }));
        } else {
          const response = await window.electronAPI.getSessionDetails(state.currentSession.id);

          if (response.success && response.session) {
            const newSession = response.session;
            set((prev) => ({
              currentSession: {
                ...newSession,
                fullMessagesLoaded: prev.currentSession?.fullMessagesLoaded || false,
              },
            }));
          }
        }
      } else {
        onStatusChange?.({
          type: 'error',
          message: `Analysis failed: ${result.error || 'Unknown error'}`,
        });
      }

      onStateChange?.({
        disabled: false,
        text: originalText,
        opacity: 1,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: `Failed to re-analyze: ${errorMessage}` });
      onStatusChange?.({
        type: 'error',
        message: `Failed to re-analyze: ${errorMessage}`,
      });

      onStateChange?.({
        disabled: false,
        text: '🔄 Re-analyze Summary',
        opacity: 1,
      });
    } finally {
      set({ isReanalyzing: false });
    }
  },

  resumeSession: async (
    useTmux: boolean,
    promptFile: string = '',
    onStatusChange?: (status: StatusUpdate) => void
  ) => {
    const state = get();

    // Use id field with session_id fallback for field inconsistency
    const sessionId = state.currentSession?.id || state.currentSession?.session_id;

    // Stricter validation matching backend security.js:42-44
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      const errorMessage = 'No valid session selected';
      set({ error: errorMessage });
      onStatusChange?.({
        type: 'error',
        message: errorMessage,
        autoClearMs: 5000,
      });
      return;
    }

    set({ isResuming: true });

    try {
      onStatusChange?.({
        type: 'loading',
        message: `Resuming session${useTmux ? ' with tmux' : ''}...`,
      });

      // Check the response object (matching App.tsx line 571 pattern)
      const result = await window.electronAPI.resumeSession(sessionId, promptFile, useTmux);

      // Verify success before showing success message
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to resume session');
      }

      onStatusChange?.({
        type: 'success',
        message: `Session resumed${useTmux ? ' with tmux' : ''} in new terminal`,
        autoClearMs: 3000,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: `Failed to resume: ${errorMessage}` });
      onStatusChange?.({
        type: 'error',
        message: `Failed to resume: ${errorMessage}`,
        autoClearMs: 5000,
      });
    } finally {
      set({ isResuming: false });
    }
  },

  copySessionId: async (sessionId: string, onFeedback?: (feedback: CopyFeedback) => void) => {
    try {
      await navigator.clipboard.writeText(sessionId);

      onFeedback?.({
        text: '✓',
        color: '#4CAF50',
        duration: 1500,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to copy session ID';
      set({ error: errorMessage });
    }
  },

  clearCurrentSession: () =>
    set({
      currentSession: null,
      prompts: [],
      error: null,
    }),

  setCurrentSession: (session: SessionDetails | null) => set({ currentSession: session }),

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
}));

export const selectCurrentSession = (state: SessionDetailStore): SessionDetails | null =>
  state.currentSession;
export const selectIsLoadingDetails = (state: SessionDetailStore): boolean =>
  state.isLoadingDetails;
export const selectPrompts = (state: SessionDetailStore): PromptFile[] => state.prompts;
export const selectIsReanalyzing = (state: SessionDetailStore): boolean => state.isReanalyzing;
export const selectIsResuming = (state: SessionDetailStore): boolean => state.isResuming;
export const selectDetailError = (state: SessionDetailStore): string | null => state.error;
