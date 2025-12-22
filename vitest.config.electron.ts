/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';

/**
 * Vitest Configuration for Main Process (Electron) Tests
 *
 * CRITICAL: Uses Node.js environment, NOT jsdom/happy-dom
 * Main process tests require access to Node.js APIs (fs, child_process, etc.)
 *
 * V1 PATTERN CONTEXT:
 * - Main process has 0% coverage (5,253 lines)
 * - Uses better-sqlite3, chokidar, child_process, fs
 * - 30+ IPC handlers need testing
 * - Database operations, file watching, Go backend spawning
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // CRITICAL: Node.js environment for main process
    environment: 'node',

    // Main process test setup
    setupFiles: ['./test/unit/electron/setup.ts'],

    // Enable globals
    globals: true,

    // Include only main process tests
    include: [
      'test/unit/electron/**/*.test.{ts,js}',
    ],

    // Exclude renderer tests
    exclude: [
      'node_modules',
      'dist',
      'test/e2e/**',
      'test/integration/**', // Integration tests use separate config
      'test/components/**',
      'test/stores/**',
      'test/hooks/**',
    ],

    // Coverage for main process only
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/electron',
      include: [
        'src/electron/**/*.{js,ts}',
      ],
      exclude: [
        'src/electron/**/*.d.ts',
        'src/electron/preload.js', // Tested via integration tests
        'src/electron/directory-tree.js', // Utility, low priority
      ],
      // Progressive thresholds for main process
      thresholds: {
        statements: 0, // Start at 0, increase as tests are added
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },

    // Reporter configuration
    reporters: ['verbose'],

    // Timeout for database/file operations
    testTimeout: 10000,

    // Clean up between tests
    clearMocks: true,
    restoreMocks: true,
    resetMocks: true,

    // Pool configuration (single thread for deterministic tests)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Main process tests must run sequentially
      },
    },

    // Watch mode configuration
    watch: false,
  },
});
