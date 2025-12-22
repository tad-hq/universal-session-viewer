// SettingsModal Component - Migrated to shadcn/ui Dialog
// Props interface is FROZEN - DO NOT MODIFY
//
// WCAG 2.1 AA Accessibility:
// - Dialog component handles focus trap automatically via Radix
// - Escape key closes modal (built into Radix Dialog)
// - aria-modal and role="dialog" handled by Radix
// - Focus management handled by Radix Dialog
// - Custom confirmation dialogs (no native confirm/alert)
// - Proper label associations for form controls
//
// Continuation Display settings section:
// - groupContinuations: Display related sessions as one entry
// - showContinuationBadges: Show badges indicating continuation status
// - collapseGroupsByDefault: Collapse continuation groups by default

import { useEffect, useRef, useState } from 'react';

import { ClaudeCodeSettings } from './ClaudeCodeSettings';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';

import type { Settings, TerminalApplication } from '../../types';
import type { ContinuationsDetected } from '../../types/ipc';

// Helper component for path input with validation and browse button
interface PathInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
  onBrowse: () => void;
  validationState: { valid: boolean; expandedPath: string; error?: string } | null;
  isValidating: boolean;
}

function PathInput({
  id,
  label,
  value,
  onChange,
  hint,
  onBrowse,
  validationState,
  isValidating,
}: PathInputProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`flex-1 font-mono text-sm ${
            validationState && !validationState.valid ? 'border-destructive' : ''
          }`}
          placeholder="~/.claude/projects"
          aria-describedby={`${id}-hint ${id}-validation`}
          aria-invalid={validationState && !validationState.valid ? true : undefined}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBrowse}
          className="shrink-0"
          aria-label={`Browse for ${label}`}
        >
          Browse...
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
      {isValidating && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <svg className="size-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Validating path...
        </p>
      )}
      {validationState && !validationState.valid && (
        <p id={`${id}-validation`} className="text-xs text-destructive" role="alert">
          {validationState.error}
        </p>
      )}
      {validationState && validationState.valid && validationState.expandedPath !== value && (
        <p className="text-xs text-muted-foreground">
          Expands to: <code className="rounded bg-muted px-1">{validationState.expandedPath}</code>
        </p>
      )}
    </div>
  );
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  formData: Settings;
  onFormDataChange: (data: Settings) => void;
  isSaving: boolean;
  onSave: (settings: Settings) => Promise<boolean>;
  onClearCache: () => Promise<{ success: boolean; cleared: number }>;
}

/**
 * SettingsModal Component
 *
 * Design:
 * - Modal dialog with backdrop
 * - Clean form layout with grouped sections
 * - Analysis Settings section
 * - UI Settings section
 * - Advanced Settings section
 * - Cache Management section with clear confirmation
 * - Save and Cancel buttons
 *
 * WCAG 2.1 AA Accessibility:
 * - Focus trap keeps keyboard navigation within modal (handled by Radix)
 * - Escape key closes modal (handled by Radix)
 * - aria-modal and role="dialog" for screen readers (handled by Radix)
 * - Proper label associations for form controls
 *
 * shadcn/ui components used: Dialog, Input, Checkbox, Select, Button, Label, Separator
 */
