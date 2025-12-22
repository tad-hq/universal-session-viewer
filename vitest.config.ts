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
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/electron/**', // Main process tested separately
        'src/components/ui/**', // shadcn/ui components (external library)
        'src/components/layout/**', // Presentational layout components (covered by E2E)
        'src/components/settings/**', // Settings UI (covered by E2E)
        'src/components/session/EmptyStates.tsx', // Presentational (covered by E2E)
        'src/components/session/FilterBanner.tsx', // Presentational (covered by E2E)
        'src/components/session/MainContent.tsx', // Presentational (covered by E2E)
        'src/components/session/SearchResultsInfo.tsx', // Presentational (covered by E2E)
        'src/components/session/SelectionToolbar.tsx', // Presentational (covered by E2E)
        'src/components/session/SessionFilters.tsx', // Presentational (covered by E2E)
        'src/components/session/SessionResume.tsx', // Presentational (covered by E2E)
        'src/components/session/SessionSummary.tsx', // Presentational (covered by E2E)
        'src/components/session/Sidebar.tsx', // Presentational (covered by E2E)
        'src/components/index.ts', // Re-export barrel file
        'src/components/session/index.ts', // Re-export barrel file
        'src/hooks/index.ts', // Re-export barrel file
        'src/stores/index.ts', // Re-export barrel file
        'src/types/index.ts', // Re-export barrel file
        'src/types/errors.ts', // Type definitions only
        // Hooks that wrap IPC calls (tested via integration/E2E tests)
        'src/hooks/useIPC.ts', // IPC wrapper hook
        'src/hooks/useBulkOperationsEvents.ts', // IPC event listener
        'src/hooks/useContinuationEvents.ts', // IPC event listener
        'src/hooks/useMainProcessErrors.ts', // IPC event listener
        'src/hooks/useQuota.ts', // IPC wrapper
        'src/hooks/useSelection.ts', // Selection state (covered by E2E)
        'src/hooks/useSessionDetails.ts', // IPC wrapper
        'src/hooks/useSessions.ts', // IPC wrapper
        'src/hooks/useSettings.ts', // IPC wrapper
        'src/hooks/useToast.ts', // UI notification hook
        // Utils with minimal logic (presentational helpers)
        'src/utils/markdown.ts', // Markdown rendering helper
        // Stores that wrap IPC state (tested via integration/E2E)
        'src/stores/quotaStore.ts', // Quota state wrapper
        'src/stores/selectionStore.ts', // Selection state (covered by E2E)
      ],
      // Thresholds for CI enforcement
      // Note: Function coverage is lower due to React component structure
      // and async IPC patterns - many functions are event handlers
      thresholds: {
        statements: 55,
        branches: 55,
        functions: 45,
        lines: 55,
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
