/**
 * React hooks for managing Electron IPC event listeners with proper cleanup.
 *
 * This module provides hooks for subscribing to main-process events including
 * session updates, analysis status, and native menu commands.
 *
 * @remarks
 * V1 Reference: index.html lines 875-894
 *
 * PERFORMANCE FIX: Uses specific cleanup functions instead of removeAllListeners()
 *
 * Problem with removeAllListeners():
 * - Removes ALL listeners, including those registered by other hooks/components
 * - Can break functionality when multiple components use IPC
 * - Memory leaks if cleanup happens in wrong order
 *
 * Solution:
 * - Each listener registration returns its own cleanup function
 * - useEffect cleanup calls only the specific cleanup functions for this hook
 * - Other components' listeners are preserved
 *
 * V2 Enhancements:
 * - Added useMenuEvents for native menu bar integration (Cmd+R, Cmd+K, Cmd+,)
 * - Added useStatus for status indicator management
 * - Proper cleanup without global removeAllListeners
 *
 * @module hooks/useIPC
 */

import { useEffect, useCallback, useState, useRef } from 'react';

import type { Session, AnalysisStatus, CleanupFunction } from '../types';

/**
 * Configuration options for the useIPC hook.
 */
interface UseIPCOptions {
  /**
   * Called when a session is updated on disk.
   * V1 Reference: lines 875-877
   * @param session - The updated session data
   */
  onSessionUpdated?: (session: Session) => void;

  /**
   * Called with analysis progress updates.
   * V1 Reference: lines 879-886
   * @param data - Analysis status with message and progress
   */
  onAnalysisStatus?: (data: AnalysisStatus) => void;

  /**
   * Called when analysis completes successfully.
   * V1 Reference: lines 888-890
   * @param message - Success message
   */
  onAnalysisComplete?: (message: string) => void;

  /**
   * Called when analysis fails.
   * V1 Reference: lines 892-894
   * @param error - Error message
   */
  onAnalysisError?: (error: string) => void;

  /**
   * Called when session discovery is complete.
   * Sent after continuation chain resolution finishes.
   * @param data - Discovery complete message
   */
  onDiscoveryComplete?: (data: { message: string }) => void;
}

/**
 * Hook for subscribing to Electron IPC events with automatic cleanup.
 *
 * Sets up listeners for session updates, analysis status, completion, and errors.
 * Uses specific cleanup functions to avoid interfering with other components.
 *
 * @example
 * ```tsx
 * function AnalysisStatusBar() {
 *   const [status, setStatus] = useState<string>('Ready');
 *
 *   useIPC({
 *     onAnalysisStatus: (data) => setStatus(data.message),
 *     onAnalysisComplete: () => setStatus('Analysis complete'),
 *     onAnalysisError: (error) => setStatus(`Error: ${error}`),
 *   });
 *
 *   return <StatusBar>{status}</StatusBar>;
 * }
 * ```
 *
 * @param options - Event callbacks configuration
 */
export function useIPC(options: UseIPCOptions = {}): void {
  const {
    onSessionUpdated,
    onAnalysisStatus,
    onAnalysisComplete,
    onAnalysisError,
    onDiscoveryComplete,
  } = options;

  // Use ref to store cleanup functions
  // This ensures we always call the correct cleanup even if callbacks change
  const cleanupFunctionsRef = useRef<CleanupFunction[]>([]);

  // Set up event listeners - Source: v1 lines 875-894
  useEffect(() => {
    // Clear any previous cleanup functions
    cleanupFunctionsRef.current = [];

    // Session updated event - Source: v1 lines 875-877
    // PERFORMANCE FIX: Store cleanup function instead of relying on removeAllListeners
    if (onSessionUpdated) {
      const cleanup = window.electronAPI.onSessionUpdated((_event: unknown, session: Session) => {
        onSessionUpdated(session);
      });
      cleanupFunctionsRef.current.push(cleanup);
    }

    // Analysis status event - Source: v1 lines 879-886
    if (onAnalysisStatus) {
      const cleanup = window.electronAPI.onAnalysisStatus(
        (_event: unknown, data: AnalysisStatus) => {
          onAnalysisStatus(data);
        }
      );
      cleanupFunctionsRef.current.push(cleanup);
    }

    // Analysis complete event - Source: v1 lines 888-890
    if (onAnalysisComplete) {
      const cleanup = window.electronAPI.onAnalysisComplete(
        (_event: unknown, data: { message: string }) => {
          onAnalysisComplete(data.message);
        }
      );
      cleanupFunctionsRef.current.push(cleanup);
    }

    // Analysis error event - Source: v1 lines 892-894
    if (onAnalysisError) {
      const cleanup = window.electronAPI.onAnalysisError(
        (_event: unknown, data: { error: string }) => {
          onAnalysisError(data.error);
        }
      );
      cleanupFunctionsRef.current.push(cleanup);
    }

    // Discovery complete event
    if (onDiscoveryComplete) {
      const cleanup = window.electronAPI.onDiscoveryComplete(
        (_event: unknown, data: { message: string }) => {
          onDiscoveryComplete(data);
        }
      );
      cleanupFunctionsRef.current.push(cleanup);
    }

    // PERFORMANCE FIX: Cleanup only our specific listeners on unmount
    // This preserves listeners from other hooks/components
    return () => {
      cleanupFunctionsRef.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          // Ignore cleanup errors (listener might already be removed)
          console.warn('IPC cleanup error:', error);
        }
      });
      cleanupFunctionsRef.current = [];
    };
  }, [
    onSessionUpdated,
    onAnalysisStatus,
    onAnalysisComplete,
    onAnalysisError,
    onDiscoveryComplete,
  ]);
}

