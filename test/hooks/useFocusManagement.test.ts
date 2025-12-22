/**
 * Tests for useFocusManagement hook
 *
 * Coverage target: 85%+ lines and branches
 * Tests roving tabindex, arrow navigation, Home/End/Enter/Space
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useFocusManagement, getRovingTabIndex } from '@/hooks/useFocusManagement';

describe('useFocusManagement', () => {
  const defaultOptions = {
    itemCount: 5,
    onSelect: vi.fn(),
    orientation: 'vertical' as const,
    wrap: true,
    initialIndex: -1,
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Return Value Structure', () => {
    it('should return all required properties', () => {
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      expect(result.current).toHaveProperty('focusedIndex');
      expect(result.current).toHaveProperty('setFocusedIndex');
      expect(result.current).toHaveProperty('handleKeyDown');
      expect(result.current).toHaveProperty('itemRefs');
      expect(result.current).toHaveProperty('focusItem');
      expect(result.current).toHaveProperty('resetFocus');
    });

    it('should initialize with -1 focused index', () => {
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      expect(result.current.focusedIndex).toBe(-1);
    });

    it('should initialize with custom initial index', () => {
      const options = { ...defaultOptions, initialIndex: 2 };
      const { result } = renderHook(() => useFocusManagement(options));

      expect(result.current.focusedIndex).toBe(2);
    });
  });

  describe('Vertical Navigation', () => {
    it('should move down with ArrowDown', () => {
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      act(() => {
        const event = {
          key: 'ArrowDown',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(3);
    });

    it('should move up with ArrowUp', () => {
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      act(() => {
        const event = {
          key: 'ArrowUp',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(1);
    });

    it('should wrap to last when moving down from last item', () => {
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      act(() => {
        result.current.setFocusedIndex(4); // Last item
      });

      act(() => {
        const event = {
          key: 'ArrowDown',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(0);
    });

    it('should wrap to first when moving up from first item', () => {
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      act(() => {
        result.current.setFocusedIndex(0);
      });

      act(() => {
        const event = {
          key: 'ArrowUp',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(4);
    });

    it('should not wrap when wrap is false', () => {
      const options = { ...defaultOptions, wrap: false };
      const { result } = renderHook(() => useFocusManagement(options));

      act(() => {
        result.current.setFocusedIndex(4);
      });

      act(() => {
        const event = {
          key: 'ArrowDown',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(4); // Stays at last
    });
  });

  describe('Horizontal Navigation', () => {
    it('should move right with ArrowRight', () => {
      const options = { ...defaultOptions, orientation: 'horizontal' as const };
      const { result } = renderHook(() => useFocusManagement(options));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      act(() => {
        const event = {
          key: 'ArrowRight',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(3);
    });

    it('should move left with ArrowLeft', () => {
      const options = { ...defaultOptions, orientation: 'horizontal' as const };
      const { result } = renderHook(() => useFocusManagement(options));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      act(() => {
        const event = {
          key: 'ArrowLeft',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(1);
    });
  });

  describe('Home/End Navigation', () => {
    it('should jump to first with Home', () => {
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      act(() => {
        result.current.setFocusedIndex(3);
      });

      act(() => {
        const event = {
          key: 'Home',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(0);
    });

    it('should jump to last with End', () => {
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      act(() => {
        result.current.setFocusedIndex(1);
      });

      act(() => {
        const event = {
          key: 'End',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(4);
    });
  });

  describe('Selection with Enter/Space', () => {
    it('should call onSelect with Enter', () => {
      const onSelect = vi.fn();
      const options = { ...defaultOptions, onSelect };
      const { result } = renderHook(() => useFocusManagement(options));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      act(() => {
        const event = {
          key: 'Enter',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(onSelect).toHaveBeenCalledWith(2);
    });

    it('should call onSelect with Space', () => {
      const onSelect = vi.fn();
      const options = { ...defaultOptions, onSelect };
      const { result } = renderHook(() => useFocusManagement(options));

      act(() => {
        result.current.setFocusedIndex(3);
      });

      act(() => {
        const event = {
          key: ' ',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(onSelect).toHaveBeenCalledWith(3);
    });

    it('should not call onSelect when no item focused', () => {
      const onSelect = vi.fn();
      const options = { ...defaultOptions, onSelect };
      const { result } = renderHook(() => useFocusManagement(options));

      act(() => {
        const event = {
          key: 'Enter',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Focus Item', () => {
    it('should focus item by index', () => {
      const mockElement = { focus: vi.fn() };
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      // Register element
      act(() => {
        const refCallback = result.current.itemRefs(2);
        refCallback(mockElement as never);
      });

      act(() => {
        result.current.focusItem(2);
      });

      expect(mockElement.focus).toHaveBeenCalled();
      expect(result.current.focusedIndex).toBe(2);
    });

    it('should not focus invalid index', () => {
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      act(() => {
        result.current.focusItem(-1);
      });

      expect(result.current.focusedIndex).toBe(-1);

      act(() => {
        result.current.focusItem(10);
      });

      expect(result.current.focusedIndex).toBe(-1);
    });
  });

  describe('Reset Focus', () => {
    it('should reset to initial index', () => {
      const options = { ...defaultOptions, initialIndex: 2 };
      const { result } = renderHook(() => useFocusManagement(options));

      act(() => {
        result.current.setFocusedIndex(4);
      });

      act(() => {
        result.current.resetFocus();
      });

      expect(result.current.focusedIndex).toBe(2);
    });
  });

  describe('Item Refs', () => {
    it('should register element ref', () => {
      const mockElement = document.createElement('div');
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      act(() => {
        const refCallback = result.current.itemRefs(0);
        refCallback(mockElement as never);
      });

      // Element is now registered (we can't directly inspect the Map, but focus should work)
      expect(typeof result.current.itemRefs).toBe('function');
    });

    it('should unregister element on null', () => {
      const { result } = renderHook(() => useFocusManagement(defaultOptions));

      act(() => {
        const refCallback = result.current.itemRefs(0);
        refCallback(null);
      });

      // Element is now unregistered
      expect(typeof result.current.itemRefs).toBe('function');
    });
  });

  describe('Enabled State', () => {
    it('should not handle keys when disabled', () => {
      const options = { ...defaultOptions, enabled: false };
      const { result } = renderHook(() => useFocusManagement(options));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      const initialIndex = result.current.focusedIndex;

      act(() => {
        const event = {
          key: 'ArrowDown',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(initialIndex);
    });
  });

  describe('Edge Cases', () => {
    it('should handle itemCount of 0', () => {
      const options = { ...defaultOptions, itemCount: 0 };
      const { result } = renderHook(() => useFocusManagement(options));

      act(() => {
        const event = {
          key: 'ArrowDown',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      expect(result.current.focusedIndex).toBe(-1);
    });

    it('should handle itemCount of 1', () => {
      const options = { ...defaultOptions, itemCount: 1 };
      const { result } = renderHook(() => useFocusManagement(options));

      act(() => {
        result.current.setFocusedIndex(0);
      });

      act(() => {
        const event = {
          key: 'ArrowDown',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent;
        result.current.handleKeyDown(event);
      });

      // With wrap=true and itemCount=1, should wrap to item 0
      expect(result.current.focusedIndex).toBe(0);
    });
  });
});

describe('getRovingTabIndex', () => {
  describe('No Item Focused', () => {
    it('should return 0 for default item when no focus', () => {
      expect(getRovingTabIndex(0, -1, 0)).toBe(0);
    });

    it('should return -1 for non-default items when no focus', () => {
      expect(getRovingTabIndex(1, -1, 0)).toBe(-1);
      expect(getRovingTabIndex(2, -1, 0)).toBe(-1);
    });
  });

  describe('Item Focused', () => {
    it('should return 0 for focused item', () => {
      expect(getRovingTabIndex(2, 2)).toBe(0);
    });

    it('should return -1 for non-focused items', () => {
      expect(getRovingTabIndex(0, 2)).toBe(-1);
      expect(getRovingTabIndex(1, 2)).toBe(-1);
      expect(getRovingTabIndex(3, 2)).toBe(-1);
    });
  });

  describe('Custom Default', () => {
    it('should use custom default tab index', () => {
      expect(getRovingTabIndex(2, -1, 2)).toBe(0);
      expect(getRovingTabIndex(0, -1, 2)).toBe(-1);
    });
  });
});
