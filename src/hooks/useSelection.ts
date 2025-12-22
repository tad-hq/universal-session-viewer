/**
 * Convenience hook for selection store with typed selectors.
 *
 * This hook provides a clean API for components to interact with
 * the selection store without importing selectors separately.
 *
 * @example
 * ```tsx
 * const {
 *   selectedIds,
 *   isSelectionMode,
 *   selectionCount,
 *   toggleSelection,
 *   selectRange,
 *   clearSelection
 * } = useSelection();
 * ```
 *
 * @module hooks/useSelection
 */

import { useSelectionStore } from '../stores/selectionStore';

/**
 * Hook return type with all selection state and actions.
 */
export interface UseSelectionReturn {
  /** Array of selected session IDs */
  selectedIds: string[];
  /** Whether selection mode is active */
  isSelectionMode: boolean;
  /** Number of selected sessions */
  selectionCount: number;
  /** Anchor ID for range selection */
  anchorId: string | null;
  /** Last selected session ID */
  lastSelectedId: string | null;
  /** Toggle selection for a session */
  toggleSelection: (sessionId: string) => void;
  /** Select range from anchor to target */
  selectRange: (sessionId: string, allSessionIds: string[]) => void;
  /** Select all sessions */
  selectAll: (allSessionIds: string[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Enter selection mode */
  enterSelectionMode: () => void;
  /** Exit selection mode */
  exitSelectionMode: () => void;
  /** Check if session is selected */
  isSelected: (sessionId: string) => boolean;
  /** Set anchor for range selection */
  setAnchor: (sessionId: string) => void;
  /** Get selected IDs as array */
  getSelectedIds: () => string[];
}

/**
 * Convenience hook for selection store.
 *
 * Provides all selection state and actions in a single hook.
 *
 * @returns Selection state and actions
 */
export function useSelection(): UseSelectionReturn {
  // Subscribe to all state
  const selectedSessionIds = useSelectionStore((state) => state.selectedSessionIds);
  const isSelectionMode = useSelectionStore((state) => state.isSelectionMode);
  const anchorId = useSelectionStore((state) => state.anchorId);
  const lastSelectedId = useSelectionStore((state) => state.lastSelectedId);

  // Subscribe to all actions
  const toggleSelection = useSelectionStore((state) => state.toggleSelection);
  const selectRange = useSelectionStore((state) => state.selectRange);
  const selectAll = useSelectionStore((state) => state.selectAll);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const enterSelectionMode = useSelectionStore((state) => state.enterSelectionMode);
  const exitSelectionMode = useSelectionStore((state) => state.exitSelectionMode);
  const isSelected = useSelectionStore((state) => state.isSelected);
  const setAnchor = useSelectionStore((state) => state.setAnchor);
  const getSelectedIds = useSelectionStore((state) => state.getSelectedIds);

  return {
    selectedIds: Array.from(selectedSessionIds),
    isSelectionMode,
    selectionCount: selectedSessionIds.size,
    anchorId,
    lastSelectedId,
    toggleSelection,
    selectRange,
    selectAll,
    clearSelection,
    enterSelectionMode,
    exitSelectionMode,
    isSelected,
    setAnchor,
    getSelectedIds,
  };
}
