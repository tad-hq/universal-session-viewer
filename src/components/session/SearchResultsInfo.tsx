// SearchResultsInfo Component
//
// Purpose: Display search result metadata including deduplication info
// when continuation chains are grouped in search results.
//
// Design:
// - Shows result count with optional deduplication indicator
// - Appears between filters and session list when in search mode
// - Subtle styling that doesn't distract from results
//
// WCAG 2.1 AA Accessibility:
// - role="status" for live region updates
// - aria-live="polite" announces changes without interrupting
// - Clear text descriptions for screen readers

import { memo } from 'react';

import { Layers, Search } from 'lucide-react';

import { cn } from '../../utils';

import type { SearchDeduplicationInfo } from '../../stores/sessionStore';

export interface SearchResultsInfoProps {
  /** Whether search mode is active */
  isSearchMode: boolean;
  /** Number of search results */
  resultCount: number;
  /** The current search query */
  searchQuery: string;
  /** Deduplication metadata when continuations are grouped */
  deduplication: SearchDeduplicationInfo | null;
  /** Optional className for styling */
  className?: string;
}

/**
 * SearchResultsInfo Component
 *
 * Shows search result metadata including:
 * - Number of results found
 * - Deduplication indicator when continuation chains are grouped
 *
 * Only renders when in search mode and there are results.
 */
function SearchResultsInfoComponent({
  isSearchMode,
  resultCount,
  searchQuery,
  deduplication,
  className,
}: SearchResultsInfoProps) {
  // Don't render if not in search mode or no query
  if (!isSearchMode || !searchQuery) {
    return null;
  }

  // Determine if deduplication occurred
  const isGrouped = deduplication?.isGrouped && deduplication.chainsGrouped > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'border-b border-border bg-muted/30 px-4 py-2',
        'flex items-center gap-2 text-xs text-muted-foreground',
        className
      )}
    >
      <Search className="size-3 shrink-0" aria-hidden="true" />

      <span className="min-w-0 flex-1 truncate">
        {resultCount === 0
          ? `No results for "${searchQuery}"`
          : resultCount === 1
            ? `1 result for "${searchQuery}"`
            : `${resultCount} results for "${searchQuery}"`}
      </span>

      {/* Deduplication indicator */}
      {isGrouped && (
        <span
          className="flex shrink-0 items-center gap-1 text-primary/70"
          title={`${deduplication.chainsGrouped} continuation chain${deduplication.chainsGrouped > 1 ? 's' : ''} grouped`}
        >
          <Layers className="size-3" aria-hidden="true" />
          <span className="hidden sm:inline">grouped</span>
        </span>
      )}
    </div>
  );
}

// PERFORMANCE: React.memo for render optimization
export const SearchResultsInfo = memo(SearchResultsInfoComponent, (prev, next) => {
  return (
    prev.isSearchMode === next.isSearchMode &&
    prev.resultCount === next.resultCount &&
    prev.searchQuery === next.searchQuery &&
    prev.deduplication?.isGrouped === next.deduplication?.isGrouped &&
    prev.deduplication?.chainsGrouped === next.deduplication?.chainsGrouped &&
    prev.className === next.className
  );
});
