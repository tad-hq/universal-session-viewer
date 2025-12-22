/**
 * Playwright Global Teardown for Electron E2E Tests
 *
 * This runs once after all tests to:
 * - Clean up test databases
 * - Remove temporary files
 * - Clean up seeded continuation data
 * - Reset environment
 */

import { cleanupContinuationData } from './fixtures/seed-continuation-data';

async function globalTeardown(): Promise<void> {
  console.log('Global teardown: Cleaning up E2E test environment...');

  // Clean up seeded continuation data
  await cleanupContinuationData();

  // Clean up environment variables
  delete process.env.E2E_TEST_MODE;
  delete process.env.E2E_PROJECT_ROOT;

  console.log('Global teardown complete.');
}

export default globalTeardown;
