// AssistantMessage Component - Performance Optimized with React.memo
// Props interface is FROZEN - DO NOT MODIFY
//
// PERFORMANCE OPTIMIZATION:
// - React.memo prevents re-renders when message hasn't changed
// - useMemo caches BOTH formatted timestamp AND parsed markdown HTML
// - marked.parse() is expensive - parsing markdown on every render kills performance
// - Critical for conversations with 100+ messages containing long assistant responses

import { memo, useMemo } from 'react';

import { marked } from 'marked';

import { formatTime } from '../../utils';

import type { Message } from '../../types';

export interface AssistantMessageProps {
  message: Message;
}

/**
 * AssistantMessage Component
 *
 * Design:
 * - Assistant avatar (A)
 * - Message content with markdown rendering
 * - Better background contrast
 * - Timestamp
 * - Proper padding and spacing
 *
 * PERFORMANCE: Wrapped in React.memo to prevent unnecessary re-renders
 * when parent components update but this message's props remain unchanged.
 *
 * CRITICAL: marked.parse() is memoized because it's computationally expensive,
 * especially for long assistant responses with code blocks and formatting.
 */
function AssistantMessageComponent({ message }: AssistantMessageProps) {
  // Memoize formatted timestamp
  // formatTime involves Date parsing and relative time calculation
  const formattedTime = useMemo(() => {
    return formatTime(message.timestamp);
  }, [message.timestamp]);

  // Memoize parsed markdown HTML
  // marked.parse() is EXPENSIVE - it parses markdown syntax, handles code blocks,
  // creates proper HTML structure, and applies syntax highlighting setup
  // Without memoization, every parent re-render would re-parse the entire message
  const parsedContent = useMemo(() => {
    // Handle null/undefined content gracefully
    const content = message.content || '';
    // marked.parse returns string | Promise<string>, but with sync usage it's string
    return marked.parse(content) as string;
  }, [message.content]);

  return (
    <div className="flex gap-3 bg-secondary p-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
        A
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="markdown-body prose prose-invert max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: parsedContent }}
        />
        <div className="mt-1 text-xs text-muted-foreground">{formattedTime}</div>
      </div>
    </div>
  );
}

// React.memo with custom equality function
// Messages are immutable in our data model, so we compare by reference first,
// then fall back to comparing individual fields for safety
//
// This is especially important for AssistantMessage because:
// 1. Assistant messages are typically longer (more expensive to re-render)
// 2. marked.parse() is called even if component re-renders with same content
export const AssistantMessage = memo(AssistantMessageComponent, (prevProps, nextProps) => {
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
