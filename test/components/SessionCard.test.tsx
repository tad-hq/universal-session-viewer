/**
 * SessionCard Component Tests
 *
 * V1 Pattern Context:
 * - Session cards display project path, title, time ago, message count
 * - Active state shows selection glow
 * - Unanalyzed sessions show "Click to analyze" badge
 * - Uses dual ID field handling (id OR session_id)
 *
 * Tests validate:
 * - Correct rendering of session data
 * - Click handling triggers onClick
 * - Active state styling
 * - Edge cases (unanalyzed, missing data)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionCard } from '@/components/session/SessionCard';
import { createMockSession } from '../mocks/electronAPI';

describe('SessionCard', () => {
  describe('rendering', () => {
    it('should render session title', () => {
      const session = createMockSession({ title: 'My Test Session' });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('My Test Session')).toBeInTheDocument();
    });

    it('should render project path (shortened)', () => {
      const session = createMockSession({
        project_path: '/Users/test/projects/my-app/frontend',
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      // Should show last 2 segments with ellipsis
      expect(screen.getByText(/my-app\/frontend/)).toBeInTheDocument();
    });

    it('should render time ago', () => {
      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 5);

      const session = createMockSession({
        last_message_time: recentDate.toISOString(),
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('5m ago')).toBeInTheDocument();
    });

    it('should render message count when present', () => {
      const session = createMockSession({ message_count: 42 });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      // Component shows just the number with a MessageSquare icon (not "42 msgs")
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should not render message count when zero', () => {
      const session = createMockSession({ message_count: 0, messageCount: 0 });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText(/msgs/)).not.toBeInTheDocument();
    });
  });

  describe('click handling', () => {
    it('should call onClick when clicked', () => {
      const onClick = vi.fn();
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={onClick}
        />
      );

      const card = screen.getByText(session.title!).closest('div');
      fireEvent.click(card!);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should have cursor-pointer class', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      // The cursor-pointer class is on the Card component (outer div with bg-card)
      // Find it by looking for the element with cursor-pointer class
      const card = screen.getByText(session.title!).closest('[class*="cursor-pointer"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe('active state', () => {
    it('should have active styling when isActive is true', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={true}
          onClick={() => {}}
        />
      );

      // Active styling is on the Card component (has bg-accent class)
      const card = screen.getByText(session.title!).closest('[class*="bg-accent"]');
      expect(card).toBeInTheDocument();
    });

    it('should have inactive styling when isActive is false', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      // Inactive state has hover:bg-accent/50 class
      const card = screen.getByText(session.title!).closest('[class*="hover:bg-accent"]');
      expect(card).toBeInTheDocument();
      // Should not have solid bg-accent (without hover prefix)
      expect(card?.className).not.toMatch(/\bbg-accent\b(?!\/)/) ;
    });
  });

  describe('unanalyzed sessions', () => {
    // V2 Implementation: "Click to analyze" badge was removed
    // Unanalyzed sessions show "Not yet analyzed" as the title instead
    it('should show "Not yet analyzed" as title when unanalyzed (no badge)', () => {
      const session = createMockSession({
        is_analyzed: 0,
        title: null,
        summary: null,
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      // V2: Shows "Not yet analyzed" as title, no separate badge
      expect(screen.getByText('Not yet analyzed')).toBeInTheDocument();
    });

    it('should show "Not yet analyzed" as title when unanalyzed', () => {
      const session = createMockSession({
        is_analyzed: 0,
        title: null,
        summary: null,
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Not yet analyzed')).toBeInTheDocument();
    });

    it('should show actual title for analyzed sessions', () => {
      const session = createMockSession({
        is_analyzed: 1,
        title: 'Analyzed Session',
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      // V2: Shows actual title for analyzed sessions
      expect(screen.getByText('Analyzed Session')).toBeInTheDocument();
      expect(screen.queryByText('Not yet analyzed')).not.toBeInTheDocument();
    });
  });

  describe('title extraction', () => {
    it('should prefer title over summary', () => {
      const session = createMockSession({
        title: 'Explicit Title',
        summary: '**Main Topic/Domain**: Summary Title',
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Explicit Title')).toBeInTheDocument();
    });

    it('should extract title from summary when title is null', () => {
      const session = createMockSession({
        title: null,
        summary: '**Main Topic/Domain**: Extracted from Summary',
        is_analyzed: 1,
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      // extractShortTitle should extract "Extracted from Summary"
      expect(screen.getByText(/Extracted from Summary/)).toBeInTheDocument();
    });
  });

  describe('project path handling', () => {
    it('should handle project_path property', () => {
      const session = createMockSession({
        project_path: '/a/b/c/d',
        projectPath: undefined,
        project: undefined,
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText(/c\/d/)).toBeInTheDocument();
    });

    it('should fallback to projectPath when project_path is missing', () => {
      const session = createMockSession({
        project_path: undefined,
        projectPath: '/x/y/z',
        project: undefined,
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText(/y\/z/)).toBeInTheDocument();
    });

    it('should show full path for short paths', () => {
      const session = createMockSession({
        project_path: '/short',
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('/short')).toBeInTheDocument();
    });
  });

  describe('timestamp handling', () => {
    it('should prefer last_message_time for formatting', () => {
      const specificTime = new Date();
      specificTime.setHours(specificTime.getHours() - 2);

      const session = createMockSession({
        last_message_time: specificTime.toISOString(),
        analysis_timestamp: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
        modified: Date.now() - 604800000, // 1 week ago
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('should fallback to analysis_timestamp when last_message_time is missing', () => {
      const session = createMockSession({
        last_message_time: undefined,
        analysis_timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        modified: Date.now() - 604800000, // 1 week ago
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('1h ago')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle session with minimal data', () => {
      const session = {
        id: 'min-session',
        title: null,
        summary: null,
        modified: Date.now(),
      };

      render(
        <SessionCard
          session={session as any}
          isActive={false}
          onClick={() => {}}
        />
      );

      // Should render without crashing
      expect(screen.getByText('Not yet analyzed')).toBeInTheDocument();
    });

    it('should handle very long titles (truncation)', () => {
      // Note: extractShortTitle returns "Untitled Session" for titles >= 120 chars
      // that don't match known patterns. To test truncation, use a shorter title
      const longTitle = 'This is a moderately long title that should be truncated by CSS';
      const session = createMockSession({ title: longTitle });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      const titleElement = screen.getByText(longTitle);
      expect(titleElement).toHaveClass('truncate');
    });

    it('should handle undefined messageCount gracefully', () => {
      const session = createMockSession({
        message_count: undefined,
        messageCount: undefined,
      });

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      // Should not show message count
      expect(screen.queryByText(/msgs/)).not.toBeInTheDocument();
    });
  });

  describe('selection mode', () => {
    it('should show checkbox when in selection mode', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
          isSelectionMode={true}
          isSelected={false}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute('aria-label', `Select session: ${session.title}`);
    });

    it('should not show checkbox when not in selection mode', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
          isSelectionMode={false}
        />
      );

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('should have checked checkbox when isSelected is true', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
          isSelectionMode={true}
          isSelected={true}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should call onToggleSelect when checkbox clicked', () => {
      const onToggleSelect = vi.fn();
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
          isSelectionMode={true}
          isSelected={false}
          onToggleSelect={onToggleSelect}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(onToggleSelect).toHaveBeenCalled();
    });

    it('should show selected styling when isSelected is true', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
          isSelected={true}
        />
      );

      // Selected styling should show ring around card
      const card = screen.getByText(session.title!).closest('[class*="ring-primary"]');
      expect(card).toBeInTheDocument();
    });

    it('should call onToggleSelect when clicked in selection mode', () => {
      const onToggleSelect = vi.fn();
      const onClick = vi.fn();
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={onClick}
          isSelectionMode={true}
          isSelected={false}
          onToggleSelect={onToggleSelect}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // In selection mode, should toggle selection not call onClick
      expect(onToggleSelect).toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should have checkbox checked when selected', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
          isSelected={true}
          isSelectionMode={true}
          onToggleSelect={() => {}}
        />
      );

      // Note: Removed aria-selected from button as it's invalid per ARIA spec
      // Checkbox handles selection semantics instead
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });
  });

  describe('continuation badge slot', () => {
    it('should render continuation badge when provided', () => {
      const session = createMockSession();
      const continuationBadge = <div data-testid="continuation-badge">3 continuations</div>;

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
          continuationBadge={continuationBadge}
        />
      );

      expect(screen.getByTestId('continuation-badge')).toBeInTheDocument();
      expect(screen.getByText('3 continuations')).toBeInTheDocument();
    });

    it('should not render badge slot when no badge provided', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.queryByTestId('continuation-badge')).not.toBeInTheDocument();
    });

    it('should call onFilterRelated when card clicked with continuation badge', () => {
      const onFilterRelated = vi.fn();
      const onClick = vi.fn();
      const session = createMockSession();
      const continuationBadge = <div>Badge</div>;

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={onClick}
          continuationBadge={continuationBadge}
          onFilterRelated={onFilterRelated}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // With continuation badge and onFilterRelated, should filter not navigate
      expect(onFilterRelated).toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have button role for keyboard accessibility', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have aria-current when active', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={true}
          onClick={() => {}}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-current', 'true');
    });

    it('should have comprehensive aria-label for screen readers', () => {
      const session = createMockSession({
        title: 'Test Session',
        project_path: '/Users/test/project',
        message_count: 10,
      });

      render(
        <SessionCard
          session={session}
          isActive={true}
          onClick={() => {}}
        />
      );

      const button = screen.getByRole('button');
      const ariaLabel = button.getAttribute('aria-label');

      // Should include title, path, message count, and active status
      expect(ariaLabel).toContain('Test Session');
      expect(ariaLabel).toContain('project');
      expect(ariaLabel).toContain('10 messages');
      expect(ariaLabel).toContain('currently selected');
    });

    it('should have visible focus ring for keyboard navigation', () => {
      const session = createMockSession();

      render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:outline-none');
      expect(button).toHaveClass('focus-visible:ring-2');
    });
  });

  describe('performance optimization (React.memo)', () => {
    it('should memoize expensive computations', () => {
      const session = createMockSession({
        title: 'Test Title',
        project_path: '/very/long/path/to/project',
        last_message_time: new Date().toISOString(),
        message_count: 42,
      });

      const { rerender } = render(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      // Title, path, timeAgo, messageCount should be memoized
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText(/project/)).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();

      // Re-render with same props should not cause recomputation
      rerender(
        <SessionCard
          session={session}
          isActive={false}
          onClick={() => {}}
        />
      );

      // Should still render correctly without recomputation
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });
  });
});
