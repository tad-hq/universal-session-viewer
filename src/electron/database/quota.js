/**
 * Daily Analysis Quota Module
 *
 * Extracted from: main.js.backup-20251215 lines 1360-1485
 *
 * V1 Pattern Preservation:
 * - Daily quota limiting (default 20 analyses/day)
 * - Three counters: performed, succeeded, failed, retries
 * - Auto-creates daily row on first use
 * - Date-based key (YYYY-MM-DD)
 *
 * Edge Cases Preserved:
 * - BACKUP_MANIFEST.md: Usage quota tracking
 * - Graceful fallback if quota check fails (allow operation)
 */

const { safeLog } = require('../config');

/**
 * Get today's date string in YYYY-MM-DD format
 * V1 Pattern (not shown in lines but used throughout)
 */
function getTodayDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Check if daily analysis quota allows new analysis
 *
 * V1 Pattern (lines 1360-1413):
 * - Query today's usage from daily_analysis_quota table
 * - Compare against limit (from settings, default 20)
 * - Return allowed status + message
 * - Gracefully allow if quota check fails
 *
 * @param {Database} db - SQLite database instance
 * @param {number} dailyLimit - Daily analysis limit (from settings)
 * @returns {Object} - { allowed, current, limit, message }
 */
function checkDailyQuota(db, dailyLimit = 20) {
  if (!db) {
    safeLog.warn('Quota check skipped (no database)');
    return { allowed: true, current: 0, limit: dailyLimit, message: 'Quota tracking disabled' };
  }

  const today = getTodayDateString();

  try {
    const stmt = db.prepare(`
      SELECT analyses_performed
      FROM daily_analysis_quota
      WHERE date = ?
    `);
    const row = stmt.get(today);
    const current = row ? row.analyses_performed : 0;
    const allowed = current < dailyLimit;

    return {
      allowed,
      current,
      limit: dailyLimit,
      message: allowed
        ? `${current}/${dailyLimit} analyses used today`
        : `Daily limit reached (${dailyLimit}/${dailyLimit})`,
    };
  } catch (error) {
    safeLog.error('Error checking daily quota:', error);
    // V1 Edge Case: If quota check fails, allow operation (graceful fallback)
    return { allowed: true, current: 0, limit: dailyLimit, message: 'Error checking quota' };
  }
}

/**
 * Increment quota counters after analysis attempt
 *
 * V1 Pattern (lines 1415-1466):
 * - Ensure row exists for today (INSERT OR IGNORE)
 * - Increment appropriate counter based on success/retry
 * - Three increment modes: success, failed, retry
 *
 * @param {Database} db - SQLite database instance
 * @param {boolean} success - Whether analysis succeeded
 * @param {boolean} isRetry - Whether this was a retry attempt
 */
function incrementQuota(db, success = true, isRetry = false) {
  if (!db) {
    safeLog.log('Quota tracking disabled (no database)');
    return;
  }

  const today = getTodayDateString();

  try {
    // Ensure row exists for today
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO daily_analysis_quota
      (date, analyses_performed, analyses_succeeded, analyses_failed, retry_attempts)
      VALUES (?, 0, 0, 0, 0)
    `);
    insertStmt.run(today);

    // Increment appropriate counters
    let updateQuery;
    if (isRetry) {
      updateQuery = `
        UPDATE daily_analysis_quota
        SET retry_attempts = retry_attempts + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `;
    } else if (success) {
      updateQuery = `
        UPDATE daily_analysis_quota
        SET analyses_performed = analyses_performed + 1,
            analyses_succeeded = analyses_succeeded + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `;
    } else {
      updateQuery = `
        UPDATE daily_analysis_quota
        SET analyses_performed = analyses_performed + 1,
            analyses_failed = analyses_failed + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `;
    }

    const updateStmt = db.prepare(updateQuery);
    updateStmt.run(today);

    safeLog.log(`Quota incremented: ${isRetry ? 'retry' : success ? 'success' : 'failed'}`);
  } catch (error) {
    safeLog.error('Error incrementing quota:', error);
  }
}

/**
 * Get quota usage statistics for last N days
 *
 * V1 Pattern (lines 1468-1485):
 * - Query daily_analysis_quota ordered by date DESC
 * - Return array of {date, performed, succeeded, failed, retries}
 * - Used for analytics and user visibility
 *
 * @param {Database} db - SQLite database instance
 * @param {number} days - Number of days to retrieve (default 7)
 * @returns {Array} - Array of quota stats objects
 */
function getQuotaStats(db, days = 7) {
  if (!db) {
    return [];
  }

  try {
    const stmt = db.prepare(`
      SELECT date, analyses_performed, analyses_succeeded, analyses_failed, retry_attempts
      FROM daily_analysis_quota
      ORDER BY date DESC
      LIMIT ?
    `);
    return stmt.all(days);
  } catch (error) {
    safeLog.error('Error getting quota stats:', error);
    return [];
  }
}

module.exports = {
  getTodayDateString,
  checkDailyQuota,
  incrementQuota,
  getQuotaStats,
};
