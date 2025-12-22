import { useState } from 'react';

import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';

import { cn } from '../../utils';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

export interface SessionSummaryProps {
  summary: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
  onReanalyze: (customInstructions?: string) => Promise<void>;
}

export function SessionSummary({
  summary,
  isCollapsed,
  onToggle,
  onReanalyze,
}: SessionSummaryProps) {
  const [customInstructions, setCustomInstructions] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleReanalyze = async () => {
    setIsAnalyzing(true);
    try {
      await onReanalyze(customInstructions.trim() || undefined);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Collapsible open={!isCollapsed} onOpenChange={() => onToggle()}>
      <div className="overflow-hidden rounded-lg border border-border">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-auto w-full items-center justify-between rounded-none bg-card px-4 py-3 hover:bg-accent/50"
          >
            <span className="font-medium">AI Summary</span>
            <ChevronDown
              className={cn(
                'size-4 transition-transform duration-200',
                isCollapsed && '-rotate-90'
              )}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-l-4 border-primary p-4">
            {summary ? (
              <>
                <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm">
                  {summary}
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  <Label htmlFor="custom-instructions" className="mb-2 block text-sm">
                    Custom Analysis Instructions (optional)
                  </Label>
                  <Textarea
                    id="custom-instructions"
                    placeholder="e.g., Focus on code quality, suggest improvements, identify patterns..."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    className="mb-3 min-h-[80px]"
                  />
                  <Button size="sm" onClick={handleReanalyze} disabled={isAnalyzing}>
                    <RefreshCw className={cn('mr-1.5 size-4', isAnalyzing && 'animate-spin')} />
                    {isAnalyzing ? 'Analyzing...' : 'Re-analyze Summary'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">
                <p className="mb-3">No summary available - session not yet analyzed</p>
                <Button size="sm" onClick={handleReanalyze} disabled={isAnalyzing}>
                  <Sparkles className={cn('mr-1.5 size-4', isAnalyzing && 'animate-pulse')} />
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Session'}
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
