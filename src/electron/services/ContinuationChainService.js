/**
 * Continuation Chain Service
 *
 * Manages session continuation chain detection, traversal, and caching.
 * Extracted from: main.js SessionViewerApp class (lines 2937-3892)
 *
 * Edge Cases Preserved:
 * - Circular dependency detection in findRootParent
 * - Orphan session healing via periodic + on-demand triggers
 * - Parent-child relationship tracking with branching support
 * - Cache invalidation triggers via database schema
 * - Parallel metadata discovery with Promise.allSettled
 *
 * Dependencies:
 * - this.db: SQLite database connection (injected)
 * - this.safeSend: IPC event emitter (injected, optional for resolveContinuationChains/healOrphanedContinuations)
 * - this.debugLog: Debug logging function (injected)
 * - detectContinuationMetadata: External function from utils/continuation-detection
 */

const { safeLog } = require('../config');
const { detectContinuationMetadata } = require('../utils/continuation-detection');

class ContinuationChainService {
  /**
   * @param {Object} db - SQLite database instance
   * @param {Function} safeSend - IPC send function (optional, bound from main)
   * @param {Function} debugLog - Debug logging function (optional, bound from main)
   */
  constructor(db, safeSend = null, debugLog = null) {
    this.db = db;
    this.safeSend = safeSend;
    this.debugLog = debugLog || (() => {});
  }

