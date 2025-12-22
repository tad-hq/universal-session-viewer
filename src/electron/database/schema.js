/**
 * Database Schema Module
 *
 * Extracted from: main.js.backup-20251215 lines 624-1100
 *
 * V1 Pattern Preservation:
 * - Two-table architecture (metadata + analysis cache)
 * - FTS5 virtual table for full-text search
 * - Continuation tracking with triggers
 * - Continuation chain cache with automatic invalidation
 * - Daily quota tracking
 * - App settings storage
 *
 * Edge Cases Preserved:
 * - BACKUP_MANIFEST.md #3: Two-Table Database Pattern
 * - BACKUP_MANIFEST.md #11: Database Migration System
 * - BACKUP_MANIFEST.md #12: FTS5 Search Configuration
 * - BACKUP_MANIFEST.md #14: Continuation Chain Detection
 */

const { safeLog } = require('../config');

/**
 * Initialize all database tables, indexes, and triggers
 *
 * V1 Pattern (lines 624-1100):
 * - Creates session_analysis_cache (main analysis storage)
 * - Creates session_metadata (fast listing table)
 * - Creates session_fts (FTS5 search)
 * - Creates session_continuations (chain tracking)
 * - Creates continuation_chain_cache (O(1) chain lookups)
 * - Creates daily_analysis_quota (usage tracking)
 * - Creates app_settings (preferences storage)
 * - Sets up all indexes and triggers
 *
 * @param {Database} db - better-sqlite3 database instance
 * @param {Object} appInstance - SessionViewerApp instance for migrations
 */
