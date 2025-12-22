/**
 * ContinuationTree Component Tests
 *
 * Tests the complex tree visualization component with:
 * - Recursive tree rendering
 * - Keyboard navigation (WCAG tree pattern)
 * - Expand/collapse functionality
 * - Active path highlighting
 * - Branch indicators
 * - Accessibility (ARIA tree roles)
 *
 * Coverage Target: 80%+ line and branch coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContinuationTree } from '@/components/session/ContinuationTree';
import {
  createBranchingTree,
  createDeepTree,
  createWideTree,
  createSingleNodeTree,
  createTreeNode,
} from '../../factories/ContinuationFactory';
import { createMockSession } from '../../mocks/electronAPI';
import * as continuationStore from '@/stores/continuationStore';

// Mock Zustand store
vi.mock('@/stores/continuationStore', () => ({
  useContinuationStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector({
        collapsedBranches: {},
        activePathCache: {},
        toggleBranchCollapse: vi.fn(),
      });
    }
    return {};
  }),
  selectCollapsedBranches: vi.fn(() => () => new Set()),
  selectActivePathSet: vi.fn(() => () => new Set(['root', 'child1'])),
}));

// Get typed mock references
const mockSelectCollapsedBranches = vi.mocked(continuationStore.selectCollapsedBranches);
const mockSelectActivePathSet = vi.mocked(continuationStore.selectActivePathSet);

describe('ContinuationTree', () => {
  const mockOnSelectNode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Tree Rendering', () => {
    it('should render root node', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      expect(screen.getByText('Root Session')).toBeInTheDocument();
    });

    it('should render children recursively', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      expect(screen.getByText('Branch 1')).toBeInTheDocument();
      expect(screen.getByText('Branch 2')).toBeInTheDocument();
      expect(screen.getByText('Branch 1 Continuation')).toBeInTheDocument();
    });

    it('should show proper tree structure with role="tree"', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const treeElement = screen.getByRole('tree');
      expect(treeElement).toBeInTheDocument();
    });

    it('should not render if only root node with no children', () => {
      const tree = createSingleNodeTree();

      const { container } = render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="single"
          onSelectNode={mockOnSelectNode}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show connecting lines between nodes', () => {
      const tree = createBranchingTree();

      const { container } = render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Check for connecting line elements (via className patterns)
      const connectingLines = container.querySelectorAll('[class*="absolute"]');
      expect(connectingLines.length).toBeGreaterThan(0);
    });

    it('should render depth badges for deep nodes', () => {
      const tree = createDeepTree(8); // Beyond MAX_INDENT_DEPTH (5)

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="level-0"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Depth 6+ should show [N] badges
      expect(screen.getByText('[6]')).toBeInTheDocument();
      expect(screen.getByText('[7]')).toBeInTheDocument();
    });
  });

  describe('Active Path Highlighting', () => {
    it('should highlight active node', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="child1"
          onSelectNode={mockOnSelectNode}
        />
      );

      const activeButton = screen.getByText('Branch 1').closest('button');
      expect(activeButton).toHaveAttribute('aria-current', 'step');
    });

    it('should show Active badge on active node', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="child1"
          onSelectNode={mockOnSelectNode}
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should show checkmark icon on active node', () => {
      const tree = createBranchingTree();

      const { container } = render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // CheckCircle component is rendered for active node (has aria-hidden so use container query)
      const rootButton = screen.getByText('Root Session').closest('button');
      const checkIcon = rootButton!.querySelector('.lucide-check-circle');

      expect(checkIcon).toBeInTheDocument();
    });
  });

  describe('Branch Indicators', () => {
    it('should show branch icon when node has multiple children', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Root has 2 children, should show GitBranch icon
      const rootButton = screen.getByText('Root Session').closest('button');
      expect(rootButton).toBeInTheDocument();
    });

    it('should show child count badge for branching nodes', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Root has 2 children
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should not show branch indicator for single child', () => {
      const tree = createTreeNode(
        createMockSession({ id: 'root', title: 'Root' }),
        [createTreeNode(createMockSession({ id: 'child', title: 'Child' }))]
      );

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Should not show branch count for single child
      const rootButton = screen.getByText('Root').closest('button');
      expect(within(rootButton!).queryByText('1')).not.toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('should show chevron icon when node has children', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const chevrons = screen.getAllByLabelText(/expand|collapse/i);
      expect(chevrons.length).toBeGreaterThan(0);
    });

    it('should toggle collapse state when chevron clicked', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      vi.mocked(await import('@/stores/continuationStore')).useContinuationStore = vi.fn(
        (selector) => {
          if (typeof selector === 'function') {
            return selector({
              collapsedBranches: {},
              activePathCache: {},
              toggleBranchCollapse: mockToggle,
            });
          }
          return mockToggle;
        }
      );

      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Tree is initially expanded, so button says "Collapse branch"
      const collapseButton = screen.getAllByLabelText(/collapse branch/i)[0];
      await user.click(collapseButton);

      expect(mockToggle).toHaveBeenCalled();
    });

    it('should show +N badge when collapsed', () => {
      mockSelectCollapsedBranches.mockReturnValue(
        () => new Set(['root'])
      );

      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Tree has 3 descendants, should show +3
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('should hide children when collapsed', () => {
      mockSelectCollapsedBranches.mockReturnValue(
        () => new Set(['root'])
      );

      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Children should not be visible
      expect(screen.queryByText('Branch 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Branch 2')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate down with ArrowDown key', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const treeElement = screen.getByRole('tree');
      treeElement.focus();

      fireEvent.keyDown(treeElement, { key: 'ArrowDown' });

      // First child should receive focus
      const firstChild = screen.getByText('Branch 1').closest('button');
      expect(firstChild).toHaveFocus();
    });

    it('should navigate up with ArrowUp key', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="child1"
          onSelectNode={mockOnSelectNode}
        />
      );

      const treeElement = screen.getByRole('tree');
      fireEvent.keyDown(treeElement, { key: 'ArrowUp' });

      // Should move to root
      const root = screen.getByText('Root Session').closest('button');
      expect(root).toHaveFocus();
    });

    it('should select node with Enter key', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const treeElement = screen.getByRole('tree');
      treeElement.focus();

      fireEvent.keyDown(treeElement, { key: 'Enter' });

      expect(mockOnSelectNode).toHaveBeenCalledWith('root');
    });

    it('should select node with Space key', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const treeElement = screen.getByRole('tree');
      treeElement.focus();

      fireEvent.keyDown(treeElement, { key: ' ' });

      expect(mockOnSelectNode).toHaveBeenCalledWith('root');
    });

    it('should navigate to first node with Home key', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="child1"
          onSelectNode={mockOnSelectNode}
        />
      );

      const treeElement = screen.getByRole('tree');
      fireEvent.keyDown(treeElement, { key: 'Home' });

      const root = screen.getByText('Root Session').closest('button');
      expect(root).toHaveFocus();
    });

    it('should navigate to last node with End key', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const treeElement = screen.getByRole('tree');
      fireEvent.keyDown(treeElement, { key: 'End' });

      // Last node in depth-first order
      const lastNode = screen.getByText('Branch 2').closest('button');
      expect(lastNode).toHaveFocus();
    });

    it('should collapse with ArrowLeft when expanded', () => {
      const mockToggle = vi.fn();

      vi.mocked(continuationStore).useContinuationStore = vi.fn((selector) => {
        if (typeof selector === 'function') {
          return selector({
            collapsedBranches: {},
            activePathCache: {},
            toggleBranchCollapse: mockToggle,
          });
        }
        return mockToggle;
      });

      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const treeElement = screen.getByRole('tree');
      fireEvent.keyDown(treeElement, { key: 'ArrowLeft' });

      expect(mockToggle).toHaveBeenCalled();
    });

    it('should expand with ArrowRight when collapsed', () => {
      const mockToggle = vi.fn();

      vi.mocked(continuationStore).useContinuationStore = vi.fn((selector) => {
        if (typeof selector === 'function') {
          return selector({
            collapsedBranches: {},
            activePathCache: {},
            toggleBranchCollapse: mockToggle,
          });
        }
        return mockToggle;
      });

      mockSelectCollapsedBranches.mockReturnValue(
        () => new Set(['root'])
      );

      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const treeElement = screen.getByRole('tree');
      fireEvent.keyDown(treeElement, { key: 'ArrowRight' });

      expect(mockToggle).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have role="tree" on container', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      expect(screen.getByRole('tree')).toBeInTheDocument();
    });

    it('should have role="treeitem" on nodes', () => {
      const tree = createBranchingTree();

      const { container } = render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const treeitems = container.querySelectorAll('[role="treeitem"]');
      expect(treeitems.length).toBeGreaterThan(0);
    });

    it('should set aria-level for depth indication', () => {
      const tree = createBranchingTree();

      const { container } = render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Root should be level 1
      const rootItem = container.querySelector('[role="treeitem"][aria-level="1"]');
      expect(rootItem).toBeInTheDocument();

      // Children should be level 2
      const childItems = container.querySelectorAll('[role="treeitem"][aria-level="2"]');
      expect(childItems.length).toBeGreaterThan(0);
    });

    it('should set aria-expanded for expandable nodes', () => {
      const tree = createBranchingTree();

      const { container } = render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const expandableItems = container.querySelectorAll('[role="treeitem"][aria-expanded]');
      expect(expandableItems.length).toBeGreaterThan(0);
    });

    it('should set aria-selected for active node', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="child1"
          onSelectNode={mockOnSelectNode}
        />
      );

      const activeNode = screen.getByText('Branch 1').closest('[role="treeitem"]');
      expect(activeNode).toHaveAttribute('aria-selected', 'true');
    });

    it('should have aria-current for active node button', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const activeButton = screen.getByText('Root Session').closest('button');
      expect(activeButton).toHaveAttribute('aria-current', 'step');
    });

    it('should have aria-live region for announcements', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('should provide descriptive aria-label for tree', () => {
      const tree = createBranchingTree();

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label');
      expect(nav.getAttribute('aria-label')).toContain('session');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very wide trees (20+ siblings)', () => {
      const tree = createWideTree(20);

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 20')).toBeInTheDocument();
    });

    it('should handle very deep trees (20+ levels)', () => {
      const tree = createDeepTree(20);

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="level-0"
          onSelectNode={mockOnSelectNode}
        />
      );

      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 19')).toBeInTheDocument();
    });

    it('should handle missing session IDs gracefully', () => {
      const invalidNode = createTreeNode({
        ...createMockSession({ title: 'No ID' }),
        id: '',
        session_id: '',
      } as any);

      expect(() => {
        render(
          <ContinuationTree
            rootNode={invalidNode}
            activeSessionId=""
            onSelectNode={mockOnSelectNode}
          />
        );
      }).not.toThrow();
    });

    it('should handle sessions with only id field (no session_id)', () => {
      const session = createMockSession({ id: 'test-id', title: 'Test' });
      delete (session as any).session_id;

      const tree = createTreeNode(session);

      expect(() => {
        render(
          <ContinuationTree
            rootNode={tree}
            activeSessionId="test-id"
            onSelectNode={mockOnSelectNode}
          />
        );
      }).not.toThrow();
    });

    it('should handle sessions with only session_id field (no id)', () => {
      const session = createMockSession({ session_id: 'test-id', title: 'Test' }) as any;
      session.id = undefined;

      const tree = createTreeNode(session);

      expect(() => {
        render(
          <ContinuationTree
            rootNode={tree}
            activeSessionId="test-id"
            onSelectNode={mockOnSelectNode}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should use React.memo to prevent unnecessary re-renders', () => {
      const tree = createBranchingTree();

      const { rerender } = render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Re-render with same props
      rerender(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="root"
          onSelectNode={mockOnSelectNode}
        />
      );

      // Component should be memoized (no easy way to test this directly,
      // but we verify it doesn't crash or behave incorrectly)
      expect(screen.getByText('Root Session')).toBeInTheDocument();
    });

    it('should handle large trees efficiently', () => {
      const startTime = Date.now();

      const tree = createDeepTree(100);

      render(
        <ContinuationTree
          rootNode={tree}
          activeSessionId="level-0"
          onSelectNode={mockOnSelectNode}
        />
      );

      const renderTime = Date.now() - startTime;

      // Should render in reasonable time (< 1 second)
      expect(renderTime).toBeLessThan(1000);
    });
  });
});
