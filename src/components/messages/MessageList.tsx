import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';

import type { Message } from '../../types';

export interface MessageListProps {
  messages: Message[];
  messageCount: number;
  fullMessagesLoaded: boolean;
  onLoadFullMessages: () => void;
}

function getMessageKey(msg: Message, index: number): string {
  if (msg.uuid) {
    return msg.uuid;
  }
  const timestamp =
    typeof msg.timestamp === 'number' ? msg.timestamp : new Date(msg.timestamp).getTime();
  return `${msg.type}-${timestamp}-${index}`;
}

export function MessageList({
  messages,
  messageCount,
  fullMessagesLoaded,
  onLoadFullMessages,
}: MessageListProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <span className="font-medium" id="messages-heading">
          Messages
        </span>
        {!fullMessagesLoaded && messageCount > 20 && (
          <button
            onClick={onLoadFullMessages}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Load full conversation. Currently showing ${messages.length} of ${messageCount} total messages. Click to load all ${messageCount} messages.`}
          >
            Load Full Conversation ({messageCount} messages)
          </button>
        )}
      </div>

      <div
        className="max-h-96 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-labelledby="messages-heading"
        tabIndex={0} // eslint-disable-line jsx-a11y/no-noninteractive-tabindex -- Scrollable log region needs keyboard focus per WAI-ARIA
        aria-label={`Conversation log, ${messages.length} messages shown${!fullMessagesLoaded && messageCount > messages.length ? ` of ${messageCount} total` : ''}`}
      >
        {!fullMessagesLoaded && messages.length > 0 && (
          <div
            className="bg-muted px-4 py-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            Showing recent {messages.length} messages
            {messageCount > messages.length &&
              ` - Click "Load Full Conversation" to see all ${messageCount}`}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground" role="status">
            No messages found
          </div>
        ) : (
          <div className="divide-y divide-border">
            {messages.map((msg, index) =>
              msg.type === 'user' ? (
                <UserMessage key={getMessageKey(msg, index)} message={msg} />
              ) : (
                <AssistantMessage key={getMessageKey(msg, index)} message={msg} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
