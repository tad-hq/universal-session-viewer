/**
 * Electron Playwright Fixtures
 *
 * Provides test fixtures for launching and controlling the Electron app.
 *
 * V1 Pattern Context:
 * - Main process must wait for renderer-ready signal
 * - IPC channels must be properly initialized
 * - Database must be accessible
 *
 * Usage:
 *   test('my test', async ({ electronApp, window }) => {
 *     await window.click('button');
 *   });
 */

import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';

// Define custom fixtures
interface ElectronFixtures {
  electronApp: ElectronApplication;
  window: Page;
}

/**
 * Extended test with Electron fixtures
 */
export const test = base.extend<ElectronFixtures>({
  // Launch Electron app
  electronApp: async ({}, use) => {
    const projectRoot = process.env.E2E_PROJECT_ROOT || path.resolve(__dirname, '../..');

    // Launch Electron app
    const electronApp = await electron.launch({
      args: [path.join(projectRoot, 'src/electron/main.js')],
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST_MODE: 'true',
      },
    });

    // Wait for the app to be ready
    await electronApp.evaluate(async ({ app }) => {
      return app.isReady();
    });

    // Use the app in tests
    await use(electronApp);

    // CRITICAL CLEANUP: Ensure app closes within 10 seconds
    // V1 Pattern: main.js has file watchers, Go backend processes, database connections
    // All must be cleaned up to prevent worker timeout
    try {
      // Step 1: Close all windows first (triggers window-all-closed event)
      const windows = electronApp.windows();
      await Promise.all(windows.map(async (w) => {
        try {
          await w.close();
        } catch (error) {
          // Window already closed - ignore
        }
      }));

      // Step 2: Trigger before-quit cleanup in main process
      // This stops file watcher, kills child processes, closes database
      await electronApp.evaluate(({ app }) => {
        app.quit();
      });

      // Step 3: Wait for graceful shutdown (max 5 seconds)
      const closePromise = electronApp.close();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Cleanup timeout')), 5000)
      );

      await Promise.race([closePromise, timeoutPromise]);

    } catch (error) {
      console.error('Electron teardown error:', error);

      // Step 4: Force kill if graceful shutdown failed
      try {
        const pid = await electronApp.evaluate(({ app }) => process.pid);
        process.kill(pid, 'SIGKILL');
      } catch (killError) {
        console.error('Failed to force kill:', killError);
      }
    }
  },

  // Get the main window
  window: async ({ electronApp }, use) => {
    // Wait for the first window to open
    const window = await electronApp.firstWindow();

    // Wait for the window to fully load
    await window.waitForLoadState('domcontentloaded');

    // Optional: Wait for renderer-ready signal (V1 pattern)
    // This ensures IPC is fully initialized
    await window.waitForFunction(() => {
      return (window as any).electronAPI !== undefined;
    }, { timeout: 10000 }).catch(() => {
      // electronAPI might be on the window global
    });

    // Use the window in tests
    await use(window);
  },
});

export { expect } from '@playwright/test';

/**
 * Helper to evaluate code in the main process
 */
export async function evaluateInMain(
  electronApp: ElectronApplication,
  fn: (args: { app: Electron.App; BrowserWindow: typeof Electron.BrowserWindow }) => unknown
): Promise<unknown> {
  return electronApp.evaluate(fn);
}

/**
 * Helper to get the main window's webContents ID
 */
export async function getWebContentsId(electronApp: ElectronApplication): Promise<number> {
  return electronApp.evaluate(async ({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) {
      throw new Error('No windows found');
    }
    return windows[0].webContents.id;
  });
}

/**
 * Helper to send IPC message from main process
 */
export async function sendIPCToRenderer(
  electronApp: ElectronApplication,
  channel: string,
  data: unknown
): Promise<void> {
  await electronApp.evaluate(
    async ({ BrowserWindow }, { channel, data }) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
      }
    },
    { channel, data }
  );
}

/**
 * Helper to wait for specific IPC response
 */
export async function waitForIPC(
  window: Page,
  channel: string,
  timeout = 5000
): Promise<unknown> {
  return window.evaluate(
    async ({ channel, timeout }) => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Timeout waiting for IPC channel: ${channel}`));
        }, timeout);

        // This would need to be adapted based on how the app exposes IPC
        // For now, this is a placeholder pattern
        const handler = (_event: unknown, data: unknown) => {
          clearTimeout(timeoutId);
          resolve(data);
        };

        // Add listener (implementation depends on app structure)
        (window as any).electronAPI?.[`on${channel}`]?.(handler);
      });
    },
    { channel, timeout }
  );
}
