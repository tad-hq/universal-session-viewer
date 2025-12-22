// ClaudeCodeSettings Component - Claude CLI Settings Section
// Implements settings for Claude binary path, model selection, permissions, etc.
//
// WCAG 2.1 AA Accessibility:
// - Proper label associations for form controls
// - Descriptive hints for each setting
// - Error messages with role="alert" for screen readers
// - Danger zone with clear warning styling

import { useEffect, useState } from 'react';

import { CLAUDE_MODELS } from '../../types/settings';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';

import type {
  ClaudeCodeSettings as ClaudeCodeSettingsType,
  PermissionMode,
} from '../../types/settings';

export interface ClaudeCodeSettingsProps {
  settings: ClaudeCodeSettingsType;
  onChange: (settings: ClaudeCodeSettingsType) => void;
}

/**
 * ClaudeCodeSettings Component
 *
 * Design requirements:
 * - Binary Path with validation and browse
 * - Model selection dropdown
 * - Permission mode selector
 * - Append system prompt textarea
 * - Max turns input
 * - Auto-resume toggle
 * - Dangerously skip permissions (danger zone with warning)
 */
export function ClaudeCodeSettings({ settings, onChange }: ClaudeCodeSettingsProps) {
  // Binary path validation state
  const [binaryValidation, setBinaryValidation] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);
  const [isValidatingBinary, setIsValidatingBinary] = useState(false);

  // Danger zone confirmation
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);

  // Validate binary path when it changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        if (!settings.binaryPath || settings.binaryPath === 'claude') {
          // Default - validate that claude is in PATH
          setIsValidatingBinary(true);
          try {
            const result = await window.electronAPI.validateBinaryPath('claude');
            setBinaryValidation(result);
          } catch (error) {
            setBinaryValidation({ valid: false, error: 'Validation failed' });
          } finally {
            setIsValidatingBinary(false);
          }
        } else if (settings.binaryPath.trim() !== '') {
          // Custom path - validate it
          setIsValidatingBinary(true);
          try {
            const result = await window.electronAPI.validateBinaryPath(settings.binaryPath);
            setBinaryValidation(result);
          } catch (error) {
            setBinaryValidation({ valid: false, error: 'Validation failed' });
          } finally {
            setIsValidatingBinary(false);
          }
        } else {
          setBinaryValidation(null);
        }
      })();
    }, 500);

    return () => clearTimeout(timer);
  }, [settings.binaryPath]);

  // Handle dangerous permission toggle
  const handleDangerousToggle = (checked: boolean) => {
    if (checked) {
      // Show confirmation before enabling
      setShowDangerConfirm(true);
    } else {
      // Disable immediately
      onChange({ ...settings, dangerouslySkipPermissions: false });
    }
  };

  // Confirm dangerous permissions
  const confirmDangerous = () => {
    onChange({ ...settings, dangerouslySkipPermissions: true });
    setShowDangerConfirm(false);
  };

  return (
    <fieldset className="space-y-4">
      <legend className="font-medium text-primary">Claude Code Settings</legend>
      <p className="-mt-2 text-xs text-muted-foreground">
        Configure how Claude CLI is invoked when resuming sessions.
      </p>

      {/* Binary Path */}
      <div className="space-y-1">
        <Label htmlFor="binaryPath" className="font-normal text-muted-foreground">
          Claude Binary Path:
        </Label>
        <Input
          id="binaryPath"
          type="text"
          value={settings.binaryPath}
          onChange={(e) => onChange({ ...settings, binaryPath: e.target.value })}
          className={`font-mono text-sm ${
            binaryValidation && !binaryValidation.valid ? 'border-destructive' : ''
          }`}
          placeholder="claude"
          aria-describedby="binaryPath-hint binaryPath-validation"
          aria-invalid={binaryValidation && !binaryValidation.valid ? true : undefined}
        />
        <p id="binaryPath-hint" className="text-xs text-muted-foreground">
          Leave as &quot;claude&quot; to use PATH, or specify full path to binary
        </p>
        {isValidatingBinary && (
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
            Validating binary...
          </p>
        )}
        {binaryValidation && !binaryValidation.valid && (
          <p id="binaryPath-validation" className="text-xs text-destructive" role="alert">
            {binaryValidation.error}
          </p>
        )}
        {binaryValidation && binaryValidation.valid && (
          <p className="flex items-center gap-1 text-xs text-green-600">
            <svg
              className="size-3"
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
            Binary found and executable
          </p>
        )}
      </div>

      {/* Model Selection */}
      <div className="flex items-center justify-between">
        <Label htmlFor="model" className="font-normal text-muted-foreground">
          Default Model:
        </Label>
        <Select
          value={settings.model}
          onValueChange={(value) => onChange({ ...settings, model: value })}
        >
          <SelectTrigger id="model" className="h-8 w-64" aria-label="Default model">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {CLAUDE_MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="-mt-2 pl-1 text-xs text-muted-foreground">
        Model used for session resume (when applicable)
      </p>

      {/* Permission Mode */}
      <div className="flex items-center justify-between">
        <Label htmlFor="permissionMode" className="font-normal text-muted-foreground">
          Permission Mode:
        </Label>
        <Select
          value={settings.permissionMode}
          onValueChange={(value) =>
            onChange({ ...settings, permissionMode: value as PermissionMode })
          }
        >
          <SelectTrigger id="permissionMode" className="h-8 w-44" aria-label="Permission mode">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="acceptEdits">Accept Edits</SelectItem>
            <SelectItem value="plan">Plan Only</SelectItem>
            <SelectItem value="bypassPermissions">Bypass (Careful!)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="-mt-2 pl-1 text-xs text-muted-foreground">
        How Claude handles permission prompts during execution
      </p>

      {/* Max Turns */}
      <div className="flex items-center justify-between">
        <Label htmlFor="maxTurns" className="font-normal text-muted-foreground">
          Max Turns:
        </Label>
        <Input
          id="maxTurns"
          type="number"
          min={0}
          max={100}
          value={settings.maxTurns}
          onChange={(e) => onChange({ ...settings, maxTurns: parseInt(e.target.value) || 0 })}
          className="h-8 w-20"
          aria-describedby="maxTurns-hint"
        />
      </div>
      <p id="maxTurns-hint" className="-mt-2 pl-1 text-xs text-muted-foreground">
        Maximum conversation turns (0 = unlimited)
      </p>

      {/* Append System Prompt */}
      <div className="space-y-1">
        <Label htmlFor="appendSystemPrompt" className="font-normal text-muted-foreground">
          Additional System Prompt:
        </Label>
        <Textarea
          id="appendSystemPrompt"
          value={settings.appendSystemPrompt}
          onChange={(e) => onChange({ ...settings, appendSystemPrompt: e.target.value })}
          className="min-h-[80px] font-mono text-sm"
          placeholder="Optional additional instructions for Claude..."
          aria-describedby="appendSystemPrompt-hint"
        />
        <p id="appendSystemPrompt-hint" className="text-xs text-muted-foreground">
          This text is appended to the system prompt for all resumed sessions
        </p>
      </div>

      {/* Auto-Resume */}
      <div className="flex items-center justify-between">
        <Label
          htmlFor="autoResume"
          className="flex-1 cursor-pointer pr-4 font-normal text-muted-foreground"
        >
          Auto-resume most recent session on launch
        </Label>
        <Switch
          id="autoResume"
          checked={settings.autoResume}
          onCheckedChange={(checked) => onChange({ ...settings, autoResume: checked })}
          aria-describedby="autoResume-hint"
        />
      </div>
      <p id="autoResume-hint" className="-mt-2 pl-1 text-xs text-muted-foreground">
        Prompt to resume the last active session when app starts
      </p>

      {/* Danger Zone */}
      <div className="space-y-3 rounded-md border border-destructive/20 bg-destructive/10 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Danger Zone
        </div>

        <div className="flex items-center justify-between">
          <Label
            htmlFor="dangerouslySkipPermissions"
            className="flex-1 cursor-pointer pr-4 font-normal text-destructive"
          >
            Dangerously skip all permission prompts
          </Label>
          <Switch
            id="dangerouslySkipPermissions"
            checked={settings.dangerouslySkipPermissions}
            onCheckedChange={handleDangerousToggle}
            aria-describedby="dangerouslySkipPermissions-hint"
            className="data-[state=checked]:bg-destructive"
          />
        </div>
        <p id="dangerouslySkipPermissions-hint" className="text-xs text-destructive/80">
          WARNING: This allows Claude to make file changes without confirmation. Only enable if you
          fully trust the session content.
        </p>

        {/* Confirmation dialog for dangerous permissions */}
        {showDangerConfirm && (
          <div className="mt-3 space-y-3 rounded border border-destructive/40 bg-background p-3">
            <p className="text-sm font-medium text-destructive">
              Are you sure you want to skip all permission prompts?
            </p>
            <p className="text-xs text-muted-foreground">
              This will allow Claude to make any file changes without asking. Only enable this if
              you fully understand the risks.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDangerConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmDangerous}>
                Enable Anyway
              </Button>
            </div>
          </div>
        )}
      </div>
    </fieldset>
  );
}
