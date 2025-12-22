// UserMessage Component - Performance Optimized with React.memo
// Props interface is FROZEN - DO NOT MODIFY
//
// PERFORMANCE OPTIMIZATION:
// - React.memo prevents re-renders when message hasn't changed
// - useMemo caches formatted timestamp (formatTime can be expensive for large lists)
// - Critical for conversations with 100+ messages
//
// V1 Reference: index.html lines 1475-1510 (message rendering)

import { memo, useMemo } from 'react';

import { formatTime } from '../../utils';

import type { Message } from '../../types';

export interface UserMessageProps {
  message: Message;
}

/**
 * UserMessage Component
 *
 * Design:
 * - User avatar (U)
 * - Message content with markdown rendering
 * - Timestamp
 * - Proper padding and spacing
 *
 * PERFORMANCE: Wrapped in React.memo to prevent unnecessary re-renders
 * when parent components update but this message's props remain unchanged.
 *
 * shadcn/ui components to use: Avatar
 */
function UserMessageComponent({ message }: UserMessageProps) {
  // PERFORMANCE: Memoize formatted timestamp
  // formatTime involves Date parsing and relative time calculation
  // V1 Reference: index.html lines 1806-1820
  const formattedTime = useMemo(() => {
    return formatTime(message.timestamp);
  }, [message.timestamp]);

  return (
    <div className="flex gap-3 p-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
        U
      </div>
      <div className="min-w-0 flex-1">
        <div className="prose prose-invert max-w-none text-sm">{message.content}</div>
        <div className="mt-1 text-xs text-muted-foreground">{formattedTime}</div>
      </div>
    </div>
  );
}

// PERFORMANCE: React.memo with custom equality function
// Messages are immutable in our data model, so we compare by reference first,
// then fall back to comparing individual fields for safety
export const UserMessage = memo(UserMessageComponent, (prevProps, nextProps) => {
  // Fast path: reference equality
  if (prevProps.message === nextProps.message) {
    return true;
  }

  // Deep comparison: check fields we actually use
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;

  return (
    prevMsg.uuid === nextMsg.uuid &&
    prevMsg.content === nextMsg.content &&
    prevMsg.timestamp === nextMsg.timestamp &&
    prevMsg.type === nextMsg.type
  );
});
