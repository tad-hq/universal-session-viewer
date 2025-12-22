/**
 * SettingsStore Tests
 *
 * Tests for application settings management including:
 * - Modal lifecycle (open/close)
 * - Settings save with side effects
 * - Cache management
 * - Initial settings load
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  useSettingsStore,
  selectSettings,
  selectIsSettingsOpen,
  selectIsSaving,
  selectIsClearing,
  type SettingsSaveCallbacks,
} from '@/stores/settingsStore';
import {
  createMockSettings,
  configureMockResponses,
  resetMockResponses,
} from '../mocks/electronAPI';

// Helper to reset store
function resetStore() {
  useSettingsStore.setState({
    settings: createMockSettings(),
    isSettingsOpen: false,
    isSaving: false,
    isClearing: false,
    error: null,
  });
}

describe('settingsStore', () => {
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
      const state = useSettingsStore.getState();

      expect(state.settings).toBeDefined();
      expect(state.isSettingsOpen).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.isClearing).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('loadSettings', () => {
    it('should load settings from IPC', async () => {
      const mockSettings = createMockSettings({
        dailyAnalysisLimit: 50,
        autoAnalyzeNewSessions: true,
      });

      configureMockResponses({ settings: mockSettings });

      await act(async () => {
        await useSettingsStore.getState().loadSettings();
      });

      const state = useSettingsStore.getState();
      expect(state.settings.dailyAnalysisLimit).toBe(50);
      expect(state.settings.autoAnalyzeNewSessions).toBe(true);
    });

    it('should handle IPC error', async () => {
      window.electronAPI.getSettings = vi.fn().mockResolvedValue({
        success: false,
        error: 'Failed to load settings',
      });

      await act(async () => {
        await useSettingsStore.getState().loadSettings();
      });

      const state = useSettingsStore.getState();
      expect(state.error).toBe('Failed to load settings');
    });
  });

  describe('openSettings', () => {
    it('should load fresh settings and open modal', async () => {
      const mockSettings = createMockSettings({ dailyAnalysisLimit: 30 });
      configureMockResponses({ settings: mockSettings });

      await act(async () => {
        await useSettingsStore.getState().openSettings();
      });

      const state = useSettingsStore.getState();
      expect(state.isSettingsOpen).toBe(true);
      expect(state.settings.dailyAnalysisLimit).toBe(30);
    });

    it('should handle load error', async () => {
      window.electronAPI.getSettings = vi.fn().mockResolvedValue({
        success: false,
        error: 'Load failed',
      });

      await act(async () => {
        await useSettingsStore.getState().openSettings();
      });

      const state = useSettingsStore.getState();
      expect(state.error).toBe('Load failed');
    });
  });

  describe('closeSettings', () => {
    it('should close modal', () => {
      useSettingsStore.setState({ isSettingsOpen: true });

      act(() => {
        useSettingsStore.getState().closeSettings();
      });

      const state = useSettingsStore.getState();
      expect(state.isSettingsOpen).toBe(false);
    });
  });

  describe('saveSettings', () => {
    it('should save settings and execute callbacks', async () => {
      const newSettings = createMockSettings({ dailyAnalysisLimit: 100 });

      window.electronAPI.saveSettings = vi.fn().mockResolvedValue({
        success: true,
      });

      const callbacks: SettingsSaveCallbacks = {
        updateQuotaDisplay: vi.fn().mockResolvedValue(undefined),
        resetPagination: vi.fn(),
        loadInitialSessions: vi.fn().mockResolvedValue(undefined),
      };

      const result = await act(async () => {
        return await useSettingsStore
          .getState()
          .saveSettings(newSettings, callbacks);
      });

      expect(result).toBe(true);
      expect(callbacks.updateQuotaDisplay).toHaveBeenCalled();
      expect(callbacks.resetPagination).toHaveBeenCalled();
      expect(callbacks.loadInitialSessions).toHaveBeenCalled();

      const state = useSettingsStore.getState();
      expect(state.settings.dailyAnalysisLimit).toBe(100);
      expect(state.isSettingsOpen).toBe(false);
    });

    it('should work without callbacks', async () => {
      const newSettings = createMockSettings();

      window.electronAPI.saveSettings = vi.fn().mockResolvedValue({
        success: true,
      });

      const result = await act(async () => {
        return await useSettingsStore.getState().saveSettings(newSettings);
      });

      expect(result).toBe(true);
    });

    it('should handle save failure', async () => {
      const newSettings = createMockSettings();

      window.electronAPI.saveSettings = vi.fn().mockResolvedValue({
        success: false,
        error: 'Save failed',
      });

      const result = await act(async () => {
        return await useSettingsStore.getState().saveSettings(newSettings);
      });

      expect(result).toBe(false);
      const state = useSettingsStore.getState();
      expect(state.error).toBe('Save failed');
    });

    it('should handle exceptions', async () => {
      const newSettings = createMockSettings();

      window.electronAPI.saveSettings = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));

      const result = await act(async () => {
        return await useSettingsStore.getState().saveSettings(newSettings);
      });

      expect(result).toBe(false);
      const state = useSettingsStore.getState();
      expect(state.error).toContain('Network error');
    });
  });

  describe('clearCache', () => {
    it('should clear cache and return count', async () => {
      window.electronAPI.clearAllCache = vi.fn().mockResolvedValue({
        success: true,
        cleared: 42,
      });

      const result = await act(async () => {
        return await useSettingsStore.getState().clearCache();
      });

      expect(result.success).toBe(true);
      expect(result.cleared).toBe(42);
    });

    it('should handle clear failure', async () => {
      window.electronAPI.clearAllCache = vi
        .fn()
        .mockRejectedValue(new Error('Clear failed'));

      const result = await act(async () => {
        return await useSettingsStore.getState().clearCache();
      });

      expect(result.success).toBe(false);
      expect(result.cleared).toBe(0);

      const state = useSettingsStore.getState();
      expect(state.error).toContain('Clear failed');
    });
  });

  describe('setSettings', () => {
    it('should update settings', () => {
      const newSettings = createMockSettings({ dailyAnalysisLimit: 999 });

      act(() => {
        useSettingsStore.getState().setSettings(newSettings);
      });

      const state = useSettingsStore.getState();
      expect(state.settings.dailyAnalysisLimit).toBe(999);
    });
  });

  describe('error management', () => {
    it('should set error', () => {
      act(() => {
        useSettingsStore.getState().setError('Test error');
      });

      const state = useSettingsStore.getState();
      expect(state.error).toBe('Test error');
    });

    it('should clear error', () => {
      useSettingsStore.setState({ error: 'Test error' });

      act(() => {
        useSettingsStore.getState().clearError();
      });

      const state = useSettingsStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('selectors', () => {
    it('selectSettings should return settings', () => {
      const settings = createMockSettings();
      useSettingsStore.setState({ settings });

      const result = selectSettings(useSettingsStore.getState());
      expect(result).toBe(settings);
    });

    it('selectIsSettingsOpen should return open state', () => {
      useSettingsStore.setState({ isSettingsOpen: true });

      const result = selectIsSettingsOpen(useSettingsStore.getState());
      expect(result).toBe(true);
    });

    it('selectIsSaving should return saving state', () => {
      useSettingsStore.setState({ isSaving: true });

      const result = selectIsSaving(useSettingsStore.getState());
      expect(result).toBe(true);
    });

    it('selectIsClearing should return clearing state', () => {
      useSettingsStore.setState({ isClearing: true });

      const result = selectIsClearing(useSettingsStore.getState());
      expect(result).toBe(true);
    });
  });
});
