import { forwardRef } from 'react';

import { FilterBanner } from './FilterBanner';
import { SearchResultsInfo } from './SearchResultsInfo';
import { SessionFilters } from './SessionFilters';
import { SessionList } from './SessionList';
import {
  useSessionStore,
  selectSearchDeduplication,
  selectRelatedFilterTriggerSessionId,
} from '../../stores/sessionStore';

import type { Session, Project, DateFilterPeriod } from '../../types';

export interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;

  isSearchMode: boolean;

  searchQuery: string;
  onSearchChange: (query: string) => void;
  projectFilter: string | null;
  projects: Project[];
  onProjectChange: (path: string | null) => void;
  dateFilter: DateFilterPeriod;
  onDateFilterChange: (period: DateFilterPeriod) => void;

  error?: string | null;
  onRetry?: () => void;

  onClearRelatedFilter?: () => void;
  onFilterRelated?: (sessionId: string) => void;
}

export const Sidebar = forwardRef<HTMLInputElement, SidebarProps>(function Sidebar(
  {
    sessions,
    currentSessionId,
    onSelectSession,
    hasMore,
    isLoading,
    onLoadMore,
    isSearchMode,
    searchQuery,
    onSearchChange,
    projectFilter,
    projects,
    onProjectChange,
    dateFilter,
    onDateFilterChange,
    error,
    onRetry,
    onClearRelatedFilter,
    onFilterRelated,
  },
  ref
) {
  const searchDeduplication = useSessionStore(selectSearchDeduplication);

  const triggerSessionId = useSessionStore(selectRelatedFilterTriggerSessionId);

  return (
    <aside className="flex w-80 flex-col border-r border-border bg-card">
      <nav aria-label="Session navigation" className="flex min-h-0 flex-1 flex-col">
        <SessionFilters
          ref={ref}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          projectFilter={projectFilter}
          projects={projects}
          onProjectChange={onProjectChange}
          dateFilter={dateFilter}
          onDateFilterChange={onDateFilterChange}
        />

        <FilterBanner
          triggerSessionId={triggerSessionId}
          chainCount={sessions.length}
          onClearFilter={onClearRelatedFilter || (() => {})}
        />

        <SearchResultsInfo
          isSearchMode={isSearchMode}
          resultCount={sessions.length}
          searchQuery={searchQuery}
          deduplication={searchDeduplication}
        />

        <SessionList
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={onLoadMore}
          isSearchMode={isSearchMode}
          error={error}
          onRetry={onRetry}
          onFilterRelated={onFilterRelated}
        />
      </nav>
    </aside>
  );
});
