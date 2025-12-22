// EmptyState Component
// V2 UX Polish: Contextual empty states with helpful guidance
//
// Replaces basic "No sessions found" messages with:
// - Visual icons for context
// - Clear explanations
// - Actionable CTAs
// - In-context keyboard hints
//
// WCAG 2.1 AA Accessibility:
// - role="status" with aria-live="polite" for announcements
// - Semantic heading structure
// - Focusable action buttons

import { type ReactNode } from 'react';

import { cn } from '../../utils/cn';

export interface EmptyStateProps {
  /** Icon element to display (e.g., <FolderOpen className="h-12 w-12" />) */
  icon?: ReactNode;
  /** Main title text */
  title: string;
  /** Description text (can include JSX for inline code/links) */
  description: ReactNode;
  /** Action buttons (e.g., "Check Settings", "Learn More") */
  actions?: ReactNode;
  /** Optional keyboard hints (e.g., "Press ? for shortcuts") */
  hint?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * EmptyState Component
 *
 * Base component for all empty state variants. Provides consistent layout
 * with icon, title, description, actions, and optional keyboard hints.
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon={<FolderOpen className="h-12 w-12" />}
 *   title="No sessions found"
 *   description="Sessions appear when you use Claude Code..."
 *   actions={<Button>Check Settings</Button>}
 *   hint={<kbd>?</kbd> for shortcuts}
 * />
 * ```
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  hint,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center p-8 text-center', className)}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      {icon !== undefined && (
        <div className="mb-4 text-muted-foreground/50" aria-hidden="true">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="mb-2 text-lg font-medium">{title}</h3>

      {/* Description */}
      <div className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</div>

      {/* Action buttons */}
      {actions !== undefined && (
        <div className="mb-4 flex flex-wrap justify-center gap-3">{actions}</div>
      )}

      {/* Keyboard hint */}
      {hint !== undefined && (
        <div className="mt-2 max-w-md rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      )}
    </div>
  );
}
