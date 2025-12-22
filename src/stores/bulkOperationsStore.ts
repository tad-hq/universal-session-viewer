import { create } from 'zustand';

export type BulkOperationType = 'analyze' | 'delete' | 'export';

export interface BulkOperationError {
  sessionId: string;
  error: string;
  timestamp: Date;
}

interface BulkOperationsState {
  currentOperation: BulkOperationType | null;
  isRunning: boolean;

  total: number;
  completed: number;
  failed: number;

  errors: BulkOperationError[];

  startBulkAnalyze: (sessionIds: string[]) => void;
  updateProgress: (completed: number, failed: number) => void;
  completeOperation: () => void;
  cancelOperation: () => void;
  addError: (sessionId: string, error: string) => void;
  reset: () => void;
}

const initialState = {
  currentOperation: null,
  isRunning: false,
  total: 0,
  completed: 0,
  failed: 0,
  errors: [],
};

export const useBulkOperationsStore = create<BulkOperationsState>((set) => ({
  ...initialState,

  startBulkAnalyze: (sessionIds: string[]) => {
    set({
      currentOperation: 'analyze',
      isRunning: true,
      total: sessionIds.length,
      completed: 0,
      failed: 0,
      errors: [],
    });
  },

  updateProgress: (completed: number, failed: number) => {
    set({ completed, failed });
  },

  completeOperation: () => {
    set({
      isRunning: false,
    });
  },

  cancelOperation: () => {
    set({
      isRunning: false,
    });
  },

  addError: (sessionId: string, error: string) => {
    set((state) => ({
      errors: [
        ...state.errors,
        {
          sessionId,
          error,
          timestamp: new Date(),
        },
      ],
    }));
  },

  reset: () => {
    set(initialState);
  },
}));
