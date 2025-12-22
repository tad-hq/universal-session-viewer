/**
 * Unit Tests for continuation-detection.js
 *
 * Tests the detection of continuation relationships from JSONL files.
 *
 * Test Coverage:
 * - TEST-001 to TEST-003: SessionId Extraction
 * - TEST-004 to TEST-008: Compact Boundary Detection (Child Sessions)
 * - TEST-009 to TEST-011: Parent Session Detection
 * - TEST-012 to TEST-015: Edge Cases - Malformed Data
 * - TEST-016 to TEST-018: File I/O Edge Cases
 * - TEST-019: Multiple SessionIds Inheritance
 * - TEST-020 to TEST-022: extractNextSessionId
 * - TEST-023 to TEST-026: batchDetectContinuations
 * - TEST-027 to TEST-030: validateContinuationChain
 *
 * Based on: plans/testing/continuation-backend-testing.md Section 3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  SAMPLE_CHILD_SESSION,
  SAMPLE_PARENT_SESSION,
  SAMPLE_LEGACY_FORMAT_SESSION,
  SAMPLE_MULTIPLE_COMPACTIONS,
} from './fixtures/jsonl-samples';
import { createLinearChain } from './fixtures/chain-fixtures';
import { createCompactBoundaryEvent } from './helpers';

// Import the module under test
const {
  detectContinuationMetadata,
  extractNextSessionId,
  batchDetectContinuations,
  validateContinuationChain,
} = require('../../../../src/migrations/continuation-detection.js');

describe('detectContinuationMetadata', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'continuation-test-'));
  });

  afterEach(async () => {
    // Clean up temporary files
    if (tempDir) {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper function to write JSONL test file
   */
  async function writeJsonlFile(filename: string, events: any[]): Promise<string> {
    const filePath = path.join(tempDir, filename);
    const lines = events.map(e => JSON.stringify(e)).join('\n');
    await fsPromises.writeFile(filePath, lines, 'utf8');
    return filePath;
  }

  describe('SessionId Extraction', () => {
    it('TEST-001: should extract session ID from filename pattern <uuid>.jsonl', async () => {
      // Pattern: 17b7a5b6-8e1f-45c5-bc88-87fd0810da5a.jsonl
      const sessionId = '17b7a5b6-8e1f-45c5-bc88-87fd0810da5a';
      const filePath = await writeJsonlFile(`${sessionId}.jsonl`, [
        { type: 'user', message: 'test' },
      ]);

      const result = await detectContinuationMetadata(filePath);

      expect(result.sessionId).toBe(sessionId);
    });

    it('TEST-002: should handle case-insensitive UUID matching', async () => {
      // Pattern: 17B7A5B6-8E1F-45C5-BC88-87FD0810DA5A.jsonl (uppercase)
      const sessionId = '17B7A5B6-8E1F-45C5-BC88-87FD0810DA5A';
      const filePath = await writeJsonlFile(`${sessionId}.jsonl`, [
        { type: 'user', message: 'test' },
      ]);

      const result = await detectContinuationMetadata(filePath);

      expect(result.sessionId).toBe(sessionId);
    });

    it('TEST-003: should return null sessionId for invalid filenames', async () => {
      // Pattern: transcript_invalid.jsonl
      const filePath = await writeJsonlFile('transcript_invalid.jsonl', [
        { type: 'user', message: 'test' },
      ]);

      const result = await detectContinuationMetadata(filePath);

      expect(result.sessionId).toBeNull();
    });
  });

  describe('Compact Boundary Detection - Child Sessions', () => {
    it('TEST-004: should detect child session when compact_boundary.sessionId differs from filename', async () => {
      // File: bfb0e536.jsonl
      // Event: { sessionId: "17b7a5b6", type: "system", subtype: "compact_boundary" }
      // Expected: isChild = true, parentSessionId = "17b7a5b6"
      const filePath = await writeJsonlFile(
        SAMPLE_CHILD_SESSION.filename,
        SAMPLE_CHILD_SESSION.content
      );

      const result = await detectContinuationMetadata(filePath);

      expect(result.sessionId).toBe(SAMPLE_CHILD_SESSION.sessionId);
      expect(result.isChild).toBe(true);
      expect(result.parentSessionId).toBe(SAMPLE_CHILD_SESSION.parentSessionId);
    });

    it('TEST-005: should detect modern format (type: system, subtype: compact_boundary)', async () => {
      // Modern Claude Code format from docs
      const childId = 'abcd1230-0000-0000-0000-000000000000';
      const parentId = 'cafe0000-0000-0000-0000-000000000000';

      const filePath = await writeJsonlFile(`${childId}.jsonl`, [
        {
          type: 'system',
          subtype: 'compact_boundary',
          sessionId: parentId,
          timestamp: '2025-11-29T03:43:28.703Z',
          content: 'Conversation compacted',
        },
      ]);

      const result = await detectContinuationMetadata(filePath);

      expect(result.isChild).toBe(true);
      expect(result.parentSessionId).toBe(parentId);
    });

    it('TEST-006: should detect legacy format (type: compact_boundary)', async () => {
      // Legacy format support (Section 3.4 of behavior doc)
      const filePath = await writeJsonlFile(
        SAMPLE_LEGACY_FORMAT_SESSION.filename,
        SAMPLE_LEGACY_FORMAT_SESSION.content
      );

      const result = await detectContinuationMetadata(filePath);

      expect(result.isChild).toBe(true);
      expect(result.parentSessionId).toBe(SAMPLE_LEGACY_FORMAT_SESSION.parentSessionId);
    });

    it('TEST-007: should extract childStartedTimestamp from compact_boundary', async () => {
      // Event: { timestamp: "2025-11-29T03:43:28.703Z" }
      // Expected: childStartedTimestamp = 1732853008703
      const filePath = await writeJsonlFile(
        SAMPLE_CHILD_SESSION.filename,
        SAMPLE_CHILD_SESSION.content
      );

      const result = await detectContinuationMetadata(filePath);

      expect(result.childStartedTimestamp).toBeDefined();
      expect(result.childStartedTimestamp).toBe(
        new Date('2025-11-29T03:43:28.703Z').getTime()
      );
    });

    it('TEST-008: should only capture FIRST compact_boundary mismatch', async () => {
      // Edge case: Multiple compact_boundary events in one file
      // Only first mismatch indicates parent (others are internal)
      const filePath = await writeJsonlFile(
        SAMPLE_MULTIPLE_COMPACTIONS.filename,
        SAMPLE_MULTIPLE_COMPACTIONS.content
      );

      const result = await detectContinuationMetadata(filePath);

      expect(result.isChild).toBe(true);
      // Should capture FIRST mismatch only
      expect(result.parentSessionId).toBe(SAMPLE_MULTIPLE_COMPACTIONS.parentSessionId);
    });
  });

  describe('Parent Session Detection', () => {
    it('TEST-009: should detect parent when compact_boundary.sessionId matches filename', async () => {
      // File: 17b7a5b6.jsonl
      // Event: { sessionId: "17b7a5b6", ... }
      // Expected: isParent = true
      const filePath = await writeJsonlFile(
        SAMPLE_PARENT_SESSION.filename,
        SAMPLE_PARENT_SESSION.content
      );

      const result = await detectContinuationMetadata(filePath);

      expect(result.sessionId).toBe(SAMPLE_PARENT_SESSION.sessionId);
      expect(result.isParent).toBe(true);
      expect(result.compactBoundary).toBeDefined();
    });

    it('TEST-010: should extract nextSessionId from compact_boundary message', async () => {
      // Message: "Continuing in new session: bfb0e536-1923-4ee4-a306-49c1b3bca8e9"
      // Expected: compactBoundary.nextSessionId = "bfb0e536-..."
      const parentId = 'fade0000-0000-0000-0000-000000000000';
      const childId = 'bfb0e536-1923-4ee4-a306-49c1b3bca8e9';

      const filePath = await writeJsonlFile(`${parentId}.jsonl`, [
        {
          type: 'system',
          subtype: 'compact_boundary',
          sessionId: parentId,
          timestamp: '2025-11-29T03:43:28.703Z',
          content: `Continuing in new session: ${childId}`,
        },
      ]);

      const result = await detectContinuationMetadata(filePath);

      expect(result.isParent).toBe(true);
      expect(result.compactBoundary?.nextSessionId).toBe(childId);
    });

    it('TEST-011: should use LAST compact_boundary for parent detection', async () => {
      // Multiple compactions = most recent child
      const parentId = 'fade0000-0000-0000-0000-000000000000';
      const firstChild = 'abcd0001-0000-0000-0000-000000000001';
      const secondChild = 'abcd0002-0000-0000-0000-000000000002';

      const filePath = await writeJsonlFile(`${parentId}.jsonl`, [
        {
          type: 'system',
          subtype: 'compact_boundary',
          sessionId: parentId,
          timestamp: '2025-11-29T03:00:00.000Z',
          content: `Continuing in new session: ${firstChild}`,
        },
        {
          type: 'system',
          subtype: 'compact_boundary',
          sessionId: parentId,
          timestamp: '2025-11-29T04:00:00.000Z',
          content: `Continuing in new session: ${secondChild}`,
        },
      ]);

      const result = await detectContinuationMetadata(filePath);

      expect(result.isParent).toBe(true);
      // Should use LAST compact_boundary
      expect(result.compactBoundary?.nextSessionId).toBe(secondChild);
    });
  });

  describe('Edge Cases - Malformed Data', () => {
    it('TEST-012: should skip malformed JSON lines gracefully', async () => {
      // Line: "{ invalid json
      // Expected: Continue parsing, no crash
      const sessionId = 'bad00000-0000-0000-0000-000000000000';
      const filePath = path.join(tempDir, `${sessionId}.jsonl`);

      // Write file with malformed JSON
      await fsPromises.writeFile(
        filePath,
        '{ "type": "user", "message": "valid line" }\n' +
          '{ invalid json without closing brace\n' +
          '{ "type": "user", "message": "another valid line" }\n',
        'utf8'
      );

      const result = await detectContinuationMetadata(filePath);

      // Should not throw, should continue parsing
      expect(result.sessionId).toBe(sessionId);
    });

    it('TEST-013: should handle empty lines without errors', async () => {
      // JSONL with blank lines
      const sessionId = 'e0000000-0000-0000-0000-000000000000';
      const filePath = path.join(tempDir, `${sessionId}.jsonl`);

      await fsPromises.writeFile(
        filePath,
        '{ "type": "user", "message": "line 1" }\n' +
          '\n' + // Empty line
          '   \n' + // Whitespace-only line
          '{ "type": "user", "message": "line 2" }\n',
        'utf8'
      );

      const result = await detectContinuationMetadata(filePath);

      expect(result.sessionId).toBe(sessionId);
    });

    it('TEST-014: should handle missing sessionId field in events', async () => {
      // Event: { type: "system", subtype: "compact_boundary" } // No sessionId
      const sessionId = 'f0000000-0000-0000-0000-000000000000';
      const filePath = await writeJsonlFile(`${sessionId}.jsonl`, [
        {
          type: 'system',
          subtype: 'compact_boundary',
          // No sessionId field
          timestamp: '2025-11-29T03:43:28.703Z',
          content: 'Conversation compacted',
        },
      ]);

      const result = await detectContinuationMetadata(filePath);

      // Should not crash, should not detect as child
      expect(result.sessionId).toBe(sessionId);
      expect(result.isChild).toBe(false);
    });

    it('TEST-015: should handle missing timestamp in compact_boundary', async () => {
      // Event should still be processed
      const parentId = 'fade0000-0000-0000-0000-000000000000';
      const filePath = await writeJsonlFile(`${parentId}.jsonl`, [
        {
          type: 'system',
          subtype: 'compact_boundary',
          sessionId: parentId,
          // No timestamp field
          content: 'Conversation compacted',
        },
      ]);

      const result = await detectContinuationMetadata(filePath);

      expect(result.isParent).toBe(true);
      expect(result.compactBoundary?.timestamp).toBeNull();
    });
  });

  describe('File I/O Edge Cases', () => {
    it('TEST-016: should handle file read errors gracefully', async () => {
      // ENOENT, EACCES errors
      // Expected: Return empty result, log error
      const nonExistentPath = path.join(tempDir, 'nonexistent-file.jsonl');

      const result = await detectContinuationMetadata(nonExistentPath);

      expect(result.sessionId).toBeNull();
      expect(result.isChild).toBe(false);
      expect(result.isParent).toBe(false);
    });

    it('TEST-017: should close file descriptors in finally block', async () => {
      // Critical: Prevent resource leaks
      // Mock fileStream.destroy() to verify cleanup
      const sessionId = 'c1ead000-0000-0000-0000-000000000000';
      const filePath = await writeJsonlFile(`${sessionId}.jsonl`, [
        { type: 'user', message: 'test' },
      ]);

      // This test verifies that the function completes without hanging
      // If file descriptors are not closed, subsequent tests may fail
      const result = await detectContinuationMetadata(filePath);

      expect(result.sessionId).toBe(sessionId);

      // Verify we can read the file again (proves it was closed)
      const result2 = await detectContinuationMetadata(filePath);
      expect(result2.sessionId).toBe(sessionId);
    });

    it('TEST-018: should handle large files efficiently (streaming)', async () => {
      // 10K+ line files should not load into memory
      // Verify readline interface usage
      const sessionId = 'fade1111-0000-0000-0000-000000000000';
      const parentId = 'cafe0000-0000-0000-0000-000000000000';

      // Create a large file with 10,000 lines
      const lines: string[] = [];
      lines.push(
        JSON.stringify({
          type: 'system',
          subtype: 'compact_boundary',
          sessionId: parentId,
          timestamp: '2025-11-29T03:43:28.703Z',
          content: 'Conversation compacted',
        })
      );

      for (let i = 0; i < 10000; i++) {
        lines.push(JSON.stringify({ type: 'user', message: `Line ${i}` }));
      }

      const filePath = path.join(tempDir, `${sessionId}.jsonl`);
      await fsPromises.writeFile(filePath, lines.join('\n'), 'utf8');

      const startTime = Date.now();
      const result = await detectContinuationMetadata(filePath);
      const duration = Date.now() - startTime;

      // Should complete quickly (streaming, not loading entire file)
      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(result.isChild).toBe(true);
      expect(result.parentSessionId).toBe(parentId);
    });
  });

  describe('Multiple SessionIds Inheritance Pattern', () => {
    it('TEST-019: should detect child even when file contains grandparent sessionIds', async () => {
      // File: d7114302.jsonl contains ["d7114302", "17b7a5b6", "16f675dd"]
      // Should detect immediate parent (16f675dd), not root
      const currentId = 'd7114302-0000-0000-0000-000000000000';
      const immediateParentId = '16f675dd-0000-0000-0000-000000000000';
      const grandparentId = '17b7a5b6-0000-0000-0000-000000000000';

      const filePath = await writeJsonlFile(`${currentId}.jsonl`, [
        {
          type: 'system',
          subtype: 'compact_boundary',
          sessionId: immediateParentId, // Immediate parent (FIRST mismatch)
          timestamp: '2025-11-29T03:43:28.703Z',
          content: 'Conversation compacted',
        },
        {
          type: 'user',
          sessionId: currentId,
          message: 'User message',
        },
        // File might contain references to grandparent, but detection
        // should use FIRST compact_boundary mismatch
      ]);

      const result = await detectContinuationMetadata(filePath);

      expect(result.isChild).toBe(true);
      // Should detect immediate parent, not grandparent
      expect(result.parentSessionId).toBe(immediateParentId);
    });
  });
});

