import { useEffect } from 'react';

import { toast } from 'sonner';

import { useBulkOperationsStore } from '@/stores/bulkOperationsStore';
import type { BulkAnalyzeProgress, BulkAnalyzeComplete } from '@/types/ipc';

/**
 * Hook to subscribe to bulk operations events from main process
 * Automatically updates the bulk operations store and shows toast notifications
 */
export function useBulkOperationsEvents(): void {
  const { updateProgress, completeOperation, addError } = useBulkOperationsStore();

  useEffect(() => {
    // Subscribe to progress events
    const cleanupProgress = window.electronAPI.onBulkAnalyzeProgress(
      (_event: unknown, data: BulkAnalyzeProgress) => {
        // Update progress counters
        const completed = data.current;
        const failed = data.status === 'failed' ? 1 : 0;
        updateProgress(completed, failed);

        // Track errors
        if (data.status === 'failed' && data.error) {
          addError(data.sessionId, data.error);
        }

        // Show toast for status changes
        if (data.status === 'failed' && data.error) {
          toast.error(`Session analysis failed: ${data.error}`, {
            description: `Session ${data.sessionId.slice(0, 8)}...`,
          });
        } else if (data.status === 'skipped' && data.error) {
          toast.warning(`Session skipped: ${data.error}`, {
            description: `Session ${data.sessionId.slice(0, 8)}...`,
          });
        }
      }
    );

    // Subscribe to completion events
    const cleanupComplete = window.electronAPI.onBulkAnalyzeComplete(
      (_event: unknown, data: BulkAnalyzeComplete) => {
        // Update store to mark operation as complete
        completeOperation();

        // Show completion toast
        if (data.failed === 0 && data.skipped === 0) {
          toast.success('Bulk analysis complete', {
            description: `Successfully analyzed ${data.completed} sessions`,
          });
        } else if (data.completed > 0) {
          toast.warning('Bulk analysis complete with issues', {
            description: `${data.completed} succeeded, ${data.failed} failed, ${data.skipped} skipped`,
          });
        } else {
          toast.error('Bulk analysis failed', {
            description: `${data.failed} failed, ${data.skipped} skipped`,
          });
        }

        // Log errors if any
        if (data.errors.length > 0) {
          console.error('Bulk analysis errors:', data.errors);
        }
      }
    );

    // Cleanup on unmount
    return () => {
      cleanupProgress();
      cleanupComplete();
    };
  }, [updateProgress, completeOperation, addError]);
}
