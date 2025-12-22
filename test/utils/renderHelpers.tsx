/**
 * Test rendering helpers for React components
 *
 * V1 Pattern Context:
 * - Components use Zustand stores for state
 * - IPC communication via window.electronAPI
 * - No context providers needed (stores are singletons)
 *
 * These helpers simplify component testing by:
 * - Providing store initialization utilities
 * - Wrapping components with necessary context
 * - Re-exporting @testing-library/react utilities
 */

import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { type ReactElement } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import type { Session } from '@/types/session';

/**
 * Custom render options with store initialization
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Initial sessions to populate sessionStore
   */
  initialSessions?: Session[];
  /**
   * Additional store initialization (for other stores)
   */
  initializeStores?: () => void;
}

/**
 * Custom render function with store initialization
 *
 * V1 Pattern: Stores are global singletons, reset in beforeEach
 *
 * @example
 * ```typescript
 * const { getByText } = render(<SessionList />, {
 *   initialSessions: [createMockSession()],
 * });
 * ```
 */
export function render(
  ui: ReactElement,
  options?: CustomRenderOptions
): ReturnType<typeof rtlRender> {
  const { initialSessions, initializeStores, ...renderOptions } = options || {};

  // Initialize sessionStore if initial sessions provided
  if (initialSessions) {
    useSessionStore.setState({
      sessions: initialSessions,
      isLoading: false,
      hasMore: false,
      error: null,
    });
  }

  // Allow custom store initialization
  if (initializeStores) {
    initializeStores();
  }

  // No wrapper needed - stores are global singletons
  return rtlRender(ui, renderOptions);
}

/**
 * Render with loading state
 *
 * V1 Pattern: Components show loading indicators during IPC calls
 *
 * @example
 * ```typescript
 * const { getByTestId } = renderWithLoading(<SessionList />);
 * expect(getByTestId('loading-spinner')).toBeInTheDocument();
 * ```
 */
export function renderWithLoading(ui: ReactElement): ReturnType<typeof rtlRender> {
  useSessionStore.setState({
    isLoading: true,
    sessions: [],
    hasMore: false,
    error: null,
  });

  return rtlRender(ui);
}

/**
 * Render with error state
 *
 * V1 Pattern: Components show error messages when IPC fails
 *
 * @example
 * ```typescript
 * const { getByText } = renderWithError(<SessionList />, 'Database connection failed');
 * expect(getByText(/database connection failed/i)).toBeInTheDocument();
 * ```
 */
export function renderWithError(
  ui: ReactElement,
  error: string = 'Test error'
): ReturnType<typeof rtlRender> {
  useSessionStore.setState({
    error,
    isLoading: false,
    sessions: [],
    hasMore: false,
  });

  return rtlRender(ui);
}

/**
 * Render with empty state
 *
 * V1 Pattern: Components show empty state messages when no data
 *
 * @example
 * ```typescript
 * const { getByText } = renderWithEmptyState(<SessionList />);
 * expect(getByText(/no sessions found/i)).toBeInTheDocument();
 * ```
 */
export function renderWithEmptyState(ui: ReactElement): ReturnType<typeof rtlRender> {
  useSessionStore.setState({
    sessions: [],
    isLoading: false,
    hasMore: false,
    error: null,
  });

  return rtlRender(ui);
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
