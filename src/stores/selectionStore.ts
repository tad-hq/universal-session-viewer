import { create } from 'zustand';

interface SelectionState {
  selectedSessionIds: Set<string>;
  isSelectionMode: boolean;
  lastSelectedId: string | null;
  anchorId: string | null;
}

interface SelectionActions {
  toggleSelection: (sessionId: string) => void;
  selectRange: (sessionId: string, allSessionIds: string[]) => void;
  selectAll: (allSessionIds: string[]) => void;
  clearSelection: () => void;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  isSelected: (sessionId: string) => boolean;
  setAnchor: (sessionId: string) => void;
  getSelectedIds: () => string[];
}

type SelectionStore = SelectionState & SelectionActions;

export type { SelectionStore };

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selectedSessionIds: new Set<string>(),
  isSelectionMode: false,
  lastSelectedId: null,
  anchorId: null,

  toggleSelection: (sessionId: string) => {
    set((state) => {
      const newSelected = new Set(state.selectedSessionIds);

      if (newSelected.has(sessionId)) {
        newSelected.delete(sessionId);

        if (newSelected.size === 0) {
          return {
            selectedSessionIds: newSelected,
            isSelectionMode: false,
            lastSelectedId: null,
            anchorId: null,
          };
        }

        return {
          selectedSessionIds: newSelected,
          lastSelectedId: sessionId,
        };
      } else {
        newSelected.add(sessionId);

        return {
          selectedSessionIds: newSelected,
          isSelectionMode: true,
          lastSelectedId: sessionId,
          anchorId: state.anchorId || sessionId,
        };
      }
    });
  },

  selectRange: (sessionId: string, allSessionIds: string[]) => {
    const { anchorId } = get();

    if (!anchorId) {
      get().toggleSelection(sessionId);
      return;
    }

    const anchorIndex = allSessionIds.indexOf(anchorId);
    const targetIndex = allSessionIds.indexOf(sessionId);

    if (anchorIndex === -1 || targetIndex === -1) {
      get().toggleSelection(sessionId);
      return;
    }

    const startIndex = Math.min(anchorIndex, targetIndex);
    const endIndex = Math.max(anchorIndex, targetIndex);
    const rangeIds = allSessionIds.slice(startIndex, endIndex + 1);

    set((state) => {
      const newSelected = new Set(state.selectedSessionIds);
      rangeIds.forEach((id) => newSelected.add(id));

      return {
        selectedSessionIds: newSelected,
        isSelectionMode: true,
        lastSelectedId: sessionId,
      };
    });
  },

  selectAll: (allSessionIds: string[]) => {
    const newSelected = new Set(allSessionIds);

    set({
      selectedSessionIds: newSelected,
      isSelectionMode: true,
      lastSelectedId: allSessionIds[allSessionIds.length - 1] || null,
      anchorId: allSessionIds[0] || null,
    });
  },

  clearSelection: () => {
    set({
      selectedSessionIds: new Set<string>(),
      isSelectionMode: false,
      lastSelectedId: null,
      anchorId: null,
    });
  },

  enterSelectionMode: () => {
    set({ isSelectionMode: true });
  },

  exitSelectionMode: () => {
    set({
      selectedSessionIds: new Set<string>(),
      isSelectionMode: false,
      lastSelectedId: null,
      anchorId: null,
    });
  },

  isSelected: (sessionId: string): boolean => {
    return get().selectedSessionIds.has(sessionId);
  },

  setAnchor: (sessionId: string) => {
    set({ anchorId: sessionId });
  },

  getSelectedIds: (): string[] => {
    return Array.from(get().selectedSessionIds);
  },
}));

export const selectSelectedIds = (state: SelectionStore): string[] => {
  return Array.from(state.selectedSessionIds);
};

export const selectIsSelectionMode = (state: SelectionStore): boolean => state.isSelectionMode;

export const selectSelectionCount = (state: SelectionStore): number =>
  state.selectedSessionIds.size;

export const selectAnchorId = (state: SelectionStore): string | null => state.anchorId;

export const selectLastSelectedId = (state: SelectionStore): string | null => state.lastSelectedId;