export function SettingsModal({
  isOpen,
  onClose,
  formData,
  onFormDataChange,
  isSaving,
  onSave,
  onClearCache,
}: SettingsModalProps) {
  // Ref for initial focus on first input
  const firstInputRef = useRef<HTMLInputElement>(null);

  // WCAG 2.1 AA: Custom confirmation dialog state (replaces native confirm/alert)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    showCancel: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', showCancel: true, onConfirm: () => {} });

  // Continuation re-scan state
  const [isRescanning, setIsRescanning] = useState(false);
  const [rescanStats, setRescanStats] = useState<ContinuationsDetected | null>(null);
  const [rescanError, setRescanError] = useState<string | null>(null);

  // Terminal Settings: Platform detection - process.platform unavailable in sandboxed renderer
  const [platform, setPlatform] = useState<'darwin' | 'linux' | 'win32'>('darwin');

  // Custom command validation
  const [customCommandError, setCustomCommandError] = useState<string | null>(null);

  // Tmux prefix validation (alphanumeric, hyphens, underscores only)
  const [tmuxPrefixError, setTmuxPrefixError] = useState<string | null>(null);

  // Path validation state
  type PathValidationState = { valid: boolean; expandedPath: string; error?: string } | null;
  const [pathValidation, setPathValidation] = useState<{
    claudeProjects: PathValidationState;
    sessionViewerData: PathValidationState;
    promptsDirectory: PathValidationState;
  }>({
    claudeProjects: null,
    sessionViewerData: null,
    promptsDirectory: null,
  });
  const [pathValidating, setPathValidating] = useState<{
    claudeProjects: boolean;
    sessionViewerData: boolean;
    promptsDirectory: boolean;
  }>({
    claudeProjects: false,
    sessionViewerData: false,
    promptsDirectory: false,
  });

  // Fetch platform on mount
  useEffect(() => {
    const fetchPlatform = async () => {
      try {
        const result = await window.electronAPI.getPlatform();
        if (result.success) {
          setPlatform(result.platform);
        }
      } catch (error) {
        console.error('Failed to get platform:', error);
      }
    };
    void fetchPlatform();
  }, []);

  // Validate custom command when it changes
  useEffect(() => {
    if (formData.terminal?.application === 'custom') {
      const cmd = formData.terminal.customLaunchCommand || '';
      if (cmd && !cmd.includes('{cmd}')) {
        setCustomCommandError('Custom command must include {cmd} placeholder');
      } else {
        setCustomCommandError(null);
      }
    } else {
      setCustomCommandError(null);
    }
  }, [formData.terminal?.application, formData.terminal?.customLaunchCommand]);

  // Validate tmux prefix
  useEffect(() => {
    if (formData.terminal?.useTmux) {
      const prefix = formData.terminal.tmuxSessionPrefix || '';
      // tmux session names: alphanumeric, hyphens, underscores
      if (prefix && !/^[a-zA-Z0-9_-]*$/.test(prefix)) {
        setTmuxPrefixError('Prefix can only contain letters, numbers, hyphens, and underscores');
      } else {
        setTmuxPrefixError(null);
      }
    } else {
      setTmuxPrefixError(null);
    }
  }, [formData.terminal?.useTmux, formData.terminal?.tmuxSessionPrefix]);

  // Path validation with debounce
  const validatePathDebounced = async (
    pathKey: 'claudeProjects' | 'sessionViewerData' | 'promptsDirectory',
    value: string
  ) => {
    if (!value) {
      setPathValidation((prev) => ({ ...prev, [pathKey]: null }));
      return;
    }

    setPathValidating((prev) => ({ ...prev, [pathKey]: true }));

    try {
      const result = await window.electronAPI.validatePath(value);
      setPathValidation((prev) => ({ ...prev, [pathKey]: result }));
    } catch (error) {
      setPathValidation((prev) => ({
        ...prev,
        [pathKey]: { valid: false, expandedPath: value, error: 'Validation failed' },
      }));
    } finally {
      setPathValidating((prev) => ({ ...prev, [pathKey]: false }));
    }
  };

  // Validate paths when they change (with debounce effect)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.paths?.claudeProjects) {
        void validatePathDebounced('claudeProjects', formData.paths.claudeProjects);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.paths?.claudeProjects]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.paths?.sessionViewerData) {
        void validatePathDebounced('sessionViewerData', formData.paths.sessionViewerData);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.paths?.sessionViewerData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.paths?.promptsDirectory) {
        void validatePathDebounced('promptsDirectory', formData.paths.promptsDirectory);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.paths?.promptsDirectory]);

  // Browse for directory handler
  const handleBrowsePath = async (
    pathKey: 'claudeProjects' | 'sessionViewerData' | 'promptsDirectory'
  ) => {
    try {
      const result = await window.electronAPI.browseDirectory();
      if (!result.canceled && result.path) {
        onFormDataChange({
          ...formData,
          paths: { ...formData.paths, [pathKey]: result.path },
        });
        // Immediately validate the selected path
        void validatePathDebounced(pathKey, result.path);
      }
    } catch (error) {
      console.error('Failed to browse directory:', error);
    }
  };

  // Update path in form data
  const handlePathChange = (
    pathKey: 'claudeProjects' | 'sessionViewerData' | 'promptsDirectory',
    value: string
  ) => {
    onFormDataChange({
      ...formData,
      paths: { ...formData.paths, [pathKey]: value },
    });
  };

  const handleSave = async () => {
    // Validate custom command before saving
    if (formData.terminal?.application === 'custom') {
      const cmd = formData.terminal.customLaunchCommand || '';
      if (!cmd) {
        setCustomCommandError('Custom command is required when using custom terminal');
        return;
      }
      if (!cmd.includes('{cmd}')) {
        setCustomCommandError('Custom command must include {cmd} placeholder');
        return;
      }
    }

    // Validate tmux prefix
    if (formData.terminal?.useTmux) {
      const prefix = formData.terminal.tmuxSessionPrefix || '';
      if (prefix && !/^[a-zA-Z0-9_-]*$/.test(prefix)) {
        setTmuxPrefixError('Prefix can only contain letters, numbers, hyphens, and underscores');
        return;
      }
    }

    const success = await onSave(formData);
    if (success) {
      onClose();
    }
  };

  // Handler for re-scanning continuation chains
  const handleRescanContinuations = async () => {
    setIsRescanning(true);
    setRescanError(null);
    setRescanStats(null);

    try {
      const result = await window.electronAPI.resolveContinuationChains();
      if (result.success && result.stats) {
        setRescanStats(result.stats);
      } else if (!result.success) {
        setRescanError(result.error || 'Failed to re-scan continuations');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setRescanError(message);
    } finally {
      setIsRescanning(false);
    }
  };

  // WCAG 2.1 AA: Custom confirmation dialog handler (no native confirm/alert)
  const handleClearCache = (): void => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Cache',
      message:
        'Are you sure you want to clear all cached analyses? This will force re-analysis of all sessions on next view.',
      showCancel: true,
      onConfirm: () => {
        void (async () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          try {
            const result = await onClearCache();
            if (result.success) {
              setConfirmDialog({
                isOpen: true,
                title: 'Cache Cleared',
                message: `Cleared ${result.cleared} cached analyses`,
                showCancel: false,
                onConfirm: () => setConfirmDialog((prev) => ({ ...prev, isOpen: false })),
              });
            }
          } catch (error) {
            console.error('Failed to clear cache:', error);
            setConfirmDialog({
              isOpen: true,
              title: 'Error',
              message: 'Failed to clear cache. Please try again.',
              showCancel: false,
              onConfirm: () => setConfirmDialog((prev) => ({ ...prev, isOpen: false })),
            });
          }
        })();
      },
    });
  };

  // Focus first input when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[80vh] max-w-[700px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Analysis Settings */}
            <fieldset className="space-y-4">
              <legend className="font-medium text-primary">Analysis Settings</legend>

              <div className="flex items-center justify-between">
                <Label htmlFor="dailyAnalysisLimit" className="font-normal text-muted-foreground">
                  Daily Analysis Limit:
                </Label>
                <Input
                  ref={firstInputRef}
                  id="dailyAnalysisLimit"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.dailyAnalysisLimit}
                  onChange={(e) =>
                    onFormDataChange({
                      ...formData,
                      dailyAnalysisLimit: parseInt(e.target.value) || 1,
                    })
                  }
                  className="h-8 w-20"
                  aria-describedby="daily-limit-hint"
                />
              </div>
              <span id="daily-limit-hint" className="sr-only">
                Enter a number between 1 and 100
              </span>

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="autoAnalyze"
                  className="cursor-pointer font-normal text-muted-foreground"
                >
                  Auto-analyze New Sessions:
                </Label>
                <Checkbox
                  id="autoAnalyze"
                  checked={formData.autoAnalyzeNewSessions}
                  onCheckedChange={(checked) =>
                    onFormDataChange({ ...formData, autoAnalyzeNewSessions: checked === true })
                  }
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="bypassQuota"
                    className="cursor-pointer font-normal text-muted-foreground"
                  >
                    Bypass daily quota limit when manually re-analyzing sessions:
                  </Label>
                  <Checkbox
                    id="bypassQuota"
                    checked={formData.bypassQuotaOnForceAnalyze}
                    onCheckedChange={(checked) =>
                      onFormDataChange({ ...formData, bypassQuotaOnForceAnalyze: checked === true })
                    }
                  />
                </div>
                <p className="pl-1 text-xs text-muted-foreground">
                  When enabled, manual re-analysis will not be blocked by the daily quota limit. The
                  analysis will still count toward your usage statistics.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="cacheDuration" className="font-normal text-muted-foreground">
                  Cache Duration (days):
                </Label>
                <Input
                  id="cacheDuration"
                  type="number"
                  min={1}
                  max={365}
                  value={formData.cacheDurationDays}
                  onChange={(e) =>
                    onFormDataChange({
                      ...formData,
                      cacheDurationDays: parseInt(e.target.value) || 1,
                    })
                  }
                  className="h-8 w-20"
                />
              </div>
            </fieldset>

            <Separator />

            {/* UI Settings */}
            <fieldset className="space-y-4">
              <legend className="font-medium text-primary">UI Settings</legend>

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="showTimestamps"
                  className="cursor-pointer font-normal text-muted-foreground"
                >
                  Show Session Timestamps:
                </Label>
                <Checkbox
                  id="showTimestamps"
                  checked={formData.showSessionTimestamps}
                  onCheckedChange={(checked) =>
                    onFormDataChange({ ...formData, showSessionTimestamps: checked === true })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="showPaths"
                  className="cursor-pointer font-normal text-muted-foreground"
                >
                  Show Project Paths:
                </Label>
                <Checkbox
                  id="showPaths"
                  checked={formData.showProjectPaths}
                  onCheckedChange={(checked) =>
                    onFormDataChange({ ...formData, showProjectPaths: checked === true })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="sortOrder" className="font-normal text-muted-foreground">
                  Default Sort Order:
                </Label>
                <Select
                  value={formData.defaultSortOrder}
                  onValueChange={(value) =>
                    onFormDataChange({
                      ...formData,
                      defaultSortOrder: value as Settings['defaultSortOrder'],
                    })
                  }
                >
                  <SelectTrigger
                    id="sortOrder"
                    className="h-8 w-36"
                    aria-label="Default sort order"
                  >
                    <SelectValue placeholder="Select order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modified">Modified Date</SelectItem>
                    <SelectItem value="created">Created Date</SelectItem>
                    <SelectItem value="project">Project Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </fieldset>

            <Separator />

            {/* Continuation Display Settings */}
            <fieldset className="space-y-4">
              <legend className="font-medium text-primary">Continuation Display</legend>

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="groupContinuations"
                  className="flex-1 cursor-pointer pr-4 font-normal text-muted-foreground"
                >
                  Group continuation chains
                </Label>
                <Switch
                  id="groupContinuations"
                  checked={formData.groupContinuations}
                  onCheckedChange={(checked) =>
                    onFormDataChange({ ...formData, groupContinuations: checked })
                  }
                  aria-describedby="groupContinuations-hint"
                />
              </div>
              <p id="groupContinuations-hint" className="-mt-2 pl-1 text-xs text-muted-foreground">
                Display related sessions as one entry with expandable timeline
              </p>

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="showContinuationBadges"
                  className="flex-1 cursor-pointer pr-4 font-normal text-muted-foreground"
                >
                  Show continuation badges
                </Label>
                <Switch
                  id="showContinuationBadges"
                  checked={formData.showContinuationBadges}
                  onCheckedChange={(checked) =>
                    onFormDataChange({ ...formData, showContinuationBadges: checked })
                  }
                  aria-describedby="showContinuationBadges-hint"
                />
              </div>
              <p
                id="showContinuationBadges-hint"
                className="-mt-2 pl-1 text-xs text-muted-foreground"
              >
                Show badges indicating continuation status on session cards
              </p>

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="collapseGroupsByDefault"
                  className="flex-1 cursor-pointer pr-4 font-normal text-muted-foreground"
                >
                  Collapse groups by default
                </Label>
                <Switch
                  id="collapseGroupsByDefault"
                  checked={formData.collapseGroupsByDefault}
                  onCheckedChange={(checked) =>
                    onFormDataChange({ ...formData, collapseGroupsByDefault: checked })
                  }
                  aria-describedby="collapseGroupsByDefault-hint"
                />
              </div>
              <p
                id="collapseGroupsByDefault-hint"
                className="-mt-2 pl-1 text-xs text-muted-foreground"
              >
                Start with continuation groups collapsed in the session list
              </p>

              <Separator className="my-4" />

              {/* Continuation Management */}
              <div className="space-y-3">
                <Label className="font-normal text-muted-foreground">
                  Continuation Chain Management
                </Label>

                <Button
                  variant="outline"
                  onClick={handleRescanContinuations}
                  disabled={isRescanning}
                  className="w-full"
                  aria-describedby="rescan-hint"
                >
                  {isRescanning ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="size-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Scanning...
                    </span>
                  ) : (
                    'Re-scan All Continuations'
                  )}
                </Button>
                <p id="rescan-hint" className="text-xs text-muted-foreground">
                  Re-detect continuation relationships between all sessions
                </p>

                {/* Show rescan results */}
                {rescanStats && (
                  <div
                    className="space-y-2 rounded-md bg-muted p-3"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                      <svg
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Scan Complete
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">{rescanStats.chains}</span>{' '}
                        continuation chains
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{rescanStats.orphaned}</span>{' '}
                        orphaned sessions
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{rescanStats.total}</span>{' '}
                        total sessions
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{rescanStats.maxDepth}</span>{' '}
                        max chain depth
                      </div>
                    </div>
                  </div>
                )}

                {/* Show rescan error */}
                {rescanError && (
                  <div className="rounded-md bg-destructive/10 p-3" role="alert">
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <svg
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {rescanError}
                    </div>
                  </div>
                )}
              </div>
            </fieldset>

            <Separator />

            {/* Terminal Settings */}
            <fieldset className="space-y-4">
              <legend className="font-medium text-primary">Terminal Settings</legend>

              <div className="flex items-center justify-between">
                <Label htmlFor="terminalApp" className="font-normal text-muted-foreground">
                  Terminal Application:
                </Label>
                <Select
                  value={
                    formData.terminal?.application ||
                    (platform === 'darwin' ? 'Terminal.app' : 'gnome-terminal')
                  }
                  onValueChange={(value) =>
                    onFormDataChange({
                      ...formData,
                      terminal: { ...formData.terminal, application: value as TerminalApplication },
                    })
                  }
                >
                  <SelectTrigger
                    id="terminalApp"
                    className="h-8 w-40"
                    aria-label="Terminal application"
                  >
                    <SelectValue placeholder="Select terminal" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Show platform-appropriate default terminal */}
                    {platform === 'darwin' && (
                      <SelectItem value="Terminal.app">Terminal.app</SelectItem>
                    )}
                    {platform === 'linux' && (
                      <SelectItem value="gnome-terminal">gnome-terminal</SelectItem>
                    )}
                    <SelectItem value="Ghostty">Ghostty</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="pl-1 text-xs text-muted-foreground">
                Terminal application to use when resuming sessions
              </p>

              {formData.terminal?.application === 'custom' && (
                <div className="space-y-1">
                  <Label htmlFor="customTerminalCmd" className="font-normal text-muted-foreground">
                    Custom Launch Command:
                  </Label>
                  <Input
                    id="customTerminalCmd"
                    type="text"
                    placeholder="kitty sh -c '{cmd}'"
                    value={formData.terminal?.customLaunchCommand || ''}
                    onChange={(e) =>
                      onFormDataChange({
                        ...formData,
                        terminal: { ...formData.terminal, customLaunchCommand: e.target.value },
                      })
                    }
                    className={`font-mono text-sm ${customCommandError ? 'border-destructive' : ''}`}
                    aria-describedby="custom-cmd-hint"
                    aria-invalid={!!customCommandError}
                  />
                  {customCommandError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {customCommandError}
                    </p>
                  ) : (
                    <p id="custom-cmd-hint" className="text-xs text-muted-foreground">
                      Use {'{cmd}'} as placeholder for the Claude command. Example: kitty sh -c '
                      {'{cmd}'}'
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="useTmux"
                  className="flex-1 cursor-pointer pr-4 font-normal text-muted-foreground"
                >
                  Use tmux for session management
                </Label>
                <Switch
                  id="useTmux"
                  checked={formData.terminal?.useTmux || false}
                  onCheckedChange={(checked) =>
                    onFormDataChange({
                      ...formData,
                      terminal: { ...formData.terminal, useTmux: checked },
                    })
                  }
                  aria-describedby="useTmux-hint"
                />
              </div>
              <p id="useTmux-hint" className="-mt-2 pl-1 text-xs text-muted-foreground">
                When enabled, sessions open in tmux for better session management
              </p>

              {formData.terminal?.useTmux && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="tmuxPrefix" className="font-normal text-muted-foreground">
                      Tmux Session Prefix:
                    </Label>
                    <Input
                      id="tmuxPrefix"
                      type="text"
                      value={formData.terminal?.tmuxSessionPrefix || 'claude-'}
                      onChange={(e) =>
                        onFormDataChange({
                          ...formData,
                          terminal: { ...formData.terminal, tmuxSessionPrefix: e.target.value },
                        })
                      }
                      className={`h-8 w-32 font-mono ${tmuxPrefixError ? 'border-destructive' : ''}`}
                      placeholder="claude-"
                      aria-invalid={!!tmuxPrefixError}
                    />
                  </div>
                  {tmuxPrefixError && (
                    <p className="text-right text-xs text-destructive" role="alert">
                      {tmuxPrefixError}
                    </p>
                  )}
                </div>
              )}
            </fieldset>

            <Separator />

            {/* Advanced Settings */}
            <fieldset className="space-y-4">
              <legend className="font-medium text-primary">Advanced Settings</legend>

              <div className="flex items-center justify-between">
                <Label htmlFor="maxConcurrent" className="font-normal text-muted-foreground">
                  Max Concurrent Analyses:
                </Label>
                <Input
                  id="maxConcurrent"
                  type="number"
                  min={1}
                  max={5}
                  value={formData.maxConcurrentAnalyses}
                  onChange={(e) =>
                    onFormDataChange({
                      ...formData,
                      maxConcurrentAnalyses: parseInt(e.target.value) || 1,
                    })
                  }
                  className="h-8 w-20"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="analysisTimeout" className="font-normal text-muted-foreground">
                  Analysis Timeout (seconds):
                </Label>
                <Input
                  id="analysisTimeout"
                  type="number"
                  min={60}
                  max={1800}
                  value={formData.analysisTimeout / 1000}
                  onChange={(e) =>
                    onFormDataChange({
                      ...formData,
                      analysisTimeout: (parseInt(e.target.value) || 60) * 1000,
                    })
                  }
                  className="h-8 w-20"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="debugLogging"
                  className="cursor-pointer font-normal text-muted-foreground"
                >
                  Enable Debug Logging:
                </Label>
                <Checkbox
                  id="debugLogging"
                  checked={formData.enableDebugLogging}
                  onCheckedChange={(checked) =>
                    onFormDataChange({ ...formData, enableDebugLogging: checked === true })
                  }
                />
              </div>
            </fieldset>

            <Separator />

            {/* Claude Code Settings */}
            <ClaudeCodeSettings
              settings={formData.claudeCode}
              onChange={(claudeCode) => onFormDataChange({ ...formData, claudeCode })}
            />

            <Separator />

            {/* Path Settings */}
            <fieldset className="space-y-4">
              <legend className="font-medium text-primary">Path Settings</legend>
              <p className="-mt-2 text-xs text-muted-foreground">
                Configure where the app looks for sessions and stores data. Paths support ~ for home
                directory.
              </p>

              <PathInput
                id="claudeProjects"
                label="Claude Projects Directory:"
                value={formData.paths?.claudeProjects || '~/.claude/projects'}
                onChange={(value) => handlePathChange('claudeProjects', value)}
                hint="Primary directory where Claude Code stores session JSONL files"
                onBrowse={() => handleBrowsePath('claudeProjects')}
                validationState={pathValidation.claudeProjects}
                isValidating={pathValidating.claudeProjects}
              />

              <PathInput
                id="sessionViewerData"
                label="Session Viewer Data Directory:"
                value={formData.paths?.sessionViewerData || '~/.universal-session-viewer'}
                onChange={(value) => handlePathChange('sessionViewerData', value)}
                hint="Directory for database, cache, and application state"
                onBrowse={() => handleBrowsePath('sessionViewerData')}
                validationState={pathValidation.sessionViewerData}
                isValidating={pathValidating.sessionViewerData}
              />

              <PathInput
                id="promptsDirectory"
                label="Prompts Directory:"
                value={formData.paths?.promptsDirectory || '~/.claude/prompts'}
                onChange={(value) => handlePathChange('promptsDirectory', value)}
                hint="Directory containing custom prompts for session resume"
                onBrowse={() => handleBrowsePath('promptsDirectory')}
                validationState={pathValidation.promptsDirectory}
                isValidating={pathValidating.promptsDirectory}
              />

              {/* Note about additional paths */}
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <strong>Note:</strong> Additional discovery paths and exclude patterns can be
                configured in the settings file. Changes to path settings take effect after
                restarting the app.
              </div>
            </fieldset>

            <Separator />

            {/* Cache Management */}
            <fieldset className="space-y-4">
              <legend className="font-medium text-primary">Cache Management</legend>
              <Button variant="destructive" onClick={handleClearCache} className="w-full">
                Clear All Cached Analyses
              </Button>
            </fieldset>
          </div>

          <DialogFooter className="gap-3 sm:gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WCAG 2.1 AA: Custom confirmation dialog (replaces native confirm/alert) */}
      <Dialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) => !open && setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">{confirmDialog.message}</p>
          <DialogFooter className="gap-3 sm:gap-3">
            {confirmDialog.showCancel && (
              <Button
                variant="secondary"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
            )}
            <Button
              variant={confirmDialog.showCancel ? 'destructive' : 'default'}
              onClick={confirmDialog.onConfirm}
            >
              {confirmDialog.showCancel ? 'Clear Cache' : 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
