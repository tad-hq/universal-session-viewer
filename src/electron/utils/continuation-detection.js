/**
 * Continuation Detection Module
 *
 * Detects Claude Code session continuation relationships by parsing JSONL files.
 *
 * DETECTION METHOD:
 * Compare event.sessionId in compact_boundary events with the filename session ID.
 * If they differ, the event.sessionId IS the parent session ID.
 *
 * This works because:
 * 1. When a session hits context limit (~155k tokens), a compact_boundary event is written
 * 2. A new child session is created
 * 3. The compact_boundary event is COPIED into the child file
 * 4. The copied event retains the PARENT's sessionId (where compaction occurred)
 * 5. Therefore: sessionId mismatch = child session, event.sessionId = parent
 *
 * IMPORTANT: Do NOT use logicalParentUuid for parent detection - it's a MESSAGE UUID,
 * not a session UUID, and will never match a session file (0% success rate).
 *
 * Based on: docs/JSONL-CONTINUATION-CHAIN-BEHAVIOR.md (authoritative source)
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const readline = require('readline');

/**
 * Detects continuation metadata from a JSONL file
 *
 * DETECTION METHOD: Compare event.sessionId with filename in compact_boundary events.
 * If they differ, event.sessionId IS the parent session ID.
 *
 * See: docs/JSONL-CONTINUATION-CHAIN-BEHAVIOR.md for complete documentation.
 *
 * NOTE: logicalParentUuid is a MESSAGE UUID, not a session UUID. It should NOT
 * be used for parent detection (0% success rate).
 *
 * @param {string} filePath - Absolute path to JSONL file
 * @returns {Promise<Object>} Continuation metadata
 *
 * Returns:
 * {
 *   isChild: boolean,              // Has compact_boundary with mismatched sessionId
 *   parentSessionId: string|null,  // The parent session ID (from compact_boundary.sessionId)
 *   childStartedTimestamp: number|null,  // When child session started
 *   compactBoundary: {             // If this session has compact_boundary marker
 *     timestamp: number,
 *     nextSessionId: string,
 *     message: string
 *   } | null,
 *   isParent: boolean,             // Has compact_boundary (spawned a child)
 *   sessionId: string|null         // Session ID from filename
 * }
 */
