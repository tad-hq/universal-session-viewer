/**
 * Tests for useCollapseState hook
 *
 * Coverage target: 85%+ lines and branches
 * Tests collapse state, toggle, localStorage persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useCollapseState } from '@/hooks/useCollapseState';

describe('useCollapseState', () => {
  const STORAGE_KEY = 'session-viewer-collapse-state';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useCollapseState());

      expect(result.current.collapseState).toEqual({
        summary: true,
        resume: true,
      });
    });

    it('should load state from localStorage on mount', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ summary: false, resume: false })
      );

      const { result } = renderHook(() => useCollapseState());

      await waitFor(() => {
        expect(result.current.collapseState).toEqual({
          summary: false,
          resume: false,
        });
      });
    });

    it('should handle corrupt localStorage data gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem(STORAGE_KEY, 'invalid json');

      const { result } = renderHook(() => useCollapseState());

      await waitFor(() => {
        expect(result.current.collapseState).toEqual({
          summary: true,
          resume: true,
        });
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should merge localStorage state with defaults', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ summary: false }));

      const { result } = renderHook(() => useCollapseState());

      await waitFor(() => {
        expect(result.current.collapseState).toEqual({
          summary: false,
          resume: true, // default value preserved
        });
      });
    });
  });

  describe('Return Value Structure', () => {
    it('should return all required properties', () => {
      const { result } = renderHook(() => useCollapseState());

      expect(result.current).toHaveProperty('collapseState');
      expect(result.current).toHaveProperty('toggleSection');
      expect(result.current).toHaveProperty('isCollapsed');
    });
  });

  describe('Toggle Section', () => {
    it('should toggle summary section', () => {
      const { result } = renderHook(() => useCollapseState());

      act(() => {
        result.current.toggleSection('summary');
      });

      expect(result.current.collapseState.summary).toBe(false);

      act(() => {
        result.current.toggleSection('summary');
      });

      expect(result.current.collapseState.summary).toBe(true);
    });

    it('should toggle resume section', () => {
      const { result } = renderHook(() => useCollapseState());

      act(() => {
        result.current.toggleSection('resume');
      });

      expect(result.current.collapseState.resume).toBe(false);

      act(() => {
        result.current.toggleSection('resume');
      });

      expect(result.current.collapseState.resume).toBe(true);
    });

    it('should persist state to localStorage on toggle', () => {
      const { result } = renderHook(() => useCollapseState());

      act(() => {
        result.current.toggleSection('summary');
      });

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.summary).toBe(false);
    });

    it('should not affect other sections when toggling', () => {
      const { result } = renderHook(() => useCollapseState());

      act(() => {
        result.current.toggleSection('summary');
      });

      expect(result.current.collapseState.resume).toBe(true);
    });
  });

  describe('isCollapsed Check', () => {
    it('should return true for collapsed summary section', () => {
      const { result } = renderHook(() => useCollapseState());

      // Summary starts collapsed
      const collapsed = result.current.isCollapsed('summary');
      expect(collapsed).toBe(true); // Summary starts in collapsed state
    });

    it('should return true for collapsed resume section', () => {
      const { result } = renderHook(() => useCollapseState());

      const collapsed = result.current.isCollapsed('resume');
      expect(collapsed).toBe(true); // Resume starts collapsed
    });

    it('should return false for expanded resume section', () => {
      const { result } = renderHook(() => useCollapseState());

      act(() => {
        result.current.toggleSection('resume');
      });

      const collapsed = result.current.isCollapsed('resume');
      expect(collapsed).toBe(false);
    });

    it('should always return false for summary section (special case)', () => {
      const { result } = renderHook(() => useCollapseState());

      act(() => {
        result.current.toggleSection('summary');
      });

      // Summary is always "expanded" according to isCollapsed
      const collapsed = result.current.isCollapsed('summary');
      expect(collapsed).toBe(false);
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should save state after each toggle', () => {
      const { result } = renderHook(() => useCollapseState());

      act(() => {
        result.current.toggleSection('resume');
      });

      const stored1 = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored1.resume).toBe(false);

      act(() => {
        result.current.toggleSection('summary');
      });

      const stored2 = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored2.summary).toBe(false);
    });

    it('should persist complete state object', () => {
      const { result } = renderHook(() => useCollapseState());

      act(() => {
        result.current.toggleSection('summary');
        result.current.toggleSection('resume');
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toEqual({
        summary: false,
        resume: false,
      });
    });
  });

  describe('Function Stability', () => {
    it('should return stable function references', () => {
      const { result, rerender } = renderHook(() => useCollapseState());

      const firstToggle = result.current.toggleSection;
      const firstIsCollapsed = result.current.isCollapsed;

      rerender();

      expect(result.current.toggleSection).toBe(firstToggle);
      expect(result.current.isCollapsed).toBe(firstIsCollapsed);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple rapid toggles', () => {
      const { result } = renderHook(() => useCollapseState());

      act(() => {
        result.current.toggleSection('resume');
        result.current.toggleSection('resume');
        result.current.toggleSection('resume');
      });

      expect(result.current.collapseState.resume).toBe(false); // Odd number of toggles
    });

    it('should handle empty localStorage', () => {
      localStorage.removeItem(STORAGE_KEY);

      const { result } = renderHook(() => useCollapseState());

      expect(result.current.collapseState).toEqual({
        summary: true,
        resume: true,
      });
    });
  });
});
