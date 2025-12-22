/**
 * Tests for useKeyboardNavigation hook
 *
 * Coverage target: 85%+ lines and branches
 * Tests vim-style navigation, gg command, selection mode, continuation navigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';

describe('useKeyboardNavigation', () => {
  const defaultOptions = {
    sessionIds: ['id1', 'id2', 'id3', 'id4', 'id5'],
    currentSessionId: 'id2',
    onSelectSession: vi.fn(),
    searchInputRef: { current: null } as React.RefObject<HTMLInputElement>,
    onClearSearch: vi.fn(),
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    // CRITICAL FIX: Reset document.activeElement to prevent test pollution
    // Some tests mock document.activeElement to test input field detection
    // If not reset, subsequent tests fail because the hook thinks user is typing
    try {
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => document.body,
      });
    } catch (e) {
      // If we can't redefine, at least try to blur any active element
      if (document.activeElement instanceof HTMLElement) {
        (document.activeElement as HTMLElement).blur?.();
      }
    }
  });

  describe('Basic Navigation - j/k', () => {
    it('should navigate down with j key', () => {
      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id3');
    });

    it('should navigate up with k key', () => {
      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id1');
    });

    it('should navigate down with ArrowDown', () => {
      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id3');
    });

    it('should navigate up with ArrowUp', () => {
      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id1');
    });

    it('should stay at last session when navigating down at end', () => {
      const options = { ...defaultOptions, currentSessionId: 'id5' };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id5');
    });

    it('should stay at first session when navigating up at start', () => {
      const options = { ...defaultOptions, currentSessionId: 'id1' };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id1');
    });

    it('should select first session when j pressed with no selection', () => {
      const options = { ...defaultOptions, currentSessionId: null };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id1');
    });

    it('should select last session when k pressed with no selection', () => {
      const options = { ...defaultOptions, currentSessionId: null };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id5');
    });
  });

  describe('Vim Commands', () => {
    it('should jump to first with gg', () => {
      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id1');
    });

    it('should reset gg combo after 1 second timeout', () => {
      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
      });

      act(() => {
        vi.advanceTimersByTime(1100);
      });

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
      });

      expect(defaultOptions.onSelectSession).not.toHaveBeenCalled();
    });

    it('should jump to last with G', () => {
      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'G' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id5');
    });

    it('should not handle single g press', () => {
      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
      });

      expect(defaultOptions.onSelectSession).not.toHaveBeenCalled();
    });
  });

  describe('Search Focus', () => {
    it('should focus search input with /', () => {
      const mockInput = { focus: vi.fn() };
      const options = {
        ...defaultOptions,
        searchInputRef: { current: mockInput } as never,
      };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
      });

      expect(mockInput.focus).toHaveBeenCalled();
    });

    it('should clear search and blur on Escape in search input', () => {
      const mockInput = { blur: vi.fn() };
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        value: mockInput,
      });

      const options = {
        ...defaultOptions,
        searchInputRef: { current: mockInput } as never,
      };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(defaultOptions.onClearSearch).toHaveBeenCalled();
      expect(mockInput.blur).toHaveBeenCalled();
    });
  });

  describe('Selection Mode', () => {
    it('should select all with Cmd+A', () => {
      const onSelectAll = vi.fn();
      const options = { ...defaultOptions, onSelectAll };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }));
      });

      expect(onSelectAll).toHaveBeenCalled();
    });

    it('should select all with Ctrl+A', () => {
      const onSelectAll = vi.fn();
      const options = { ...defaultOptions, onSelectAll };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));
      });

      expect(onSelectAll).toHaveBeenCalled();
    });

    it('should clear selection with Cmd+D', () => {
      const onClearSelection = vi.fn();
      const options = { ...defaultOptions, onClearSelection };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true }));
      });

      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should toggle selection with Space', () => {
      const onToggleSelection = vi.fn();
      const options = { ...defaultOptions, onToggleSelection };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      });

      expect(onToggleSelection).toHaveBeenCalledWith('id2');
    });

    it('should extend selection down with Shift+J', () => {
      const onExtendSelection = vi.fn();
      const options = { ...defaultOptions, onExtendSelection };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true }));
      });

      expect(onExtendSelection).toHaveBeenCalledWith('down');
    });

    it('should extend selection up with Shift+K', () => {
      const onExtendSelection = vi.fn();
      const options = { ...defaultOptions, onExtendSelection };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', shiftKey: true }));
      });

      expect(onExtendSelection).toHaveBeenCalledWith('up');
    });

    it('should exit selection mode with Escape', () => {
      const onExitSelectionMode = vi.fn();
      const options = { ...defaultOptions, isSelectionMode: true, onExitSelectionMode };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(onExitSelectionMode).toHaveBeenCalled();
    });
  });

  describe('Continuation Navigation', () => {
    it('should expand group with ArrowRight', () => {
      const onExpandGroup = vi.fn();
      const isGroupExpanded = vi.fn().mockReturnValue(false);
      const options = { ...defaultOptions, onExpandGroup, isGroupExpanded };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });

      expect(onExpandGroup).toHaveBeenCalledWith('id2');
    });

    it('should collapse group with ArrowLeft', () => {
      const onCollapseGroup = vi.fn();
      const isGroupExpanded = vi.fn().mockReturnValue(true);
      const options = { ...defaultOptions, onCollapseGroup, isGroupExpanded };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      });

      expect(onCollapseGroup).toHaveBeenCalledWith('id2');
    });

    it('should navigate to next continuation with Alt+ArrowRight', () => {
      const getContinuationGroup = vi.fn().mockReturnValue({
        continuations: [
          { id: 'id2' },
          { id: 'id3' },
        ],
      });
      const options = { ...defaultOptions, getContinuationGroup };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id3');
    });

    it('should navigate to previous continuation with Alt+ArrowLeft', () => {
      const getContinuationGroup = vi.fn().mockReturnValue({
        continuations: [
          { id: 'id1' },
          { id: 'id2' },
        ],
      });
      const options = { ...defaultOptions, getContinuationGroup };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id1');
    });
  });

  describe('Input Field Detection', () => {
    it('should not handle navigation when typing in input', () => {
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        value: document.createElement('input'),
      });

      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      });

      expect(defaultOptions.onSelectSession).not.toHaveBeenCalled();
    });

    it('should not handle navigation when typing in textarea', () => {
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        value: document.createElement('textarea'),
      });

      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      });

      expect(defaultOptions.onSelectSession).not.toHaveBeenCalled();
    });

    it('should handle Escape in search input even when typing', () => {
      const mockInput = document.createElement('input');
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        value: mockInput,
      });

      const options = {
        ...defaultOptions,
        searchInputRef: { current: mockInput as never },
      };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(defaultOptions.onClearSearch).toHaveBeenCalled();
    });
  });

  describe('Enabled State', () => {
    it('should not handle keys when disabled', () => {
      const options = { ...defaultOptions, enabled: false };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      });

      expect(defaultOptions.onSelectSession).not.toHaveBeenCalled();
    });

    it('should handle keys when enabled', () => {
      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id3');
    });
  });

  describe('Cleanup', () => {
    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = renderHook(() => useKeyboardNavigation(defaultOptions));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should clear timeout on unmount', () => {
      const { unmount } = renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
      });

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty session list', () => {
      const options = { ...defaultOptions, sessionIds: [] };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      });

      expect(defaultOptions.onSelectSession).not.toHaveBeenCalled();
    });

    it('should handle Enter key on selected session', () => {
      renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      expect(defaultOptions.onSelectSession).toHaveBeenCalledWith('id2');
    });

    it('should not handle Enter when no session selected', () => {
      const options = { ...defaultOptions, currentSessionId: null };
      renderHook(() => useKeyboardNavigation(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      expect(defaultOptions.onSelectSession).not.toHaveBeenCalled();
    });
  });
});
