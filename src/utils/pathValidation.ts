/**
 * Path Validation Utilities
 *
 * Utilities for validating and comparing file system paths.
 * Used by AdditionalPathsSection for path validation logic.
 *
 * Features:
 * - Symlink resolution (follows symlinks to real paths)
 * - Subdirectory detection (check parent/child relationships)
 * - Duplicate detection (exact + symlink-aware)
 */

import fs from 'fs';
import path from 'path';

export interface DuplicatePathResult {
  type: 'exact' | 'symlink';
  path: string;
}

/**
 * Resolves a path, following symlinks to the real target.
 *
 * @param targetPath - The path to resolve (may be a symlink)
 * @returns The real path (symlink target) or original path if not a symlink
 *
 * @example
 * // If /link -> /real/target
 * resolvePath('/link') // returns '/real/target'
 * resolvePath('/real/target') // returns '/real/target'
 */
export function resolvePath(targetPath: string): string {
  try {
    return fs.realpathSync(targetPath);
  } catch (error) {
    // If realpath fails (path doesn't exist, etc.), return original path
    return targetPath;
  }
}

/**
 * Checks if a path is a subdirectory of another path.
 * Handles trailing slashes correctly.
 *
 * @param child - The potential subdirectory path
 * @param parent - The potential parent directory path
 * @returns true if child is a subdirectory of parent, false otherwise
 *
 * @example
 * isSubdirectory('/parent/child', '/parent') // true
 * isSubdirectory('/parent/child/', '/parent/') // true
 * isSubdirectory('/other/path', '/parent') // false
 */
export function isSubdirectory(child: string, parent: string): boolean {
  // Normalize paths to remove trailing slashes and resolve relative paths
  const normalizedChild = path.resolve(child);
  const normalizedParent = path.resolve(parent);

  // Get relative path from parent to child
  const relative = path.relative(normalizedParent, normalizedChild);

  // If relative path is empty, they're the same directory (not a subdirectory)
  if (relative === '') {
    return false;
  }

  // If relative path starts with '..', child is not under parent
  // If relative is absolute, child is not under parent
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Finds a duplicate path in a list of existing paths.
 * Checks for both exact matches and symlink-resolved matches.
 *
 * @param newPath - The path to check for duplicates
 * @param existingPaths - Array of existing paths to check against
 * @returns Duplicate info if found, null otherwise
 *
 * @example
 * // Exact duplicate
 * findDuplicatePath('/path/a', ['/path/a', '/path/b'])
 * // returns { type: 'exact', path: '/path/a' }
 *
 * // Symlink duplicate (if /link -> /real/path)
 * findDuplicatePath('/link', ['/real/path'])
 * // returns { type: 'symlink', path: '/real/path' }
 */
export function findDuplicatePath(
  newPath: string,
  existingPaths: string[]
): DuplicatePathResult | null {
  // Check for exact match first
  if (existingPaths.includes(newPath)) {
    return { type: 'exact', path: newPath };
  }

  // Resolve the new path to handle symlinks
  const resolvedNewPath = resolvePath(newPath);

  // Check if resolved path matches any existing path (after resolution)
  for (const existingPath of existingPaths) {
    const resolvedExisting = resolvePath(existingPath);

    if (resolvedNewPath === resolvedExisting) {
      return { type: 'symlink', path: resolvedExisting };
    }
  }

  return null;
}
