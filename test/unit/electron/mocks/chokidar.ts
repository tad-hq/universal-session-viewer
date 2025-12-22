/**
 * Mock chokidar for Main Process Testing
 *
 * PURPOSE: Mock file watching without actual filesystem events
 *
 * V1 PATTERN CONTEXT:
 * - Main process uses chokidar.watch() with 300ms debounce + 500ms stabilization
 * - Watches ~/.claude/projects glob pattern for session file changes
 * - Emits 'change', 'add', 'unlink' events
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';

export interface MockFSWatcher extends EventEmitter {
  close: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  unwatch: ReturnType<typeof vi.fn>;
  getWatched: ReturnType<typeof vi.fn>;
  _triggerChange: (filePath: string) => void;
  _triggerAdd: (filePath: string) => void;
  _triggerUnlink: (filePath: string) => void;
}

/**
 * Create mock FSWatcher instance
 *
 * V1 Pattern (main.js:5253-5280): Chokidar with awaitWriteFinish
 */
export function createMockFSWatcher(): MockFSWatcher {
  const watcher = new EventEmitter() as MockFSWatcher;

  watcher.close = vi.fn().mockResolvedValue(undefined);
  watcher.add = vi.fn().mockReturnValue(watcher);
  watcher.unwatch = vi.fn().mockReturnValue(watcher);
  watcher.getWatched = vi.fn().mockReturnValue({});

  // Test helpers to trigger events
  watcher._triggerChange = (filePath: string) => {
    watcher.emit('change', filePath, { size: 1000, mtime: new Date() });
  };

  watcher._triggerAdd = (filePath: string) => {
    watcher.emit('add', filePath, { size: 1000, mtime: new Date() });
  };

  watcher._triggerUnlink = (filePath: string) => {
    watcher.emit('unlink', filePath);
  };

  return watcher;
}

/**
 * Create mock chokidar.watch function
 *
 * V1 Pattern: watch(path, options) returns FSWatcher
 */
export function createMockWatch() {
  const watchers: MockFSWatcher[] = [];

  const watch = vi.fn((paths: string | string[], options?: any): MockFSWatcher => {
    const watcher = createMockFSWatcher();
    watchers.push(watcher);
    return watcher;
  });

  // Helper to get all created watchers
  (watch as any).getWatchers = () => watchers;

  return watch;
}

/**
 * Create mock chokidar module
 *
 * Usage in tests:
 * ```typescript
 * vi.mock('chokidar', () => createMockChokidar());
 * ```
 */
export function createMockChokidar() {
  const watch = createMockWatch();

  return {
    watch,
    FSWatcher: vi.fn(),
  };
}

/**
 * Helper to verify file watcher configuration
 *
 * V1 Edge Case: Verifies 300ms debounce + 500ms stabilization settings
 */
export function verifyWatcherConfig(watch: ReturnType<typeof createMockWatch>): boolean {
  const calls = watch.mock.calls;
  if (calls.length === 0) return false;

  const [_paths, options] = calls[0];

  // V1 Pattern validation
  return (
    options?.ignoreInitial === true &&
    options?.awaitWriteFinish?.stabilityThreshold === 500 &&
    options?.awaitWriteFinish?.pollInterval === 100
  );
}
