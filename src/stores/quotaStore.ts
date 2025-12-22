import { create } from 'zustand';

import type { QuotaInfo } from '../types';

export const DEFAULT_QUOTA: QuotaInfo = {
  current: 0,
  limit: 20,
  allowed: true,
  message: '0/20',
};

interface QuotaState {
  quota: QuotaInfo;
  isLoading: boolean;
  error: string | null;
}

interface QuotaActions {
  updateQuota: () => Promise<void>;
  setQuota: (quota: QuotaInfo) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type QuotaStore = QuotaState & QuotaActions;

export const useQuotaStore = create<QuotaStore>((set) => ({
  quota: DEFAULT_QUOTA,
  isLoading: false,
  error: null,

  updateQuota: async () => {
    set({ isLoading: true });

    try {
      const result = await window.electronAPI.getQuota();

      if (result.success) {
        set({
          quota: result.quota,
          isLoading: false,
          error: null,
        });
      } else {
        const errorMessage = (result as { error?: string }).error || 'Failed to update quota';
        set({ isLoading: false, error: errorMessage });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error updating quota';
      set({ isLoading: false, error: errorMessage });
    }
  },

  setQuota: (quota: QuotaInfo) => set({ quota }),

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
}));

export const selectQuota = (state: QuotaStore): QuotaInfo => state.quota;
export const selectQuotaIsLoading = (state: QuotaStore): boolean => state.isLoading;

export const selectQuotaDisplayText = (state: QuotaStore): string => {
  const { quota } = state;

  const ratioMatch = quota.message.match(/(\d+\/\d+)/);
  if (ratioMatch) {
    return ratioMatch[1];
  }

  if (quota.message.includes('/')) {
    const parts = quota.message.split(' ');
    const ratioPart = parts.find((part) => part.includes('/'));
    if (ratioPart) {
      return ratioPart;
    }
  }

  return `${quota.current}/${quota.limit}`;
};

export const selectQuotaColor = (state: QuotaStore): string => {
  return state.quota.allowed ? '#888' : '#f44336';
};

export const selectQuotaError = (state: QuotaStore): string | null => state.error;
