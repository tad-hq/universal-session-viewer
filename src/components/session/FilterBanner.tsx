// FilterBanner Component - Related Sessions Filter
//
// Purpose: Display filter status banner with back button when related filter is active
//
// V2 Pattern: Minimal state - accepts data via props, calls callback for actions
// Uses shadcn/ui Alert component for consistent styling
//
// WCAG 2.1 AA Accessibility:
// - Button element with clear label for screen readers
// - aria-label on back button describes action
// - Info icon provides visual context for banner purpose

import { ArrowLeft, Info } from 'lucide-react';

import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';

export interface FilterBannerProps {
  /** Session ID that triggered the filter, null if filter not active */
  triggerSessionId: string | null;
  /** Number of sessions in the filtered continuation chain */
  chainCount: number;
  /** Callback to clear the related filter and return to full list */
  onClearFilter: () => void;
}

/**
 * FilterBanner Component
 *
 * Shows a dismissible info banner when the related sessions filter is active.
 * Provides visual feedback about filter state and a back button to clear the filter.
 *
 * Design:
 * - Info icon on left (visual context)
 * - Text describing filter state
 * - Back arrow button on right (clear action)
 * - Slide-in animation (400ms from user spec)
 *
 * V2 Pattern: Controlled component - parent manages filter state
 * V2 Enhancement: Smooth animation for better UX
 *
 * shadcn/ui components used: Alert, AlertDescription, Button
 * Lucide icons: ArrowLeft, Info
 */
export function FilterBanner({ triggerSessionId, chainCount, onClearFilter }: FilterBannerProps) {
  // Don't render if filter not active
  if (!triggerSessionId) {
    return null;
  }

  return (
    <Alert className="m-2 border-blue-200 bg-blue-50 transition-transform duration-400 ease-in-out dark:border-blue-800 dark:bg-blue-950/20">
      <Info className="size-4 text-blue-600 dark:text-blue-400" />
      <div className="flex w-full items-center justify-between">
        <AlertDescription className="text-blue-900 dark:text-blue-100">
          Viewing {chainCount} related session{chainCount !== 1 ? 's' : ''}
        </AlertDescription>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilter}
          aria-label="Return to full session list"
          className="h-8 gap-2 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
        >
          <ArrowLeft className="size-4" />
          Back to all sessions
        </Button>
      </div>
    </Alert>
  );
}
