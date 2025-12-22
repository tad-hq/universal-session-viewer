/**
 * Main Process Test Setup
 *
 * PURPOSE: Configure test environment for Node.js-based main process testing
 *
 * CRITICAL: This runs in Node.js, NOT browser/jsdom
 */

import { beforeEach, afterEach, vi } from 'vitest';

/**
 * Reset all mocks between tests
 *
 * V1 Pattern: Ensure test isolation
 */
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Set NODE_ENV for tests
 */
process.env.NODE_ENV = 'test';

/**
 * Suppress console output in tests (unless debugging)
 */
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}
