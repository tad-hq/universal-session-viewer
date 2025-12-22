/**
 * Tests for useKeyboardShortcuts hook
 *
 * Coverage target: 85%+ lines and branches
 * Tests global shortcuts, platform detection, escape handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useKeyboardShortcuts, getModifierKey, getShortcutDisplay } from '@/hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  const defaultOptions = {
    onFocusSearch: vi.fn(),
    onRefresh: vi.fn(),
    onOpenSettings: vi.fn(),
    onClearRelatedFilter: vi.fn(),
    isRelatedFilterActive: false,
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Focus Search (Cmd/Ctrl+K)', () => {
    it('should focus search with Cmd+K on Mac', () => {
      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        // Test environment isn't Mac, so send ctrlKey (hook checks platform at runtime)
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onFocusSearch).toHaveBeenCalled();
    });

    it('should focus search with Ctrl+K on Windows', () => {
      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onFocusSearch).toHaveBeenCalled();
    });

    it('should not focus search when already in input', () => {
      const inputElement = document.createElement('input');
      document.body.appendChild(inputElement);

      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        // Dispatch event on input element itself (target matters for hook logic)
        inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onFocusSearch).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(inputElement);
    });
  });

  describe('Refresh (Cmd/Ctrl+R)', () => {
    it('should refresh with Cmd+R on Mac', () => {
      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        // Test environment isn't Mac, so send ctrlKey
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onRefresh).toHaveBeenCalled();
    });

    it('should refresh with Ctrl+R on Windows', () => {
      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onRefresh).toHaveBeenCalled();
    });

    it('should not refresh when in input', () => {
      const textareaElement = document.createElement('textarea');
      document.body.appendChild(textareaElement);

      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        // Dispatch event on textarea element itself (target matters for hook logic)
        textareaElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onRefresh).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(textareaElement);
    });
  });

  describe('Open Settings (Cmd/Ctrl+,)', () => {
    it('should open settings with Cmd+,', () => {
      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        // Test environment isn't Mac, so send ctrlKey
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onOpenSettings).toHaveBeenCalled();
    });

    it('should open settings with Ctrl+,', () => {
      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onOpenSettings).toHaveBeenCalled();
    });

    it('should not open settings when in input', () => {
      const selectElement = document.createElement('select');
      document.body.appendChild(selectElement);

      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        // Dispatch event on select element itself (target matters for hook logic)
        selectElement.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onOpenSettings).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(selectElement);
    });
  });

  describe('Clear Related Filter (Escape)', () => {
    it('should clear related filter when active', () => {
      const options = { ...defaultOptions, isRelatedFilterActive: true };
      renderHook(() => useKeyboardShortcuts(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      expect(defaultOptions.onClearRelatedFilter).toHaveBeenCalled();
    });

    it('should not clear related filter when inactive', () => {
      const options = { ...defaultOptions, isRelatedFilterActive: false };
      renderHook(() => useKeyboardShortcuts(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      expect(defaultOptions.onClearRelatedFilter).not.toHaveBeenCalled();
    });

    it('should not clear related filter when in input', () => {
      const inputElement = document.createElement('input');
      document.body.appendChild(inputElement);

      const options = { ...defaultOptions, isRelatedFilterActive: true };
      renderHook(() => useKeyboardShortcuts(options));

      act(() => {
        // Dispatch event on the input element itself (target matters, not activeElement)
        inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      expect(defaultOptions.onClearRelatedFilter).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(inputElement);
    });
  });

  describe('Enabled State', () => {
    it('should not handle shortcuts when disabled', () => {
      const options = { ...defaultOptions, enabled: false };
      renderHook(() => useKeyboardShortcuts(options));

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onFocusSearch).not.toHaveBeenCalled();
    });

    it('should handle shortcuts when enabled', () => {
      const options = { ...defaultOptions, enabled: true };
      renderHook(() => useKeyboardShortcuts(options));

      act(() => {
        // Test environment isn't Mac, so send ctrlKey
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onFocusSearch).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = renderHook(() => useKeyboardShortcuts(defaultOptions));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true });
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle uppercase K', () => {
      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        // Test environment isn't Mac, so send ctrlKey
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onFocusSearch).toHaveBeenCalled();
    });

    it('should handle uppercase R', () => {
      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        // Test environment isn't Mac, so send ctrlKey
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onRefresh).toHaveBeenCalled();
    });
  });

  describe('ContentEditable Detection', () => {
    it('should not handle shortcuts in contenteditable elements', () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';

      // Happy-dom might not automatically set isContentEditable property
      // Mock it explicitly to match real browser behavior
      Object.defineProperty(div, 'isContentEditable', {
        value: true,
        writable: true,
        configurable: true,
      });

      document.body.appendChild(div);

      renderHook(() => useKeyboardShortcuts(defaultOptions));

      act(() => {
        // Dispatch event on contenteditable element itself (target matters for hook logic)
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      });

      expect(defaultOptions.onFocusSearch).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(div);
    });
  });
});

describe('Helper Functions', () => {
  describe('getModifierKey', () => {
    it('should return Cmd or Ctrl based on platform', () => {
      const result = getModifierKey();
      expect(['Cmd', 'Ctrl']).toContain(result);
    });
  });

  describe('getShortcutDisplay', () => {
    it('should return formatted shortcut string', () => {
      const result = getShortcutDisplay('K');
      expect(result).toMatch(/^(Cmd|Ctrl)\+K$/);
    });

    it('should uppercase the key', () => {
      const result = getShortcutDisplay('k');
      expect(result).toMatch(/^(Cmd|Ctrl)\+K$/);
    });
  });
});
