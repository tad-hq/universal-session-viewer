// useKeyboardShortcuts Hook
// V2 Enhancement: Global keyboard shortcuts for power users
//
// Implements Command Palette pattern shortcuts:
// - Cmd/Ctrl+K: Focus search (universal search shortcut)
// - Cmd/Ctrl+R: Refresh sessions
// - Cmd/Ctrl+,: Open settings (standard macOS pattern)
//
// Platform-aware: Uses Cmd on Mac, Ctrl on Windows/Linux
//
// KNOWN CONFLICT: Cmd/Ctrl+R
// --------------------------
// This shortcut conflicts with the browser's native page refresh (Cmd/Ctrl+R).
// In development mode (running in a browser), this creates a conflict where:
// - Our handler intercepts the keypress to refresh sessions
// - The browser may still attempt to refresh the page
//
// In production Electron builds, this is NOT a conflict because:
// - Electron apps don't have browser refresh (no browser chrome)
// - We can fully control keyboard shortcuts without browser interference
// - The shortcut works as expected for "refresh sessions"
//
// Mitigation strategies considered:
// 1. Only intercept in production (process.env.NODE_ENV === 'production')
//    - Downside: Different behavior in dev vs prod
// 2. Use a different shortcut (e.g., Cmd+Shift+R)
//    - Downside: Less discoverable, non-standard
// 3. Accept the conflict in dev mode (current approach)
//    - Users can use the UI refresh button in dev mode
//    - Production Electron app works correctly
//
// Decision: Accept the conflict. The Electron production build is the target
// environment, and dev mode has the refresh button as a fallback.

import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsOptions {
  /** Handler for Cmd/Ctrl+K - Focus search */
  onFocusSearch?: () => void;
  /** Handler for Cmd/Ctrl+R - Refresh sessions */
  onRefresh?: () => void;
  /** Handler for Cmd/Ctrl+, - Open settings */
  onOpenSettings?: () => void;
  /** Handler for Escape - Clear related sessions filter */
  onClearRelatedFilter?: () => void;
  /** Whether related sessions filter is currently active */
  isRelatedFilterActive?: boolean;
  /** Disable shortcuts (e.g., when modal is open) */
  enabled?: boolean;
}

// Detect platform for modifier key
// V2 Pattern: Use navigator.platform for reliable detection
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * useKeyboardShortcuts Hook
 *
 * Provides global keyboard shortcuts for common actions.
 * Uses Command key on Mac, Control key on Windows/Linux.
 *
 * Shortcuts:
 * - Cmd/Ctrl+K: Focus search input
 * - Cmd/Ctrl+R: Refresh sessions list
 * - Cmd/Ctrl+,: Open settings modal
 * - Escape: Clear related sessions filter
 *
 * The hook is disabled when `enabled` is false (e.g., during modal dialogs).
 */
export function useKeyboardShortcuts({
  onFocusSearch,
  onRefresh,
  onOpenSettings,
  onClearRelatedFilter,
  isRelatedFilterActive = false,
  enabled = true,
}: UseKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // V2 Pattern: Skip if disabled or if user is typing in an input
      if (!enabled) return;

      // Handle Escape key for clearing related filter (no modifier needed)
      // BUG FIX: Don't intercept Escape if user is in an input (let them clear input first)
      if (event.key === 'Escape' && isRelatedFilterActive) {
        const target = event.target as HTMLElement;
        const isInInput =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable;

        if (!isInInput) {
          event.preventDefault();
          event.stopPropagation();
          onClearRelatedFilter?.();
          return;
        }
      }

      // Check for modifier key (Cmd on Mac, Ctrl on Windows/Linux)
      const hasModifier = isMac ? event.metaKey : event.ctrlKey;

      // Skip if no modifier key is pressed
      if (!hasModifier) return;

      // V2 Pattern: Don't intercept shortcuts when typing in form fields
      // Exception: Cmd+K should work everywhere for quick search access
      const target = event.target as HTMLElement;
      const isInInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      switch (event.key.toLowerCase()) {
        // Cmd/Ctrl+K: Focus search
        // V2 Pattern: Universal search shortcut (like VS Code, Slack, etc.)
        case 'k':
          // BUG FIX: Don't intercept if already in the search input (allow typing)
          if (!isInInput) {
            event.preventDefault();
            event.stopPropagation();
            onFocusSearch?.();
          }
          break;

        // Cmd/Ctrl+R: Refresh sessions
        // V2 Pattern: Prevent browser refresh, use for app refresh
        //
        // NOTE: This conflicts with browser's native refresh in dev mode.
        // See file header comment for detailed explanation.
        // In production Electron builds, this works correctly without conflict.
        case 'r':
          // Only intercept if not in input (allow text editing shortcuts)
          if (!isInInput) {
            event.preventDefault();
            event.stopPropagation();
            onRefresh?.();
          }
          break;

        // Cmd/Ctrl+,: Open settings
        // V2 Pattern: Standard macOS settings shortcut
        case ',':
          // BUG FIX: Don't intercept if in input (allow typing)
          if (!isInInput) {
            event.preventDefault();
            event.stopPropagation();
            onOpenSettings?.();
          }
          break;
      }
    },
    [enabled, onFocusSearch, onRefresh, onOpenSettings, onClearRelatedFilter, isRelatedFilterActive]
  );

  useEffect(() => {
    if (!enabled) return;

    // V2 Pattern: Use capture phase to handle before other listeners
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled, handleKeyDown]);
}

/**
 * Get the modifier key display string for the current platform
 * Use this for displaying keyboard shortcuts in the UI
 */
export function getModifierKey(): string {
  return isMac ? 'Cmd' : 'Ctrl';
}

/**
 * Get the full shortcut display string
 * @param key - The key (e.g., 'K', 'R', ',')
 * @returns Display string like "Cmd+K" or "Ctrl+K"
 */
export function getShortcutDisplay(key: string): string {
  return `${getModifierKey()}+${key.toUpperCase()}`;
}

/**
 * Keyboard shortcut definitions for UI display
 */
export const KEYBOARD_SHORTCUTS = {
  focusSearch: {
    key: 'K',
    description: 'Focus search',
    display: () => getShortcutDisplay('K'),
  },
  refresh: {
    key: 'R',
    description: 'Refresh sessions',
    display: () => getShortcutDisplay('R'),
  },
  openSettings: {
    key: ',',
    description: 'Open settings',
    display: () => getShortcutDisplay(','),
  },
} as const;
