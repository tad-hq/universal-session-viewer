const fs = require('fs').promises;
const path = require('path');

/**
 * Migration: Add session_metadata table for two-table architecture
 *
 * This migration enables all sessions to be visible immediately without requiring
 * expensive LLM analysis first. It creates a new session_metadata table that stores
 * lightweight filesystem and content metadata for ALL sessions.
 */

async function migrateToTwoTableArchitecture(db, app) {
  const startTime = Date.now();
  console.log('\n=== Starting Two-Table Architecture Migration ===');
  console.log(`Target: Make all sessions visible without requiring analysis`);
  console.log(`Database: ${app.dbPath || '~/.claude-m/session-viewer-cache.db'}\n`);

  try {
    // Step 1: Create session_metadata table
    console.log('Step 1/6: Creating session_metadata table...');
    db.exec(`
            CREATE TABLE IF NOT EXISTS session_metadata (
                -- Primary Key
                session_id TEXT PRIMARY KEY,

                -- File System Metadata (lightweight, filesystem-based)
                project_name TEXT NOT NULL,
                project_path TEXT,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_modified_time INTEGER NOT NULL,

                -- Basic Content Metadata (extracted without LLM)
                message_count INTEGER DEFAULT 0,
                first_message_time INTEGER,
                last_message_time INTEGER,
                session_duration_seconds INTEGER,

                -- Analysis Status Flags
                is_analyzed BOOLEAN DEFAULT 0,
                is_valid BOOLEAN DEFAULT 1,
                is_empty BOOLEAN DEFAULT 0,

                -- Timestamps
                discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    console.log('  ✓ session_metadata table created');

    // Step 2: Create indexes
    console.log('\nStep 2/6: Creating indexes for query performance...');
    db.exec(`
            CREATE INDEX IF NOT EXISTS idx_metadata_modified ON session_metadata(file_modified_time DESC);
            CREATE INDEX IF NOT EXISTS idx_metadata_project ON session_metadata(project_path);
            CREATE INDEX IF NOT EXISTS idx_metadata_analyzed ON session_metadata(is_analyzed);
            CREATE INDEX IF NOT EXISTS idx_metadata_last_msg ON session_metadata(last_message_time DESC);
            CREATE INDEX IF NOT EXISTS idx_metadata_project_modified
                ON session_metadata(project_path, file_modified_time DESC);
            CREATE INDEX IF NOT EXISTS idx_metadata_analyzed_modified
                ON session_metadata(is_analyzed, file_modified_time DESC);
        `);
    console.log('  ✓ Created 6 indexes');

    // Step 3: Create triggers
    console.log('\nStep 3/6: Creating triggers for auto-sync...');
    db.exec(`
            CREATE TRIGGER IF NOT EXISTS update_metadata_timestamp
            AFTER UPDATE ON session_metadata
            BEGIN
                UPDATE session_metadata
                SET metadata_updated_at = CURRENT_TIMESTAMP
                WHERE session_id = NEW.session_id;
            END;

            CREATE TRIGGER IF NOT EXISTS mark_session_analyzed
            AFTER INSERT ON session_analysis_cache
            BEGIN
                UPDATE session_metadata
                SET is_analyzed = 1,
                    metadata_updated_at = CURRENT_TIMESTAMP
                WHERE session_id = NEW.session_id;
            END;

            CREATE TRIGGER IF NOT EXISTS unmark_session_analyzed
            AFTER DELETE ON session_analysis_cache
            BEGIN
                UPDATE session_metadata
                SET is_analyzed = 0,
                    metadata_updated_at = CURRENT_TIMESTAMP
                WHERE session_id = OLD.session_id;
            END;
        `);
    console.log('  ✓ Created 3 triggers');

    // Step 4: Populate metadata from filesystem
    console.log('\nStep 4/6: Scanning filesystem and populating metadata...');
    console.log('  This may take a few minutes for ~8,500 sessions...');

    const allSessions = await app.findAllSessions();
    console.log(`  Found ${allSessions.length} sessions in filesystem`);

    const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO session_metadata
            (session_id, project_name, project_path, file_path, file_name,
             file_size, file_modified_time, message_count, first_message_time,
             last_message_time, session_duration_seconds, is_analyzed, is_valid, is_empty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

    let successCount = 0;
    let errorCount = 0;
    const batchSize = 100;

    for (let i = 0; i < allSessions.length; i++) {
      const session = allSessions[i];

      // Show progress every 100 sessions
      if (i > 0 && i % batchSize === 0) {
        const percent = Math.floor((i / allSessions.length) * 100);
        console.log(
          `  Progress: ${i}/${allSessions.length} (${percent}%) - ${successCount} succeeded, ${errorCount} errors`
        );
      }

      try {
        const metadata = await extractSessionMetadata(session);

        insertStmt.run(
          session.id,
          session.project,
          session.projectPath,
          session.filePath,
          session.fileName,
          session.size,
          Math.floor(session.modified.getTime() / 1000),
          metadata.messageCount,
          metadata.firstMessageTime,
          metadata.lastMessageTime,
          metadata.duration,
          0, // is_analyzed - will update in next step
          metadata.isValid ? 1 : 0,
          metadata.isEmpty ? 1 : 0
        );
        successCount++;
      } catch (error) {
        console.error(`  Failed to process ${session.id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`  ✓ Processed ${successCount} sessions (${errorCount} errors)`);

    // Step 5: Mark analyzed sessions
    console.log('\nStep 5/6: Marking analyzed sessions...');
    const updateStmt = db.prepare(`
            UPDATE session_metadata
            SET is_analyzed = 1
            WHERE session_id IN (
                SELECT session_id FROM session_analysis_cache
            )
        `);
    const result = updateStmt.run();
    console.log(`  ✓ Marked ${result.changes} sessions as analyzed`);

    // Step 6: Validate migration
    console.log('\nStep 6/6: Validating migration...');
    const counts = db
      .prepare(
        `
            SELECT
                (SELECT COUNT(*) FROM session_metadata) as total_metadata,
                (SELECT COUNT(*) FROM session_metadata WHERE is_analyzed = 1) as analyzed_metadata,
                (SELECT COUNT(*) FROM session_analysis_cache) as analyzed_cache,
                (SELECT COUNT(*) FROM session_metadata WHERE is_valid = 0) as invalid_sessions,
                (SELECT COUNT(*) FROM session_metadata WHERE is_empty = 1) as empty_sessions
        `
      )
      .get();

    console.log(`\n  Validation Results:`);
    console.log(`  - Total sessions in metadata: ${counts.total_metadata}`);
    console.log(`  - Analyzed sessions (metadata): ${counts.analyzed_metadata}`);
    console.log(`  - Analyzed sessions (cache): ${counts.analyzed_cache}`);
    console.log(`  - Invalid sessions: ${counts.invalid_sessions}`);
    console.log(`  - Empty sessions: ${counts.empty_sessions}`);

    if (counts.analyzed_metadata !== counts.analyzed_cache) {
      console.warn(`  ⚠ WARNING: Mismatch between analyzed counts!`);
      console.warn(`    Metadata: ${counts.analyzed_metadata}, Cache: ${counts.analyzed_cache}`);
    } else {
      console.log(`  ✓ Analyzed counts match perfectly`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n=== Migration Complete in ${elapsed}s ===`);
    console.log(
      `✅ Success! ${counts.total_metadata} sessions now visible (${counts.analyzed_metadata} analyzed, ${counts.total_metadata - counts.analyzed_metadata} unanalyzed)\n`
    );

    return {
      success: true,
      sessionsProcessed: successCount,
      errors: errorCount,
      totalMetadata: counts.total_metadata,
      analyzedCount: counts.analyzed_metadata,
    };
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);

    // Attempt rollback
    console.log('\nAttempting rollback...');
    try {
      db.exec('DROP TABLE IF EXISTS session_metadata');
      db.exec('DROP INDEX IF EXISTS idx_metadata_modified');
      db.exec('DROP INDEX IF EXISTS idx_metadata_project');
      db.exec('DROP INDEX IF EXISTS idx_metadata_analyzed');
      db.exec('DROP INDEX IF EXISTS idx_metadata_last_msg');
      db.exec('DROP INDEX IF EXISTS idx_metadata_project_modified');
      db.exec('DROP INDEX IF EXISTS idx_metadata_analyzed_modified');
      db.exec('DROP TRIGGER IF EXISTS update_metadata_timestamp');
      db.exec('DROP TRIGGER IF EXISTS mark_session_analyzed');
      db.exec('DROP TRIGGER IF EXISTS unmark_session_analyzed');
      console.log('✓ Rollback complete - database restored to previous state');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
    }

    throw error;
  }
}

/**
 * Extract metadata from a session without using LLM
 * This is fast and cheap - just counts messages and extracts timestamps
 */
async function extractSessionMetadata(session) {
  try {
    const content = await fs.readFile(session.filePath, 'utf8');
    const lines = content.trim().split('\n');

    let messageCount = 0;
    let firstTimestamp = null;
    let lastTimestamp = null;
    let hasValidMessages = false;

    for (const line of lines) {
      if (!line.trim()) continue; // Skip empty lines

      try {
        const parsed = JSON.parse(line);

        // Count user and assistant messages
        if (parsed.type === 'user' || parsed.type === 'assistant') {
          messageCount++;
          hasValidMessages = true;

          // Extract timestamps
          const ts = parsed.timestamp;
          if (ts) {
            if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
            if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;
          }
        }
      } catch (parseError) {
        // Skip invalid JSON lines
        continue;
      }
    }

    // Calculate duration in seconds
    const duration =
      firstTimestamp && lastTimestamp ? Math.floor((lastTimestamp - firstTimestamp) / 1000) : 0;

    return {
      messageCount,
      firstMessageTime: firstTimestamp,
      lastMessageTime: lastTimestamp,
      duration,
      isValid: lines.length > 0,
      isEmpty: !hasValidMessages,
    };
  } catch (error) {
    console.error(`Error extracting metadata from ${session.filePath}:`, error.message);

    // Return safe defaults
    return {
      messageCount: 0,
      firstMessageTime: null,
      lastMessageTime: null,
      duration: 0,
      isValid: false,
      isEmpty: true,
    };
  }
}

module.exports = {
  migrateToTwoTableArchitecture,
  extractSessionMetadata,
};
