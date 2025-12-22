import { memo, useMemo } from 'react';

import { MessageSquare } from 'lucide-react';

import { formatTimeAgo, extractShortTitle, cn } from '../../utils';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Checkbox } from '../ui/checkbox';

import type { Session } from '../../types';

export interface SessionCardProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  continuationBadge?: React.ReactNode;
  onFilterRelated?: () => void;
}

function SessionCardComponent({
  session,
  isActive,
  onClick,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  continuationBadge,
  onFilterRelated,
}: SessionCardProps) {
  const title = useMemo(() => {
    if (session.title || session.summary) {
      return extractShortTitle(session.title || session.summary);
    }
    return 'Not yet analyzed';
  }, [session.title, session.summary]);

  const shortPath = useMemo(() => {
    const projectPath = session.project_path || session.projectPath || session.project || 'Unknown';
    const pathSegments = projectPath.split('/').filter(Boolean);
    return pathSegments.length > 2 ? '.../' + pathSegments.slice(-2).join('/') : projectPath;
  }, [session.project_path, session.projectPath, session.project]);

  const timeAgo = useMemo(() => {
    let date: Date;
    if (
      session.last_message_time !== undefined &&
      session.last_message_time !== null &&
      session.last_message_time !== ''
    ) {
      date = new Date(session.last_message_time);
    } else if (session.analysis_timestamp !== undefined && session.analysis_timestamp !== null) {
      date = new Date(session.analysis_timestamp * 1000);
    } else if (session.modified !== undefined && session.modified !== null) {
      date = new Date(session.modified);
    } else {
      date = new Date();
    }
    return formatTimeAgo(date);
  }, [session.last_message_time, session.analysis_timestamp, session.modified]);

  const messageCount = useMemo(() => {
    return session.message_count ?? session.messageCount ?? 0;
  }, [session.message_count, session.messageCount]);

  const accessibleLabel = useMemo(() => {
    return [
      title,
      `in ${shortPath}`,
      timeAgo,
      messageCount > 0 ? `${messageCount} messages` : null,
      isActive ? 'currently selected' : null,
    ]
      .filter(Boolean)
      .join(', ');
  }, [title, shortPath, timeAgo, messageCount, isActive]);

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || isSelectionMode) {
      onToggleSelect?.(e);
    } else if (continuationBadge !== undefined && onFilterRelated !== undefined) {
      onFilterRelated();
    } else {
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={isActive ? 'true' : undefined}
      aria-label={accessibleLabel}
      className={cn(
        'block w-full text-left',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
    >
      <Card
        className={cn(
          'cursor-pointer rounded-none border-0 border-b transition-all duration-200',
          isActive && !isSelected
            ? 'bg-accent shadow-sm ring-1 ring-primary/20'
            : isSelected
              ? 'bg-primary/5 ring-1 ring-primary/40'
              : 'hover:bg-accent/50'
        )}
      >
        <CardContent className="flex items-start gap-2 p-3">
          {isSelectionMode && (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Propagation guard only, Checkbox is the interactive element
            <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect?.({} as React.MouseEvent)}
                aria-label={`Select session: ${title}`}
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-start justify-between" aria-hidden="true">
              <span className="truncate text-xs text-muted-foreground">{shortPath}</span>
            </div>

            <div className="truncate text-sm font-medium leading-snug" aria-hidden="true">
              {title}
            </div>

            <div
              className="mt-2 flex min-w-0 items-center justify-between gap-2"
              aria-hidden="true"
            >
              <div className="flex min-w-0 shrink items-center gap-2 overflow-hidden">
                {messageCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 shrink-0 whitespace-nowrap px-1.5 py-0 text-xs font-normal"
                  >
                    <MessageSquare className="mr-1 size-3" />
                    {messageCount}
                  </Badge>
                )}
                {continuationBadge !== undefined && continuationBadge}
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                {timeAgo}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export const SessionCard = memo(SessionCardComponent, (prevProps, nextProps) => {
  if (
    prevProps.session === nextProps.session &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.onClick === nextProps.onClick
  ) {
    return true;
  }

  if (
    prevProps.isActive !== nextProps.isActive ||
    prevProps.onClick !== nextProps.onClick ||
    prevProps.isSelectionMode !== nextProps.isSelectionMode ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.onToggleSelect !== nextProps.onToggleSelect ||
    prevProps.continuationBadge !== nextProps.continuationBadge
  ) {
    return false;
  }

  const prevSession = prevProps.session;
  const nextSession = nextProps.session;

  return (
    prevSession.id === nextSession.id &&
    prevSession.session_id === nextSession.session_id &&
    prevSession.is_analyzed === nextSession.is_analyzed &&
    prevSession.title === nextSession.title &&
    prevSession.summary === nextSession.summary &&
    prevSession.project_path === nextSession.project_path &&
    prevSession.projectPath === nextSession.projectPath &&
    prevSession.project === nextSession.project &&
    prevSession.last_message_time === nextSession.last_message_time &&
    prevSession.analysis_timestamp === nextSession.analysis_timestamp &&
    prevSession.modified === nextSession.modified &&
    prevSession.message_count === nextSession.message_count &&
    prevSession.messageCount === nextSession.messageCount
  );
});
