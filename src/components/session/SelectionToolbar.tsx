/**
 * SelectionToolbar - Floating toolbar for bulk selection actions
 *
 * This component displays a floating toolbar at the bottom center of the screen
 * when sessions are selected. Provides actions for bulk operations.
 *
 * V2 Enhancement: Multi-select with keyboard shortcuts and visual feedback
 * V2 Enhancement: Bulk analysis with progress tracking and cancellation
 *
 * Features:
 * - Slide-in animation from bottom
 * - Selection count display
 * - Open 1-4 sessions in tmux4 layout with proper working directories
 * - Bulk analyze selected sessions
 * - Progress bar during bulk operations
 * - Cancel button for ongoing operations
 * - Select all/Deselect all toggle
 * - Exit selection mode
 * - Warning for >4 sessions (tmux limit)
 * - ARIA labels for accessibility
 *
 * @example
 * ```tsx
 * <SelectionToolbar
 *   selectedCount={5}
 *   totalCount={100}
 *   selectedSessionIds={['id1', 'id2', ...]}
 *   onSelectAll={() => selectAll(allSessionIds)}
 *   onClearSelection={() => clearSelection()}
 *   onExitSelectionMode={() => exitSelectionMode()}
 * />
 * ```
 *
 * @module components/session/SelectionToolbar
 */

import { useState } from 'react';

import { X, CheckSquare, Square, Sparkles, Loader2, Grid2X2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useBulkOperationsStore } from '@/stores/bulkOperationsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { cn } from '@/utils/cn';

interface SelectionToolbarProps {
  /** Number of currently selected sessions */
  selectedCount: number;

  /** Total number of sessions available */
  totalCount: number;

  /** Array of selected session IDs for bulk operations */
  selectedSessionIds: string[];

  /**
   * Callback when "Select All" is clicked
   * Should select all visible sessions
   */
  onSelectAll: () => void;

  /**
   * Callback when "Clear Selection" is clicked
   * Should deselect all sessions
   */
  onClearSelection: () => void;

  /**
   * Callback when "Exit" (X) is clicked
   * Should exit selection mode and clear selections
   */
  onExitSelectionMode: () => void;
}

/**
 * Floating toolbar for bulk selection actions.
 *
 * Appears at bottom center with slide-in animation when selections exist.
 * Provides quick access to select all, clear, and exit actions.
 * Includes bulk analysis with real-time progress tracking.
 */
