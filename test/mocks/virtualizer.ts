/**
 * @tanstack/react-virtual Mock
 *
 * Provides stateful mock for useVirtualizer hook that responds to prop changes
 * and simulates virtualization behavior for testing.
 */

import { vi } from 'vitest';

export interface VirtualItem {
  key: string | number;
  index: number;
  start: number;
  end?: number;
  size?: number;
}

export interface Virtualizer {
  getVirtualItems: () => VirtualItem[];
  getTotalSize: () => number;
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void;
  scrollToOffset: (offset: number, options?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void;
  measure: () => void;
  measureElement: (element: Element | null) => void;
  scrollOffset?: number;
  scrollDirection?: 'forward' | 'backward';
}

export interface UseVirtualizerOptions {
  count: number;
  getScrollElement: () => Element | null;
  estimateSize: () => number;
  overscan?: number;
}

// Global state for virtualizer mock
let mockVirtualizer: Virtualizer | null = null;

/**
 * Create default virtualizer implementation
 */
function createDefaultVirtualizer(options: UseVirtualizerOptions): Virtualizer {
  const { count, estimateSize, overscan = 5 } = options;
  const itemSize = estimateSize();

  // Calculate visible items (simulate viewport showing ~10 items at a time)
  const visibleCount = Math.min(count, 10 + overscan * 2);

  return {
    getVirtualItems: () => {
      return Array.from({ length: visibleCount }, (_, i) => ({
        key: i,
        index: i,
        start: i * itemSize,
        end: (i + 1) * itemSize,
        size: itemSize,
      }));
    },
    getTotalSize: () => count * itemSize,
    scrollToIndex: vi.fn(),
    scrollToOffset: vi.fn(),
    measure: vi.fn(),
    measureElement: vi.fn(),
    scrollOffset: 0,
    scrollDirection: 'forward',
  };
}

/**
 * Mock implementation of useVirtualizer
 */
export const useVirtualizer = vi.fn((options: UseVirtualizerOptions) => {
  // If a custom mock has been set, use it
  if (mockVirtualizer) {
    return mockVirtualizer;
  }

  // Otherwise, create default implementation
  return createDefaultVirtualizer(options);
});

/**
 * Set custom virtualizer mock (for individual tests)
 */
export function setMockVirtualizer(virtualizer: Virtualizer | null): void {
  mockVirtualizer = virtualizer;
}

/**
 * Reset virtualizer mock to default behavior
 */
export function resetMockVirtualizer(): void {
  mockVirtualizer = null;
  useVirtualizer.mockClear();
}

/**
 * Create a virtualizer instance for testing
 */
export function createMockVirtualizer(
  items: VirtualItem[] = [],
  totalSize = 0,
  options: Partial<Virtualizer> = {}
): Virtualizer {
  return {
    getVirtualItems: () => items,
    getTotalSize: () => totalSize,
    scrollToIndex: vi.fn(),
    scrollToOffset: vi.fn(),
    measure: vi.fn(),
    measureElement: vi.fn(),
    scrollOffset: 0,
    scrollDirection: 'forward',
    ...options,
  };
}
