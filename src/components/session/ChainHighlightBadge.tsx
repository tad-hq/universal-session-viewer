// ChainHighlightBadge Component - SessionList Chain Visualization
//
// Purpose: Display a compact badge showing session position in highlighted chain
// with relationship indicators.
//
// Design:
// - Position badge: [2/5] showing chain position
// - Relationship icon: ⚓ (root), ↑ (ancestor), ↓ (descendant), ═ (sibling), ● (clicked)
//
// Color Scheme:
// - Clicked: Primary blue
// - Ancestor: Amber (↑ toward root)
// - Descendant: Cyan (↓ toward children)
// - Sibling: Violet (═ same level)
//
// WCAG 2.1 AA Accessibility:
// - aria-label for screen reader context

import { memo, useMemo } from 'react';

import { Anchor, ArrowUp, ArrowDown, Minus, Circle } from 'lucide-react';

import { cn } from '../../utils';
import { Badge } from '../ui/badge';

import type { ChainHighlightInfo, ChainHighlightRole } from '../../stores/continuationStore';

export interface ChainHighlightBadgeProps {
  /** Session ID this badge represents */
  sessionId: string;
  /** Highlight info from store selector */
  highlightInfo: ChainHighlightInfo;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * Get the icon component for a chain role.
 */
function getRoleIcon(role: ChainHighlightRole, isRoot: boolean) {
  if (isRoot) {
    return Anchor; // Root session gets anchor icon
  }
  switch (role) {
    case 'clicked':
      return Circle; // Filled circle for currently viewing
    case 'ancestor':
      return ArrowUp; // Arrow up toward root
    case 'descendant':
      return ArrowDown; // Arrow down toward children
    case 'sibling':
      return Minus; // Horizontal line for sibling
    default:
      return Minus;
  }
}

/**
 * Get color classes for a chain role.
 */
function getRoleColorClasses(role: ChainHighlightRole): {
  badge: string;
  icon: string;
  text: string;
} {
  switch (role) {
    case 'clicked':
      return {
        badge: 'bg-primary/10 text-primary border-primary/50',
        icon: 'text-primary',
        text: 'text-primary font-medium',
      };
    case 'ancestor':
      return {
        badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/50',
        icon: 'text-amber-600 dark:text-amber-400',
        text: 'text-amber-700 dark:text-amber-400',
      };
    case 'descendant':
      return {
        badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/50',
        icon: 'text-cyan-600 dark:text-cyan-400',
        text: 'text-cyan-700 dark:text-cyan-400',
      };
    case 'sibling':
      return {
        badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/50',
        icon: 'text-violet-600 dark:text-violet-400',
        text: 'text-violet-700 dark:text-violet-400',
      };
    default:
      return {
        badge: 'bg-muted text-muted-foreground border-border',
        icon: 'text-muted-foreground',
        text: 'text-muted-foreground',
      };
  }
}

/**
 * ChainHighlightBadge Component
 *
 * Displays compact chain position and relationship indicator.
 * Appears on sessions that are part of a highlighted chain.
 */
function ChainHighlightBadgeComponent({ highlightInfo, className }: ChainHighlightBadgeProps) {
  const { role, position, total, isRoot } = highlightInfo;

  const Icon = useMemo(() => getRoleIcon(role, isRoot), [role, isRoot]);
  const colors = useMemo(() => getRoleColorClasses(role), [role]);

  // Accessible label for screen readers
  const accessibleLabel = useMemo(() => {
    const positionText = `Session ${position} of ${total} in chain`;
    const roleText = (() => {
      if (role === 'clicked') return ', currently viewing';
      if (isRoot) return ', chain root';
      if (role === 'ancestor') return ', ancestor of selected';
      if (role === 'descendant') return ', descendant of selected';
      if (role === 'sibling') return ', sibling of selected';
      return '';
    })();
    return `${positionText}${roleText}`;
  }, [position, total, role, isRoot]);

  // Display text for the badge
  const displayText = useMemo(() => {
    if (isRoot && role !== 'clicked') {
      return `ROOT`;
    }
    return `${position}/${total}`;
  }, [position, total, isRoot, role]);

  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 px-1.5 py-0 text-xs font-normal',
        'inline-flex items-center gap-1',
        'border',
        // Animation for entrance
        'duration-200 animate-in fade-in-50 slide-in-from-left-2',
        colors.badge,
        className
      )}
      aria-label={accessibleLabel}
    >
      <Icon className={cn('size-3', colors.icon)} aria-hidden="true" />
      <span className={colors.text}>{displayText}</span>
    </Badge>
  );
}

// PERFORMANCE: React.memo prevents unnecessary re-renders
export const ChainHighlightBadge = memo(ChainHighlightBadgeComponent, (prevProps, nextProps) => {
  // Check if basic props changed
  if (prevProps.sessionId !== nextProps.sessionId || prevProps.className !== nextProps.className) {
    return false;
  }

  // Deep compare highlight info
  const prevInfo = prevProps.highlightInfo;
  const nextInfo = nextProps.highlightInfo;

  return (
    prevInfo.role === nextInfo.role &&
    prevInfo.position === nextInfo.position &&
    prevInfo.total === nextInfo.total &&
    prevInfo.distance === nextInfo.distance &&
    prevInfo.isRoot === nextInfo.isRoot
  );
});

ChainHighlightBadge.displayName = 'ChainHighlightBadge';