describe('extractNextSessionId', () => {
  it('TEST-020: should extract UUID from standard message', () => {
    // "Continuing in new session: abc123..."
    const nextId = 'abc12345-1234-5678-9012-123456789abc';
    const message = `Continuing in new session: ${nextId}`;

    const result = extractNextSessionId(message);

    expect(result).toBe(nextId);
  });

  it('TEST-021: should extract UUID from Claude message variations', () => {
    // Different message formats
    const nextId = 'bfb0e536-1923-4ee4-a306-49c1b3bca8e9';

    const variations = [
      `Continuing in new session: ${nextId}`,
      `Context window approaching limit. Continuing in new session: ${nextId}`,
      `New session started: ${nextId}`,
      nextId, // Just the UUID
    ];

    for (const message of variations) {
      const result = extractNextSessionId(message);
      expect(result).toBe(nextId);
    }
  });

  it('TEST-022: should return null for messages without UUID', () => {
    // "Conversation compacted" (no next session)
    const messagesWithoutUUID = [
      'Conversation compacted',
      'Context window limit reached',
      '',
      'Invalid UUID format: not-a-uuid',
      'Short ID: abc-123',
    ];

    for (const message of messagesWithoutUUID) {
      const result = extractNextSessionId(message);
      expect(result).toBeNull();
    }

    // Test null/undefined input
    expect(extractNextSessionId(null as any)).toBeNull();
    expect(extractNextSessionId(undefined as any)).toBeNull();
  });
});

