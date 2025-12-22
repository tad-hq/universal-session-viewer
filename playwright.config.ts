/**
 * Playwright Configuration for Electron E2E Tests
 *
 * V1 Pattern Context:
 * - Tests the full Electron application (main + renderer)
 * - Validates IPC communication works correctly
 * - Tests real database interactions
 * - Tests file watching behavior
 *
 * Setup:
 * - Uses electron-playwright for Electron app testing
 * - Configures test fixtures for app launch
 * - Sets up screenshot/video capture for debugging
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './test/e2e',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Maximum time one test can run (90s to accommodate slower Electron startup)
  timeout: 90000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Run tests in files in parallel
  fullyParallel: false, // Electron tests should run sequentially

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit workers for Electron tests (critical: prevents resource conflicts)
  workers: 1,

  // Global timeout for entire test run
  globalTimeout: process.env.CI ? 600000 : 300000, // 10min CI, 5min local

  // Reporter to use
  // CI mode: JSON + HTML + GitHub annotations
  // Local mode: list + HTML
  reporter: process.env.CI
    ? [
        ['json', { outputFile: 'test-results/playwright-results.json' }],
        ['html', { outputFolder: 'playwright-report' }],
        ['github'],
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report' }],
      ],

  // Shared settings for all projects
  use: {
    // Base URL - not used for Electron but required
    baseURL: 'http://localhost:5173',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on first retry
    video: 'on-first-retry',

    // Timeout for actions
    actionTimeout: 10000,

    // Timeout for navigation
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts',
      use: {
        // Electron-specific configuration is handled in fixtures
      },
    },
  ],

  // Global setup for Electron
  globalSetup: path.join(__dirname, 'test/e2e/global-setup.ts'),

  // Global teardown
  globalTeardown: path.join(__dirname, 'test/e2e/global-teardown.ts'),

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Preserve output on failure
  preserveOutput: 'failures-only',
});
