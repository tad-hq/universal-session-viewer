const fs = require('fs').promises;
const path = require('path');

/**
 * Migration: Add session_continuations table for tracking Claude Code continuation chains
 *
 * This migration enables detection and tracking of session continuation relationships.
 * When Claude Code conversations exceed ~155k tokens, it automatically creates new
 * session files with references to previous sessions, creating a chain of continuations.
 *
 * This migration scans existing sessions for continuation markers and builds the
 * relationship graph in the database.
 */

/**
 * Detect continuation metadata from a JSONL session file
 * Looks for:
 * 1. file-history-snapshot events with logicalParentUuid (marks child sessions)
 * 2. compact_boundary events (marks parent sessions and split points)
 */
async function detectContinuationMetadata(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');

    let parentUuid = null;
    let childStartedTimestamp = null;
    let compactBoundaryInfo = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);

        // Pattern 1: file-history-snapshot with logicalParentUuid (child session marker)
        if (parsed.type === 'file-history-snapshot' && parsed.logicalParentUuid) {
          parentUuid = parsed.logicalParentUuid;
          childStartedTimestamp = parsed.timestamp ? new Date(parsed.timestamp).getTime() : null;
        }

        // Pattern 2: compact_boundary event (parent session marker)
        if (parsed.type === 'compact_boundary') {
          const message = parsed.message?.content || '';

          // Extract next session ID from message
          // Format: "Context window approaching limit. Continuing in new session: <session-id>"
          const sessionIdMatch = message.match(/new session:\s*([a-f0-9-]{36})/i);
          const nextSessionId = sessionIdMatch ? sessionIdMatch[1] : null;

          compactBoundaryInfo = {
            timestamp: parsed.timestamp ? new Date(parsed.timestamp).getTime() : null,
            nextSessionId,
            message,
          };

          // Only use first compact_boundary event
          break;
        }
      } catch (parseError) {
        // Skip invalid JSON lines
        continue;
      }
    }

    return {
      isChild: !!parentUuid,
      parentSessionId: parentUuid,
      childStartedTimestamp,
      compactBoundary: compactBoundaryInfo,
      isParent: !!compactBoundaryInfo,
    };
  } catch (error) {
    console.error(`Error detecting continuation metadata from ${filePath}:`, error.message);
    return {
      isChild: false,
      parentSessionId: null,
      childStartedTimestamp: null,
      compactBoundary: null,
      isParent: false,
    };
  }
}

/**
 * Main migration function
 */
