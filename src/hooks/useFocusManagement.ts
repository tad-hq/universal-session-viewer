// useFocusManagement Hook
// WCAG 2.1 AA Accessibility: Keyboard navigation across components
//
// This hook provides focus management utilities for keyboard navigation:
// - Arrow key navigation within lists
// - Enter/Space key activation
// - Focus trapping within containers
// - Roving tabindex pattern for efficient navigation
//
// INTEGRATION NOTE:
// This hook is available for use with non-virtualized lists like settings panels,
// dropdown menus, or other static lists. For the SessionList component, keyboard
// navigation is handled by useKeyboardNavigation hook which uses document-level
// key listeners (vim-style j/k navigation) - this is intentional as SessionList
// uses virtualization (@tanstack/react-virtual) which makes ref-based roving
// tabindex complex to implement correctly.
//
// FUTURE USE CASES:
// - Settings modal navigation between sections
// - Dropdown menu keyboard navigation
// - Modal action button navigation
// - Any non-virtualized list that needs WCAG 2.1 AA keyboard navigation
//
// Usage:
// const { focusedIndex, setFocusedIndex, handleKeyDown, itemRefs } = useFocusManagement({
//   itemCount: items.length,
//   onSelect: (index) => selectItem(index),
//   orientation: 'vertical',
// });

import { useCallback, useRef, useState } from 'react';

export interface UseFocusManagementOptions {
  // Total number of focusable items
  itemCount: number;
  // Callback when an item is selected (Enter/Space)
  onSelect?: (index: number) => void;
  // Direction of navigation (vertical = up/down, horizontal = left/right)
  orientation?: 'vertical' | 'horizontal';
  // Enable wrapping from last to first item
  wrap?: boolean;
  // Initial focused index
  initialIndex?: number;
  // Whether the focus management is enabled
  enabled?: boolean;
}

export interface UseFocusManagementReturn {
  // Currently focused index (-1 if none)
  focusedIndex: number;
  // Set the focused index programmatically
  setFocusedIndex: (index: number) => void;
  // Keyboard event handler to attach to container
  handleKeyDown: (event: React.KeyboardEvent) => void;
  // Ref callback for items - use as ref={itemRefs(index)}
  itemRefs: (index: number) => (element: HTMLElement | null) => void;
  // Focus a specific item by index
  focusItem: (index: number) => void;
  // Reset focus to initial state
  resetFocus: () => void;
}

/**
 * useFocusManagement - WCAG 2.1 AA compliant keyboard navigation hook
 *
 * Implements the roving tabindex pattern for efficient keyboard navigation:
 * - Only one item in the list is tabbable at a time (tabindex="0")
 * - Other items have tabindex="-1"
 * - Arrow keys move focus between items
 * - Home/End keys jump to first/last item
 * - Enter/Space activates the focused item
 *
 * @param options Configuration options for focus management
 * @returns Focus management utilities and state
 */
export function useFocusManagement({
  itemCount,
  onSelect,
  orientation = 'vertical',
  wrap = true,
  initialIndex = -1,
  enabled = true,
}: UseFocusManagementOptions): UseFocusManagementReturn {
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  const itemRefsMap = useRef<Map<number, HTMLElement>>(new Map());

  // Focus a specific item by index
  const focusItem = useCallback(
    (index: number) => {
      if (index >= 0 && index < itemCount) {
        setFocusedIndex(index);
        const element = itemRefsMap.current.get(index);
        if (element) {
          element.focus();
        }
      }
    },
    [itemCount]
  );

  // Reset focus to initial state
  const resetFocus = useCallback(() => {
    setFocusedIndex(initialIndex);
  }, [initialIndex]);

  // Ref callback factory for items
  const itemRefs = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      if (element) {
        itemRefsMap.current.set(index, element);
      } else {
        itemRefsMap.current.delete(index);
      }
    },
    []
  );

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      const { key } = event;

      // Determine navigation keys based on orientation
      const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
      const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';

      let newIndex = focusedIndex;
      let handled = false;

      switch (key) {
        case prevKey:
          // Move to previous item
          if (focusedIndex > 0) {
            newIndex = focusedIndex - 1;
          } else if (wrap) {
            newIndex = itemCount - 1;
          }
          handled = true;
          break;

        case nextKey:
          // Move to next item
          if (focusedIndex < itemCount - 1) {
            newIndex = focusedIndex + 1;
          } else if (wrap) {
            newIndex = 0;
          }
          handled = true;
          break;

        case 'Home':
          // Jump to first item
          newIndex = 0;
          handled = true;
          break;

        case 'End':
          // Jump to last item
          newIndex = itemCount - 1;
          handled = true;
          break;

        case 'Enter':
        case ' ':
          // Activate current item
          if (focusedIndex >= 0 && onSelect) {
            event.preventDefault();
            onSelect(focusedIndex);
          }
          return;

        default:
          return;
      }

      if (handled) {
        event.preventDefault();
        if (newIndex !== focusedIndex) {
          focusItem(newIndex);
        }
      }
    },
    [enabled, itemCount, focusedIndex, orientation, wrap, onSelect, focusItem]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    itemRefs,
    focusItem,
    resetFocus,
  };
}

/**
 * Helper function to generate tabIndex based on roving tabindex pattern
 * Use this to set tabIndex on list items:
 *
 * <button tabIndex={getRovingTabIndex(index, focusedIndex)}>Item</button>
 *
 * @param index The index of the current item
 * @param focusedIndex The currently focused index
 * @param defaultTabIndex The default tab index when no item is focused (default: 0 for first item)
 * @returns 0 if this item should be tabbable, -1 otherwise
 */
export function getRovingTabIndex(
  index: number,
  focusedIndex: number,
  defaultTabIndex: number = 0
): 0 | -1 {
  // If no item is focused, make the default item tabbable
  if (focusedIndex === -1) {
    return index === defaultTabIndex ? 0 : -1;
  }
  // Otherwise, only the focused item is tabbable
  return index === focusedIndex ? 0 : -1;
}
