import { create } from 'zustand';

import { DEFAULT_SETTINGS } from '../types/settings';

import type { Settings } from '../types';

interface SettingsState {
  settings: Settings;
  isSettingsOpen: boolean;
  isSaving: boolean;
  isClearing: boolean;
  error: string | null;
}

export interface SettingsSaveCallbacks {
  updateQuotaDisplay: () => Promise<void>;
  resetPagination: () => void;
  loadInitialSessions: () => Promise<void>;
}

interface SettingsActions {
  openSettings: () => Promise<void>;
  closeSettings: () => void;
  saveSettings: (newSettings: Settings, callbacks?: SettingsSaveCallbacks) => Promise<boolean>;
  clearCache: () => Promise<{ success: boolean; cleared: number }>;
  loadSettings: () => Promise<void>;
  setSettings: (settings: Settings) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>((set, _get) => ({
  settings: DEFAULT_SETTINGS,
  isSettingsOpen: false,
  isSaving: false,
  isClearing: false,
  error: null,

  loadSettings: async () => {
    try {
      const result = await window.electronAPI.getSettings();
      if (result.success) {
        set({ settings: result.settings, error: null });
      } else {
        const errorMessage = result.error || 'Failed to load settings';
        set({ error: errorMessage });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading settings';
      set({ error: errorMessage });
    }
  },

  openSettings: async () => {
    try {
      const result = await window.electronAPI.getSettings();
      if (result.success) {
        set({
          settings: result.settings,
          isSettingsOpen: true,
          error: null,
        });
      } else {
        const errorMessage = result.error || 'Failed to load settings';
        set({ error: errorMessage });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading settings';
      set({ error: errorMessage });
    }
  },

  closeSettings: () => {
    set({ isSettingsOpen: false });
  },

  saveSettings: async (
    newSettings: Settings,
    callbacks?: SettingsSaveCallbacks
  ): Promise<boolean> => {
    set({ isSaving: true });

    try {
      const result = await window.electronAPI.saveSettings(newSettings);

      if (result.success) {
        set({
          settings: newSettings,
          isSettingsOpen: false,
          isSaving: false,
        });

        if (callbacks) {
          await callbacks.updateQuotaDisplay();
          callbacks.resetPagination();
          await callbacks.loadInitialSessions();
        }

        return true;
      } else {
        const errorMessage = result.error || 'Failed to save settings';
        set({ isSaving: false, error: errorMessage });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error saving settings';
      set({ isSaving: false, error: errorMessage });
      return false;
    }
  },

  clearCache: async (): Promise<{ success: boolean; cleared: number }> => {
    set({ isClearing: true });

    try {
      const result = await window.electronAPI.clearAllCache();

      set({ isClearing: false, error: null });

      return {
        success: result.success,
        cleared: result.cleared || 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error clearing cache';
      set({ isClearing: false, error: errorMessage });
      return { success: false, cleared: 0 };
    }
  },

  setSettings: (settings: Settings) => set({ settings }),

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
}));

export const selectSettings = (state: SettingsStore): Settings => state.settings;
export const selectIsSettingsOpen = (state: SettingsStore): boolean => state.isSettingsOpen;
export const selectIsSaving = (state: SettingsStore): boolean => state.isSaving;
export const selectIsClearing = (state: SettingsStore): boolean => state.isClearing;
export const selectSettingsError = (state: SettingsStore): string | null => state.error;
