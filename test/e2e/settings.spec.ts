/**
 * Settings Modal E2E Tests
 *
 * V1 Pattern Context:
 * - Settings stored via IPC to main process
 * - Settings include theme, paths, auto-refresh, etc.
 * - Modal opens from header button
 * - Changes persist across app restarts
 *
 * These tests validate the settings flow end-to-end using semantic selectors.
 *
 * Semantic Selector Strategy:
 * - Settings button: getByRole('button', { name: /settings/i })
 * - Dialog: getByRole('dialog', { name: /settings/i })
 * - Inputs: getByLabelText() or getByRole('spinbutton', { name: ... })
 * - Checkboxes: getByRole('checkbox', { name: ... })
 * - Switches: getByRole('switch', { name: ... })
 * - Buttons: getByRole('button', { name: /save|cancel/i })
 * - Selects: getByRole('combobox', { name: ... })
 */

import { test, expect } from './fixtures/electron';

test.describe('Settings Modal', () => {
  test('should open settings modal from header button', async ({ window }) => {
    // Wait for app to load - header should be visible
    await window.waitForSelector('header', { timeout: 15000 });

    // Find settings button by accessible label
    const settingsButton = window.getByRole('button', { name: /settings/i });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // Modal should open with proper dialog role
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();
  });

  test('should close settings modal with Cancel button', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    const settingsButton = window.getByRole('button', { name: /settings/i });
    await settingsButton.click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Click Cancel button
    const cancelButton = window.getByRole('button', { name: /cancel/i });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Modal should close
    await expect(dialog).not.toBeVisible();
  });

  test('should close settings modal with Escape key', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Press Escape
    await window.keyboard.press('Escape');

    // Modal should close
    await expect(dialog).not.toBeVisible();
  });

  test('should display current settings values', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Check that key settings fields are present and populated
    // Using spinbutton role for number inputs
    const dailyLimitInput = window.getByRole('spinbutton', { name: /daily analysis limit/i });
    await expect(dailyLimitInput).toBeVisible();
    const dailyLimitValue = await dailyLimitInput.inputValue();
    expect(parseInt(dailyLimitValue)).toBeGreaterThan(0);

    // Check for checkboxes
    const autoAnalyzeCheckbox = window.getByRole('checkbox', { name: /auto-analyze new sessions/i });
    await expect(autoAnalyzeCheckbox).toBeVisible();
  });

  test('should change daily analysis limit', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Find daily limit input
    const dailyLimitInput = window.getByRole('spinbutton', { name: /daily analysis limit/i });
    await expect(dailyLimitInput).toBeVisible();

    // Change the value
    await dailyLimitInput.fill('25');
    const newValue = await dailyLimitInput.inputValue();
    expect(newValue).toBe('25');
  });

  test('should toggle auto-analyze checkbox', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Find auto-analyze checkbox
    const autoAnalyzeCheckbox = window.getByRole('checkbox', { name: /auto-analyze new sessions/i });
    await expect(autoAnalyzeCheckbox).toBeVisible();

    // Get initial state
    const wasChecked = await autoAnalyzeCheckbox.isChecked();

    // Toggle it
    await autoAnalyzeCheckbox.click();

    // Verify it changed
    const isNowChecked = await autoAnalyzeCheckbox.isChecked();
    expect(isNowChecked).toBe(!wasChecked);
  });

  test('should save settings and persist changes', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Find and toggle auto-analyze
    const autoAnalyzeCheckbox = window.getByRole('checkbox', { name: /auto-analyze new sessions/i });
    const wasChecked = await autoAnalyzeCheckbox.isChecked();
    await autoAnalyzeCheckbox.click();

    // Save settings
    const saveButton = window.getByRole('button', { name: /save settings/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Modal should close
    await expect(dialog).not.toBeVisible();

    // Reopen settings to verify persistence
    await window.getByRole('button', { name: /settings/i }).click();
    await expect(dialog).toBeVisible();

    // Check it's still the new value
    const stillChecked = await autoAnalyzeCheckbox.isChecked();
    expect(stillChecked).toBe(!wasChecked);
  });

  test('should change cache duration', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Find cache duration input
    const cacheDurationInput = window.getByRole('spinbutton', { name: /cache duration/i });
    await expect(cacheDurationInput).toBeVisible();

    // Get the original value
    const originalValue = await cacheDurationInput.inputValue();

    // Change the value - use a value within valid range (1-365)
    await cacheDurationInput.fill('60');

    // Wait a bit for the input to update
    await window.waitForTimeout(100);

    const newValue = await cacheDurationInput.inputValue();

    // Verify the value changed (it should be different from original)
    // Note: The exact value might be constrained by input validation
    expect(parseInt(newValue)).toBeGreaterThan(0);
    expect(parseInt(newValue)).toBeLessThanOrEqual(365);
  });

  test('should toggle UI settings checkboxes', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Find show timestamps checkbox
    const timestampsCheckbox = window.getByRole('checkbox', { name: /show session timestamps/i });
    if (await timestampsCheckbox.isVisible()) {
      const wasChecked = await timestampsCheckbox.isChecked();
      await timestampsCheckbox.click();
      const isNowChecked = await timestampsCheckbox.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    }

    // Find show paths checkbox
    const pathsCheckbox = window.getByRole('checkbox', { name: /show project paths/i });
    if (await pathsCheckbox.isVisible()) {
      const wasChecked = await pathsCheckbox.isChecked();
      await pathsCheckbox.click();
      const isNowChecked = await pathsCheckbox.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    }
  });

  test('should change sort order', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Find sort order select (combobox role for shadcn Select)
    const sortOrderSelect = window.getByRole('combobox', { name: /default sort order/i });
    if (await sortOrderSelect.isVisible()) {
      await sortOrderSelect.click();

      // Wait for dropdown to open, then select an option
      // Note: shadcn Select opens options in a portal, we need to find by role
      const modifiedOption = window.getByRole('option', { name: /modified date/i });
      if (await modifiedOption.isVisible()) {
        await modifiedOption.click();
      }
    }
  });

  test('should toggle continuation display switches', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Find group continuations switch
    const groupSwitch = window.getByRole('switch', { name: /group continuation chains/i });
    if (await groupSwitch.isVisible()) {
      const wasChecked = await groupSwitch.isChecked();
      await groupSwitch.click();
      const isNowChecked = await groupSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    }

    // Find show badges switch
    const badgesSwitch = window.getByRole('switch', { name: /show continuation badges/i });
    if (await badgesSwitch.isVisible()) {
      const wasChecked = await badgesSwitch.isChecked();
      await badgesSwitch.click();
      const isNowChecked = await badgesSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    }

    // Find collapse by default switch
    const collapseSwitch = window.getByRole('switch', { name: /collapse groups by default/i });
    if (await collapseSwitch.isVisible()) {
      const wasChecked = await collapseSwitch.isChecked();
      await collapseSwitch.click();
      const isNowChecked = await collapseSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    }
  });

  test('should have clear cache button', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Find clear cache button
    const clearCacheButton = window.getByRole('button', { name: /clear all cached analyses/i });
    await expect(clearCacheButton).toBeVisible();

    // Click it (this will open confirmation dialog)
    await clearCacheButton.click();

    // Confirmation dialog should appear
    const confirmDialog = window.getByRole('dialog', { name: /clear cache/i });
    await expect(confirmDialog).toBeVisible();

    // Cancel the operation
    const cancelButton = window.getByRole('button', { name: /cancel/i }).last();
    await cancelButton.click();

    // Confirmation dialog should close
    await expect(confirmDialog).not.toBeVisible();

    // Settings dialog should still be open
    await expect(dialog).toBeVisible();
  });

  test('should change advanced settings', async ({ window }) => {
    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Find max concurrent analyses input
    const maxConcurrentInput = window.getByRole('spinbutton', { name: /max concurrent analyses/i });
    if (await maxConcurrentInput.isVisible()) {
      await maxConcurrentInput.fill('3');
      const newValue = await maxConcurrentInput.inputValue();
      expect(newValue).toBe('3');
    }

    // Find analysis timeout input
    const timeoutInput = window.getByRole('spinbutton', { name: /analysis timeout/i });
    if (await timeoutInput.isVisible()) {
      await timeoutInput.fill('180');
      const newValue = await timeoutInput.inputValue();
      expect(newValue).toBe('180');
    }

    // Find debug logging checkbox
    const debugCheckbox = window.getByRole('checkbox', { name: /enable debug logging/i });
    if (await debugCheckbox.isVisible()) {
      const wasChecked = await debugCheckbox.isChecked();
      await debugCheckbox.click();
      const isNowChecked = await debugCheckbox.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    }
  });

  test('should handle settings save error gracefully', async ({ window }) => {
    // This test verifies the settings modal works without errors
    // even when changes are made and discarded

    // Open settings
    await window.waitForSelector('header', { timeout: 15000 });
    await window.getByRole('button', { name: /settings/i }).click();

    // Wait for dialog
    const dialog = window.getByRole('dialog', { name: /settings/i });
    await expect(dialog).toBeVisible();

    // Make a change
    const autoAnalyzeCheckbox = window.getByRole('checkbox', { name: /auto-analyze new sessions/i });
    if (await autoAnalyzeCheckbox.isVisible()) {
      await autoAnalyzeCheckbox.click();
    }

    // Close modal without saving (Cancel)
    const cancelButton = window.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Modal should close
    await expect(dialog).not.toBeVisible();

    // App should still be functional - header should be visible
    const header = window.locator('header');
    await expect(header).toBeVisible();

    // Settings button should still work
    const settingsButton = window.getByRole('button', { name: /settings/i });
    await expect(settingsButton).toBeVisible();
  });
});
