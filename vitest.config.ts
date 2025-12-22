/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest Configuration for Universal Session Viewer v2
 *
 * V1 Pattern Context:
 * - Tests must mock window.electronAPI (the preload bridge)
 * - Renderer process runs in isolated context (contextIsolation: true)
 * - All IPC communication goes through the 18-channel whitelist
 *
 * Configuration:
 * - Uses happy-dom for fast DOM simulation
 * - Configures path aliases to match tsconfig
 * - Sets up global test utilities
 * - Enables coverage reporting
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Use happy-dom for fast, lightweight DOM simulation
    // Better performance than jsdom for Electron renderer testing
    environment: 'happy-dom',

    // Global test setup - mocks electronAPI, cleanup, etc.
    setupFiles: ['./test/setup.ts'],

    // Enable globals (describe, it, expect) without imports
    globals: true,

    // Include patterns for test files
    include: [
      'test/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
    ],

    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      'test/e2e/**', // E2E tests run separately with Playwright
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/electron/**', // Main process tested separately
        'src/components/ui/**', // shadcn/ui components
      ],
      // Thresholds for CI enforcement
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },

    // Reporter configuration
    // Default to verbose, CI uses --reporter flag to add JSON output
    reporters: ['verbose'],

    // Output file for CI JSON reporter (overridden by CLI --outputFile flag)
    outputFile: {
      json: './test-results/vitest-results.json',
    },

    // Timeout for async tests
    testTimeout: 10000,

    // Mock timers configuration for debounce tests
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    },

    // Type checking
    typecheck: {
      enabled: false, // Run separately with tsc for better performance
    },

    // Watch mode configuration
    watch: false,

    // Pool configuration for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
});
