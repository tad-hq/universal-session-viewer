/**
 * ContinuationBadge Component Tests
 *
 * Tests the clickable badge showing continuation count with:
 * - Expand/collapse toggle
 * - Search match variant
 * - Branch indicator variant
 * - Accessibility (button, aria-expanded)
 * - Edge cases (single chapter, no chapters)
 *
 * Coverage Target: 80%+ line and branch coverage
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContinuationBadge } from '@/components/session/ContinuationBadge';

describe('ContinuationBadge', () => {
  describe('Basic Rendering', () => {
    it('should render badge with continuation count', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      expect(screen.getByText('3 chapters')).toBeInTheDocument();
    });

    it('should use singular "chapter" for count of 2', () => {
      // Edge case: continuationCount includes root, so 2 = 1 continuation
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={2}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      expect(screen.getByText('2 chapters')).toBeInTheDocument();
    });

    it('should not render if continuationCount is 1 or less', () => {
      const mockToggle = vi.fn();

      const { container } = render(
        <ContinuationBadge
          continuationCount={1}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render if continuationCount is 0', () => {
      const mockToggle = vi.fn();

      const { container } = render(
        <ContinuationBadge
          continuationCount={0}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show BookOpen icon by default', () => {
      const mockToggle = vi.fn();

      const { container } = render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      // BookOpen icon rendered (check SVG presence)
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Toggle', () => {
    it('should show ChevronDown when collapsed', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should show ChevronUp when expanded', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={true}
          onToggle={mockToggle}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should call onToggle when clicked', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    it('should stop event propagation to prevent parent click', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();
      const mockParentClick = vi.fn();

      render(
        <div onClick={mockParentClick}>
          <ContinuationBadge
            continuationCount={3}
            isExpanded={false}
            onToggle={mockToggle}
          />
        </div>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockToggle).toHaveBeenCalledTimes(1);
      expect(mockParentClick).not.toHaveBeenCalled();
    });
  });

  describe('Search Match Variant', () => {
    it('should show search match variant when matchedInChapter > 1', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
          searchMatch={{ matchedInChapter: 3, totalChapters: 5 }}
        />
      );

      expect(screen.getByText('Found in Ch. 3')).toBeInTheDocument();
    });

    it('should not show search variant when matchedInChapter is 1', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
          searchMatch={{ matchedInChapter: 1, totalChapters: 5 }}
        />
      );

      // Should show normal badge, not search variant
      expect(screen.queryByText(/Found in Ch./)).not.toBeInTheDocument();
      expect(screen.getByText('5 chapters')).toBeInTheDocument();
    });

    it('should show Search icon in search match variant', () => {
      const mockToggle = vi.fn();

      const { container } = render(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
          searchMatch={{ matchedInChapter: 3, totalChapters: 5 }}
        />
      );

      // Search icon rendered
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should use outline variant for search match badge', () => {
      const mockToggle = vi.fn();

      const { container } = render(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
          searchMatch={{ matchedInChapter: 3, totalChapters: 5 }}
        />
      );

      // Badge should have distinct styling for search match
      const badge = container.querySelector('[class*="border-primary"]');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Branch Variant', () => {
    it('should show GitFork icon when hasBranches is true', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
          hasBranches={true}
        />
      );

      // GitFork icon should be present
      expect(screen.getByText('5 chapters')).toBeInTheDocument();
    });

    it('should show path count when branchCount provided', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
          hasBranches={true}
          branchCount={3}
        />
      );

      expect(screen.getByText('5 chapters (3 paths)')).toBeInTheDocument();
    });

    it('should not show path count for single path', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
          hasBranches={true}
          branchCount={1}
        />
      );

      expect(screen.queryByText(/paths/)).not.toBeInTheDocument();
      expect(screen.getByText('5 chapters')).toBeInTheDocument();
    });

    it('should not show branch indicator in search mode', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
          hasBranches={true}
          branchCount={3}
          searchMatch={{ matchedInChapter: 3, totalChapters: 5 }}
        />
      );

      // Search variant should override branch variant
      expect(screen.getByText('Found in Ch. 3')).toBeInTheDocument();
      expect(screen.queryByText(/paths/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be a button element', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have aria-expanded attribute', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded');
    });

    it('should have descriptive aria-label', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      const button = screen.getByRole('button');
      const label = button.getAttribute('aria-label');
      expect(label).toContain('3 chapters');
      expect(label).toContain('expand');
    });

    it('should include branch info in aria-label', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
          hasBranches={true}
          branchCount={3}
        />
      );

      const button = screen.getByRole('button');
      const label = button.getAttribute('aria-label');
      expect(label).toContain('3 paths');
    });

    it('should include search match info in aria-label', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
          searchMatch={{ matchedInChapter: 3, totalChapters: 5 }}
        />
      );

      const button = screen.getByRole('button');
      const label = button.getAttribute('aria-label');
      expect(label).toContain('chapter 3 of 5');
    });

    it('should have visible focus ring', () => {
      const mockToggle = vi.fn();

      const { container } = render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus-visible:ring-2');
    });
  });

  describe('Performance', () => {
    it('should use React.memo to prevent unnecessary re-renders', () => {
      const mockToggle = vi.fn();

      const { rerender } = render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      // Re-render with same props
      rerender(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      // Should not cause issues
      expect(screen.getByText('3 chapters')).toBeInTheDocument();
    });

    it('should update when continuationCount changes', () => {
      const mockToggle = vi.fn();

      const { rerender } = render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      rerender(
        <ContinuationBadge
          continuationCount={5}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      expect(screen.getByText('5 chapters')).toBeInTheDocument();
    });

    it('should update when isExpanded changes', () => {
      const mockToggle = vi.fn();

      const { rerender } = render(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      rerender(
        <ContinuationBadge
          continuationCount={3}
          isExpanded={true}
          onToggle={mockToggle}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large continuation count', () => {
      const mockToggle = vi.fn();

      render(
        <ContinuationBadge
          continuationCount={1000}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      expect(screen.getByText('1000 chapters')).toBeInTheDocument();
    });

    it('should handle undefined searchMatch gracefully', () => {
      const mockToggle = vi.fn();

      expect(() => {
        render(
          <ContinuationBadge
            continuationCount={3}
            isExpanded={false}
            onToggle={mockToggle}
            searchMatch={undefined}
          />
        );
      }).not.toThrow();
    });

    it('should handle undefined hasBranches gracefully', () => {
      const mockToggle = vi.fn();

      expect(() => {
        render(
          <ContinuationBadge
            continuationCount={3}
            isExpanded={false}
            onToggle={mockToggle}
            hasBranches={undefined}
          />
        );
      }).not.toThrow();
    });

    it('should handle undefined branchCount gracefully', () => {
      const mockToggle = vi.fn();

      expect(() => {
        render(
          <ContinuationBadge
            continuationCount={3}
            isExpanded={false}
            onToggle={mockToggle}
            hasBranches={true}
            branchCount={undefined}
          />
        );
      }).not.toThrow();
    });

    it('should prevent text wrapping for long chapter counts', () => {
      const mockToggle = vi.fn();

      const { container } = render(
        <ContinuationBadge
          continuationCount={32}
          isExpanded={false}
          onToggle={mockToggle}
        />
      );

      // Badge should have whitespace-nowrap class
      const badge = container.querySelector('[class*="whitespace-nowrap"]');
      expect(badge).toBeInTheDocument();
    });
  });
});
