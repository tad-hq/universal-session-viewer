// SessionFilters Component - Migrated to shadcn/ui
// Props interface is FROZEN - DO NOT MODIFY (except for keyboard nav ref)
//
// V1 Pattern Translation:
// - Search input with icon (/ key focus preserved via forwardRef)
// - Project dropdown showing path (last 2 segments) and count
// - Date filter quick buttons (Today, Week, Month, Quarter, All)
// - Debounced search functionality maintained by parent
//
// WCAG 2.1 AA Accessibility:
// - role="search" on search container for landmark navigation
// - Proper <label> elements with htmlFor for all inputs
// - aria-label on inputs for screen reader context
// - Date filter uses role="radiogroup" with role="radio" for single selection
//   (Changed from aria-pressed toggle pattern to proper radio group pattern
//   since only one date filter can be active at a time - this is semantically
//   correct for mutually exclusive options per WCAG 2.1 AA)

import { forwardRef } from 'react';

import { Search, FolderOpen, Calendar } from 'lucide-react';

import { cn } from '../../utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

import type { Project, DateFilterPeriod } from '../../types';

export interface SessionFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  projectFilter: string | null;
  projects: Project[];
  onProjectChange: (path: string | null) => void;
  dateFilter: DateFilterPeriod;
  onDateFilterChange: (period: DateFilterPeriod) => void;
}

/**
 * SessionFilters Component
 *
 * Design requirements:
 * - Search input with icon
 * - Project dropdown showing path (last 2 segments) and count
 * - Date filter quick buttons (Today, Week, Month, Quarter, All)
 *
 * V1 Pattern: forwardRef for keyboard navigation
 * V1 Reference: index.html lines 2014-2016 (/ key focuses search)
 *
 * WCAG 2.1 AA Accessibility:
 * - role="search" landmark for screen reader navigation
 * - Labels associated with form controls via id/htmlFor
 * - Date filter uses role="radiogroup" with role="radio" and aria-checked
 *   (Proper pattern for mutually exclusive single-selection options)
 * - Arrow key navigation within the radio group for keyboard users
 *
 * shadcn/ui components used: Input, Select, Button
 * Lucide icons: Search, FolderOpen, Calendar
 */
export const SessionFilters = forwardRef<HTMLInputElement, SessionFiltersProps>(
  function SessionFilters(
    {
      searchQuery,
      onSearchChange,
      projectFilter,
      projects,
      onProjectChange,
      dateFilter,
      onDateFilterChange,
    },
    ref
  ) {
    // V1 Pattern: Calculate total session count across all projects
    const totalCount = projects.reduce((sum, p) => sum + p.session_count, 0);

    // V1 Pattern: Format project path to show last 2 segments
    const formatProjectPath = (fullPath: string): string => {
      const segments = fullPath.split('/').filter(Boolean);
      if (segments.length > 2) {
        return '.../' + segments.slice(-2).join('/');
      }
      return fullPath;
    };

    // Date filter options with labels
    const dateFilterOptions: { value: DateFilterPeriod; label: string }[] = [
      { value: 'today', label: 'Today' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: 'quarter', label: 'Quarter' },
      { value: 'all', label: 'All' },
    ];

    return (
      <div className="space-y-3 border-b border-border p-4">
        {/* WCAG 2.1 AA: Search container with role="search" for landmark navigation */}
        <div role="search" className="relative">
          {/* WCAG 2.1 AA: Hidden label for screen readers */}
          <label htmlFor="session-search" className="sr-only">
            Search sessions
          </label>
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={ref}
            id="session-search"
            type="search"
            placeholder="Search sessions... (press / to focus)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Search sessions. Press forward slash to focus."
          />
        </div>

        {/* Project filter dropdown */}
        <div className="relative">
          {/* WCAG 2.1 AA: Hidden label for screen readers */}
          <label htmlFor="project-filter" className="sr-only">
            Filter by project
          </label>
          <FolderOpen
            className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Select
            value={projectFilter || '__all__'}
            onValueChange={(value) => onProjectChange(value === '__all__' ? null : value)}
          >
            <SelectTrigger className="pl-9" id="project-filter" aria-label="Filter by project">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Projects ({totalCount})</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.project_path} value={project.project_path}>
                  {formatProjectPath(project.project_path)} ({project.session_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* WCAG 2.1 AA: Date filter with role="radiogroup" for mutually exclusive selection
            Using radiogroup instead of aria-pressed buttons because:
            1. Only one date filter can be active at a time (mutually exclusive)
            2. Screen readers announce "X of Y selected" context
            3. Arrow key navigation is expected behavior for radio groups
            4. Semantically correct for single-selection from a set */}
        <div className="flex items-center gap-1">
          <Calendar className="mr-1 size-4 text-muted-foreground" aria-hidden="true" />
          <div
            role="radiogroup"
            aria-label="Filter sessions by date range"
            className="flex flex-wrap gap-1"
            tabIndex={0}
            onKeyDown={(e) => {
              // WCAG 2.1 AA: Arrow key navigation within radio group
              const currentIndex = dateFilterOptions.findIndex((opt) => opt.value === dateFilter);
              let newIndex = currentIndex;

              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                newIndex = (currentIndex + 1) % dateFilterOptions.length;
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                newIndex = (currentIndex - 1 + dateFilterOptions.length) % dateFilterOptions.length;
              } else if (e.key === 'Home') {
                e.preventDefault();
                newIndex = 0;
              } else if (e.key === 'End') {
                e.preventDefault();
                newIndex = dateFilterOptions.length - 1;
              }

              if (newIndex !== currentIndex) {
                onDateFilterChange(dateFilterOptions[newIndex].value);
                // Focus the newly selected radio button
                const radioButtons = e.currentTarget.querySelectorAll('[role="radio"]');
                (radioButtons[newIndex] as HTMLElement)?.focus();
              }
            }}
          >
            {dateFilterOptions.map(({ value, label }) => {
              const isSelected = dateFilter === value;
              return (
                <Button
                  key={value}
                  variant={isSelected ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => onDateFilterChange(value)}
                  // WCAG 2.1 AA: role="radio" with aria-checked for radio group pattern
                  role="radio"
                  aria-checked={isSelected}
                  // Roving tabindex: only selected item is tabbable
                  tabIndex={isSelected ? 0 : -1}
                  className={cn(
                    'h-7 px-2.5 text-xs',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-secondary-foreground hover:bg-secondary'
                  )}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);
