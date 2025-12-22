/**
 * Playwright Global Setup for Electron E2E Tests
 *
 * This runs once before all tests to:
 * - Build the application if needed
 * - Set up test database
 * - Seed continuation chain test data
 * - Configure test environment
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { seedContinuationData } from './fixtures/seed-continuation-data';

async function globalSetup(): Promise<void> {
  console.log('Global setup: Preparing E2E test environment...');

  const projectRoot = path.resolve(__dirname, '../..');

  // Check if we need to build
  const distDir = path.join(projectRoot, 'dist');
  const shouldBuild = !fs.existsSync(distDir) || process.env.E2E_FORCE_BUILD;

  if (shouldBuild) {
    console.log('Building application for E2E tests...');
    try {
      execSync('npm run build', {
        cwd: projectRoot,
        stdio: 'inherit',
      });
    } catch (error) {
      console.error('Build failed:', error);
      throw error;
    }
  }

  // Create test data directory if it doesn't exist
  const testDataDir = path.join(projectRoot, 'test/e2e/fixtures');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Set up test environment variables
  // CRITICAL: E2E_TEST_MODE limits continuation detection to test project only
  // This ensures continuation tests can find seeded test data quickly
  process.env.E2E_TEST_MODE = 'true';
  process.env.E2E_PROJECT_ROOT = projectRoot;

  // Seed test database with continuation chain data
  console.log('Seeding continuation chain test data...');
  await seedContinuationData();

  console.log('Global setup complete.');
}

export default globalSetup;