  /**
   * Get complete continuation chain for a session
   * Extracted from: main.js lines 2937-2954
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Chain with parent, children, flatDescendants, branching info
   */
  async getContinuationChain(sessionId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const rootParent = await this.findRootParent(sessionId);
      const chain = await this.buildChainFromParent(rootParent);

      return chain;
    } catch (error) {
      safeLog.error('Error getting continuation chain:', error);
      throw error;
    }
  }

  /**
   * Find the root parent of a continuation chain
   * Extracted from: main.js lines 2961-2992
   *
   * Edge Case: Uses visited Set to prevent infinite loops from circular references
   *
   * @param {string} sessionId - Starting session ID
   * @returns {Promise<string>} Root parent session ID
   */
  async findRootParent(sessionId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let currentId = sessionId;
    const visited = new Set();

    // eslint-disable-next-line no-constant-condition -- Intentional infinite loop with return statements
    while (true) {
      if (visited.has(currentId)) {
        safeLog.warn(`Circular reference detected in continuation chain for ${sessionId}`);
        return currentId;
      }
      visited.add(currentId);

      const parent = this.db
        .prepare(
          `
        SELECT parent_session_id as continuation_of
        FROM session_continuations
        WHERE child_session_id = ?
      `
        )
        .get(currentId);

      if (!parent || !parent.continuation_of) {
        return currentId;
      }

      currentId = parent.continuation_of;
    }
  }

  /**
   * Build complete continuation chain starting from parent
   * Extracted from: main.js lines 2999-3135
   *
   * Uses recursive CTE to handle multi-level chains AND branching.
   * Returns both backward-compatible children array and new flatDescendants with parent refs.
   *
   * @param {string} parentId - Root parent session ID
   * @returns {Promise<Object>} Chain with parent, children, flatDescendants, and branching info
   */
  async buildChainFromParent(parentId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const parent = this.db
      .prepare(
        `
      SELECT
        m.session_id,
        m.project_path,
        m.file_path,
        m.message_count,
        m.last_message_time,
        m.is_analyzed,
        c.title,
        c.summary
      FROM session_metadata m
      LEFT JOIN session_analysis_cache c ON m.session_id = c.session_id
      WHERE m.session_id = ?
    `
      )
      .get(parentId);

    if (!parent) {
      throw new Error(`Parent session ${parentId} not found`);
    }

    // CRITICAL: Now includes parent_session_id for tree reconstruction
    const descendantsRaw = this.db
      .prepare(
        `
      WITH RECURSIVE chain AS (
        -- Base case: direct children of the root parent
        SELECT
          sc.child_session_id,
          sc.parent_session_id,
          sc.continuation_order,
          sc.is_active_continuation,
          1 as depth
        FROM session_continuations sc
        WHERE sc.parent_session_id = ?

        UNION ALL

        -- Recursive case: children of children (handles branching automatically)
        SELECT
          sc2.child_session_id,
          sc2.parent_session_id,
          sc2.continuation_order,
          sc2.is_active_continuation,
          chain.depth + 1 as depth
        FROM session_continuations sc2
        JOIN chain ON sc2.parent_session_id = chain.child_session_id
      )
      SELECT
        m.session_id,
        m.project_path,
        m.file_path,
        m.message_count,
        m.last_message_time,
        m.is_analyzed,
        c.title,
        c.summary,
        chain.parent_session_id,
        chain.continuation_order as chain_position,
        chain.is_active_continuation,
        chain.depth
      FROM chain
      JOIN session_metadata m ON chain.child_session_id = m.session_id
      LEFT JOIN session_analysis_cache c ON m.session_id = c.session_id
      ORDER BY chain.depth ASC, chain.continuation_order ASC
    `
      )
      .all(parentId);

    const children = descendantsRaw.map((d) => ({
      session_id: d.session_id,
      project_path: d.project_path,
      file_path: d.file_path,
      message_count: d.message_count,
      last_message_time: d.last_message_time,
      is_analyzed: d.is_analyzed,
      title: d.title,
      summary: d.summary,
      chain_position: d.chain_position,
      is_active_continuation: d.is_active_continuation,
      depth: d.depth,
    }));

    const flatDescendants = descendantsRaw.map((d) => ({
      session: {
        session_id: d.session_id,
        project_path: d.project_path,
        file_path: d.file_path,
        message_count: d.message_count,
        last_message_time: d.last_message_time,
        is_analyzed: d.is_analyzed,
        title: d.title,
        summary: d.summary,
      },
      parentSessionId: d.parent_session_id,
      depth: d.depth,
      continuationOrder: d.chain_position,
      isActiveContinuation: d.is_active_continuation === 1,
    }));

    const childCountByParent = new Map();

    const rootDirectChildren = descendantsRaw.filter((d) => d.parent_session_id === parentId);
    childCountByParent.set(parentId, rootDirectChildren.length);

    for (const d of descendantsRaw) {
      const childrenOfThis = descendantsRaw.filter((c) => c.parent_session_id === d.session_id);
      if (childrenOfThis.length > 0) {
        childCountByParent.set(d.session_id, childrenOfThis.length);
      }
    }

    const hasBranches = Array.from(childCountByParent.values()).some((count) => count > 1);

    const maxDepth =
      descendantsRaw.length > 0 ? Math.max(...descendantsRaw.map((d) => d.depth)) : 0;

    return {
      parent,
      children,
      flatDescendants,
      hasBranches,
      totalSessions: 1 + children.length,
      maxDepth,
    };
  }

  /**
   * Get direct children of a session
   * Extracted from: main.js lines 3142-3172
   *
   * @param {string} sessionId - Parent session ID
   * @returns {Promise<Array>} Array of child sessions
   */
  async getContinuationChildren(sessionId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const children = this.db
        .prepare(
          `
        SELECT
          m.session_id,
          m.project_path,
          m.file_path,
          m.message_count,
          m.last_message_time,
          m.is_analyzed,
          c.title,
          c.summary,
          sc.continuation_order as chain_position,
          sc.is_active_continuation
        FROM session_continuations sc
        JOIN session_metadata m ON sc.child_session_id = m.session_id
        LEFT JOIN session_analysis_cache c ON m.session_id = c.session_id
        WHERE sc.parent_session_id = ?
        ORDER BY sc.continuation_order ASC
      `
        )
        .all(sessionId);

      return children;
    } catch (error) {
      safeLog.error('Error getting continuation children:', error);
      throw error;
    }
  }

  /**
   * Get session with full continuation context (parent chain + children)
   * Extracted from: main.js lines 3180-3208
   *
   * NOTE: Depends on getSessionDetails from main class - must be passed as parameter
   *
   * @param {string} sessionId - Session ID
   * @param {boolean} loadFullMessages - Whether to load full messages
   * @param {Function} getSessionDetails - Function to get session details
   * @returns {Promise<Object>} Session with continuation context
   */
  async getSessionWithContinuations(sessionId, loadFullMessages = false, getSessionDetails) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!getSessionDetails) {
      throw new Error('getSessionDetails function is required');
    }

    try {
      const session = await getSessionDetails(sessionId, loadFullMessages);

      if (!session) {
        return null;
      }

      const metadata = await this.getContinuationMetadata(sessionId);
      const chain = await this.getContinuationChain(sessionId);

      return {
        ...session,
        continuationMetadata: metadata,
        continuationChain: chain,
      };
    } catch (error) {
      safeLog.error('Error getting session with continuations:', error);
      throw error;
    }
  }

  /**
   * Get continuation metadata for a session
   * Extracted from: main.js lines 3215-3266
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Metadata about continuation status
   */
  async getContinuationMetadata(sessionId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const cached = this.db
        .prepare(
          `
        SELECT * FROM continuation_chain_cache
        WHERE session_id = ?
      `
        )
        .get(sessionId);

      if (cached) {
        this.debugLog(`[Cache hit] Metadata for ${sessionId}`);
        return {
          is_child: cached.is_child === 1,
          is_parent: cached.is_parent === 1,
          depth: cached.depth_from_root,
          chain_position: cached.chain_position,
          is_active_continuation: cached.is_active_continuation === 1,
          child_count: cached.child_count,
          has_children: cached.is_parent === 1,
        };
      }

      this.debugLog(`[Cache miss] Computing metadata for ${sessionId}`);

      const childInfo = this.db
        .prepare(
          `
        SELECT
          parent_session_id as continuation_of,
          continuation_order as chain_position,
          is_active_continuation
        FROM session_continuations
        WHERE child_session_id = ?
      `
        )
        .get(sessionId);

      const isChild = !!childInfo;

      const childCountResult = this.db
        .prepare(
          `
        SELECT COUNT(*) as count
        FROM session_continuations
        WHERE parent_session_id = ?
      `
        )
        .get(sessionId);

      const isParent = childCountResult && childCountResult.count > 0;

      let depth = 0;
      if (isChild) {
        const root = await this.findRootParent(sessionId);
        if (root !== sessionId) {
          const chain = await this.getContinuationChain(sessionId);
          const index = chain.children.findIndex((c) => c.session_id === sessionId);
          depth = index >= 0 ? index + 1 : 0;
        }
      }

      const metadata = {
        is_child: isChild,
        is_parent: isParent,
        depth,
        chain_position: childInfo ? childInfo.chain_position : 0,
        is_active_continuation: childInfo ? childInfo.is_active_continuation === 1 : false,
        child_count: childCountResult ? childCountResult.count : 0,
        has_children: isParent,
      };

      this.populateContinuationCache(sessionId).catch((err) =>
        this.debugLog(`Cache population failed for ${sessionId}: ${err.message}`)
      );

      return metadata;
    } catch (error) {
      safeLog.error('Error getting continuation metadata:', error);
      throw error;
    }
  }

  /**
   * Get continuation statistics across all sessions
   * Extracted from: main.js lines 3272-3321
   *
   * @returns {Promise<Object>} Statistics about continuation chains
   */
  async getContinuationStats() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const totalRelationships = this.db
        .prepare(
          `
        SELECT COUNT(*) as count
        FROM session_continuations
      `
        )
        .get();

      const uniqueParents = this.db
        .prepare(
          `
        SELECT COUNT(DISTINCT parent_session_id) as count
        FROM session_continuations
      `
        )
        .get();

      const maxDepthQuery = this.db
        .prepare(
          `
        SELECT
          parent_session_id,
          COUNT(*) as depth
        FROM session_continuations
        GROUP BY parent_session_id
        ORDER BY depth DESC
        LIMIT 1
      `
        )
        .get();

      const orphanedQuery = this.db
        .prepare(
          `
        SELECT COUNT(*) as count
        FROM session_continuations sc
        WHERE sc.is_orphaned = 1
      `
        )
        .get();

      return {
        total_chains: uniqueParents.count,
        total_relationships: totalRelationships.count,
        max_depth: maxDepthQuery ? maxDepthQuery.depth : 0,
        orphaned_count: orphanedQuery.count,
        average_chain_length:
          uniqueParents.count > 0 ? (totalRelationships.count / uniqueParents.count).toFixed(2) : 0,
      };
    } catch (error) {
      safeLog.error('Error getting continuation stats:', error);
      throw error;
    }
  }

  // =========================================================================
  // Continuation Chain Cache Methods (Enterprise-Grade Caching)
  // =========================================================================
  // Purpose: O(1) lookups for continuation chain data instead of O(N) traversal
  // Pattern: Lazy population with trigger-based invalidation
  // Reference: docs/CONTINUATION_CACHE_ARCHITECTURE.md
  // =========================================================================

  /**
   * Populate continuation cache for a single session.
   * Called on-demand when cache miss occurs.
   * Extracted from: main.js lines 3338-3418
   *
   * @param {string} sessionId - Session ID to populate cache for
   * @returns {Promise<Object>} Cached continuation data
   */
  async populateContinuationCache(sessionId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const now = Math.floor(Date.now() / 1000);

    try {
      const rootSessionId = await this.findRootParent(sessionId);

      const childInfo = this.db
        .prepare(
          `
        SELECT parent_session_id, continuation_order, is_active_continuation
        FROM session_continuations
        WHERE child_session_id = ?
      `
        )
        .get(sessionId);

      const childCountResult = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM session_continuations
        WHERE parent_session_id = ?
      `
        )
        .get(sessionId);

      const childCount = childCountResult?.count || 0;

      let depth = 0;
      if (childInfo) {
        const depthResult = this.db
          .prepare(
            `
          WITH RECURSIVE ancestors AS (
            SELECT child_session_id, parent_session_id, 1 as d
            FROM session_continuations
            WHERE child_session_id = ?
            UNION ALL
            SELECT a.child_session_id, sc.parent_session_id, a.d + 1
            FROM ancestors a
            JOIN session_continuations sc ON a.parent_session_id = sc.child_session_id
          )
          SELECT MAX(d) as depth FROM ancestors
        `
          )
          .get(sessionId);
        depth = depthResult?.depth || 0;
      }

      const hasMultipleChildren = childCount > 1;

      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO continuation_chain_cache
        (session_id, root_session_id, is_child, is_parent, child_count,
         chain_position, is_active_continuation, depth_from_root,
         has_multiple_children, computed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          sessionId,
          rootSessionId,
          childInfo ? 1 : 0,
          childCount > 0 ? 1 : 0,
          childCount,
          childInfo?.continuation_order || 0,
          childInfo?.is_active_continuation || 0,
          depth,
          hasMultipleChildren ? 1 : 0,
          now
        );

      this.debugLog(
        `Populated cache for session ${sessionId}: root=${rootSessionId}, depth=${depth}, children=${childCount}`
      );

      return {
        session_id: sessionId,
        root_session_id: rootSessionId,
        is_child: !!childInfo,
        is_parent: childCount > 0,
        child_count: childCount,
        depth_from_root: depth,
        has_multiple_children: hasMultipleChildren,
      };
    } catch (error) {
      this.debugLog(`Failed to populate cache for ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cached continuation data, populate if missing.
   * This is the primary entry point for getting continuation data.
   * Extracted from: main.js lines 3427-3451
   *
   * @param {string} sessionId - Session ID to get cache for
   * @returns {Promise<Object>} Cached continuation data
   */
  async getCachedContinuationData(sessionId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const cached = this.db
        .prepare(
          `
        SELECT * FROM continuation_chain_cache
        WHERE session_id = ?
      `
        )
        .get(sessionId);

      if (cached) {
        this.debugLog(`Cache hit for session ${sessionId}`);
        return cached;
      }

      this.debugLog(`Cache miss for session ${sessionId} - populating...`);
      return await this.populateContinuationCache(sessionId);
    } catch (error) {
      safeLog.error(`Error getting cached continuation data for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get chain statistics from cache with O(1) lookup.
   * Falls back to computing if cache is empty.
   * Extracted from: main.js lines 3460-3489
   *
   * @param {string} rootSessionId - Root session ID of the chain
   * @returns {Promise<Object|null>} Chain statistics
   */
  async getCachedChainStats(rootSessionId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stats = this.db
        .prepare(
          `
        SELECT
          MAX(depth_from_root) as max_depth,
          COUNT(*) as total_sessions,
          MAX(has_multiple_children) as has_branches
        FROM continuation_chain_cache
        WHERE root_session_id = ?
      `
        )
        .get(rootSessionId);

      if (!stats || stats.total_sessions === 0) {
        return null;
      }

      return {
        maxDepth: stats.max_depth || 0,
        totalSessions: stats.total_sessions || 0,
        hasBranches: stats.has_branches === 1,
      };
    } catch (error) {
      safeLog.error(`Error getting cached chain stats for ${rootSessionId}:`, error);
      return null;
    }
  }

  /**
   * Batch populate cache for all sessions in a chain.
   * Used for preloading entire chains on expansion.
   * Extracted from: main.js lines 3498-3531
   *
   * @param {string} rootSessionId - Root session ID to populate chain for
   * @returns {Promise<number>} Number of sessions cached
   */
  async populateChainCache(rootSessionId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const chain = await this.buildChainFromParent(rootSessionId);
      const sessionIds = [rootSessionId];

      if (chain.children) {
        sessionIds.push(...chain.children.map((c) => c.session_id));
      }

      let populated = 0;
      for (const sessionId of sessionIds) {
        try {
          await this.populateContinuationCache(sessionId);
          populated++;
        } catch (error) {
          this.debugLog(`Failed to populate cache for ${sessionId}: ${error.message}`);
        }
      }

      this.debugLog(
        `Populated chain cache for ${rootSessionId}: ${populated}/${sessionIds.length} sessions`
      );
      return populated;
    } catch (error) {
      safeLog.error(`Error populating chain cache for ${rootSessionId}:`, error);
      throw error;
    }
  }

  /**
   * Clear continuation cache (useful for testing/debugging).
   * Note: Normally cache is cleared by database triggers, not application code.
   * Extracted from: main.js lines 3539-3552
   *
   * @returns {number} Number of entries cleared
   */
  clearContinuationCache() {
    if (!this.db) {
      return 0;
    }

    try {
      const result = this.db.prepare(`DELETE FROM continuation_chain_cache`).run();
      this.debugLog(`Cleared continuation cache: ${result.changes} entries`);
      return result.changes;
    } catch (error) {
      safeLog.error('Error clearing continuation cache:', error);
      return 0;
    }
  }

  /**
   * Detect continuation metadata from JSONL file
   * Extracted from: main.js lines 3564-3578
   *
   * Parses the JSONL file to find:
   * - logicalParentUuid in file-history-snapshot events
   * - compact_boundary events with next session IDs
   *
   * @param {string} filePath - Absolute path to JSONL file
   * @returns {Promise<Object>} Continuation metadata
   */
  async detectSessionContinuation(filePath) {
    try {
      return await detectContinuationMetadata(filePath);
    } catch (error) {
      safeLog.error(`Error detecting continuation metadata for ${filePath}:`, error);
      return {
        isChild: false,
        parentSessionId: null,
        childStartedTimestamp: null,
        compactBoundary: null,
        isParent: false,
        sessionId: null,
      };
    }
  }

  /**
   * Get all session IDs in a continuation group
   * Extracted from: main.js lines 3586-3601
   *
   * @param {string} sessionId - Any session ID in the group
   * @returns {Promise<Array<string>>} All session IDs in the group
   */
  async getSessionGroup(sessionId) {
    try {
      const chain = await this.getContinuationChain(sessionId);

      const sessionIds = [chain.parent.session_id];
      if (chain.children && chain.children.length > 0) {
        sessionIds.push(...chain.children.map((c) => c.session_id));
      }

      return sessionIds;
    } catch (error) {
      safeLog.error(`Error getting session group for ${sessionId}:`, error);
      return [sessionId];
    }
  }

  /**
   * Resolve continuation chains after session discovery
   * Extracted from: main.js lines 3611-3753
   *
   * Scans all JSONL files for continuation markers and populates
   * the session_continuations table.
   *
   * @param {Object} mainWindow - Electron BrowserWindow instance (for safeSend)
   * @returns {Promise<Object>} Statistics about resolved chains
   */
  async resolveContinuationChains(mainWindow = null) {
    if (!this.db) {
      safeLog.error('Database not initialized');
      return;
    }

    try {
      safeLog.info('Starting continuation chain resolution...');

      const isTestMode = process.env.E2E_TEST_MODE === 'true';
      const testProjectPath = 'e2e-test-continuations';

      const sessions = isTestMode
        ? this.db
            .prepare(
              `
            SELECT DISTINCT file_path, session_id
            FROM session_metadata
            WHERE file_path IS NOT NULL
              AND project_path LIKE '%' || ? || '%'
          `
            )
            .all(testProjectPath)
        : this.db
            .prepare(
              `
            SELECT DISTINCT file_path, session_id
            FROM session_metadata
            WHERE file_path IS NOT NULL
          `
            )
            .all();

      safeLog.info(
        `Analyzing ${sessions.length} sessions for continuations...${isTestMode ? ' (E2E TEST MODE)' : ''}`
      );

      const metadataPromises = sessions.map((session) =>
        this.detectSessionContinuation(session.file_path)
          .then((metadata) => ({ session, metadata }))
          .catch((error) => {
            safeLog.error(`Detection failed for ${session.file_path}:`, error.message);
            return { session, metadata: null, error };
          })
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(metadataPromises);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      safeLog.info(`Metadata discovery completed in ${duration}s`);

      // CORRECT APPROACH: Use metadata.isChild and metadata.parentSessionId directly
      // The detection module compares event.sessionId with filename - if they differ
      // in a compact_boundary event, event.sessionId IS the parent session ID.
      // See: docs/JSONL-CONTINUATION-CHAIN-BEHAVIOR.md
      const continuationMap = new Map();
      let childCount = 0;
      let errorCount = 0;

      for (const result of results) {
        if (result.status === 'rejected') {
          errorCount++;
          continue;
        }

        const { session, metadata, error } = result.value;

        if (error) {
          errorCount++;
          continue;
        }

        // CORRECT: Check if this session is a child using the detection module's result
        // metadata.isChild is true when compact_boundary.sessionId differs from filename
        // metadata.parentSessionId contains the actual parent session ID
        if (metadata?.isChild && metadata?.parentSessionId) {
          continuationMap.set(session.session_id, {
            parentSessionId: metadata.parentSessionId,
            childStartedTimestamp: metadata.childStartedTimestamp,
            filePath: session.file_path,
          });
          childCount++;
        }
      }

      safeLog.info(`Found ${childCount} child sessions, ${errorCount} errors`);

      if (continuationMap.size === 0) {
        safeLog.info('No continuations to process');
        return;
      }

      const parentIds = Array.from(
        new Set(Array.from(continuationMap.values()).map((c) => c.parentSessionId))
      );

      const existingParents = new Set(
        this.db
          .prepare(
            `
          SELECT session_id
          FROM session_metadata
          WHERE session_id IN (${parentIds.map(() => '?').join(',')})
        `
          )
          .all(...parentIds)
          .map((row) => row.session_id)
      );

      safeLog.info(`Validated ${existingParents.size}/${parentIds.length} parents exist`);

      const upsertTransaction = this.db.transaction((validContinuations) => {
        const stmt = this.db.prepare(`
          INSERT INTO session_continuations (
            child_session_id,
            parent_session_id,
            child_started_timestamp
          ) VALUES (?, ?, ?)
          ON CONFLICT(child_session_id)
          DO UPDATE SET
            parent_session_id = excluded.parent_session_id,
            child_started_timestamp = excluded.child_started_timestamp,
            updated_at = CURRENT_TIMESTAMP
        `);

        let insertCount = 0;
        for (const [childId, data] of validContinuations) {
          if (existingParents.has(data.parentSessionId)) {
            stmt.run(childId, data.parentSessionId, data.childStartedTimestamp);
            insertCount++;
          }
        }

        return insertCount;
      });

      const insertedCount = upsertTransaction(continuationMap);

      safeLog.info(`Inserted/updated ${insertedCount} continuations`);

      safeLog.info('Populating continuation cache...');
      const cacheStartTime = Date.now();

      const rootSessionIds = new Set(
        Array.from(continuationMap.values()).map((c) => c.parentSessionId)
      );

      let totalCached = 0;
      for (const rootId of rootSessionIds) {
        try {
          const count = await this.populateChainCache(rootId);
          totalCached += count;
        } catch (cacheError) {
          safeLog.warn(`Failed to populate cache for root ${rootId}:`, cacheError.message);
        }
      }

      const cacheDuration = ((Date.now() - cacheStartTime) / 1000).toFixed(1);
      safeLog.info(`Cache populated: ${totalCached} sessions in ${cacheDuration}s`);

      if (mainWindow && !mainWindow.isDestroyed() && this.safeSend) {
        this.safeSend('continuations-detected', {
          total: sessions.length,
          continuations: insertedCount,
          errors: errorCount,
          orphans: continuationMap.size - insertedCount,
          cached: totalCached,
        });
      }

      const orphanCount = continuationMap.size - insertedCount;
      if (orphanCount > 0) {
        safeLog.warn(`${orphanCount} orphaned continuations logged for healing`);
      }
    } catch (error) {
      safeLog.error('Error resolving continuation chains:', error);
      throw error;
    }
  }

  /**
   * Heal orphaned continuations
   * Extracted from: main.js lines 3755-3853
   *
   * Finds orphaned continuations where parent now exists and updates the records.
   *
   * @param {Object} mainWindow - Electron BrowserWindow instance (for safeSend)
   * @returns {Promise<void>}
   */
  async healOrphanedContinuations(mainWindow = null) {
    if (!this.db) return;

    try {
      safeLog.info('Running orphan healing...');

      const orphans = this.db
        .prepare(
          `
        SELECT DISTINCT
          sc.child_session_id,
          sc.parent_session_id,
          sm.file_path
        FROM session_continuations sc
        LEFT JOIN session_metadata sm ON sc.child_session_id = sm.session_id
        WHERE sc.parent_session_id NOT IN (
          SELECT session_id FROM session_metadata
        )
        AND sm.file_path IS NOT NULL
      `
        )
        .all();

      if (orphans.length === 0) {
        safeLog.info('No orphans to heal');
        return;
      }

      safeLog.info(`Found ${orphans.length} orphans to heal`);

      const metadataPromises = orphans.map((orphan) =>
        this.detectSessionContinuation(orphan.file_path)
          .then((metadata) => ({ orphan, metadata }))
          .catch((error) => {
            safeLog.error(
              `Healing detection failed for ${orphan.child_session_id}:`,
              error.message
            );
            return { orphan, metadata: null, error };
          })
      );

      const results = await Promise.allSettled(metadataPromises);

      const validHealings = [];
      for (const result of results) {
        if (result.status === 'rejected') continue;

        const { orphan, metadata, error } = result.value;
        if (error || !metadata?.isChild) continue;

        const parentExists = this.db
          .prepare(
            `
          SELECT 1 FROM session_metadata WHERE session_id = ?
        `
          )
          .get(metadata.parentSessionId);

        if (parentExists && metadata.parentSessionId === orphan.parent_session_id) {
          validHealings.push({
            childId: orphan.child_session_id,
            parentId: metadata.parentSessionId,
            timestamp: metadata.childStartedTimestamp,
          });
        }
      }

      const healTransaction = this.db.transaction((healingList) => {
        const stmt = this.db.prepare(`
          INSERT INTO session_continuations (
            child_session_id,
            parent_session_id,
            child_started_timestamp
          ) VALUES (?, ?, ?)
          ON CONFLICT(child_session_id)
          DO UPDATE SET
            parent_session_id = excluded.parent_session_id,
            child_started_timestamp = excluded.child_started_timestamp,
            updated_at = CURRENT_TIMESTAMP
        `);

        let healedCount = 0;
        for (const healing of healingList) {
          stmt.run(healing.childId, healing.parentId, healing.timestamp);
          healedCount++;
        }
        return healedCount;
      });

      const healed = healTransaction(validHealings);
      safeLog.info(`Healed ${healed} orphaned continuations`);

      if (mainWindow && !mainWindow.isDestroyed() && this.safeSend) {
        this.safeSend('continuations-updated', {
          healed,
          remaining: orphans.length - healed,
        });
      }
    } catch (error) {
      safeLog.error('Orphan healing error:', error);
    }
  }

  /**
   * Detect orphaned continuations (children whose parents are missing)
   * Extracted from: main.js lines 3860-3892
   *
   * @returns {Promise<Array<Object>>} Array of orphaned continuation records
   */
  async detectOrphanedContinuations() {
    if (!this.db) {
      return [];
    }

    try {
      const stmt = this.db.prepare(`
        SELECT
          c.session_id as child_session_id,
          c.parent_session_id,
          c.continuation_order,
          m.file_path,
          m.project_path
        FROM session_continuations c
        JOIN session_metadata m ON m.session_id = c.session_id
        WHERE c.parent_session_id NOT IN (
          SELECT session_id FROM session_metadata
        )
      `);

      const orphaned = stmt.all();

      if (orphaned.length > 0) {
        this.debugLog(`Found ${orphaned.length} orphaned continuations`);
      }

      return orphaned;
    } catch (error) {
      safeLog.error('Error detecting orphaned continuations:', error);
      return [];
    }
  }
}

module.exports = { ContinuationChainService };
