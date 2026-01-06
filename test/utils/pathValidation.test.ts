/**
 * Path Validation Utilities Tests
 *
 * Tests for path validation utilities used in AdditionalPathsSection component.
 * These utilities support validation logic for:
 * - Symlink resolution
 * - Subdirectory detection
 * - Duplicate path detection (exact + symlink)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { resolvePath, isSubdirectory, findDuplicatePath } from '../../src/utils/pathValidation';

describe('Path Validation Utilities', () => {
  let testDir: string;
  let symlinkPath: string;
  let realPath: string;

  beforeAll(() => {
    // Create temporary test directory structure
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-validation-test-'));

    // Resolve testDir to handle macOS /var -> /private/var symlink
    testDir = fs.realpathSync(testDir);

    realPath = path.join(testDir, 'real-target');
    symlinkPath = path.join(testDir, 'symlink');

    // Create real directory
    fs.mkdirSync(realPath, { recursive: true });

    // Create symlink pointing to real directory
    fs.symlinkSync(realPath, symlinkPath);
  });

  afterAll(() => {
    // Cleanup test directories
    try {
      fs.unlinkSync(symlinkPath);
      fs.rmdirSync(realPath);
      fs.rmdirSync(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('resolvePath', () => {
    test('resolves symlinks to real path', () => {
      // GIVEN: symlink pointing to real directory
      const resolved = resolvePath(symlinkPath);

      // THEN: returns the real target path
      expect(resolved).toBe(realPath);
    });

    test('returns original path if not symlink', () => {
      // GIVEN: regular directory (not a symlink)
      const resolved = resolvePath(realPath);

      // THEN: returns the same path
      expect(resolved).toBe(realPath);
    });
  });

  describe('isSubdirectory', () => {
    test('detects subdirectory relationship', () => {
      // WHEN: checking if child is subdirectory of parent
      const result = isSubdirectory('/parent/child', '/parent');

      // THEN: returns true
      expect(result).toBe(true);
    });

    test('handles trailing slashes', () => {
      // WHEN: paths have trailing slashes
      const result = isSubdirectory('/parent/child/', '/parent/');

      // THEN: still correctly detects subdirectory relationship
      expect(result).toBe(true);
    });

    test('rejects non-subdirectories', () => {
      // WHEN: paths are not in parent-child relationship
      const result = isSubdirectory('/other/path', '/parent');

      // THEN: returns false
      expect(result).toBe(false);
    });
  });

  describe('findDuplicatePath', () => {
    test('finds exact duplicate', () => {
      // GIVEN: list of existing paths
      const existingPaths = ['/path/a', '/path/b'];

      // WHEN: checking for duplicate of existing path
      const result = findDuplicatePath('/path/a', existingPaths);

      // THEN: returns exact match duplicate info
      expect(result).toEqual({ type: 'exact', path: '/path/a' });
    });

    test('finds symlink duplicate', () => {
      // GIVEN: existing paths with real directory
      const existingPaths = [realPath];

      // WHEN: checking symlink that points to existing path
      const result = findDuplicatePath(symlinkPath, existingPaths);

      // THEN: returns symlink duplicate info
      expect(result).toEqual({ type: 'symlink', path: realPath });
    });
  });
});
