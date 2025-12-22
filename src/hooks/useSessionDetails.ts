/**
 * React hook for managing session details including messages, prompts, and actions.
 *
 * This hook wraps the Zustand sessionDetailStore and provides a clean API for
 * selecting sessions, loading messages, and performing session actions with
 * visual feedback support.
 *
 * @remarks
 * V1 Reference: index.html lines 1547-1678
 *
 * V1 patterns preserved:
 * - Dual ID field handling (checks both `id` and `session_id` fields)
 * - Progressive loading (recentMessages first for fast render, then full)
 * - Visual feedback callbacks for button states during async operations
 * - Status updates with auto-clear timers for notifications
 *
 * @example
 * ```tsx
 * function SessionDetailView({ sessionId, sessions }) {
 *   const {
 *     currentSession,
 *     isLoadingDetails,
 *     selectSession,
 *     reanalyzeSession,
 *     resumeSession,
 *   } = useSessionDetails();
 *
 *   useEffect(() => {
 *     if (sessionId) {
 *       selectSession(sessionId, sessions);
 *     }
 *   }, [sessionId]);
 *
 *   const handleReanalyze = () => {
 *     reanalyzeSession(
 *       undefined, // customInstructions (optional)
 *       (state) => setButtonState(state),
 *       (status) => setStatusMessage(status)
 *     );
 *   };
 *
 *   if (isLoadingDetails) return <Skeleton />;
 *   if (!currentSession) return <EmptyState />;
 *
 *   return <SessionContent session={currentSession} />;
 * }
 * ```
 *
 * @returns Object containing session detail state and actions
 *
 * @module hooks/useSessionDetails
 */

import { useSessionDetailStore } from '../stores';

import type {
  SessionDetailStore,
  ButtonState,
  CopyFeedback,
  StatusUpdate,
} from '../stores/sessionDetailStore';
import type { Session, SessionDetails, PromptFile } from '../types';

// Re-export types for consumers
export type { ButtonState, CopyFeedback, StatusUpdate };

/**
 * Return type for the useSessionDetails hook.
 */
interface UseSessionDetailsReturn {
  /** Currently selected session with details, or null */
  currentSession: SessionDetails | null;
  /** Whether session details are being loaded */
  isLoadingDetails: boolean;
  /** Available prompt files for session resume */
  prompts: PromptFile[];
  /** Error message from last operation, null if no error */
  error: string | null;

  /**
   * Selects a session and loads its details.
   * V1 Pattern: Handles both `id` and `session_id` fields.
   * @param sessionId - ID of the session to select
   * @param sessions - Array of available sessions to search
   * @returns Promise that resolves when selection completes
   */
  selectSession: (sessionId: string, sessions: Session[]) => Promise<void>;

  /**
   * Loads the full message history for the current session.
   * V1 Pattern: Only loads if not already loaded (fullMessagesLoaded flag).
   * @returns Promise that resolves when loading completes
   */
  loadFullMessages: () => Promise<void>;

  /**
   * Re-analyzes the current session with LLM.
   * Supports visual feedback callbacks for button state and status messages.
   * @param customInstructions - Optional custom instructions for analysis
   * @param onStateChange - Callback for button state changes
   * @param onStatusChange - Callback for status message changes
   * @returns Promise that resolves when analysis completes
   */
  reanalyzeSession: SessionDetailStore['reanalyzeSession'];

  /**
   * Resumes the current session in a new terminal.
   * Supports optional tmux integration and prompt file selection.
   * @param useTmux - Whether to use tmux for the terminal session
   * @param promptFile - Optional prompt file to use
   * @param onStatusChange - Callback for status message changes
   * @returns Promise that resolves when resume completes
   */
  resumeSession: SessionDetailStore['resumeSession'];

  /**
   * Copies the session ID to clipboard with visual feedback.
   * V1 Pattern: Shows checkmark feedback for 1500ms.
   * @param sessionId - Session ID to copy
   * @param onFeedback - Callback for copy feedback
   * @returns Promise that resolves when copy completes
   */
  copySessionId: SessionDetailStore['copySessionId'];
}

/**
 * Hook for managing session detail state with action callbacks.
 *
 * @returns {UseSessionDetailsReturn} Session detail state and actions
 */
export function useSessionDetails(): UseSessionDetailsReturn {
  // Get state and actions from Zustand store
  const {
    currentSession,
    isLoadingDetails,
    prompts,
    error,
    selectSession,
    loadFullMessages,
    reanalyzeSession,
    resumeSession,
    copySessionId,
  } = useSessionDetailStore();

  // The store already implements all v1 patterns:
  // - Dual ID field check (line 1555)
  // - Progressive loading (lines 1559-1628)
  // - Visual feedback callbacks (lines 1918-1942)
  // - Status auto-clear (lines 1871-1883)

  return {
    currentSession,
    isLoadingDetails,
    prompts,
    error,
    selectSession,
    loadFullMessages,
    reanalyzeSession,
    resumeSession,
    copySessionId,
  };
}