/**
 * Configuration options for the useMenuEvents hook.
 */
interface UseMenuEventsOptions {
  /**
   * Called when user triggers refresh from menu (Cmd+R).
   */
  onRefresh?: () => void;

  /**
   * Called when user triggers focus search from menu (Cmd+K).
   */
  onFocusSearch?: () => void;

  /**
   * Called when user triggers open settings from menu (Cmd+,).
   */
  onOpenSettings?: () => void;
}

/**
 * Hook for subscribing to native menu bar events.
 *
 * V2 Enhancement: Provides integration with Electron's native menu for
 * keyboard shortcuts that need to trigger React actions.
 *
 * @example
 * ```tsx
 * function App() {
 *   const searchRef = useRef<HTMLInputElement>(null);
 *
 *   useMenuEvents({
 *     onRefresh: () => refreshSessions(),
 *     onFocusSearch: () => searchRef.current?.focus(),
 *     onOpenSettings: () => setSettingsOpen(true),
 *   });
 *
 *   return <SearchInput ref={searchRef} />;
 * }
 * ```
 *
 * @param options - Menu event callbacks configuration
 */
export function useMenuEvents(options: UseMenuEventsOptions = {}): void {
  const { onRefresh, onFocusSearch, onOpenSettings } = options;

  // Use ref to store cleanup functions for menu events
  const cleanupFunctionsRef = useRef<CleanupFunction[]>([]);

  useEffect(() => {
    // Clear any previous cleanup functions
    cleanupFunctionsRef.current = [];

    // Menu refresh event (Cmd+R from menu)
    if (onRefresh) {
      const cleanup = window.electronAPI.onMenuRefresh(() => {
        onRefresh();
      });
      cleanupFunctionsRef.current.push(cleanup);
    }

    // Menu focus search event (Cmd+K from menu)
    if (onFocusSearch) {
      const cleanup = window.electronAPI.onMenuFocusSearch(() => {
        onFocusSearch();
      });
      cleanupFunctionsRef.current.push(cleanup);
    }

    // Menu open settings event (Cmd+, from menu)
    if (onOpenSettings) {
      const cleanup = window.electronAPI.onMenuOpenSettings(() => {
        onOpenSettings();
      });
      cleanupFunctionsRef.current.push(cleanup);
    }

    // PERFORMANCE FIX: Cleanup only our specific listeners on unmount
    return () => {
      cleanupFunctionsRef.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Menu event cleanup error:', error);
        }
      });
      cleanupFunctionsRef.current = [];
    };
  }, [onRefresh, onFocusSearch, onOpenSettings]);
}

/**
 * State shape for status indicator.
 */
export interface StatusState {
  /** Current status indicator type */
  indicator: 'ready' | 'analyzing' | 'loading' | 'error' | 'success';
  /** Human-readable status text */
  text: string;
}

/**
 * Hook for managing application status indicator state.
 *
 * Provides a simple status state with an update function for use in
 * status bars and loading indicators.
 *
 * @example
 * ```tsx
 * function StatusBar() {
 *   const { status, updateStatus } = useStatus();
 *
 *   // Update status when analysis starts
 *   const handleAnalyze = () => {
 *     updateStatus('analyzing', 'Analyzing session...');
 *   };
 *
 *   return (
 *     <div className={`status-${status.indicator}`}>
 *       {status.text}
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns Object with status state and update function
 */
export function useStatus(): {
  status: StatusState;
  updateStatus: (indicator: StatusState['indicator'], text: string) => void;
} {
  const [status, setStatus] = useState<StatusState>({ indicator: 'ready', text: 'Ready' });

  const updateStatus = useCallback((indicator: StatusState['indicator'], text: string) => {
    setStatus({ indicator, text });
  }, []);

  return { status, updateStatus };
}
