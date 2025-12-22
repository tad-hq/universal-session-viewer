/**
 * Prompt File Validation Test Suite
 *
 * Tests validatePromptFile() function for security and robustness
 * Covers: path traversal, file type validation, permissions, size limits, content validation
 *
 * TEST STRATEGY (TDD):
 * - Write tests first before implementation
 * - Test all 7 validation checks from plan
 * - Cover both success and failure cases
 * - Verify AppError codes and messages
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import error handling infrastructure
import { AppError, ErrorCode } from '../../../src/electron/error-handler.js';

/**
 * Import validatePromptFile from main.js
 * Note: This will fail initially (TDD approach) until we implement the function
 */
let validatePromptFile;

// Setup temp directory for test files
let tempDir;
let promptsDir;

beforeEach(async () => {
  // Create temp directory structure
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-validation-test-'));
  promptsDir = path.join(tempDir, 'prompts');
  fs.mkdirSync(promptsDir);

  // Dynamically import validatePromptFile
  // Note: main.js uses CommonJS, so we need createRequire
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);

    // Clear cache to get fresh import
    const mainPath = require.resolve('../../../src/electron/main.js');
    delete require.cache[mainPath];

    const mainModule = require('../../../src/electron/main.js');
    validatePromptFile = mainModule.validatePromptFile;
  } catch (error) {
    // Function might not exist yet (TDD approach)
    console.error('Error importing validatePromptFile:', error);
    validatePromptFile = null;
  }
});

