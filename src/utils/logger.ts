/* eslint-disable no-console */
/**
 * Centralized logging wrapper - console usage is intentional.
 * All application logging goes through this abstraction.
 *
 * PERFORMANCE: Remove console.log spam in production.
 * Only log in development mode or when explicitly enabled.
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.debug('Debug message', { data });  // Only in dev
 *   logger.log('Info message');                // Only in dev
 *   logger.error('Error message');             // Always logged
 */

const isDev = import.meta.env.MODE === 'development';

export const logger = {
  /**
   * Log informational messages (dev only)
   */
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },

  /**
   * Log warning messages (dev only)
   */
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },

  /**
   * Log error messages (always logged, even in production)
   */
  error: (...args: unknown[]) => {
    // Always log errors
    console.error(...args);
  },

  /**
   * Log debug messages (dev only)
   */
  debug: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },

  /**
   * Log verbose trace messages (dev only)
   */
  trace: (...args: unknown[]) => {
    if (isDev) console.trace(...args);
  },
};

/**
 * Critical logs that should survive to production
 * Use sparingly - only for critical debugging that needs production visibility
 */
export const criticalLog = (...args: unknown[]): void => {
  console.log('[CRITICAL]', ...args);
};

/**
 * Performance marker logger
 * Only active in development
 */
export const perfLog = (label: string, duration: number): void => {
  if (isDev) {
    const fixed = duration.toFixed(2);
    console.log('[PERF] ' + label + ': ' + fixed + 'ms');
  }
};