async function migrateContinuations(db, app) {
  const startTime = Date.now();
  console.log('\n=== Starting Session Continuations Migration ===');
  console.log(`Target: Detect and track Claude Code session continuation chains`);
  console.log(`Database: ${app.dbPath || '~/.claude-m/session-viewer-cache.db'}\n`);

  try {
    // Step 1: Verify prerequisites
    console.log('Step 1/6: Verifying prerequisites...');
    const sessionMetadataExists = db
      .prepare(
        `
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='session_metadata'
        `
      )
      .get();

    if (!sessionMetadataExists) {
      throw new Error('session_metadata table does not exist. Run migration 001 first.');
    }

    const continuationsExists = db
      .prepare(
        `
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='session_continuations'
        `
      )
      .get();

    if (!continuationsExists) {
      throw new Error(
        'session_continuations table does not exist. Database initialization failed.'
      );
    }

    console.log('  ✓ Prerequisites verified');

    // Step 2: Get all sessions from database
    console.log('\nStep 2/6: Loading sessions from database...');
    const sessions = db
      .prepare(
        `
            SELECT session_id, file_path
            FROM session_metadata
            WHERE is_valid = 1
            ORDER BY file_modified_time DESC
        `
      )
      .all();

    console.log(`  Found ${sessions.length} valid sessions to analyze`);

    // Step 3: Scan for continuation relationships
    console.log('\nStep 3/6: Scanning for continuation markers...');
    console.log('  This may take a few minutes...');

    const childRelationships = [];
    const parentMap = new Map(); // Maps parent_id -> { children: [], compactBoundary: {} }

    let processedCount = 0;
    let childrenFound = 0;
    let parentsFound = 0;
    const batchSize = 100;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];

      // Show progress every 100 sessions
      if (i > 0 && i % batchSize === 0) {
        const percent = Math.floor((i / sessions.length) * 100);
        console.log(
          `  Progress: ${i}/${sessions.length} (${percent}%) - ${childrenFound} children, ${parentsFound} parents`
        );
      }

      try {
        const metadata = await detectContinuationMetadata(session.file_path);

        // Track child sessions
        if (metadata.isChild && metadata.parentSessionId) {
          childRelationships.push({
            childId: session.session_id,
            parentId: metadata.parentSessionId,
            childStartedTimestamp: metadata.childStartedTimestamp,
            hasFileHistoryEvent: true,
          });
          childrenFound++;
        }

        // Track parent sessions
        if (metadata.isParent && metadata.compactBoundary) {
          if (!parentMap.has(session.session_id)) {
            parentMap.set(session.session_id, {
              children: [],
              compactBoundary: metadata.compactBoundary,
            });
          }
          parentsFound++;
        }

        processedCount++;
      } catch (error) {
        console.error(`  Failed to process ${session.session_id}: ${error.message}`);
      }
    }

    console.log(`  ✓ Processed ${processedCount} sessions`);
    console.log(`    - Found ${childrenFound} child sessions`);
    console.log(`    - Found ${parentsFound} parent sessions with compact_boundary`);

    // Step 4: Build continuation chains
    console.log('\nStep 4/6: Building continuation chains...');

    // Group children by parent
    const parentToChildren = new Map();
    for (const rel of childRelationships) {
      if (!parentToChildren.has(rel.parentId)) {
        parentToChildren.set(rel.parentId, []);
      }
      parentToChildren.get(rel.parentId).push(rel);
    }

    // Sort children by timestamp within each parent group
    for (const [parentId, children] of parentToChildren.entries()) {
      children.sort((a, b) => {
        const timeA = a.childStartedTimestamp || 0;
        const timeB = b.childStartedTimestamp || 0;
        return timeA - timeB;
      });
    }

    console.log(`  ✓ Built ${parentToChildren.size} continuation chains`);

    // Step 5: Insert into database
    console.log('\nStep 5/6: Inserting continuation relationships...');

    const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO session_continuations
            (child_session_id, parent_session_id, continuation_order,
             split_reason, split_timestamp, child_started_timestamp,
             is_active_continuation, is_orphaned, has_file_history_event, has_compact_boundary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

    let insertedCount = 0;
    let orphanedCount = 0;

    // Insert all relationships in a transaction for performance
    const insertMany = db.transaction(() => {
      for (const [parentId, children] of parentToChildren.entries()) {
        // Check if parent exists in database
        const parentExists = db
          .prepare('SELECT 1 FROM session_metadata WHERE session_id = ?')
          .get(parentId);

        const isOrphaned = !parentExists;
        if (isOrphaned) orphanedCount++;

        // Get parent's compact_boundary info if available
        const parentInfo = parentMap.get(parentId);
        const splitTimestamp = parentInfo?.compactBoundary?.timestamp || null;
        const splitReason =
          parentInfo?.compactBoundary?.message || 'Context window approaching limit';
        const hasCompactBoundary = !!parentInfo?.compactBoundary;

        for (let order = 0; order < children.length; order++) {
          const child = children[order];
          const isActive = order === children.length - 1 && !isOrphaned; // Last child is active

          // Check if child exists in database
          const childExists = db
            .prepare('SELECT 1 FROM session_metadata WHERE session_id = ?')
            .get(child.childId);

          const childOrphaned = !childExists || isOrphaned;

          insertStmt.run(
            child.childId,
            parentId,
            order,
            splitReason,
            splitTimestamp,
            child.childStartedTimestamp,
            isActive ? 1 : 0,
            childOrphaned ? 1 : 0,
            child.hasFileHistoryEvent ? 1 : 0,
            hasCompactBoundary ? 1 : 0
          );
          insertedCount++;
        }
      }
    });

    insertMany();

    console.log(`  ✓ Inserted ${insertedCount} continuation relationships`);
    console.log(`    - ${orphanedCount} orphaned chains (parent file missing)`);

    // Step 6: Validate migration
    console.log('\nStep 6/6: Validating migration...');

    const counts = db
      .prepare(
        `
            SELECT
                (SELECT COUNT(*) FROM session_continuations) as total_continuations,
                (SELECT COUNT(DISTINCT parent_session_id) FROM session_continuations) as unique_parents,
                (SELECT COUNT(*) FROM session_continuations WHERE is_active_continuation = 1) as active_continuations,
                (SELECT COUNT(*) FROM session_continuations WHERE is_orphaned = 1) as orphaned_continuations,
                (SELECT COUNT(*) FROM session_continuations WHERE has_file_history_event = 1) as has_file_history,
                (SELECT COUNT(*) FROM session_continuations WHERE has_compact_boundary = 1) as has_compact_boundary
        `
      )
      .get();

    console.log(`\n  Validation Results:`);
    console.log(`  - Total continuation relationships: ${counts.total_continuations}`);
    console.log(`  - Unique parent sessions: ${counts.unique_parents}`);
    console.log(`  - Active continuations: ${counts.active_continuations}`);
    console.log(`  - Orphaned continuations: ${counts.orphaned_continuations}`);
    console.log(`  - With file-history-snapshot: ${counts.has_file_history}`);
    console.log(`  - With compact_boundary: ${counts.has_compact_boundary}`);

    // Check for longest chain
    const longestChain = db
      .prepare(
        `
            SELECT parent_session_id, COUNT(*) as chain_length
            FROM session_continuations
            GROUP BY parent_session_id
            ORDER BY chain_length DESC
            LIMIT 1
        `
      )
      .get();

    if (longestChain) {
      console.log(`  - Longest continuation chain: ${longestChain.chain_length} continuations`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n=== Migration Complete in ${elapsed}s ===`);
    console.log(
      `✅ Success! Tracked ${counts.total_continuations} continuation relationships across ${counts.unique_parents} conversation chains\n`
    );

    return {
      success: true,
      totalContinuations: counts.total_continuations,
      uniqueParents: counts.unique_parents,
      activeContinuations: counts.active_continuations,
      orphanedContinuations: counts.orphaned_continuations,
    };
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);

    // Attempt rollback
    console.log('\nAttempting rollback...');
    try {
      db.exec('DELETE FROM session_continuations');
      console.log('✓ Rollback complete - session_continuations table cleared');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
    }

    throw error;
  }
}

module.exports = {
  migrateContinuations,
  detectContinuationMetadata,
};
