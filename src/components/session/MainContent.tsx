import { AlertTriangle, Copy, FileText, RefreshCw } from 'lucide-react';

import { SessionResume } from './SessionResume';
import { SessionSummary } from './SessionSummary';
import { MessageList } from '../messages/MessageList';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

import type { SessionDetails, PromptFile } from '../../types';

export interface MainContentProps {
  session: SessionDetails | null;
  isLoading: boolean;
  prompts: PromptFile[];

  summaryCollapsed: boolean;
  resumeCollapsed: boolean;
  onToggleSummary: () => void;
  onToggleResume: () => void;

  onCopySessionId: (id: string) => void;
  onReanalyze: (customInstructions?: string) => Promise<void>;
  onResume: (useTmux: boolean, promptFile?: string) => void;
  onLoadFullMessages: () => void;

  error?: string | null;
  onRetry?: () => void;
}

export function MainContent({
  session,
  isLoading,
  prompts,
  summaryCollapsed,
  resumeCollapsed,
  onToggleSummary,
  onToggleResume,
  onCopySessionId,
  onReanalyze,
  onResume,
  onLoadFullMessages,
  error,
  onRetry,
}: MainContentProps) {
  if (isLoading) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        aria-label="Session details - Loading"
        className="flex flex-1 flex-col overflow-hidden bg-background focus:outline-none"
      >
        <div className="border-b border-border p-4">
          <Skeleton className="mb-2 h-7 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-2 h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
              <div className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
              <div className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        aria-label="Session details - Error"
        className="flex flex-1 items-center justify-center bg-background focus:outline-none"
        role="alert"
        aria-live="assertive"
      >
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="size-4" />
          <AlertTitle>Error loading session</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3 text-sm">{error}</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
                <RefreshCw className="size-4" />
                Try Again
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!session) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        aria-label="Session details - No session selected"
        className="flex flex-1 items-center justify-center bg-background focus:outline-none"
      >
        <div className="text-center text-muted-foreground">
          <FileText className="mx-auto mb-4 size-12 opacity-50" aria-hidden="true" />
          <p className="text-lg font-medium">Select a session to view details</p>
          <p className="mt-1 text-sm">Use the sidebar to browse sessions</p>
        </div>
      </main>
    );
  }

  const projectPath = session.projectPath || session.project || 'Unknown';
  const folderName = projectPath.split('/').filter(Boolean).pop() || projectPath;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-label={`Session details for ${folderName}`}
      className="flex flex-1 flex-col overflow-hidden bg-background focus:outline-none"
    >
      <div className="border-b border-border p-4">
        <h2 className="text-xl font-semibold">{folderName}</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono text-xs">{session.id.slice(0, 8)}...</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopySessionId(session.id)}
            className="h-6 gap-1 px-2 text-xs"
          >
            <Copy className="size-3" />
            Copy
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <SessionSummary
          summary={session.summary}
          isCollapsed={summaryCollapsed}
          onToggle={onToggleSummary}
          onReanalyze={onReanalyze}
        />

        <SessionResume
          isCollapsed={resumeCollapsed}
          onToggle={onToggleResume}
          prompts={prompts}
          onResume={onResume}
        />

        <MessageList
          messages={session.messages || session.recentMessages || []}
          messageCount={session.message_count ?? session.messageCount ?? 0}
          fullMessagesLoaded={session.fullMessagesLoaded || false}
          onLoadFullMessages={onLoadFullMessages}
        />
      </div>
    </main>
  );
}
