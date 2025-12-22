/**
 * BulkOperationsStore Tests
 *
 * Tests for bulk operations state management including:
 * - Bulk analyze operations
 * - Progress tracking
 * - Error collection
 * - Operation lifecycle (start, update, complete, cancel)
 * - State reset
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { useBulkOperationsStore } from '@/stores/bulkOperationsStore';

// Helper to reset store
function resetStore() {
  useBulkOperationsStore.setState({
    currentOperation: null,
    isRunning: false,
    total: 0,
    completed: 0,
    failed: 0,
    errors: [],
  });
}

describe('bulkOperationsStore', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useBulkOperationsStore.getState();

      expect(state.currentOperation).toBeNull();
      expect(state.isRunning).toBe(false);
      expect(state.total).toBe(0);
      expect(state.completed).toBe(0);
      expect(state.failed).toBe(0);
      expect(state.errors).toEqual([]);
    });
  });

  describe('startBulkAnalyze', () => {
    it('should initialize bulk analyze operation', () => {
      const sessionIds = ['session-1', 'session-2', 'session-3'];

      act(() => {
        useBulkOperationsStore.getState().startBulkAnalyze(sessionIds);
      });

      const state = useBulkOperationsStore.getState();
      expect(state.currentOperation).toBe('analyze');
      expect(state.isRunning).toBe(true);
      expect(state.total).toBe(3);
      expect(state.completed).toBe(0);
      expect(state.failed).toBe(0);
      expect(state.errors).toEqual([]);
    });

    it('should handle empty session list', () => {
      act(() => {
        useBulkOperationsStore.getState().startBulkAnalyze([]);
      });

      const state = useBulkOperationsStore.getState();
      expect(state.total).toBe(0);
      expect(state.isRunning).toBe(true);
    });

    it('should handle large session list', () => {
      const sessionIds = Array.from({ length: 1000 }, (_, i) => `session-${i}`);

      act(() => {
        useBulkOperationsStore.getState().startBulkAnalyze(sessionIds);
      });

      const state = useBulkOperationsStore.getState();
      expect(state.total).toBe(1000);
    });

    it('should reset progress on new operation', () => {
      // Start first operation
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: false,
        total: 5,
        completed: 3,
        failed: 2,
        errors: [{ sessionId: 'test', error: 'error', timestamp: new Date() }],
      });

      // Start new operation
      act(() => {
        useBulkOperationsStore
          .getState()
          .startBulkAnalyze(['new-1', 'new-2']);
      });

      const state = useBulkOperationsStore.getState();
      expect(state.total).toBe(2);
      expect(state.completed).toBe(0);
      expect(state.failed).toBe(0);
      expect(state.errors).toEqual([]);
    });
  });

  describe('updateProgress', () => {
    it('should update progress counters', () => {
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: true,
        total: 10,
      });

      act(() => {
        useBulkOperationsStore.getState().updateProgress(5, 1);
      });

      const state = useBulkOperationsStore.getState();
      expect(state.completed).toBe(5);
      expect(state.failed).toBe(1);
    });

    it('should handle zero progress', () => {
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: true,
        total: 10,
      });

      act(() => {
        useBulkOperationsStore.getState().updateProgress(0, 0);
      });

      const state = useBulkOperationsStore.getState();
      expect(state.completed).toBe(0);
      expect(state.failed).toBe(0);
    });

    it('should handle complete progress', () => {
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: true,
        total: 10,
      });

      act(() => {
        useBulkOperationsStore.getState().updateProgress(10, 0);
      });

      const state = useBulkOperationsStore.getState();
      expect(state.completed).toBe(10);
      expect(state.failed).toBe(0);
    });

    it('should handle all failed', () => {
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: true,
        total: 10,
      });

      act(() => {
        useBulkOperationsStore.getState().updateProgress(0, 10);
      });

      const state = useBulkOperationsStore.getState();
      expect(state.completed).toBe(0);
      expect(state.failed).toBe(10);
    });

    it('should handle mixed success/failure', () => {
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: true,
        total: 10,
      });

      act(() => {
        useBulkOperationsStore.getState().updateProgress(7, 3);
      });

      const state = useBulkOperationsStore.getState();
      expect(state.completed).toBe(7);
      expect(state.failed).toBe(3);
    });
  });

  describe('completeOperation', () => {
    it('should mark operation as not running', () => {
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: true,
        total: 10,
        completed: 10,
        failed: 0,
      });

      act(() => {
        useBulkOperationsStore.getState().completeOperation();
      });

      const state = useBulkOperationsStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentOperation).toBe('analyze');
      expect(state.total).toBe(10);
      expect(state.completed).toBe(10);
    });

    it('should preserve operation results', () => {
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: true,
        total: 10,
        completed: 7,
        failed: 3,
      });

      act(() => {
        useBulkOperationsStore.getState().completeOperation();
      });

      const state = useBulkOperationsStore.getState();
      expect(state.total).toBe(10);
      expect(state.completed).toBe(7);
      expect(state.failed).toBe(3);
    });
  });

  describe('cancelOperation', () => {
    it('should cancel running operation', () => {
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: true,
        total: 10,
        completed: 3,
        failed: 1,
      });

      act(() => {
        useBulkOperationsStore.getState().cancelOperation();
      });

      const state = useBulkOperationsStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.completed).toBe(3);
      expect(state.failed).toBe(1);
    });

    it('should preserve partial results on cancel', () => {
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: true,
        total: 100,
        completed: 50,
        failed: 5,
      });

      act(() => {
        useBulkOperationsStore.getState().cancelOperation();
      });

      const state = useBulkOperationsStore.getState();
      expect(state.total).toBe(100);
      expect(state.completed).toBe(50);
      expect(state.failed).toBe(5);
    });
  });

  describe('addError', () => {
    it('should add error to collection', () => {
      act(() => {
        useBulkOperationsStore
          .getState()
          .addError('session-1', 'Analysis failed');
      });

      const state = useBulkOperationsStore.getState();
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0].sessionId).toBe('session-1');
      expect(state.errors[0].error).toBe('Analysis failed');
      expect(state.errors[0].timestamp).toBeInstanceOf(Date);
    });

    it('should accumulate multiple errors', () => {
      act(() => {
        useBulkOperationsStore
          .getState()
          .addError('session-1', 'Error 1');
        useBulkOperationsStore
          .getState()
          .addError('session-2', 'Error 2');
        useBulkOperationsStore
          .getState()
          .addError('session-3', 'Error 3');
      });

      const state = useBulkOperationsStore.getState();
      expect(state.errors).toHaveLength(3);
    });

    it('should allow duplicate session IDs in errors', () => {
      act(() => {
        useBulkOperationsStore
          .getState()
          .addError('session-1', 'First attempt failed');
        useBulkOperationsStore
          .getState()
          .addError('session-1', 'Second attempt failed');
      });

      const state = useBulkOperationsStore.getState();
      expect(state.errors).toHaveLength(2);
      expect(state.errors[0].sessionId).toBe('session-1');
      expect(state.errors[1].sessionId).toBe('session-1');
    });

    it('should preserve error order', () => {
      act(() => {
        useBulkOperationsStore.getState().addError('session-1', 'Error 1');
        useBulkOperationsStore.getState().addError('session-2', 'Error 2');
        useBulkOperationsStore.getState().addError('session-3', 'Error 3');
      });

      const state = useBulkOperationsStore.getState();
      expect(state.errors[0].error).toBe('Error 1');
      expect(state.errors[1].error).toBe('Error 2');
      expect(state.errors[2].error).toBe('Error 3');
    });
  });

  describe('reset', () => {
    it('should reset all state to initial', () => {
      useBulkOperationsStore.setState({
        currentOperation: 'analyze',
        isRunning: true,
        total: 50,
        completed: 30,
        failed: 5,
        errors: [
          { sessionId: 'test', error: 'error', timestamp: new Date() },
        ],
      });

      act(() => {
        useBulkOperationsStore.getState().reset();
      });

      const state = useBulkOperationsStore.getState();
      expect(state.currentOperation).toBeNull();
      expect(state.isRunning).toBe(false);
      expect(state.total).toBe(0);
      expect(state.completed).toBe(0);
      expect(state.failed).toBe(0);
      expect(state.errors).toEqual([]);
    });
  });

  describe('operation lifecycle', () => {
    it('should support complete workflow', () => {
      const sessionIds = ['session-1', 'session-2', 'session-3'];

      // Start operation
      act(() => {
        useBulkOperationsStore.getState().startBulkAnalyze(sessionIds);
      });

      let state = useBulkOperationsStore.getState();
      expect(state.isRunning).toBe(true);
      expect(state.total).toBe(3);

      // Update progress - 2 completed, 1 failed
      act(() => {
        useBulkOperationsStore.getState().updateProgress(2, 1);
        useBulkOperationsStore
          .getState()
          .addError('session-3', 'Analysis timeout');
      });

      state = useBulkOperationsStore.getState();
      expect(state.completed).toBe(2);
      expect(state.failed).toBe(1);
      expect(state.errors).toHaveLength(1);

      // Complete operation
      act(() => {
        useBulkOperationsStore.getState().completeOperation();
      });

      state = useBulkOperationsStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentOperation).toBe('analyze');

      // Reset for next operation
      act(() => {
        useBulkOperationsStore.getState().reset();
      });

      state = useBulkOperationsStore.getState();
      expect(state.currentOperation).toBeNull();
      expect(state.total).toBe(0);
    });

    it('should support cancel workflow', () => {
      const sessionIds = Array.from({ length: 100 }, (_, i) => `session-${i}`);

      // Start large operation
      act(() => {
        useBulkOperationsStore.getState().startBulkAnalyze(sessionIds);
      });

      // Process some items
      act(() => {
        useBulkOperationsStore.getState().updateProgress(30, 2);
        useBulkOperationsStore.getState().addError('session-5', 'Failed');
        useBulkOperationsStore.getState().addError('session-12', 'Failed');
      });

      // Cancel mid-operation
      act(() => {
        useBulkOperationsStore.getState().cancelOperation();
      });

      const state = useBulkOperationsStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.completed).toBe(30);
      expect(state.failed).toBe(2);
      expect(state.errors).toHaveLength(2);
      expect(state.total).toBe(100);
    });
  });
});