afterEach(() => {
  // Cleanup temp files
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('validatePromptFile', () => {
  it('should be defined', () => {
    expect(validatePromptFile).toBeDefined();
    expect(typeof validatePromptFile).toBe('function');
  });

  // =========================================================================
  // TEST 1: Valid file returns content
  // =========================================================================
  describe('valid file handling', () => {
    it('should return content for valid prompt file', () => {
      const promptPath = path.join(promptsDir, 'valid-prompt.txt');
      const expectedContent = 'Use concise responses only.\nBe professional.';

      fs.writeFileSync(promptPath, expectedContent, 'utf8');

      const result = validatePromptFile(promptPath, promptsDir);

      expect(result).toBe(expectedContent);
    });

    it('should handle Unicode content correctly', () => {
      const promptPath = path.join(promptsDir, 'unicode-prompt.txt');
      const expectedContent = '使用简洁的回复。Be concise. 😀';

      fs.writeFileSync(promptPath, expectedContent, 'utf8');

      const result = validatePromptFile(promptPath, promptsDir);

      expect(result).toBe(expectedContent);
    });
  });

  // =========================================================================
  // TEST 2: Nonexistent file throws PROMPT_FILE_NOT_FOUND
  // =========================================================================
  describe('nonexistent file handling', () => {
    it('should throw PROMPT_FILE_NOT_FOUND for missing file', () => {
      const nonexistentPath = path.join(promptsDir, 'does-not-exist.txt');

      expect(() => {
        validatePromptFile(nonexistentPath, promptsDir);
      }).toThrow();

      try {
        validatePromptFile(nonexistentPath, promptsDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ErrorCode.PROMPT_FILE_NOT_FOUND);
        expect(error.message).toContain(nonexistentPath);
        expect(error.details.promptPath).toBe(nonexistentPath);
      }
    });
  });

  // =========================================================================
  // TEST 3: Empty file throws PROMPT_FILE_EMPTY
  // =========================================================================
  describe('empty file handling', () => {
    it('should throw PROMPT_FILE_EMPTY for completely empty file', () => {
      const emptyPath = path.join(promptsDir, 'empty.txt');
      fs.writeFileSync(emptyPath, '', 'utf8');

      expect(() => {
        validatePromptFile(emptyPath, promptsDir);
      }).toThrow();

      try {
        validatePromptFile(emptyPath, promptsDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ErrorCode.PROMPT_FILE_EMPTY);
        expect(error.message).toContain('empty');
        expect(error.details.promptPath).toBe(emptyPath);
      }
    });

    it('should throw PROMPT_FILE_EMPTY for whitespace-only file', () => {
      const whitespacePath = path.join(promptsDir, 'whitespace.txt');
      fs.writeFileSync(whitespacePath, '   \n\t  \r\n  ', 'utf8');

      expect(() => {
        validatePromptFile(whitespacePath, promptsDir);
      }).toThrow();

      try {
        validatePromptFile(whitespacePath, promptsDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ErrorCode.PROMPT_FILE_EMPTY);
      }
    });
  });

  // =========================================================================
  // TEST 4: Path traversal blocked
  // =========================================================================
  describe('path traversal prevention', () => {
    it('should block path traversal with ../../', () => {
      const maliciousPath = path.join(promptsDir, '..', '..', 'etc', 'passwd');

      expect(() => {
        validatePromptFile(maliciousPath, promptsDir);
      }).toThrow();

      try {
        validatePromptFile(maliciousPath, promptsDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ErrorCode.PROMPT_FILE_PATH_TRAVERSAL);
        expect(error.message).toContain('outside allowed directory');
        expect(error.details.promptPath).toBeDefined();
        expect(error.details.promptsDir).toBe(promptsDir);
      }
    });

    it('should block absolute path outside prompts directory', () => {
      const maliciousPath = '/etc/passwd';

      expect(() => {
        validatePromptFile(maliciousPath, promptsDir);
      }).toThrow();

      try {
        validatePromptFile(maliciousPath, promptsDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ErrorCode.PROMPT_FILE_PATH_TRAVERSAL);
      }
    });

    it('should normalize paths before comparison', () => {
      // Create file with valid path
      const validPath = path.join(promptsDir, 'valid.txt');
      fs.writeFileSync(validPath, 'Valid content', 'utf8');

      // Try to access same file with path containing ./
      const normalizedPath = path.join(promptsDir, '.', 'valid.txt');

      // Should succeed - same file, just normalized differently
      const result = validatePromptFile(normalizedPath, promptsDir);
      expect(result).toBe('Valid content');
    });
  });

  // =========================================================================
  // TEST 5: Symlink rejected with PROMPT_FILE_INVALID
  // =========================================================================
  describe('symlink rejection', () => {
    it('should reject symlinks to files', () => {
      // Skip on Windows (symlink creation requires admin)
      if (process.platform === 'win32') {
        return;
      }

      // Create target file outside prompts directory
      const targetPath = path.join(tempDir, 'external-file.txt');
      fs.writeFileSync(targetPath, 'External content', 'utf8');

      // Create symlink inside prompts directory
      const symlinkPath = path.join(promptsDir, 'symlink.txt');
      fs.symlinkSync(targetPath, symlinkPath);

      expect(() => {
        validatePromptFile(symlinkPath, promptsDir);
      }).toThrow();

      try {
        validatePromptFile(symlinkPath, promptsDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ErrorCode.PROMPT_FILE_INVALID);
        expect(error.message).toContain('not a regular file');
      }
    });

    it('should reject directory paths', () => {
      const dirPath = path.join(promptsDir, 'subdir');
      fs.mkdirSync(dirPath);

      expect(() => {
        validatePromptFile(dirPath, promptsDir);
      }).toThrow();

      try {
        validatePromptFile(dirPath, promptsDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ErrorCode.PROMPT_FILE_INVALID);
        expect(error.message).toContain('not a regular file');
        expect(error.details.type).toBe('directory');
      }
    });
  });

  // =========================================================================
  // TEST 6: No read permission throws PROMPT_FILE_UNREADABLE
  // =========================================================================
  describe('permission validation', () => {
    it('should throw PROMPT_FILE_UNREADABLE for unreadable file', () => {
      // Skip on Windows (chmod behaves differently)
      if (process.platform === 'win32') {
        return;
      }

      const unreadablePath = path.join(promptsDir, 'unreadable.txt');
      fs.writeFileSync(unreadablePath, 'Secret content', 'utf8');
      fs.chmodSync(unreadablePath, 0o000); // Remove all permissions

      expect(() => {
        validatePromptFile(unreadablePath, promptsDir);
      }).toThrow();

      try {
        validatePromptFile(unreadablePath, promptsDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ErrorCode.PROMPT_FILE_UNREADABLE);
        expect(error.message).toContain('permission');
        expect(error.details.promptPath).toBe(unreadablePath);
      } finally {
        // Restore permissions for cleanup
        try {
          fs.chmodSync(unreadablePath, 0o644);
        } catch (e) {
          // Ignore
        }
      }
    });
  });

  // =========================================================================
  // TEST 7: File too large throws PROMPT_FILE_INVALID
  // =========================================================================
  describe('size validation', () => {
    it('should reject files larger than 10MB', () => {
      const hugePath = path.join(promptsDir, 'huge.txt');

      // Create 11MB file (10MB limit + 1MB)
      const bufferSize = 11 * 1024 * 1024;
      const hugeContent = 'A'.repeat(bufferSize);
      fs.writeFileSync(hugePath, hugeContent, 'utf8');

      expect(() => {
        validatePromptFile(hugePath, promptsDir);
      }).toThrow();

      try {
        validatePromptFile(hugePath, promptsDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ErrorCode.PROMPT_FILE_INVALID);
        expect(error.message).toContain('too large');
        expect(error.message).toContain('MB');
        expect(error.details.size).toBeGreaterThan(10 * 1024 * 1024);
      }
    });

    it('should accept files exactly at 10MB limit', () => {
      const maxSizePath = path.join(promptsDir, 'max-size.txt');

      // Create exactly 10MB file
      const bufferSize = 10 * 1024 * 1024;
      const content = 'A'.repeat(bufferSize);
      fs.writeFileSync(maxSizePath, content, 'utf8');

      // Should succeed (at limit, not over)
      const result = validatePromptFile(maxSizePath, promptsDir);
      expect(result).toBe(content);
    });

    it('should accept small files', () => {
      const smallPath = path.join(promptsDir, 'small.txt');
      const smallContent = 'Small prompt file content.';
      fs.writeFileSync(smallPath, smallContent, 'utf8');

      const result = validatePromptFile(smallPath, promptsDir);
      expect(result).toBe(smallContent);
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================
  describe('edge cases', () => {
    it('should handle files with special characters in name', () => {
      const specialPath = path.join(promptsDir, 'special (name) [test].txt');
      const content = 'Content with special filename';
      fs.writeFileSync(specialPath, content, 'utf8');

      const result = validatePromptFile(specialPath, promptsDir);
      expect(result).toBe(content);
    });

    it('should handle files with newlines in content', () => {
      const newlinePath = path.join(promptsDir, 'newlines.txt');
      const content = 'Line 1\nLine 2\r\nLine 3\n\nLine 5';
      fs.writeFileSync(newlinePath, content, 'utf8');

      const result = validatePromptFile(newlinePath, promptsDir);
      expect(result).toBe(content);
    });

    it('should preserve leading and trailing whitespace in valid content', () => {
      const whitespacePath = path.join(promptsDir, 'whitespace-edges.txt');
      const content = '  Leading and trailing spaces  ';
      fs.writeFileSync(whitespacePath, content, 'utf8');

      const result = validatePromptFile(whitespacePath, promptsDir);
      expect(result).toBe(content);
    });
  });
});
