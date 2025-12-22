/**
 * useContinuationEvents Hook
 *
 * Listens for continuation update events from the main process and
 * invalidates the continuation store cache accordingly.
 *
 * This hook is part of the enterprise-grade continuation caching system.
 * It completes the event-driven architecture by wiring up the frontend
 * to respond to real-time file watcher events.
 *
 * Pattern: Follows useBulkOperationsEvents.ts exactly
 *
 * Integration points:
 * - Main process: file watcher detects continuation changes (main.js:1404)
 * - IPC: 'continuations-updated' event sent via safeSend
 * - Preload: onContinuationsUpdated exposed (preload.js:155)
 * - Store: clearCache() invalidates in-memory continuation data
 *
 * Reference: docs/CONTINUATION_CACHE_ARCHITECTURE.md
 */

import { useEffect } from 'react';

import { useContinuationStore } from '../stores/continuationStore';

import type { ContinuationsUpdated } from '../types';

/**
 * Hook that subscribes to continuation update events from the main process.
 *
 * When the file watcher detects new/modified continuation chains,
 * this hook receives the event and clears the in-memory cache.
 * The next access will query fresh data from the database (which
 * has been updated by database triggers).
 *
 * This creates a seamless real-time update experience:
 * 1. User continues session in Claude Code → new JSONL created
 * 2. File watcher detects change (300ms debounce + 500ms stabilization)
 * 3. Main process updates session_continuations table
 * 4. Database triggers invalidate continuation_chain_cache
 * 5. Main process emits 'continuations-updated' event
 * 6. This hook receives event, clears in-memory store cache
 * 7. UI components re-fetch fresh data on next render
 *
 * @example
 * ```tsx
 * // In App.tsx after other event hooks:
 * import { useContinuationEvents } from './hooks/useContinuationEvents';
 *
 * function App() {
 *   useBulkOperationsEvents();
 *   useContinuationEvents(); // Add this line
 *   // ...
 * }
 * ```
 */
export function useContinuationEvents(): void {
  const clearCache = useContinuationStore((state) => state.clearCache);

  useEffect(() => {
    // Subscribe to continuation update events
    const cleanup = window.electronAPI.onContinuationsUpdated(
      (_event: unknown, _data: ContinuationsUpdated) => {
        // Clear the in-memory cache - next access will query fresh from DB
        // The database triggers have already invalidated the SQLite cache table,
        // so this just clears the Zustand store's in-memory Maps and Sets
        clearCache();
      }
    );

    // Cleanup subscription on unmount
    return cleanup;
  }, [clearCache]);
}
