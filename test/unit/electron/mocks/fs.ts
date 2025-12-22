/**
 * Mock fs/fs.promises for Main Process Testing
 *
 * PURPOSE: Mock file system operations without actual disk I/O
 *
 * V1 PATTERN CONTEXT:
 * - Main process reads JSONL files via fs.promises.readFile()
 * - Checks file stats via fs.promises.stat()
 * - Reads directories via fs.promises.readdir()
 * - SHA-256 hashing of file contents for cache validation
 */

import { vi } from 'vitest';

export interface MockStats {
  size: number;
  mtime: Date;
  isDirectory: () => boolean;
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
}

export interface MockFileSystem {
  files: Map<string, { content: string; stats: MockStats }>;
  readFile: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  stat: ReturnType<typeof vi.fn>;
  readdir: ReturnType<typeof vi.fn>;
  access: ReturnType<typeof vi.fn>;
  mkdir: ReturnType<typeof vi.fn>;
  unlink: ReturnType<typeof vi.fn>;
  rm: ReturnType<typeof vi.fn>;
  // Helpers for tests
  addFile: (path: string, content: string, size?: number) => void;
  addDirectory: (path: string, files: string[]) => void;
  clear: () => void;
}

/**
 * Create mock file stats
 */
export function createMockStats(
  size: number = 1000,
  mtime: Date = new Date(),
  isDir: boolean = false
): MockStats {
  return {
    size,
    mtime,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isSymbolicLink: () => false,
  };
}

/**
 * Create mock file system with in-memory storage
 *
 * V1 Pattern: Various file operations throughout main.js
 */
export function createMockFileSystem(): MockFileSystem {
  const files = new Map<string, { content: string; stats: MockStats }>();
  const directories = new Map<string, string[]>();

  const fs: MockFileSystem = {
    files,

    // V1 Pattern (main.js:2050-2100): Read session JSONL files
    readFile: vi.fn().mockImplementation(async (path: string, encoding?: string) => {
      const file = files.get(path);
      if (!file) {
        const error: any = new Error(`ENOENT: no such file or directory, open '${path}'`);
        error.code = 'ENOENT';
        throw error;
      }
      return encoding === 'utf-8' ? file.content : Buffer.from(file.content);
    }),

    writeFile: vi.fn().mockImplementation(async (path: string, content: string) => {
      const stats = createMockStats(content.length, new Date(), false);
      files.set(path, { content, stats });
    }),

    // V1 Pattern (main.js:2090): Get file stats for mtime/size checks
    stat: vi.fn().mockImplementation(async (path: string) => {
      const file = files.get(path);
      if (file) return file.stats;

      const dir = directories.get(path);
      if (dir) return createMockStats(0, new Date(), true);

      const error: any = new Error(`ENOENT: no such file or directory, stat '${path}'`);
      error.code = 'ENOENT';
      throw error;
    }),

    // V1 Pattern: Read directory for session discovery
    readdir: vi.fn().mockImplementation(async (path: string, options?: any) => {
      // Check if directory exists
      const dir = directories.get(path);

      // If directory doesn't exist, check if any files match the path prefix
      // This handles the case where we added files but not the directory
      if (!dir) {
        const matchingFiles: string[] = [];
        for (const [filePath] of files) {
          if (filePath.startsWith(path + '/')) {
            const fileName = filePath.substring((path + '/').length).split('/')[0];
            if (!matchingFiles.includes(fileName)) {
              matchingFiles.push(fileName);
            }
          }
        }

        if (matchingFiles.length > 0) {
          if (options?.withFileTypes) {
            return matchingFiles.map(name => ({
              name,
              isDirectory: () => directories.has(`${path}/${name}`),
              isFile: () => files.has(`${path}/${name}`),
              isSymbolicLink: () => false,
            }));
          }
          return matchingFiles;
        }

        // No directory and no matching files - throw error
        const error: any = new Error(`ENOENT: no such file or directory, scandir '${path}'`);
        error.code = 'ENOENT';
        throw error;
      }

      if (options?.withFileTypes) {
        return dir.map(name => ({
          name,
          isDirectory: () => directories.has(`${path}/${name}`),
          isFile: () => files.has(`${path}/${name}`),
          isSymbolicLink: () => false,
        }));
      }

      return dir;
    }),

    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),

    // Test helpers
    addFile: (path: string, content: string, size?: number) => {
      const stats = createMockStats(size ?? content.length, new Date(), false);
      files.set(path, { content, stats });

      // Auto-update parent directory to include this file
      const lastSlash = path.lastIndexOf('/');
      if (lastSlash > 0) {
        const parentDir = path.substring(0, lastSlash);
        const fileName = path.substring(lastSlash + 1);

        let dirContents = directories.get(parentDir);
        if (!dirContents) {
          dirContents = [];
          directories.set(parentDir, dirContents);
        }
        if (!dirContents.includes(fileName)) {
          dirContents.push(fileName);
        }
      }
    },

    addDirectory: (path: string, dirFiles: string[] = []) => {
      directories.set(path, dirFiles);
      // Also add files to the files map if they don't exist
      dirFiles.forEach(file => {
        const fullPath = `${path}/${file}`;
        if (!files.has(fullPath)) {
          const stats = createMockStats(100, new Date(), false);
          files.set(fullPath, { content: '', stats });
        }
      });
    },

    clear: () => {
      files.clear();
      directories.clear();
    },
  };

  return fs;
}

/**
 * Create mock fs.promises module
 *
 * Usage in tests:
 * ```typescript
 * vi.mock('fs/promises', () => createMockFsPromises());
 * ```
 */
export function createMockFsPromises() {
  return createMockFileSystem();
}

/**
 * Helper to create JSONL session file content
 *
 * V1 Pattern: Session files are newline-delimited JSON
 */
export function createSessionJSONL(sessionId: string = 'test-session', messageCount: number = 10): string {
  const lines: string[] = [];

  for (let i = 0; i < messageCount; i++) {
    const entry = {
      uuid: `msg-${i}`,
      sessionId,
      timestamp: new Date(Date.now() - (messageCount - i) * 60000).toISOString(),
      message: {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: [
          { type: 'text', text: `Message ${i} content` }
        ],
      },
    };
    lines.push(JSON.stringify(entry));
  }

  return lines.join('\n');
}
