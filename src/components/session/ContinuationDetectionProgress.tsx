// ContinuationDetectionProgress Component
// Displays real-time progress during continuation chain detection
//
// WCAG 2.1 AA Accessibility:
// - Progress bar with aria-valuenow/aria-valuemin/aria-valuemax
// - Status text announced via aria-live region
// - Sufficient color contrast for all text
//
// V1 Reference: No equivalent - V2 enhancement for large dataset feedback
// V2 Pattern: Real-time IPC event subscription with cleanup

import { useEffect, useState } from 'react';

import { Progress } from '@/components/ui/progress';

import type {
  ContinuationDetectionProgress as DetectionProgressData,
  ContinuationsDetected,
} from '../../types/ipc';

interface ProgressState {
  current: number;
  total: number;
  percentage: number;
  batch: number;
  totalBatches: number;
  message?: string;
}

interface CompletionStats {
  total: number;
  chains: number;
  orphaned: number;
  maxDepth: number;
}

/**
 * ContinuationDetectionProgress Component
 *
 * Displays a floating progress indicator during continuation chain detection.
 * Subscribes to IPC events for real-time progress updates.
 *
 * Events handled:
 * - continuation-detection-progress: Updates progress bar
 * - continuations-detected: Shows completion notification
 *
 * Auto-hides after detection completes.
 */
export function ContinuationDetectionProgress() {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);

  useEffect(() => {
    // Track the hide timer so we can clean it up on unmount
    let hideTimer: NodeJS.Timeout | null = null;

    // Listen for progress updates
    const cleanupProgress = window.electronAPI.onContinuationDetectionProgress(
      (_event: unknown, data: DetectionProgressData) => {
        // Clear existing hide timer if new progress starts
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }

        setProgress({
          current: data.current,
          total: data.total,
          percentage: data.percentage,
          batch: data.batch,
          totalBatches: data.totalBatches,
          message: data.message,
        });
        setIsDetecting(true);
        setShowCompletion(false);
      }
    );

    // Listen for completion
    const cleanupCompletion = window.electronAPI.onContinuationsDetected(
      (_event: unknown, data: ContinuationsDetected) => {
        setIsDetecting(false);
        setProgress(null);
        setCompletionStats({
          total: data.total,
          chains: data.chains,
          orphaned: data.orphaned,
          maxDepth: data.maxDepth,
        });
        setShowCompletion(true);

        // Auto-hide completion message after 5 seconds
        hideTimer = setTimeout(() => {
          setShowCompletion(false);
          setCompletionStats(null);
          hideTimer = null;
        }, 5000);
      }
    );

    // Cleanup listeners and timer on unmount
    return () => {
      cleanupProgress();
      cleanupCompletion();
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, []);

  // Show completion message
  if (showCompletion && completionStats) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 min-w-[300px] max-w-[400px] rounded-lg border border-border bg-background p-4 shadow-lg"
        role="status"
        aria-live="polite"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <svg
              className="size-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm font-medium">Continuation Detection Complete</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{completionStats.chains}</span>{' '}
              continuation chains
            </div>
            <div>
              <span className="font-medium text-foreground">{completionStats.orphaned}</span>{' '}
              orphaned sessions
            </div>
            <div>
              <span className="font-medium text-foreground">{completionStats.total}</span> total
              sessions
            </div>
            <div>
              <span className="font-medium text-foreground">{completionStats.maxDepth}</span> max
              chain depth
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if not detecting
  if (!isDetecting || !progress) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 min-w-[300px] max-w-[400px] rounded-lg border border-border bg-background p-4 shadow-lg"
      role="status"
      aria-live="polite"
      aria-label="Continuation detection progress"
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Spinner */}
            <svg
              className="size-4 animate-spin text-primary"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm font-medium">Detecting Continuations</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Batch {progress.batch}/{progress.totalBatches}
          </span>
        </div>

        {/* Progress bar */}
        <Progress
          value={progress.percentage}
          className="h-2"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.percentage)}
          aria-label={`Progress: ${Math.round(progress.percentage)}%`}
        />

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {progress.current.toLocaleString()} / {progress.total.toLocaleString()} sessions
          </span>
          <span className="font-medium">{Math.round(progress.percentage)}%</span>
        </div>

        {/* Optional message */}
        {progress.message && (
          <p className="border-t border-border pt-2 text-xs text-muted-foreground">
            {progress.message}
          </p>
        )}
      </div>
    </div>
  );
}
