/**
 * useMainProcessErrors Hook
 *
 * Subscribes to main process errors via IPC and displays them using toast notifications.
 * This hook ensures that errors occurring in the Electron main process are visible
 * to users in the renderer process.
 *
 * @remarks
 * V2 Enhancement: Main process error visibility
 * - Listens to 'main-process-error' IPC channel
 * - Displays errors via toast notifications
 * - Properly cleans up listener on unmount
 *
 * @example
 * ```tsx
 * // In App.tsx
 * function App() {
 *   useMainProcessErrors(); // Will show toast for any main process errors
 *   return <div>...</div>;
 * }
 * ```
 *
 * @module hooks/useMainProcessErrors
 */

import { useEffect } from 'react';

import { useToast } from './useToast';

/**
 * Shape of main process error data sent via IPC
 * This matches the type in ipc.ts for onMainProcessError
 */
export interface MainProcessErrorData {
  /** Error code for identification */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Severity level */
  severity: 'critical' | 'error' | 'warning';
  /** Timestamp of error occurrence */
  timestamp: string;
  /** Technical details (optional, for extended error info) */
  details?: string;
  /** Source of the error (optional) */
  source?: string;
}

/**
 * Hook options for customizing error handling behavior
 */
interface UseMainProcessErrorsOptions {
  /** Whether to show toast notifications (default: true) */
  showToasts?: boolean;
  /** Custom error handler for additional processing */
  onError?: (error: MainProcessErrorData) => void;
}

/**
 * Subscribes to main process errors and displays them via toast notifications.
 *
 * Features:
 * - Automatic subscription on mount, cleanup on unmount
 * - Severity-based toast styling (error, warning, info)
 * - Shows technical details in toast description for debugging
 * - Calls optional custom error handler for analytics/logging
 *
 * @param options - Configuration options
 */
export function useMainProcessErrors(options: UseMainProcessErrorsOptions = {}): void {
  const { showToasts = true, onError } = options;
  const toast = useToast();

  useEffect(() => {
    // Handler for main process errors
    // Note: event type is 'unknown' to match ElectronAPI interface in ipc.ts
    const handleMainProcessError = (_event: unknown, errorData: MainProcessErrorData): void => {
      // Call custom error handler if provided
      if (onError) {
        onError(errorData);
      }

      // Display toast notification if enabled
      if (showToasts) {
        const severity = errorData.severity || 'error';
        const source = errorData.source ? `[${errorData.source}] ` : '';
        const message = `${source}${errorData.message}`;

        // Build description with technical details
        let description: string | undefined;
        if (errorData.details !== undefined) {
          // Truncate long details for toast
          const maxLength = 200;
          description =
            errorData.details.length > maxLength
              ? `${errorData.details.substring(0, maxLength)}...`
              : errorData.details;
        }

        // Show appropriate toast based on severity
        // Note: Type allows 'critical' | 'error' | 'warning', no 'info' level
        switch (severity) {
          case 'warning':
            toast.warning(message, { description, duration: 'long' });
            break;
          case 'critical':
            // Critical errors get long duration and different styling
            toast.error(message, { description, duration: 'long' });
            break;
          case 'error':
          default:
            toast.error(message, { description, duration: 'long' });
            break;
        }
      }

      // Always log to console for debugging
      console.error('[Main Process Error]', errorData);
    };

    // Subscribe to main process errors
    // Returns cleanup function that removes only this listener
    const cleanup = window.electronAPI.onMainProcessError(handleMainProcessError);

    // Return cleanup function for unmount
    return cleanup;
  }, [showToasts, onError, toast]);
}

// Re-export UseMainProcessErrorsOptions for convenience
// Note: MainProcessErrorData is already exported at definition
export type { UseMainProcessErrorsOptions };
