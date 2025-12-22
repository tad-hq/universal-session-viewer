/**
 * Database helper utilities for testing
 *
 * V1 Pattern Context:
 * - SQLite database with two-table schema (metadata + cache)
 * - FTS5 for full-text search
 * - In-memory database for unit tests
 * - Persistent database for E2E tests
 *
 * These helpers simplify database testing by:
 * - Creating in-memory test databases
 * - Seeding with test data
 * - Providing query utilities
 * - Ensuring proper cleanup
 */

import Database from 'better-sqlite3';
import type { Session } from '@/types/session';

/**
 * Create an in-memory SQLite database with schema
 *
 * V1 Pattern: main.js initializes database with two-table schema
 * - session_metadata: Fast metadata for session list
 * - session_analysis_cache: LLM summaries (lazy loaded)
 * - session_fts: FTS5 virtual table for search
 *
 * @example
 * ```typescript
 * const db = createInMemoryDb();
 * // Use database
 * db.close();
 * ```
 */
export function createInMemoryDb(): Database.Database {
  const db = new Database(':memory:');

  // Apply schema (matches main.js schema)
  db.exec(`
    -- Session metadata table (eagerly loaded)
    CREATE TABLE session_metadata (
      session_id TEXT PRIMARY KEY,
      title TEXT,
      summary TEXT,
      project_path TEXT,
      modified INTEGER,
      last_message_time TEXT,
      message_count INTEGER,
      is_analyzed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      continuation_of TEXT,
      chain_position INTEGER,
      is_active_continuation INTEGER,
      continuation_count INTEGER DEFAULT 0
    );

    -- Analysis cache table (lazily loaded)
    CREATE TABLE session_analysis_cache (
      session_id TEXT PRIMARY KEY,
      summary TEXT,
      content_hash TEXT,
      created_at INTEGER,
      FOREIGN KEY (session_id) REFERENCES session_metadata(session_id)
    );

    -- FTS5 virtual table for full-text search
    CREATE VIRTUAL TABLE session_fts USING fts5(
      session_id UNINDEXED,
      title,
      summary,
      content='session_metadata',
      content_rowid='rowid'
    );

    -- Indexes for common queries
    CREATE INDEX idx_session_modified ON session_metadata(modified DESC);
    CREATE INDEX idx_session_project ON session_metadata(project_path);
    CREATE INDEX idx_session_analyzed ON session_metadata(is_analyzed);

    -- Trigger to keep FTS index in sync
    CREATE TRIGGER session_fts_insert AFTER INSERT ON session_metadata BEGIN
      INSERT INTO session_fts(rowid, session_id, title, summary)
      VALUES (new.rowid, new.session_id, new.title, new.summary);
    END;

    CREATE TRIGGER session_fts_update AFTER UPDATE ON session_metadata BEGIN
      UPDATE session_fts SET title = new.title, summary = new.summary
      WHERE rowid = new.rowid;
    END;

    CREATE TRIGGER session_fts_delete AFTER DELETE ON session_metadata BEGIN
      DELETE FROM session_fts WHERE rowid = old.rowid;
    END;
  `);

  return db;
}

/**
 * Seed database with session data
 *
 * V1 Pattern: Inserts sessions into both metadata and FTS tables
 *
 * @example
 * ```typescript
 * const db = createInMemoryDb();
 * const sessions = [createMockSession(), createMockSession()];
 * seedTestData(db, sessions);
 * ```
 */
export function seedTestData(db: Database.Database, sessions: Session[]): void {
  const stmt = db.prepare(`
    INSERT INTO session_metadata (
      session_id,
      title,
      summary,
      project_path,
      modified,
      last_message_time,
      message_count,
      is_analyzed,
      status,
      continuation_of,
      chain_position,
      is_active_continuation,
      continuation_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const session of sessions) {
    stmt.run(
      session.id,
      session.title,
      session.summary,
      session.project_path || null,
      session.modified,
      session.last_message_time || null,
      session.message_count || 0,
      session.is_analyzed || 0,
      session.status || 'pending',
      session.continuation_of || null,
      session.chain_position || null,
      session.is_active_continuation || 0,
      session.continuation_count || 0
    );
  }
}

/**
 * Query sessions from database
 *
 * V1 Pattern: Queries session_metadata table
 *
 * @example
 * ```typescript
 * const sessions = querySessions(db, { limit: 50, offset: 0 });
 * ```
 */
export function querySessions(
  db: Database.Database,
  options: {
    limit?: number;
    offset?: number;
    projectPath?: string;
    dateFrom?: number;
    dateTo?: number;
  } = {}
): Session[] {
  const { limit = 50, offset = 0, projectPath, dateFrom, dateTo } = options;

  let query = 'SELECT * FROM session_metadata WHERE 1=1';
  const params: unknown[] = [];

  if (projectPath) {
    query += ' AND project_path = ?';
    params.push(projectPath);
  }

  if (dateFrom) {
    query += ' AND modified >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    query += ' AND modified <= ?';
    params.push(dateTo);
  }

  query += ' ORDER BY modified DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params) as Session[];
}

/**
 * Search sessions using FTS5
 *
 * V1 Pattern: Uses session_fts virtual table
 *
 * @example
 * ```typescript
 * const results = searchSessions(db, 'test query', 50);
 * ```
 */
export function searchSessions(
  db: Database.Database,
  query: string,
  limit: number = 50
): Session[] {
  const stmt = db.prepare(`
    SELECT m.*
    FROM session_fts f
    JOIN session_metadata m ON f.session_id = m.session_id
    WHERE session_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  return stmt.all(query, limit) as Session[];
}

/**
 * Get session count
 *
 * V1 Pattern: Used for pagination total
 *
 * @example
 * ```typescript
 * const count = getSessionCount(db);
 * ```
 */
export function getSessionCount(db: Database.Database): number {
  const result = db.prepare('SELECT COUNT(*) as count FROM session_metadata').get() as {
    count: number;
  };
  return result.count;
}

/**
 * Clear all data from database
 *
 * V1 Pattern: Used for cleanup between tests
 *
 * @example
 * ```typescript
 * clearTestData(db);
 * ```
 */
export function clearTestData(db: Database.Database): void {
  db.exec('DELETE FROM session_analysis_cache');
  db.exec('DELETE FROM session_metadata');
  // FTS table cleared automatically via trigger
}

/**
 * Close and cleanup database
 *
 * V1 Pattern: Proper cleanup prevents memory leaks
 *
 * @example
 * ```typescript
 * teardownDatabase(db);
 * ```
 */
export function teardownDatabase(db: Database.Database): void {
  db.close();
}