async function initializeSchema(db, appInstance = null) {
  safeLog.log('Initializing database schema...');

  // =========================================================================
  // Session Analysis Cache Table

  // Edge Case #3: Analysis cache table (lazy loaded, separate from metadata)
  // =========================================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_analysis_cache (
      session_id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_modified_time INTEGER NOT NULL,
      file_hash TEXT,
      title TEXT,
      summary TEXT NOT NULL,
      analysis_model TEXT NOT NULL,
      analysis_timestamp INTEGER NOT NULL,
      messages_analyzed INTEGER NOT NULL,
      tokens_saved INTEGER NOT NULL,
      analysis_duration_ms INTEGER NOT NULL,
      cache_version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // =========================================================================
  // Migrations: Add file_hash column to existing databases

  // Edge Case #11: Database Migration System (versioned migrations)
  // =========================================================================
  try {
    const checkColumn = db.prepare('PRAGMA table_info(session_analysis_cache)');
    const columns = checkColumn.all();
    const hasFileHash = columns.some((col) => col.name === 'file_hash');

    if (!hasFileHash) {
      safeLog.log('Migrating database: adding file_hash column');
      db.exec('ALTER TABLE session_analysis_cache ADD COLUMN file_hash TEXT');
    }
  } catch (migrationError) {
    safeLog.warn('Migration warning (file_hash):', migrationError.message);
  }

  // =========================================================================
  // Migration: Add analysis_date column for calendar views

  // =========================================================================
  try {
    const checkColumn = db.prepare('PRAGMA table_info(session_analysis_cache)');
    const columns = checkColumn.all();
    const hasAnalysisDate = columns.some((col) => col.name === 'analysis_date');

    if (!hasAnalysisDate) {
      safeLog.log('Migrating database: adding analysis_date column');
      db.exec('ALTER TABLE session_analysis_cache ADD COLUMN analysis_date TEXT');

      // Populate analysis_date for existing rows
      db.exec(`
        UPDATE session_analysis_cache
        SET analysis_date = date(analysis_timestamp, 'unixepoch')
        WHERE analysis_date IS NULL
      `);

      safeLog.log('Populated analysis_date for existing sessions');
    }
  } catch (migrationError) {
    safeLog.warn('Migration warning (analysis_date):', migrationError.message);
  }

  // =========================================================================
  // Create indexes for performance (after migrations)

  // =========================================================================
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_cache_project ON session_analysis_cache(project_path);
    CREATE INDEX IF NOT EXISTS idx_session_cache_modified ON session_analysis_cache(file_modified_time DESC);
    CREATE INDEX IF NOT EXISTS idx_session_cache_hash ON session_analysis_cache(file_hash);
    CREATE INDEX IF NOT EXISTS idx_session_cache_analyzed ON session_analysis_cache(analysis_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_session_cache_date ON session_analysis_cache(analysis_date DESC);
    CREATE INDEX IF NOT EXISTS idx_session_cache_project_analyzed ON session_analysis_cache(project_path, analysis_timestamp DESC);
  `);

  // =========================================================================
  // FTS5 Virtual Table for Full-Text Search

  // Edge Case #12: FTS5 Search Configuration (external content table pattern)
  // =========================================================================
  try {
    const ftsExists = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='session_fts'
    `
      )
      .get();

    if (!ftsExists) {
      safeLog.log('Creating FTS5 search table');

      db.exec(`
        CREATE VIRTUAL TABLE session_fts USING fts5(
          session_id UNINDEXED,
          title,
          summary,
          project_path,
          file_path,
          tokenize='porter unicode61'
        )
      `);

      // Populate FTS5 table with existing data
      db.exec(`
        INSERT INTO session_fts(session_id, title, summary, project_path, file_path)
        SELECT session_id,
               COALESCE(title, ''),
               COALESCE(summary, ''),
               COALESCE(project_path, ''),
               COALESCE(file_path, '')
        FROM session_analysis_cache
      `);

      safeLog.log('Populated FTS5 table with existing sessions');
    }
  } catch (ftsError) {
    safeLog.warn('FTS5 setup warning:', ftsError.message);
  }

  // =========================================================================
  // FTS5 Sync Triggers

  // Edge Case #12: Insert into both session_analysis_cache AND session_fts
  // =========================================================================
  try {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS session_fts_insert
      AFTER INSERT ON session_analysis_cache
      BEGIN
        INSERT INTO session_fts(session_id, title, summary, project_path, file_path)
        VALUES (
          new.session_id,
          COALESCE(new.title, ''),
          COALESCE(new.summary, ''),
          COALESCE(new.project_path, ''),
          COALESCE(new.file_path, '')
        );
      END;

      CREATE TRIGGER IF NOT EXISTS session_fts_update
      AFTER UPDATE ON session_analysis_cache
      BEGIN
        UPDATE session_fts
        SET title = COALESCE(new.title, ''),
            summary = COALESCE(new.summary, ''),
            project_path = COALESCE(new.project_path, ''),
            file_path = COALESCE(new.file_path, '')
        WHERE session_id = new.session_id;
      END;

      CREATE TRIGGER IF NOT EXISTS session_fts_delete
      AFTER DELETE ON session_analysis_cache
      BEGIN
        DELETE FROM session_fts WHERE session_id = old.session_id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_analysis_date_insert
      AFTER INSERT ON session_analysis_cache
      BEGIN
        UPDATE session_analysis_cache
        SET analysis_date = date(NEW.analysis_timestamp, 'unixepoch')
        WHERE session_id = NEW.session_id AND analysis_date IS NULL;
      END;

      CREATE TRIGGER IF NOT EXISTS update_analysis_date_update
      AFTER UPDATE OF analysis_timestamp ON session_analysis_cache
      BEGIN
        UPDATE session_analysis_cache
        SET analysis_date = date(NEW.analysis_timestamp, 'unixepoch')
        WHERE session_id = NEW.session_id;
      END;
    `);

    safeLog.log('Created FTS5 sync triggers');
  } catch (triggerError) {
    safeLog.warn('Trigger creation warning:', triggerError.message);
  }

  // =========================================================================
  // Daily Analysis Quota Tracking Table

  // =========================================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_analysis_quota (
      date TEXT PRIMARY KEY,
      analyses_performed INTEGER DEFAULT 0,
      analyses_succeeded INTEGER DEFAULT 0,
      analyses_failed INTEGER DEFAULT 0,
      retry_attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // =========================================================================
  // App Settings Storage Table

  // =========================================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      value_type TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // =========================================================================
  // Two-Table Migration Check

  // Edge Case #3: Migrate to two-table architecture if needed
  // =========================================================================
  try {
    const tableExists = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='session_metadata'
    `
      )
      .get();

    if (!tableExists) {
      safeLog.log('Two-table architecture migration needed...');
      // Migration requires appInstance for file system access
      if (appInstance) {
        const migration = require('../migrations/001_add_session_metadata');
        await migration.migrateToTwoTableArchitecture(db, appInstance);
      } else {
        safeLog.warn('Two-table migration skipped (no appInstance provided)');
      }
    } else {
      safeLog.log('Two-table architecture already migrated');
    }
  } catch (migrationError) {
    safeLog.error('Migration check warning:', migrationError.message);
    // Don't fail initialization if migration check fails
  }

  // =========================================================================
  // Session Continuations Table

  // Edge Case #14: Continuation Chain Detection (parent-child tracking)
  // =========================================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_continuations (
      child_session_id TEXT PRIMARY KEY,
      parent_session_id TEXT NOT NULL,
      continuation_order INTEGER NOT NULL DEFAULT 0,
      split_reason TEXT,
      split_timestamp INTEGER,
      child_started_timestamp INTEGER,
      is_active_continuation BOOLEAN DEFAULT 0,
      is_orphaned BOOLEAN DEFAULT 0,
      has_file_history_event BOOLEAN DEFAULT 1,
      has_compact_boundary BOOLEAN DEFAULT 0,
      discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE,
      FOREIGN KEY (parent_session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
    )
  `);

  // =========================================================================
  // Continuation Indexes

  // =========================================================================
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_continuations_parent
      ON session_continuations(parent_session_id, continuation_order);
    CREATE INDEX IF NOT EXISTS idx_continuations_child
      ON session_continuations(child_session_id);
    CREATE INDEX IF NOT EXISTS idx_continuations_active
      ON session_continuations(is_active_continuation) WHERE is_active_continuation = 1;
    CREATE INDEX IF NOT EXISTS idx_continuations_chain
      ON session_continuations(parent_session_id, continuation_order, is_active_continuation);
    CREATE INDEX IF NOT EXISTS idx_continuations_orphaned
      ON session_continuations(is_orphaned) WHERE is_orphaned = 1;
  `);

  // =========================================================================
  // Continuation Auto-Management Triggers

  // Edge Case #14: Auto-mark active continuation, orphan handling
  // =========================================================================
  try {
    db.exec(`
      -- Auto-mark most recent child as active continuation
      CREATE TRIGGER IF NOT EXISTS update_active_continuation
      AFTER INSERT ON session_continuations
      BEGIN
        -- Unmark all previous children of this parent
        UPDATE session_continuations
        SET is_active_continuation = 0
        WHERE parent_session_id = NEW.parent_session_id
          AND child_session_id != NEW.child_session_id;

        -- Mark the newest child as active
        UPDATE session_continuations
        SET is_active_continuation = 1
        WHERE child_session_id = (
          SELECT child_session_id
          FROM session_continuations
          WHERE parent_session_id = NEW.parent_session_id
          ORDER BY continuation_order DESC
          LIMIT 1
        );
      END;

      -- Mark continuations as orphaned when parent is deleted
      CREATE TRIGGER IF NOT EXISTS mark_orphaned_on_parent_delete
      BEFORE DELETE ON session_metadata
      BEGIN
        UPDATE session_continuations
        SET is_orphaned = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE parent_session_id = OLD.session_id;
      END;

      -- Auto-update modified timestamp
      CREATE TRIGGER IF NOT EXISTS update_continuation_timestamp
      AFTER UPDATE ON session_continuations
      BEGIN
        UPDATE session_continuations
        SET updated_at = CURRENT_TIMESTAMP
        WHERE child_session_id = NEW.child_session_id;
      END;

      -- Mark child continuations as orphaned when child file deleted
      CREATE TRIGGER IF NOT EXISTS mark_child_orphaned_on_delete
      BEFORE DELETE ON session_metadata
      BEGIN
        UPDATE session_continuations
        SET is_orphaned = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE child_session_id = OLD.session_id;
      END;

      -- Heal orphaned continuations when parent appears
      CREATE TRIGGER IF NOT EXISTS heal_orphaned_continuations
      AFTER INSERT ON session_metadata
      BEGIN
        UPDATE session_continuations
        SET is_orphaned = 0, updated_at = CURRENT_TIMESTAMP
        WHERE parent_session_id = NEW.session_id AND is_orphaned = 1;
      END;
    `);

    safeLog.log('Created continuation tracking triggers');
  } catch (triggerError) {
    safeLog.warn('Continuation trigger creation warning:', triggerError.message);
  }

  // =========================================================================
  // Continuation Chain Cache Table (Enterprise-Grade Caching)

  // Purpose: Store pre-computed continuation chain data for O(1) lookups
  // Pattern: Trigger-based invalidation (not TTL-based)
  // Benefits:
  //   - Cold start = warm start (read from table, no computation)
  //   - 80-95% reduction in continuation query latency
  //   - Automatic cache coherence via database triggers
  // =========================================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS continuation_chain_cache (
      -- Primary identification
      session_id TEXT PRIMARY KEY,

      -- Computed chain hierarchy (eliminates findRootParent traversal)
      root_session_id TEXT NOT NULL,

      -- Per-session continuation metadata
      is_child BOOLEAN DEFAULT 0,
      is_parent BOOLEAN DEFAULT 0,
      child_count INTEGER DEFAULT 0,
      chain_position INTEGER,
      is_active_continuation BOOLEAN DEFAULT 0,

      -- Computed depth (eliminates recursive CTE for depth calculation)
      depth_from_root INTEGER DEFAULT 0,

      -- Chain structure summary (for hasBranches detection)
      has_multiple_children BOOLEAN DEFAULT 0,

      -- Cache management
      cache_version INTEGER NOT NULL DEFAULT 1,
      computed_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Foreign key constraints (CASCADE delete for cleanup)
      FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE,
      FOREIGN KEY (root_session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
    )
  `);

  // =========================================================================
  // Continuation Chain Cache Indexes

  // =========================================================================
  db.exec(`
    -- Fast lookup by root (for chain aggregation)
    CREATE INDEX IF NOT EXISTS idx_chain_cache_root
      ON continuation_chain_cache(root_session_id);

    -- Partial index for child sessions only
    CREATE INDEX IF NOT EXISTS idx_chain_cache_is_child
      ON continuation_chain_cache(is_child) WHERE is_child = 1;

    -- Partial index for parent sessions only
    CREATE INDEX IF NOT EXISTS idx_chain_cache_is_parent
      ON continuation_chain_cache(is_parent) WHERE is_parent = 1;

    -- Composite for tree traversal queries
    CREATE INDEX IF NOT EXISTS idx_chain_cache_depth
      ON continuation_chain_cache(root_session_id, depth_from_root);

    -- Partial index for active continuations
    CREATE INDEX IF NOT EXISTS idx_chain_cache_active
      ON continuation_chain_cache(is_active_continuation) WHERE is_active_continuation = 1;

    -- For cache freshness queries
    CREATE INDEX IF NOT EXISTS idx_chain_cache_computed
      ON continuation_chain_cache(computed_at DESC);

    -- Composite for full chain queries
    CREATE INDEX IF NOT EXISTS idx_chain_cache_root_depth
      ON continuation_chain_cache(root_session_id, depth_from_root, session_id);
  `);

  // =========================================================================
  // Continuation Chain Cache Invalidation Triggers

  // These triggers ensure cache stays in sync WITHOUT application code TTLs
  // =========================================================================
  try {
    db.exec(`
      -- Auto-update timestamp on any cache change
      CREATE TRIGGER IF NOT EXISTS update_chain_cache_timestamp
      AFTER UPDATE ON continuation_chain_cache
      BEGIN
        UPDATE continuation_chain_cache
        SET updated_at = CURRENT_TIMESTAMP
        WHERE session_id = NEW.session_id;
      END;

      -- Invalidate cache when continuation is inserted
      CREATE TRIGGER IF NOT EXISTS invalidate_cache_on_continuation_insert
      AFTER INSERT ON session_continuations
      BEGIN
        -- Delete cache for child (will be recomputed on next access)
        DELETE FROM continuation_chain_cache
        WHERE session_id = NEW.child_session_id;

        -- Delete cache for parent (child_count changed)
        DELETE FROM continuation_chain_cache
        WHERE session_id = NEW.parent_session_id;

        -- Delete all sessions in same chain (depths may have changed)
        DELETE FROM continuation_chain_cache
        WHERE root_session_id IN (
          SELECT root_session_id FROM continuation_chain_cache
          WHERE session_id IN (NEW.child_session_id, NEW.parent_session_id)
        );
      END;

      -- Invalidate cache when continuation is updated
      CREATE TRIGGER IF NOT EXISTS invalidate_cache_on_continuation_update
      AFTER UPDATE ON session_continuations
      BEGIN
        DELETE FROM continuation_chain_cache
        WHERE session_id = NEW.child_session_id;

        DELETE FROM continuation_chain_cache
        WHERE session_id = NEW.parent_session_id;

        DELETE FROM continuation_chain_cache
        WHERE session_id = OLD.parent_session_id;
      END;

      -- Invalidate cache when continuation is deleted
      CREATE TRIGGER IF NOT EXISTS invalidate_cache_on_continuation_delete
      AFTER DELETE ON session_continuations
      BEGIN
        DELETE FROM continuation_chain_cache
        WHERE session_id = OLD.child_session_id;

        DELETE FROM continuation_chain_cache
        WHERE session_id = OLD.parent_session_id;

        -- Invalidate entire chain
        DELETE FROM continuation_chain_cache
        WHERE root_session_id IN (
          SELECT root_session_id FROM continuation_chain_cache
          WHERE session_id = OLD.parent_session_id
        );
      END;

      -- Cascade delete when session is deleted
      CREATE TRIGGER IF NOT EXISTS invalidate_cache_on_session_delete
      BEFORE DELETE ON session_metadata
      BEGIN
        DELETE FROM continuation_chain_cache
        WHERE session_id = OLD.session_id
           OR root_session_id = OLD.session_id;
      END;
    `);

    safeLog.log('Created continuation chain cache table, indexes, and triggers');
  } catch (cacheError) {
    safeLog.warn('Continuation cache trigger creation warning:', cacheError.message);
  }

  safeLog.log('Database schema initialization complete');
}

module.exports = {
  initializeSchema,
};