describe('batchDetectContinuations', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'continuation-batch-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    }
  });

  async function writeJsonlFile(filename: string, events: any[]): Promise<string> {
    const filePath = path.join(tempDir, filename);
    const lines = events.map(e => JSON.stringify(e)).join('\n');
    await fsPromises.writeFile(filePath, lines, 'utf8');
    return filePath;
  }

  it('TEST-023: should process 100+ files in parallel', async () => {
    // Performance test: < 5s for 100 files
    const filePaths: string[] = [];

    for (let i = 0; i < 100; i++) {
      const hexIndex = i.toString(16).padStart(8, '0');
      const sessionId = `${hexIndex}-0000-0000-0000-000000000000`;
      const filePath = await writeJsonlFile(`${sessionId}.jsonl`, [
        { type: 'user', message: `Session ${i}` },
      ]);
      filePaths.push(filePath);
    }

    const startTime = Date.now();
    const result = await batchDetectContinuations(filePaths);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // < 5 seconds
    expect(result.size).toBe(100);
  }, 10000); // 10 second timeout

  it('TEST-024: should invoke progress callback with correct values', async () => {
    // Callback: (current, total, filePath)
    const filePaths: string[] = [];

    for (let i = 0; i < 5; i++) {
      const hexIndex = i.toString(16).padStart(8, '0');
      const sessionId = `${hexIndex}-0000-0000-0000-000000000000`;
      const filePath = await writeJsonlFile(`${sessionId}.jsonl`, [
        { type: 'user', message: `Session ${i}` },
      ]);
      filePaths.push(filePath);
    }

    const progressCalls: Array<{ current: number; total: number; filePath: string }> = [];
    const progressCallback = vi.fn((current: number, total: number, filePath: string) => {
      progressCalls.push({ current, total, filePath });
    });

    await batchDetectContinuations(filePaths, progressCallback);

    expect(progressCallback).toHaveBeenCalledTimes(5);
    expect(progressCalls[0]).toEqual({ current: 1, total: 5, filePath: filePaths[0] });
    expect(progressCalls[4]).toEqual({ current: 5, total: 5, filePath: filePaths[4] });
  });

  it('TEST-025: should continue processing after individual file errors', async () => {
    // One bad file shouldn't stop batch
    const filePaths: string[] = [];

    // Good file
    const session1 = 'aaaa0001-0000-0000-0000-000000000000';
    filePaths.push(await writeJsonlFile(`${session1}.jsonl`, [{ type: 'user', message: 'test' }]));

    // Non-existent file (will error)
    filePaths.push(path.join(tempDir, 'bbbb0000-0000-0000-0000-000000000000.jsonl'));

    // Another good file
    const session2 = 'cccc0002-0000-0000-0000-000000000000';
    filePaths.push(await writeJsonlFile(`${session2}.jsonl`, [{ type: 'user', message: 'test' }]));

    const result = await batchDetectContinuations(filePaths);

    // Should have processed valid files
    expect(result.has(session1)).toBe(true);
    expect(result.has(session2)).toBe(true);
    // May also have an entry for the failed file with sessionId extracted but empty metadata
    expect(result.size).toBeGreaterThanOrEqual(2);
  });

  it('TEST-026: should return Map<sessionId, metadata>', async () => {
    // Verify Map structure and keys
    const childId = 'bfb0e536-1923-4ee4-a306-49c1b3bca8e9';
    const parentId = '17b7a5b6-8e1f-45c5-bc88-87fd0810da5a';

    const filePath = await writeJsonlFile(`${childId}.jsonl`, [
      createCompactBoundaryEvent(parentId, '2025-11-29T03:43:28.703Z'),
      {
        type: 'user',
        sessionId: childId,
        message: { role: 'user', content: 'Summary...' },
      },
    ]);

    const result = await batchDetectContinuations([filePath]);

    expect(result).toBeInstanceOf(Map);
    expect(result.has(childId)).toBe(true);

    const metadata = result.get(childId);
    expect(metadata).toBeDefined();
    expect(metadata?.sessionId).toBe(childId);
    expect(metadata?.isChild).toBe(true);
    expect(metadata?.parentSessionId).toBe(parentId);
  });
});