export function SelectionToolbar({
  selectedCount,
  totalCount,
  selectedSessionIds,
  onSelectAll,
  onClearSelection,
  onExitSelectionMode,
}: SelectionToolbarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const { isRunning, total, completed, startBulkAnalyze, cancelOperation } =
    useBulkOperationsStore();
  const { settings } = useSettingsStore();
  const [isOpeningTmux, setIsOpeningTmux] = useState(false);
  const [tmuxError, setTmuxError] = useState<string | null>(null);

  // Calculate progress percentage
  const progressPercentage = total > 0 ? (completed / total) * 100 : 0;

  // Tmux4 validation - enabled for users with tmux installed
  // The IPC handler validates tmux installation and returns error if not available
  const canOpenTmux = selectedCount >= 1 && selectedCount <= 4 && !isRunning;
  const exceedsTmuxLimit = selectedCount > 4;

  const handleBulkAnalyze = async () => {
    if (selectedSessionIds.length === 0) {
      toast.error('No sessions selected');
      return;
    }

    try {
      // Start bulk analyze operation in store
      startBulkAnalyze(selectedSessionIds);

      // Get bypass quota setting
      const bypassQuota = settings?.bypassQuotaOnForceAnalyze ?? false;

      // Trigger bulk analysis via IPC
      const result = await window.electronAPI.bulkAnalyzeSessions(selectedSessionIds, bypassQuota);

      if (!result.success) {
        toast.error('Failed to start bulk analysis', {
          description: result.error,
        });
        cancelOperation();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to start bulk analysis', {
        description: message,
      });
      cancelOperation();
    }
  };

  const handleCancel = async () => {
    try {
      await window.electronAPI.cancelBulkAnalyze();
      cancelOperation();
      toast.info('Bulk analysis cancelled');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to cancel bulk analysis', {
        description: message,
      });
    }
  };

  const handleOpenTmux4 = async () => {
    if (!canOpenTmux) return;

    setIsOpeningTmux(true);
    setTmuxError(null);

    try {
      const result = await window.electronAPI.openSessionsTmux4(selectedSessionIds);
      if (!result.success) {
        setTmuxError(result.error || 'Failed to open sessions in tmux');
        toast.error('Failed to open tmux', {
          description: result.error,
        });
      } else {
        toast.success(`Opened ${selectedSessionIds.length} sessions in tmux`);
        // Optionally clear selection after successful open
        // onClearSelection();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTmuxError(message);
      toast.error('Failed to open tmux', {
        description: message,
      });
    } finally {
      setIsOpeningTmux(false);
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Bulk selection actions"
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
        'rounded-lg border border-border bg-background shadow-lg',
        'flex min-w-[400px] flex-col gap-3 px-4 py-3',
        'duration-300 animate-in slide-in-from-bottom-4'
      )}
    >
      {/* Progress bar (shown when operation is running) */}
      {isRunning && (
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Analyzing sessions...</span>
            <span className="tabular-nums">
              {completed} / {total}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      )}

      {/* Warning for >4 sessions (tmux limit) */}
      {exceedsTmuxLimit && (
        <Alert variant="default" className="py-2">
          <AlertTriangle className="size-4" />
          <AlertDescription className="text-xs">
            Maximum 4 sessions can be opened in tmux. First 4 will be used.
          </AlertDescription>
        </Alert>
      )}

      {/* Tmux error display */}
      {tmuxError && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="size-4" />
          <AlertDescription className="text-xs">{tmuxError}</AlertDescription>
        </Alert>
      )}

      {/* Main toolbar content */}
      <div className="flex items-center gap-4">
        {/* Selection count */}
        <div className="text-sm font-medium text-foreground">
          <span className="tabular-nums">{selectedCount}</span>
          {' of '}
          <span className="tabular-nums">{totalCount}</span>
          {' selected'}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Open in tmux4 button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleOpenTmux4}
          disabled={!canOpenTmux || isOpeningTmux}
          className="gap-2"
          aria-label="Open selected sessions in tmux (4 pane layout)"
          title={selectedCount > 4 ? 'Maximum 4 sessions' : undefined}
        >
          {isOpeningTmux ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Opening...
            </>
          ) : (
            <>
              <Grid2X2 className="size-4" />
              Open in tmux (4)
            </>
          )}
        </Button>

        {/* Analyze button */}
        <Button
          variant="default"
          size="sm"
          onClick={handleBulkAnalyze}
          disabled={isRunning || selectedCount === 0}
          className="gap-2"
          aria-label="Analyze selected sessions"
        >
          {isRunning ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Analyze Selected
            </>
          )}
        </Button>

        {/* Cancel button (shown when operation is running) */}
        {isRunning && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="gap-2"
            aria-label="Cancel bulk analysis"
          >
            <X className="size-4" />
            Cancel
          </Button>
        )}

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Select all / Deselect all toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={allSelected ? onClearSelection : onSelectAll}
          disabled={isRunning}
          className="gap-2"
          aria-label={allSelected ? 'Deselect all sessions' : 'Select all sessions'}
        >
          {allSelected ? (
            <>
              <Square className="size-4" />
              Deselect all
            </>
          ) : (
            <>
              <CheckSquare className="size-4" />
              Select all
            </>
          )}
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Exit selection mode */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onExitSelectionMode}
          disabled={isRunning}
          className="gap-2"
          aria-label="Exit selection mode"
        >
          <X className="size-4" />
          Exit
        </Button>
      </div>
    </div>
  );
}
