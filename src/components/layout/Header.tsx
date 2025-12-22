// Header Component - Migrated to shadcn/ui
// Props interface is FROZEN - DO NOT MODIFY
//
// V1 Pattern Translation:
// - Status indicator showing current state (ready/analyzing/error)
// - Quota display with neutral colors when within limits
// - Clean, minimal layout with proper spacing
// - Accessible button controls

import {
  RefreshCw,
  Settings,
  Clock,
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { cn } from '../../utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export interface HeaderProps {
  sessionCount: { displayed: number; total: number };
  status: { indicator: 'ready' | 'analyzing' | 'loading' | 'error' | 'success'; text: string };
  quota: { current: number; limit: number; allowed: boolean };
  onRefresh: () => void;
  onOpenSettings: () => void;
  isRefreshing: boolean;
}

/**
 * Header Component
 *
 * Design requirements:
 * - Status pill showing current status (ready/analyzing/error/success)
 * - Quota display with neutral colors
 * - Clean, minimal layout
 * - Refresh button with loading state
 * - Settings button
 *
 * shadcn/ui components used: Button, Badge
 * Lucide icons: RefreshCw, Settings, Clock, Database, CheckCircle, AlertCircle, Loader2
 */
export function Header({
  sessionCount,
  status,
  quota,
  onRefresh,
  onOpenSettings,
  isRefreshing,
}: HeaderProps) {
  // V1 Pattern: Map status indicator to appropriate styling and icon
  // Note: Using "outline" variant as base and overriding with className to avoid variant/className conflicts
  const getStatusConfig = () => {
    switch (status.indicator) {
      case 'ready':
        return {
          className: 'bg-green-500/15 text-green-500 border-green-500/20',
          icon: <CheckCircle className="size-3" />,
        };
      case 'analyzing':
      case 'loading':
        return {
          className: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
          icon: <Loader2 className="size-3 animate-spin" />,
        };
      case 'success':
        return {
          className: 'bg-green-500/15 text-green-400 border-green-500/20',
          icon: <CheckCircle className="size-3" />,
        };
      case 'error':
        return {
          className: 'bg-red-500/15 text-red-400 border-red-500/20',
          icon: <AlertCircle className="size-3" />,
        };
      default:
        return {
          className: '',
          icon: null,
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* Left section: Title and session count */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Session Viewer</h1>
        <Badge variant="outline" className="font-normal text-muted-foreground">
          <Database className="mr-1.5 size-3" />
          {sessionCount.displayed} of {sessionCount.total}
        </Badge>
      </div>

      {/* Right section: Status, Quota, and Actions */}
      <div className="flex items-center gap-3">
        {/* Status indicator - WCAG 2.1 AA: Descriptive aria-label */}
        {/* Using "outline" variant as base to avoid conflicts with custom className */}
        <Badge
          variant="outline"
          className={cn('gap-1.5 font-normal', statusConfig.className)}
          // Descriptive label for screen readers explaining the current application state
          aria-label={`Application status: ${status.text}. ${
            status.indicator === 'ready'
              ? 'Ready to process sessions.'
              : status.indicator === 'analyzing'
                ? 'Currently analyzing session data.'
                : status.indicator === 'loading'
                  ? 'Loading session data.'
                  : status.indicator === 'success'
                    ? 'Operation completed successfully.'
                    : status.indicator === 'error'
                      ? 'An error occurred.'
                      : ''
          }`}
          // Use role="status" for live region announcements when status changes
          role="status"
          aria-live="polite"
        >
          {statusConfig.icon}
          {status.text}
        </Badge>

        {/* Quota display - WCAG 2.1 AA: Descriptive aria-label */}
        <Badge
          variant="outline"
          className={cn(
            'gap-1.5 font-normal',
            quota.allowed ? 'text-muted-foreground' : 'border-red-500/30 text-red-400'
          )}
          // Descriptive label explaining what the quota numbers mean
          aria-label={`API quota: ${quota.current} of ${quota.limit} requests used. ${
            quota.allowed ? 'Within quota limits.' : 'Quota exceeded. Some features may be limited.'
          }`}
        >
          <Clock className="size-3" aria-hidden="true" />
          {quota.current}/{quota.limit}
        </Badge>

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-1.5"
        >
          <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'Refreshing' : 'Refresh'}
        </Button>

        {/* Settings button */}
        <Button variant="ghost" size="icon" onClick={onOpenSettings} className="size-9">
          <Settings className="size-4" />
          <span className="sr-only">Settings</span>
        </Button>
      </div>
    </header>
  );
}
