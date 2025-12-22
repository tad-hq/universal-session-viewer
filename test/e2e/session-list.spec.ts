/**
 * Session List E2E Tests
 *
 * V1 Pattern Context:
 * - Session list renders from database via IPC
 * - Pagination with 50 items per page (v1 line 815)
 * - Infinite scroll with IntersectionObserver (v1 lines 970-1030)
 * - Session cards show title, time ago, message count
 *
 * These tests validate the full flow from main process to UI.
 *
 * SEMANTIC SELECTORS: Tests use role-based queries to validate accessibility
 * and test how real users interact with the app.
 */

import { test, expect } from './fixtures/electron';

test.describe('Session List', () => {
  test('should display session list on app launch', async ({ window }) => {
    // SEMANTIC: Use <aside> element for sidebar
    await expect(window.locator('aside')).toBeVisible({
      timeout: 15000,
    });

    // SEMANTIC: Session list uses role="list" (WCAG 2.1 AA)
    const sessionList = window.getByRole('list', { name: /session list/i });
    await expect(sessionList).toBeVisible();
  });

  test('should show loading state initially', async ({ window }) => {
    // SEMANTIC: Loading indicators use role="status" or visible loading text
    const loadingByRole = window.getByRole('status');
    const loadingByText = window.getByText(/loading sessions/i);

    // Either loading is visible or sessions are already loaded
    const hasLoadingRole = await loadingByRole.first().isVisible().catch(() => false);
    const hasLoadingText = await loadingByText.isVisible().catch(() => false);

    // SEMANTIC: Session cards are buttons (WCAG 2.1 AA - keyboard accessible)
    const hasSessions = await window
      .getByRole('button')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasLoadingRole || hasLoadingText || hasSessions).toBe(true);
  });

  test('should display session cards with correct information', async ({ window }) => {
    // SEMANTIC: Wait for session list to be populated
    const sessionList = window.getByRole('list', { name: /session list/i });
    await expect(sessionList).toBeVisible({ timeout: 15000 });

    // SEMANTIC: Session cards are buttons within listitems with aria-label containing session info
    const sessionListItem = sessionList.getByRole('listitem').first();
    await expect(sessionListItem).toBeVisible();

    // Get the button within the first listitem
    const firstCard = sessionListItem.getByRole('button');
    await expect(firstCard).toBeVisible();

    // Session card should have accessible label with title and metadata
    const ariaLabel = await firstCard.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    // Should contain project path, time, and message count
    expect(ariaLabel).toMatch(/messages/i);
  });

  test('should select session on click', async ({ window }) => {
    // SEMANTIC: Wait for session list to be populated
    const sessionList = window.getByRole('list', { name: /session list/i });
    await expect(sessionList).toBeVisible({ timeout: 15000 });

    // Get the first session card button (within listitem)
    const firstListItem = sessionList.getByRole('listitem').first();
    const firstCard = firstListItem.getByRole('button');

    // Click the session card
    await firstCard.click();

    // SEMANTIC: Selected cards have aria-current="true" (WCAG 2.1 AA)
    await expect(firstCard).toHaveAttribute('aria-current', 'true');
  });

  test('should show session details in main content on selection', async ({ window }) => {
    // SEMANTIC: Wait for session list to be populated
    const sessionList = window.getByRole('list', { name: /session list/i });
    await expect(sessionList).toBeVisible({ timeout: 15000 });

    // Click the first session card button
    const firstListItem = sessionList.getByRole('listitem').first();
    await firstListItem.getByRole('button').click();

    // SEMANTIC: Main content uses <main> landmark with id="main-content"
    const mainContent = window.getByRole('main', { name: /session details/i });
    await expect(mainContent).toBeVisible();

    // Should show session content (headings, copy button, etc.)
    const hasHeading = await window
      .getByRole('heading')
      .first()
      .isVisible()
      .catch(() => false);

    // SEMANTIC: Copy Session ID button exists
    const hasCopyButton = await window
      .getByRole('button', { name: /copy/i })
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasHeading || hasCopyButton).toBe(true);
  });

  test('should handle empty state when no sessions', async ({ window }) => {
    // SEMANTIC: Check if session list has any listitems
    const sessionList = window.getByRole('list', { name: /session list/i });
    const sessionItems = await sessionList.getByRole('listitem').count();

    if (sessionItems === 0) {
      // Look for empty state by role and text content
      const emptyState = window.getByRole('status');
      const emptyText = window.getByText(/no sessions found/i);

      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      const hasEmptyText = await emptyText.isVisible().catch(() => false);

      expect(hasEmptyState || hasEmptyText).toBe(true);
    }
  });

  test('should support keyboard navigation between sessions', async ({ window }) => {
    // SEMANTIC: Wait for session list to be populated
    const sessionList = window.getByRole('list', { name: /session list/i });
    await expect(sessionList).toBeVisible({ timeout: 15000 });

    const sessionItems = sessionList.getByRole('listitem');
    const cardCount = await sessionItems.count();

    if (cardCount < 2) {
      test.skip();
      return;
    }

    // Focus on the first session button
    const firstCard = sessionItems.first().getByRole('button');
    await firstCard.click();

    // Press down arrow to move to next session
    await window.keyboard.press('ArrowDown');

    // Second card should now have aria-current="true"
    const secondCard = sessionItems.nth(1).getByRole('button');
    await expect(secondCard).toHaveAttribute('aria-current', 'true');
  });

  test('should maintain selection after refresh', async ({ window }) => {
    // SEMANTIC: Wait for session list to be populated
    const sessionList = window.getByRole('list', { name: /session list/i });
    await expect(sessionList).toBeVisible({ timeout: 15000 });

    // Select the first session
    const firstListItem = sessionList.getByRole('listitem').first();
    const firstCard = firstListItem.getByRole('button');
    await firstCard.click();

    // Verify it's selected
    await expect(firstCard).toHaveAttribute('aria-current', 'true');

    // SEMANTIC: Find refresh button in header by role and name
    const refreshButton = window.getByRole('button', { name: /refresh/i });

    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Wait a moment for refresh to start and complete
      // Instead of waiting for button text, wait for session list to stabilize
      await window.waitForTimeout(2000);

      // The first session card should still be selected
      const newFirstListItem = sessionList.getByRole('listitem').first();
      const newFirstCard = newFirstListItem.getByRole('button');
      await expect(newFirstCard).toHaveAttribute('aria-current', 'true');
    }
  });

  test('should load more sessions on scroll (infinite scroll)', async ({ window }) => {
    // SEMANTIC: Wait for session list to be populated
    const sessionList = window.getByRole('list', { name: /session list/i });
    await expect(sessionList).toBeVisible({ timeout: 15000 });

    const initialCount = await sessionList.getByRole('listitem').count();

    if (initialCount < 50) {
      // Not enough sessions to test pagination
      test.skip();
      return;
    }

    // SEMANTIC: Scroll the region with role="region" aria-label="Session list scroll area"
    const sessionListRegion = window.getByRole('region', {
      name: /session list scroll area/i,
    });

    // Scroll to the bottom to trigger infinite scroll
    await sessionListRegion.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // Wait for new sessions to load
    await window.waitForTimeout(1000);

    const newCount = await sessionList.getByRole('listitem').count();

    // Should have loaded more sessions
    expect(newCount).toBeGreaterThan(initialCount);
  });
});
