/**
 * React hook for managing application settings with cross-store side effects.
 *
 * This hook wraps the Zustand settingsStore and integrates with sessionStore
 * and quotaStore to ensure proper side effects after settings are saved.
 *
 * @remarks
 * V1 Reference: index.html lines 2122-2199
 *
 * V1 patterns preserved:
 * - CRITICAL: Side effects after save (v1 lines 2169-2173)
 *   1. updateQuotaDisplay() - quota might change if limit changed
 *   2. resetPagination() - clear current session list
 *   3. clearSessionList() - implicit in resetPagination
 *   4. loadInitialSessions() - reload with new settings (sort order, etc.)
 * - Settings loaded fresh when modal opens
 * - Cache clear with confirmation count feedback
 *
 * @example
 * ```tsx
 * function SettingsButton() {
 *   const { settings, isSettingsOpen, openSettings, saveSettings } = useSettings();
 *
 *   const handleSave = async (newSettings: Settings) => {
 *     const success = await saveSettings(newSettings);
 *     if (success) {
 *       toast.success('Settings saved');
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <Button onClick={openSettings}>Settings</Button>
 *       <SettingsModal
 *         open={isSettingsOpen}
 *         settings={settings}
 *         onSave={handleSave}
 *       />
 *     </>
 *   );
 * }
 * ```
 *
 * @returns Object containing settings state and actions
 *
 * @module hooks/useSettings
 */

import { useEffect, useCallback } from 'react';

import { useSettingsStore, useSessionStore, useQuotaStore } from '../stores';

import type { Settings } from '../types';

/**
 * Return type for the useSettings hook.
 */
interface UseSettingsReturn {
  /** Current application settings */
  settings: Settings;
  /** Whether the settings modal is open */
  isSettingsOpen: boolean;
  /** Whether settings are currently being saved */
  isSaving: boolean;

  /**
   * Opens the settings modal and fetches fresh settings.
   * V1 Pattern: Always fetch fresh settings when modal opens.
   * @returns Promise that resolves when settings are loaded
   */
  openSettings: () => Promise<void>;

  /**
   * Closes the settings modal without saving.
   */
  closeSettings: () => void;

  /**
   * Saves settings and executes required side effects.
   * V1 CRITICAL: Must execute side effects in order after successful save.
   * @param newSettings - New settings values to save
   * @returns Promise resolving to true if save succeeded
   */
  saveSettings: (newSettings: Settings) => Promise<boolean>;

  /**
   * Clears all cached session analyses.
   * @returns Promise with success status and count of cleared entries
   */
  clearCache: () => Promise<{ success: boolean; cleared: number }>;
}

/**
 * Hook for managing settings with cross-store integration.
 *
 * @returns {UseSettingsReturn} Settings state and actions
 */
export function useSettings(): UseSettingsReturn {
  // Get settings store
  const {
    settings,
    isSettingsOpen,
    isSaving,
    openSettings,
    closeSettings,
    saveSettings: storeSaveSettings,
    clearCache,
    loadSettings,
  } = useSettingsStore();

  // Get session store for side effects
  const { resetPagination, loadMoreSessions } = useSessionStore();

  // Get quota store for side effects
  const { updateQuota } = useQuotaStore();

  // V1 Reference: lines 843-865 (load settings on mount)
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // V1 CRITICAL: Save with side effects
  // V1 Reference: lines 2169-2173
  // After successful save, must execute:
  // 1. updateQuotaDisplay() - quota might change if limit changed
  // 2. resetPagination() - clear current session list
  // 3. loadInitialSessions() - reload with new settings (sort order, etc.)
  const saveSettings = useCallback(
    async (newSettings: Settings): Promise<boolean> => {
      const loadInitialSessions = async (): Promise<void> => {
        resetPagination();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await loadMoreSessions();
      };

      return storeSaveSettings(newSettings, {
        updateQuotaDisplay: updateQuota,
        resetPagination,
        loadInitialSessions,
      });
    },
    [storeSaveSettings, updateQuota, resetPagination, loadMoreSessions]
  );

  return {
    settings,
    isSettingsOpen,
    isSaving,
    openSettings,
    closeSettings,
    saveSettings,
    clearCache,
  };
}
