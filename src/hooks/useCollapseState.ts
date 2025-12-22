/**
 * React hook for managing collapsible section state with localStorage persistence.
 *
 * This hook manages the collapsed/expanded state of UI sections (summary, resume)
 * and persists the state to localStorage so it survives page refreshes.
 *
 * @remarks
 * V1 Reference: index.html lines 2050-2098
 *
 * V1 patterns preserved:
 * - Both sections start collapsed by default
 * - State persisted to localStorage under 'session-viewer-collapse-state' key
 * - Summary section always reports as expanded (special case for summary display)
 *
 * @example
 * ```tsx
 * function SessionDetail() {
 *   const { isCollapsed, toggleSection } = useCollapseState();
 *
 *   return (
 *     <div>
 *       <Collapsible open={!isCollapsed('summary')}>
 *         <CollapsibleTrigger onClick={() => toggleSection('summary')}>
 *           Summary
 *         </CollapsibleTrigger>
 *         <CollapsibleContent>
 *           <SessionSummary />
 *         </CollapsibleContent>
 *       </Collapsible>
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns Object containing collapse state and control functions
 *
 * @module hooks/useCollapseState
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * State shape for collapsible sections.
 */
interface CollapseState {
  /** Whether the summary section is collapsed */
  summary: boolean;
  /** Whether the resume section is collapsed */
  resume: boolean;
}

/** localStorage key for persisting collapse state */
const STORAGE_KEY = 'session-viewer-collapse-state';

/**
 * Default state: both sections start collapsed.
 * V1 Reference: lines 2045-2048
 */
const DEFAULT_STATE: CollapseState = {
  summary: true,
  resume: true,
};

/**
 * Return type for the useCollapseState hook.
 */
interface UseCollapseStateReturn {
  /** Current collapse state for all sections */
  collapseState: CollapseState;

  /**
   * Toggles a section between collapsed and expanded.
   * Automatically persists to localStorage.
   * @param section - The section to toggle ('summary' or 'resume')
   */
  toggleSection: (section: keyof CollapseState) => void;

  /**
   * Checks if a section is currently collapsed.
   * Note: Summary always returns false (always expanded).
   * @param section - The section to check
   * @returns true if the section is collapsed
   */
  isCollapsed: (section: keyof CollapseState) => boolean;
}

/**
 * Hook for managing collapsible section state with persistence.
 *
 * @returns {UseCollapseStateReturn} Collapse state and control functions
 */
export function useCollapseState(): UseCollapseStateReturn {
  const [collapseState, setCollapseState] = useState<CollapseState>(DEFAULT_STATE);

  // Load collapse state from localStorage - Source: v1 lines 2050-2059
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCollapseState((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to load collapse state:', e);
      }
    }
  }, []);

  // Save collapse state to localStorage - Source: v1 lines 2061-2063
  const saveCollapseState = useCallback((state: CollapseState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, []);

  // Toggle section - Source: v1 lines 2065-2082
  const toggleSection = useCallback(
    (section: keyof CollapseState) => {
      setCollapseState((prev) => {
        const newState = {
          ...prev,
          [section]: !prev[section],
        };
        saveCollapseState(newState);
        return newState;
      });
    },
    [saveCollapseState]
  );

  // Check if section is collapsed
  const isCollapsed = useCallback(
    (section: keyof CollapseState) => {
      return collapseState[section];
    },
    [collapseState]
  );

  return {
    collapseState,
    toggleSection,
    isCollapsed,
  };
}