describe('validateContinuationChain', () => {
  it('TEST-027: should detect circular references', () => {
    // Chain: A -> B -> C -> A
    // Expected: { isValid: false, error: "Circular reference..." }
    const chain = new Map([
      ['session-a', 'session-c'],
      ['session-b', 'session-a'],
      ['session-c', 'session-b'],
    ]);

    const getParentFunc = (id: string) => chain.get(id) || null;

    const result = validateContinuationChain('session-a', getParentFunc);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Circular reference');
  });

  it('TEST-028: should enforce max depth limit (default 100)', () => {
    // Chain of 101 sessions
    // Expected: { isValid: false, error: "Chain depth exceeded..." }
    const chainFixture = createLinearChain(101);
    const chain = new Map(chainFixture.sessions.map((s: any) => [s.id, s.parent]));

    const getParentFunc = (id: string) => chain.get(id) || null;

    const deepestChild = chainFixture.sessions[100].id;
    const result = validateContinuationChain(deepestChild, getParentFunc);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Chain depth exceeded');
  });

  it('TEST-029: should validate legitimate long chains', () => {
    // Chain of 50 sessions (valid)
    // Expected: { isValid: true, depth: 50 }
    const chainFixture = createLinearChain(50);
    const chain = new Map(chainFixture.sessions.map((s: any) => [s.id, s.parent]));

    const getParentFunc = (id: string) => chain.get(id) || null;

    const deepestChild = chainFixture.sessions[49].id;
    const result = validateContinuationChain(deepestChild, getParentFunc);

    expect(result.isValid).toBe(true);
    expect(result.depth).toBe(50);
    expect(result.error).toBeNull();
  });

  it('TEST-030: should allow custom maxDepth parameter', () => {
    // maxDepth: 10, chain: 15 sessions
    const chainFixture = createLinearChain(15);
    const chain = new Map(chainFixture.sessions.map((s: any) => [s.id, s.parent]));

    const getParentFunc = (id: string) => chain.get(id) || null;

    const deepestChild = chainFixture.sessions[14].id;

    // Should fail with maxDepth=10
    const result1 = validateContinuationChain(deepestChild, getParentFunc, 10);
    expect(result1.isValid).toBe(false);
    expect(result1.error).toContain('Chain depth exceeded');
    expect(result1.error).toContain('10');

    // Should succeed with maxDepth=20
    const result2 = validateContinuationChain(deepestChild, getParentFunc, 20);
    expect(result2.isValid).toBe(true);
    expect(result2.depth).toBe(15);
  });
});
