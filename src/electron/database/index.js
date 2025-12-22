/**
 * Database Connection Module
 *
 * Extracted from: main.js.backup-20251215 lines 593-623
 *
 * V1 Pattern Preservation:
 * - Enterprise-grade PRAGMA configuration
 * - Connection-level foreign_keys (MUST be per-connection)
 * - WAL journal mode for concurrent reads
 * - 64MB cache, memory-mapped I/O
 *
 * Edge Cases Preserved:
 * - BACKUP_MANIFEST.md #11: Database Migration System
 * - Critical: foreign_keys MUST be verified after setting
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { safeLog } = require('../config');

/**
 * Get database file path
 * Uses custom dbPath if provided, otherwise default location
 */
function getDbPath(customPath = null) {
  if (customPath) {
    return customPath;
  }

  const dataDir = path.join(os.homedir(), '.universal-session-viewer');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return path.join(dataDir, 'session-cache.db');
}

/**
 * Initialize database connection with enterprise-grade configuration
 *
 * V1 Pattern (lines 593-623):
 * - Sets connection-level PRAGMAs (foreign_keys per-connection)
 * - Sets persistent PRAGMAs (journal_mode, cache, mmap)
 * - Verifies foreign_keys = 1 (critical for data integrity)
 *
 * @param {string|null} customPath - Optional custom database path
 * @returns {Database} - Configured better-sqlite3 database instance
 */
function initializeConnection(customPath = null) {
  const dbPath = getDbPath(customPath);
  const db = new Database(dbPath);

  safeLog.log(`Connected to SQLite database: ${dbPath}`);

  // =========================================================================
  // Enterprise-grade database configuration
  // CRITICAL: These must be set per connection

  // =========================================================================

  // Connection-level PRAGMAs (must be set immediately after open)
  db.pragma('foreign_keys = ON'); // Referential integrity - MUST be per-connection

  // Persistent PRAGMAs (apply to database file)
  db.pragma('journal_mode = WAL'); // Concurrent reads during writes
  db.pragma('synchronous = NORMAL'); // Balanced durability/performance
  db.pragma('cache_size = -65536'); // 64MB cache
  db.pragma('temp_store = MEMORY'); // Temp tables in RAM
  db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O

  // =========================================================================
  // Verify critical connection-level PRAGMAs
  // Edge Case #11: Foreign keys MUST be 1, otherwise integrity is broken

  // =========================================================================
  const foreignKeys = db.pragma('foreign_keys', { simple: true });
  const cacheSize = db.pragma('cache_size', { simple: true });
  const tempStore = db.pragma('temp_store', { simple: true });
  const mmapSize = db.pragma('mmap_size', { simple: true });

  safeLog.log(
    `PRAGMA verification: foreign_keys=${foreignKeys}, cache_size=${cacheSize}, temp_store=${tempStore}, mmap_size=${mmapSize}`
  );

  // Critical check: foreign_keys must be 1, otherwise referential integrity is broken
  if (foreignKeys !== 1) {
    safeLog.error('CRITICAL: foreign_keys PRAGMA failed to apply! Data integrity at risk!');
  }

  return db;
}

/**
 * Close database connection safely
 *
 * @param {Database} db - Database instance to close
 */
function closeConnection(db) {
  if (db) {
    try {
      db.close();
      safeLog.log('Database connection closed');
    } catch (error) {
      safeLog.error('Error closing database:', error.message);
    }
  }
}

module.exports = {
  getDbPath,
  initializeConnection,
  closeConnection,
};
