// Session Empty States
// V2 UX Polish: Contextual empty state variants
//
// Provides helpful guidance for each empty state scenario:
// 1. No sessions at all (first-time users)
// 2. No search results (user searched, nothing matches)
// 3. No filter matches (filters too restrictive)
// 4. No session selected (user hasn't clicked yet)
//
// Each variant explains the problem and provides actionable next steps.

import { FolderOpen, Settings, ExternalLink, Search, X, MousePointer, Filter } from 'lucide-react';

import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';

// ============================================================================
// Variant 1: No Sessions (First-Time User)
// ============================================================================

export interface EmptySessionListNoSessionsProps {
  onOpenSettings: () => void;
}

/**
 * EmptySessionListNoSessions
 *
 * Shown when: No sessions exist in the database
 * User type: First-time users who haven't used Claude Code yet
 * Goal: Explain where sessions come from and how to troubleshoot
 */
export function EmptySessionListNoSessions({ onOpenSettings }: EmptySessionListNoSessionsProps) {
  return (
    <EmptyState
      icon={<FolderOpen className="size-12" />}
      title="No sessions found"
      description={
        <>
          Sessions appear here when you use Claude Code in your terminal. They&apos;re stored in{' '}
          <code className="rounded bg-muted px-1 font-mono text-xs">~/.claude/projects</code>.
        </>
      }
      actions={
        <>
          <Button variant="outline" onClick={onOpenSettings}>
            <Settings className="mr-2 size-4" />
            Check Settings
          </Button>
          <Button variant="ghost" asChild>
            <a
              href="https://www.anthropic.com/claude/code"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 size-4" />
              Learn about Claude Code
            </a>
          </Button>
        </>
      }
      hint={
        <>
          <span className="font-medium">Pro tip:</span> Use{' '}
          <kbd className="rounded bg-background px-1 font-mono">j</kbd> and{' '}
          <kbd className="rounded bg-background px-1 font-mono">k</kbd> to navigate sessions,{' '}
          <kbd className="rounded bg-background px-1 font-mono">Enter</kbd> to open, and{' '}
          <kbd className="rounded bg-background px-1 font-mono">?</kbd> for all shortcuts.
        </>
      }
    />
  );
}

// ============================================================================
// Variant 2: No Search Results
// ============================================================================

export interface EmptySearchResultsProps {
  query: string;
  onClearSearch: () => void;
}

/**
 * EmptySearchResults
 *
 * Shown when: User has searched but no sessions match
 * User type: Active users trying to find specific sessions
 * Goal: Suggest alternative search terms and provide escape hatch
 */
export function EmptySearchResults({ query, onClearSearch }: EmptySearchResultsProps) {
  return (
    <EmptyState
      icon={<Search className="size-12" />}
      title="No results found"
      description={
        <>
          No sessions match <strong>&quot;{query}&quot;</strong>. Try different keywords or clear
          your search.
        </>
      }
      actions={
        <Button variant="outline" onClick={onClearSearch}>
          <X className="mr-2 size-4" />
          Clear Search
        </Button>
      }
      hint={
        <>
          <span className="font-medium">Search tips:</span> Search looks through session names,
          summaries, and conversation content. Try broader keywords.
        </>
      }
    />
  );
}

// ============================================================================
// Variant 3: No Filter Matches
// ============================================================================

export interface EmptyFilterResultsProps {
  onClearFilters: () => void;
}

/**
 * EmptyFilterResults
 *
 * Shown when: User has active filters but no sessions match
 * User type: Active users using date/project filters
 * Goal: Suggest adjusting filters and provide quick clear action
 */
export function EmptyFilterResults({ onClearFilters }: EmptyFilterResultsProps) {
  return (
    <EmptyState
      icon={<Filter className="size-12" />}
      title="No matching sessions"
      description="No sessions match your current filters. Try adjusting the date range or project filter."
      actions={
        <Button variant="outline" onClick={onClearFilters}>
          <X className="mr-2 size-4" />
          Clear All Filters
        </Button>
      }
    />
  );
}

// ============================================================================
// Variant 4: No Session Selected
// ============================================================================

/**
 * EmptySessionDetail
 *
 * Shown when: User hasn't selected a session yet
 * User type: All users on app launch
 * Goal: Prompt user to make a selection
 */
export function EmptySessionDetail() {
  return (
    <EmptyState
      icon={<MousePointer className="size-12" />}
      title="Select a session"
      description="Choose a session from the list to view its details and conversation history."
      className="h-full"
      hint={
        <>
          <span className="font-medium">Keyboard shortcuts:</span>{' '}
          <kbd className="rounded bg-background px-1 font-mono">j</kbd>/
          <kbd className="rounded bg-background px-1 font-mono">k</kbd> to navigate,{' '}
          <kbd className="rounded bg-background px-1 font-mono">Enter</kbd> to select,{' '}
          <kbd className="rounded bg-background px-1 font-mono">?</kbd> for all shortcuts.
        </>
      }
    />
  );
}