async function detectContinuationMetadata(filePath) {
  const result = {
    isChild: false,
    parentSessionId: null,
    childStartedTimestamp: null,
    compactBoundary: null,
    isParent: false,
    sessionId: null,
  };

  // CRITICAL: Must track these for cleanup in finally block
  let fileStream = null;
  let rl = null;

  try {
    // BUG FIX 1: Extract session ID from file path (reliable method)
    // The lineCount === 1 approach fails because lineCount includes empty lines
    // FIX BUG #2: Actual files are <uuid>.jsonl NOT transcript_<uuid>.jsonl
    const sessionIdMatch = filePath.match(
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.jsonl$/i
    );
    if (sessionIdMatch) {
      result.sessionId = sessionIdMatch[1];
    } else {
      console.warn(`Could not extract session ID from path: ${filePath}`);
    }

    // Create read stream for line-by-line parsing (memory efficient)
    fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lineCount = 0;
    const foundFileHistorySnapshot = false;
    const compactBoundaries = [];

    for await (const line of rl) {
      lineCount++;

      // Skip empty lines
      if (!line.trim()) {
        continue;
      }

      try {
        const event = JSON.parse(line);

        // CORRECT DETECTION: sessionId mismatch in compact_boundary events
        // See: docs/JSONL-CONTINUATION-CHAIN-BEHAVIOR.md for full documentation
        //
        // When a session is compacted, the compact_boundary event is COPIED to the child file.
        // The event retains the PARENT's sessionId, not the child's.
        // Therefore: if event.sessionId !== filename, this IS a child session and
        // event.sessionId IS the parent session ID.
        //
        // NOTE: logicalParentUuid is a MESSAGE UUID, not a session UUID. It will
        // NEVER match a session file. Do NOT use it for parent detection.

        // Check for compact_boundary (BOTH formats for compatibility)
        const isCompactBoundary =
          (event.type === 'system' && event.subtype === 'compact_boundary') ||
          event.type === 'compact_boundary';

        if (isCompactBoundary) {
          const eventSessionId = event.sessionId;

          // THE KEY DETECTION: If sessionId differs from filename, this is a CHILD
          if (eventSessionId && result.sessionId && eventSessionId !== result.sessionId) {
            if (!result.isChild) {
              // Only capture first occurrence
              result.isChild = true;
              result.parentSessionId = eventSessionId; // THIS IS THE PARENT

              // Capture when child session started
              if (event.timestamp) {
                result.childStartedTimestamp = new Date(event.timestamp).getTime();
              }
            }
          }
        }

        // Also track compact_boundary for parent detection (when this session spawned a child)
        // BUG FIX 2: Claude Code uses type: "system", subtype: "compact_boundary"
        if (event.type === 'system' && event.subtype === 'compact_boundary') {
          const boundary = {
            timestamp: null,
            nextSessionId: null,
            message: '',
          };

          if (event.timestamp) {
            boundary.timestamp = new Date(event.timestamp).getTime();
          }

          // Extract next session ID from message content
          // BUG FIX 3: Content is directly in event.content, not event.message.content
          if (event.content) {
            boundary.message = event.content;

            // Pattern: "Context window approaching limit. Continuing in new session: UUID"
            const sessionIdMatch = boundary.message.match(
              /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
            );
            if (sessionIdMatch) {
              boundary.nextSessionId = sessionIdMatch[1];
            }
          }

          compactBoundaries.push(boundary);
        }
      } catch (parseError) {
        // Skip malformed JSON lines
        continue;
      }

      // Optimization: If we found file-history-snapshot and have compact boundaries,
      // we can stop early (unless we want ALL compact boundaries)
      // For now, keep scanning to catch all boundaries
    }

    // Determine if this is a parent based on compact_boundary presence
    if (compactBoundaries.length > 0) {
      result.isParent = true;
      // Use the LAST compact_boundary (most recent continuation)
      result.compactBoundary = compactBoundaries[compactBoundaries.length - 1];
    }

    return result;
  } catch (error) {
    // Return empty result if file read fails
    console.error(`Error detecting continuation metadata in ${filePath}:`, error.message);
    return result;
  } finally {
    // CRITICAL: Always close file descriptors to prevent resource leaks
    try {
      if (rl) {
        rl.close();
      }
      if (fileStream) {
        fileStream.destroy();
      }
    } catch (cleanupError) {
      // Silently ignore cleanup errors
      console.error(`Cleanup error for ${filePath}:`, cleanupError.message);
    }
  }
}

/**
 * Extract next session ID from compact_boundary message
 *
 * @param {string} message - The compact_boundary message content
 * @returns {string|null} - Extracted session ID or null
 */
function extractNextSessionId(message) {
  if (!message) return null;

  // Pattern: UUID in the message
  const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const match = message.match(uuidRegex);

  return match ? match[1] : null;
}

/**
 * Batch detect continuation metadata for multiple files
 *
 * @param {Array<string>} filePaths - Array of absolute paths to JSONL files
 * @param {Function} progressCallback - Optional callback(current, total, filePath)
 * @returns {Promise<Map<string, Object>>} - Map of sessionId → metadata
 */
async function batchDetectContinuations(filePaths, progressCallback = null) {
  const results = new Map();

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];

    if (progressCallback) {
      progressCallback(i + 1, filePaths.length, filePath);
    }

    const metadata = await detectContinuationMetadata(filePath);

    if (metadata.sessionId) {
      results.set(metadata.sessionId, metadata);
    }
  }

  return results;
}

/**
 * Validate a continuation chain for circular references
 *
 * @param {string} sessionId - Starting session ID
 * @param {Function} getParentFunc - Function that returns parent session ID
 * @param {number} maxDepth - Maximum chain depth (default: 100)
 * @returns {Object} - { isValid: boolean, depth: number, error: string|null }
 */
function validateContinuationChain(sessionId, getParentFunc, maxDepth = 100) {
  const visited = new Set();
  let currentId = sessionId;
  let depth = 0;

  while (currentId) {
    depth++;

    // Check for circular reference
    if (visited.has(currentId)) {
      return {
        isValid: false,
        depth,
        error: `Circular reference detected at session ${currentId}`,
      };
    }

    // Check for excessive depth
    if (depth > maxDepth) {
      return {
        isValid: false,
        depth,
        error: `Chain depth exceeded maximum (${maxDepth})`,
      };
    }

    visited.add(currentId);
    currentId = getParentFunc(currentId);
  }

  return {
    isValid: true,
    depth,
    error: null,
  };
}

module.exports = {
  detectContinuationMetadata,
  extractNextSessionId,
  batchDetectContinuations,
  validateContinuationChain,
};
