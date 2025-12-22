import { useState } from 'react';

import { ChevronDown, Terminal, LayoutGrid } from 'lucide-react';

import { cn } from '../../utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

import type { PromptFile } from '../../types';

export interface SessionResumeProps {
  isCollapsed: boolean;
  onToggle: () => void;
  prompts: PromptFile[];
  onResume: (useTmux: boolean, promptFile?: string) => void;

  isContinuationChild?: boolean;
  chapterNumber?: number;
  rootSessionId?: string;
  onResumeFromRoot?: (useTmux: boolean, promptFile?: string) => void;
}

export function SessionResume({
  isCollapsed,
  onToggle,
  prompts,
  onResume,
  isContinuationChild = false,
  chapterNumber,
  rootSessionId,
  onResumeFromRoot,
}: SessionResumeProps) {
  const [selectedPrompt, setSelectedPrompt] = useState('none');

  const [showContinuationDialog, setShowContinuationDialog] = useState(false);
  const [pendingResumeTmux, setPendingResumeTmux] = useState(false);

  const handleResume = (useTmux: boolean) => {
    if (isContinuationChild && rootSessionId && onResumeFromRoot) {
      setPendingResumeTmux(useTmux);
      setShowContinuationDialog(true);
      return;
    }

    onResume(useTmux, selectedPrompt === 'none' ? undefined : selectedPrompt);
  };

  const handleResumeFromRoot = () => {
    setShowContinuationDialog(false);
    if (onResumeFromRoot) {
      onResumeFromRoot(pendingResumeTmux, selectedPrompt === 'none' ? undefined : selectedPrompt);
    }
  };

  const handleResumeFromCurrent = () => {
    setShowContinuationDialog(false);
    onResume(pendingResumeTmux, selectedPrompt === 'none' ? undefined : selectedPrompt);
  };

  return (
    <Collapsible open={!isCollapsed} onOpenChange={() => onToggle()}>
      <div className="overflow-hidden rounded-lg border border-border">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-auto w-full items-center justify-between rounded-none bg-card px-4 py-3 hover:bg-accent/50"
          >
            <span className="font-medium">Resume Conversation</span>
            <ChevronDown
              className={cn(
                'size-4 transition-transform duration-200',
                isCollapsed && '-rotate-90'
              )}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-l-4 border-green-500 p-4">
            <div className="mb-3">
              <Label htmlFor="prompt-select" className="mb-1.5 block text-sm text-muted-foreground">
                Select Prompt (optional)
              </Label>
              <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                <SelectTrigger
                  id="prompt-select"
                  className="w-full"
                  aria-label="Select prompt file"
                >
                  <SelectValue placeholder="No prompt (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No prompt (default)</SelectItem>
                  {prompts.map((prompt) => (
                    <SelectItem key={prompt.filename} value={prompt.filename}>
                      {prompt.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleResume(false)}
                className="flex-1"
              >
                <Terminal className="mr-1.5 size-4" />
                Resume in Terminal
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleResume(true)}
                className="flex-1"
              >
                <LayoutGrid className="mr-1.5 size-4" />
                Resume with Tmux
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>

      <AlertDialog open={showContinuationDialog} onOpenChange={setShowContinuationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              This is Chapter {chapterNumber ?? '?'} of a multi-part conversation. How would you
              like to resume?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction onClick={handleResumeFromRoot} className="w-full">
              Resume from beginning (full context)
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleResumeFromCurrent}
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Resume from this chapter (may miss context)
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
