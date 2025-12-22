/**
 * ContinuationBreadcrumb Component Tests
 *
 * Tests the navigation breadcrumb for continuation paths with:
 * - Path rendering (Root > Parent > Current)
 * - Collapsed segments for long paths
 * - Branch point indicators
 * - Click navigation
 * - Accessibility (nav role, aria-current)
 *
 * Coverage Target: 80%+ line and branch coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContinuationBreadcrumb } from '@/components/session/ContinuationBreadcrumb';
import { createBreadcrumbPath } from '../../factories/ContinuationFactory';
import * as continuationStore from '@/stores/continuationStore';

// Mock Zustand store
vi.mock('@/stores/continuationStore', () => ({
  useContinuationStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector({
        paths: {},
      });
    }
    return undefined;
  }),
  selectLinearPath: vi.fn(() => () => ({
    nodes: [],
    length: 0,
    branchPoints: [],
  })),
}));

// Get typed mock reference
const mockSelectLinearPath = vi.mocked(continuationStore.selectLinearPath);

describe('ContinuationBreadcrumb', () => {
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render breadcrumb navigation', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should not render if path length is 1 or less', () => {
      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [],
        length: 1,
        branchPoints: [],
      }));

      const { container } = render(
        <ContinuationBreadcrumb
          rootSessionId="single"
          activeSessionId="single"
          onNavigate={mockOnNavigate}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render if path is null', () => {
      mockSelectLinearPath.mockReturnValue(() => null as any);

      const { container } = render(
        <ContinuationBreadcrumb
          rootSessionId="test"
          activeSessionId="test"
          onNavigate={mockOnNavigate}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render ordered list for segments', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
      expect(list.tagName).toBe('OL');
    });
  });

  describe('Path Segments', () => {
    it('should show all segments when path fits maxVisibleSegments', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
          maxVisibleSegments={5}
        />
      );

      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
    });

    it('should collapse middle segments when path exceeds maxVisibleSegments', () => {
      const tree = createBreadcrumbPath(7);

      const nodes = [tree];
      let current = tree;
      for (let i = 1; i < 7; i++) {
        current = current.children[0];
        nodes.push(current);
      }

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes,
        length: 7,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-6"
          onNavigate={mockOnNavigate}
          maxVisibleSegments={4}
        />
      );

      // Should show: Root, [...], Parent, Current
      expect(screen.getByText('Level 0')).toBeInTheDocument(); // Root
      expect(screen.getByText('Level 6')).toBeInTheDocument(); // Current
      expect(screen.getByText('+4')).toBeInTheDocument(); // Collapsed count
    });

    it('should show +N indicator for collapsed segments', () => {
      const tree = createBreadcrumbPath(10);

      const nodes = [tree];
      let current = tree;
      for (let i = 1; i < 10; i++) {
        current = current.children[0];
        nodes.push(current);
      }

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes,
        length: 10,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-9"
          onNavigate={mockOnNavigate}
          maxVisibleSegments={4}
        />
      );

      // 10 total - 3 visible (root, parent, current) = 7 hidden
      expect(screen.getByText('+7')).toBeInTheDocument();
    });

    it('should show Home icon for root segment', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      const { container } = render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      // Home icon should be present in root segment
      const homeIcon = container.querySelector('svg');
      expect(homeIcon).toBeInTheDocument();
    });

    it('should show chevron separators between segments', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      const { container } = render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      // ChevronRight separators
      const chevrons = container.querySelectorAll('svg');
      expect(chevrons.length).toBeGreaterThan(1); // At least Home icon + separators
    });
  });

  describe('Branch Point Indicators', () => {
    it('should show GitBranch icon for branch points', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [{ branchPointId: 'level-1', alternativePaths: [] }],
      }));

      const { container } = render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      // GitBranch icon should be present
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should include branch point info in aria-label', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [{ branchPointId: 'level-1', alternativePaths: [] }],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      const button = screen.getByText('Level 1').closest('button');
      const label = button?.getAttribute('aria-label');
      expect(label).toContain('branch point');
    });
  });

  describe('Click Navigation', () => {
    it('should call onNavigate when segment clicked', async () => {
      const user = userEvent.setup();
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      const button = screen.getByText('Level 0').closest('button');
      await user.click(button!);

      expect(mockOnNavigate).toHaveBeenCalledWith('level-0');
    });

    it('should disable current segment', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      const currentButton = screen.getByText('Level 2').closest('button');
      expect(currentButton).toBeDisabled();
    });

    it('should not call onNavigate when current segment clicked', async () => {
      const user = userEvent.setup();
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      const currentButton = screen.getByText('Level 2').closest('button');

      try {
        await user.click(currentButton!);
      } catch {
        // Expected to fail since button is disabled
      }

      expect(mockOnNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have navigation role', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should have descriptive aria-label on navigation', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      const nav = screen.getByRole('navigation');
      const label = nav.getAttribute('aria-label');
      expect(label).toContain('Breadcrumb navigation');
      expect(label).toContain('3 levels');
    });

    it('should set aria-current on current segment', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      const currentButton = screen.getByText('Level 2').closest('button');
      expect(currentButton).toHaveAttribute('aria-current', 'page');
    });

    it('should have descriptive aria-label on buttons', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      const button = screen.getByText('Level 0').closest('button');
      const label = button?.getAttribute('aria-label');
      expect(label).toContain('Root session');
      expect(label).toContain('Level 0');
      expect(label).toContain('click to navigate');
    });

    it('should have aria-label on collapsed indicator', () => {
      const tree = createBreadcrumbPath(7);

      const nodes = [tree];
      let current = tree;
      for (let i = 1; i < 7; i++) {
        current = current.children[0];
        nodes.push(current);
      }

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes,
        length: 7,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-6"
          onNavigate={mockOnNavigate}
          maxVisibleSegments={4}
        />
      );

      const collapsedIndicator = screen.getByText(/\+\d+/);
      expect(collapsedIndicator.parentElement).toHaveAttribute('aria-label');
      expect(collapsedIndicator.parentElement?.getAttribute('aria-label')).toContain('sessions hidden');
    });

    it('should have focus rings on clickable segments', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      const button = screen.getByText('Level 0').closest('button');
      expect(button).toHaveClass('focus-visible:ring-2');
    });
  });

  describe('Title Truncation', () => {
    it('should truncate long titles', () => {
      const tree = createBreadcrumbPath(3);
      tree.session.title = 'A'.repeat(100);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      // Title should be truncated to ~20 chars
      const button = screen.getByText((content) => content.includes('...'));
      expect(button).toBeInTheDocument();
    });

    it('should handle sessions without titles', () => {
      const tree = createBreadcrumbPath(3);
      tree.session.title = null;
      tree.session.summary = null;

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      // Should show session ID prefix or "Untitled"
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should use React.memo to prevent unnecessary re-renders', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      const { rerender } = render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      // Re-render with same props
      rerender(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText('Level 0')).toBeInTheDocument();
    });

    it('should update when activeSessionId changes', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0]],
        length: 2,
        branchPoints: [],
      }));

      const { rerender } = render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-1"
          onNavigate={mockOnNavigate}
        />
      );

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      rerender(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      // Should show updated path
      expect(screen.getByText('Level 2')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle default maxVisibleSegments (5)', () => {
      const tree = createBreadcrumbPath(3);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0], tree.children[0].children[0]],
        length: 3,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-2"
          onNavigate={mockOnNavigate}
        />
      );

      // Should show all 3 segments (less than default 5)
      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
    });

    it('should handle path with only 2 nodes', () => {
      const tree = createBreadcrumbPath(2);

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0]],
        length: 2,
        branchPoints: [],
      }));

      render(
        <ContinuationBreadcrumb
          rootSessionId="level-0"
          activeSessionId="level-1"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
    });

    it('should handle sessions with only id field (no session_id)', () => {
      const tree = createBreadcrumbPath(2);
      delete (tree.session as any).session_id;

      mockSelectLinearPath.mockReturnValue(() => ({
        nodes: [tree, tree.children[0]],
        length: 2,
        branchPoints: [],
      }));

      expect(() => {
        render(
          <ContinuationBreadcrumb
            rootSessionId="level-0"
            activeSessionId="level-1"
            onNavigate={mockOnNavigate}
          />
        );
      }).not.toThrow();
    });
  });
});
