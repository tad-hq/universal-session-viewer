import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  useSessionDetailStore,
  selectCurrentSession,
  selectIsLoadingDetails,
  selectPrompts,
  selectIsReanalyzing,
  selectIsResuming,
} from '@/stores/sessionDetailStore';
import {
  createMockSession,
  createMockSessionDetails,
  configureMockResponses,
  resetMockResponses,
  createMockPromptFile,
} from '../mocks/electronAPI';

function resetStore() {
  useSessionDetailStore.setState({
    currentSession: null,
    isLoadingDetails: false,
    prompts: [],
    isReanalyzing: false,
    isResuming: false,
    error: null,
  });
}

describe('sessionDetailStore', () => {
  beforeEach(() => {
    resetStore();
    resetMockResponses();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useSessionDetailStore.getState();

      expect(state.currentSession).toBeNull();
      expect(state.isLoadingDetails).toBe(false);
      expect(state.prompts).toEqual([]);
      expect(state.isReanalyzing).toBe(false);
      expect(state.isResuming).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('selectSession', () => {
    it('should load session details and set current session', async () => {
      const mockSession = createMockSession({ id: 'test-session' });
      const mockDetails = createMockSessionDetails({ id: 'test-session' });

      configureMockResponses({ sessionDetails: mockDetails });

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .selectSession('test-session', [mockSession]);
      });

      const state = useSessionDetailStore.getState();
      expect(state.currentSession).not.toBeNull();
      expect(state.currentSession?.id).toBe('test-session');
      expect(state.isLoadingDetails).toBe(false);
    });

    it('should handle dual ID fields (id and session_id)', async () => {
      const mockSession = createMockSession({
        id: 'test-1',
        session_id: 'test-1',
      });
      const mockDetails = createMockSessionDetails({
        id: 'test-1',
        session_id: 'test-1',
      });

      configureMockResponses({ sessionDetails: mockDetails });

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .selectSession('test-1', [mockSession]);
      });

      const state = useSessionDetailStore.getState();
      expect(state.currentSession).not.toBeNull();
    });

    it('should skip loading if same session is already selected', async () => {
      const mockSession = createMockSession({ id: 'test-session' });

      useSessionDetailStore.setState({
        currentSession: mockSession as any,
      });

      const getSessionDetailsMock =
        window.electronAPI.getSessionDetails as any;

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .selectSession('test-session', [mockSession]);
      });

      expect(getSessionDetailsMock).not.toHaveBeenCalled();
    });

    it('should load prompts after session loads', async () => {
      const mockSession = createMockSession({ id: 'test-session' });
      const mockDetails = createMockSessionDetails({ id: 'test-session' });
      const mockPrompts = [createMockPromptFile()];

      configureMockResponses({
        sessionDetails: mockDetails,
        prompts: mockPrompts,
      });

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .selectSession('test-session', [mockSession]);
      });

      const state = useSessionDetailStore.getState();
      expect(state.prompts).toHaveLength(1);
    });

    it('should set error on IPC failure', async () => {
      const mockSession = createMockSession({ id: 'test-session' });

      configureMockResponses({
        sessionDetails: null,
        errors: {
          getSessionDetails: 'Failed to load',
          getSessions: null,
          search: null,
          saveSettings: null,
        },
      });

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .selectSession('test-session', [mockSession]);
      });

      const state = useSessionDetailStore.getState();
      expect(state.error).toBe('Failed to load');
    });
  });

  describe('loadFullMessages', () => {
    it('should load full messages when not already loaded', async () => {
      const mockDetails = createMockSessionDetails({
        id: 'test-session',
        fullMessagesLoaded: false,
      });

      useSessionDetailStore.setState({
        currentSession: mockDetails,
      });

      configureMockResponses({
        sessionDetails: {
          ...mockDetails,
          fullMessagesLoaded: true,
          messages: [...mockDetails.messages, { type: 'user', content: 'More' }],
        },
      });

      await act(async () => {
        await useSessionDetailStore.getState().loadFullMessages();
      });

      const state = useSessionDetailStore.getState();
      expect(state.currentSession?.fullMessagesLoaded).toBe(true);
    });

    it('should skip if messages already loaded', async () => {
      const mockDetails = createMockSessionDetails({
        id: 'test-session',
        fullMessagesLoaded: true,
      });

      useSessionDetailStore.setState({
        currentSession: mockDetails,
      });

      const getSessionDetailsMock =
        window.electronAPI.getSessionDetails as any;

      await act(async () => {
        await useSessionDetailStore.getState().loadFullMessages();
      });

      expect(getSessionDetailsMock).not.toHaveBeenCalled();
    });

    it('should skip if no current session', async () => {
      useSessionDetailStore.setState({ currentSession: null });

      const getSessionDetailsMock =
        window.electronAPI.getSessionDetails as any;

      await act(async () => {
        await useSessionDetailStore.getState().loadFullMessages();
      });

      expect(getSessionDetailsMock).not.toHaveBeenCalled();
    });
  });

  describe('loadAvailablePrompts', () => {
    it('should load prompts from IPC', async () => {
      const mockPrompts = [
        createMockPromptFile({ filename: 'test1.md' }),
        createMockPromptFile({ filename: 'test2.md' }),
      ];

      window.electronAPI.getAvailablePrompts = vi
        .fn()
        .mockResolvedValue(mockPrompts);

      await act(async () => {
        await useSessionDetailStore.getState().loadAvailablePrompts();
      });

      const state = useSessionDetailStore.getState();
      expect(state.prompts).toHaveLength(2);
    });

    it('should handle IPC errors', async () => {
      window.electronAPI.getAvailablePrompts = vi
        .fn()
        .mockRejectedValue(new Error('Failed to load prompts'));

      await act(async () => {
        await useSessionDetailStore.getState().loadAvailablePrompts();
      });

      const state = useSessionDetailStore.getState();
      expect(state.error).toContain('Failed to load prompts');
    });
  });

  describe('reanalyzeSession', () => {
    it('should trigger reanalysis with visual feedback', async () => {
      const mockDetails = createMockSessionDetails({ id: 'test-session' });
      useSessionDetailStore.setState({ currentSession: mockDetails });

      const onStateChange = vi.fn();
      const onStatusChange = vi.fn();

      window.electronAPI.reanalyzeSession = vi
        .fn()
        .mockResolvedValue({ success: true, summary: 'New summary' });

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .reanalyzeSession(undefined, onStateChange, onStatusChange);
      });

      expect(onStateChange).toHaveBeenCalled();
      expect(onStatusChange).toHaveBeenCalled();
      expect(useSessionDetailStore.getState().isReanalyzing).toBe(false);
    });

    it('should handle reanalysis with custom instructions', async () => {
      const mockDetails = createMockSessionDetails({ id: 'test-session' });
      useSessionDetailStore.setState({ currentSession: mockDetails });

      window.electronAPI.reanalyzeSession = vi
        .fn()
        .mockResolvedValue({ success: true, summary: 'Custom summary' });

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .reanalyzeSession('Custom prompt');
      });

      expect(window.electronAPI.reanalyzeSession).toHaveBeenCalled();
      const callArgs = (window.electronAPI.reanalyzeSession as any).mock.calls[0];
      expect(callArgs[0]).toBe('test-session');
      expect(callArgs[1]).toBe('Custom prompt');
    });

    it('should handle reanalysis failure', async () => {
      const mockDetails = createMockSessionDetails({ id: 'test-session' });
      useSessionDetailStore.setState({ currentSession: mockDetails });

      const onStatusChange = vi.fn();

      window.electronAPI.reanalyzeSession = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'Analysis failed' });

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .reanalyzeSession(undefined, undefined, onStatusChange);
      });

      expect(onStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Analysis failed'),
        })
      );
    });

    it('should skip if no current session', async () => {
      useSessionDetailStore.setState({ currentSession: null });

      await act(async () => {
        await useSessionDetailStore.getState().reanalyzeSession();
      });

      expect(window.electronAPI.reanalyzeSession).not.toHaveBeenCalled();
    });
  });

  describe('resumeSession', () => {
    it('should resume session with tmux', async () => {
      const mockDetails = createMockSessionDetails({ id: 'test-session' });
      useSessionDetailStore.setState({ currentSession: mockDetails });

      window.electronAPI.resumeSession = vi
        .fn()
        .mockResolvedValue({ success: true });

      const onStatusChange = vi.fn();

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .resumeSession(true, '', onStatusChange);
      });

      expect(window.electronAPI.resumeSession).toHaveBeenCalledWith(
        'test-session',
        '',
        true
      );
      expect(onStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          message: expect.stringContaining('tmux'),
        })
      );
    });

    it('should resume with prompt file', async () => {
      const mockDetails = createMockSessionDetails({ id: 'test-session' });
      useSessionDetailStore.setState({ currentSession: mockDetails });

      window.electronAPI.resumeSession = vi
        .fn()
        .mockResolvedValue({ success: true });

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .resumeSession(false, 'test.md');
      });

      expect(window.electronAPI.resumeSession).toHaveBeenCalledWith(
        'test-session',
        'test.md',
        false
      );
    });

    it('should handle resume failure', async () => {
      const mockDetails = createMockSessionDetails({ id: 'test-session' });
      useSessionDetailStore.setState({ currentSession: mockDetails });

      window.electronAPI.resumeSession = vi
        .fn()
        .mockRejectedValue(new Error('Terminal error'));

      const onStatusChange = vi.fn();

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .resumeSession(false, '', onStatusChange);
      });

      expect(onStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Terminal error'),
        })
      );
    });
  });

  describe('copySessionId', () => {
    it('should copy session ID to clipboard', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        configurable: true,
      });

      const onFeedback = vi.fn();

      await act(async () => {
        await useSessionDetailStore
          .getState()
          .copySessionId('test-id', onFeedback);
      });

      expect(writeTextMock).toHaveBeenCalledWith('test-id');
      expect(onFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.any(String),
          color: '#4CAF50',
          duration: 1500,
        })
      );
    });

    it('should handle clipboard failure', async () => {
      const writeTextMock = vi
        .fn()
        .mockRejectedValue(new Error('Clipboard denied'));
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        configurable: true,
      });

      await act(async () => {
        await useSessionDetailStore.getState().copySessionId('test-id');
      });

      const state = useSessionDetailStore.getState();
      expect(state.error).toContain('Clipboard denied');
    });
  });

  describe('clearCurrentSession', () => {
    it('should clear current session and prompts', () => {
      useSessionDetailStore.setState({
        currentSession: createMockSessionDetails(),
        prompts: [createMockPromptFile()],
        error: 'Some error',
      });

      act(() => {
        useSessionDetailStore.getState().clearCurrentSession();
      });

      const state = useSessionDetailStore.getState();
      expect(state.currentSession).toBeNull();
      expect(state.prompts).toEqual([]);
      expect(state.error).toBeNull();
    });
  });

  describe('setCurrentSession', () => {
    it('should set current session', () => {
      const mockDetails = createMockSessionDetails();

      act(() => {
        useSessionDetailStore.getState().setCurrentSession(mockDetails);
      });

      const state = useSessionDetailStore.getState();
      expect(state.currentSession).toEqual(mockDetails);
    });
  });

  describe('selectors', () => {
    it('selectCurrentSession should return current session', () => {
      const mockDetails = createMockSessionDetails();
      useSessionDetailStore.setState({ currentSession: mockDetails });

      const result = selectCurrentSession(useSessionDetailStore.getState());
      expect(result).toBe(mockDetails);
    });

    it('selectIsLoadingDetails should return loading state', () => {
      useSessionDetailStore.setState({ isLoadingDetails: true });

      const result = selectIsLoadingDetails(useSessionDetailStore.getState());
      expect(result).toBe(true);
    });

    it('selectPrompts should return prompts array', () => {
      const prompts = [createMockPromptFile()];
      useSessionDetailStore.setState({ prompts });

      const result = selectPrompts(useSessionDetailStore.getState());
      expect(result).toBe(prompts);
    });

    it('selectIsReanalyzing should return reanalysis state', () => {
      useSessionDetailStore.setState({ isReanalyzing: true });

      const result = selectIsReanalyzing(useSessionDetailStore.getState());
      expect(result).toBe(true);
    });

    it('selectIsResuming should return resume state', () => {
      useSessionDetailStore.setState({ isResuming: true });

      const result = selectIsResuming(useSessionDetailStore.getState());
      expect(result).toBe(true);
    });
  });
});
