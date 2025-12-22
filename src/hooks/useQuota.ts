/**
 * React hook for managing daily analysis quota with automatic polling.
 *
 * This hook wraps the Zustand quotaStore and provides automatic lifecycle
 * management including initial fetch, 30-second polling, and event-based updates.
 *
 * @remarks
 * V1 Reference: index.html lines 2106-2120, 2201-2208
 *
 * V1 patterns preserved:
 * - Update quota on mount (v1 line 2202)
 * - Poll every 30 seconds (v1 line 2203)
 * - Update on analysis complete event (v1 lines 2206-2208)
 *
 * @example
 * ```tsx
 * function QuotaDisplay() {
 *   const { quota, isLoading } = useQuota();
 *
 *   if (isLoading) return <Skeleton width={60} />;
 *
 *   return (
 *     <span className={quota.allowed ? 'text-gray-500' : 'text-red-500'}>
 *       {quota.current}/{quota.limit} analyses today
 *     </span>
 *   );
 * }
 * ```
 *
 * @returns Object containing quota state and update function
 *
 * @module hooks/useQuota
 */

import { useEffect } from 'react';

import { useQuotaStore } from '../stores';

import type { QuotaInfo } from '../types';

/**
 * Return type for the useQuota hook.
 */
interface UseQuotaReturn {
  /** Current quota information */
  quota: QuotaInfo;
  /** Whether quota is being loaded */
  isLoading: boolean;
  /**
   * Manually trigger quota update.
   * @returns Promise that resolves when update completes
   */
  updateQuota: () => Promise<void>;
}

/**
 * Hook for managing quota state with automatic polling.
 *
 * @returns {UseQuotaReturn} Quota state and update function
 */
export function useQuota(): UseQuotaReturn {
  const { quota, isLoading, updateQuota } = useQuotaStore();

  // V1 Reference: lines 2201-2204 (quota polling on mount)
  // Update quota on mount and poll every 30 seconds
  useEffect(() => {
    void updateQuota();

    // V1 Pattern: Poll every 30 seconds
    // V1 Reference: line 2203 - setInterval(updateQuotaDisplay, 30000)
    const interval = setInterval(() => void updateQuota(), 30000);

    return () => clearInterval(interval);
  }, [updateQuota]);

  // V1 Reference: lines 2206-2208 (onAnalysisComplete listener)
  // Update quota when analysis completes
  // PERFORMANCE FIX: Now properly cleans up this specific listener
  useEffect(() => {
    const handleAnalysisComplete = (): void => {
      void updateQuota();
    };

    // Register event listener for analysis complete
    // PERFORMANCE FIX: Store the cleanup function returned by the listener registration
    const cleanup = window.electronAPI.onAnalysisComplete(handleAnalysisComplete);

    // Cleanup on unmount - now properly removes only this listener
    return () => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Quota listener cleanup error:', error);
      }
    };
  }, [updateQuota]);

  return {
    quota,
    isLoading,
    updateQuota,
  };
}
