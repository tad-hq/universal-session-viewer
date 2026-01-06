/**
 * AdditionalPathsSection Component
 *
 * Manages additional discovery paths for browsing sessions from multiple directories.
 * Follows the controlled form pattern: UI → formData → onFormDataChange() → saveSettings()
 *
 * Features:
 * - Add/remove additional discovery paths
 * - Validation: existence, duplicates (exact + symlink), primary path conflict
 * - Symlink resolution for deduplication
 * - Empty state display
 *
 * Pattern: Follows excludePaths section (SettingsModal.tsx:1053-1129)
 */

import { useState } from 'react';

import { Button } from '../ui/button';

import type { Settings } from '../../types/settings';

interface AdditionalPathsSectionProps {
  formData: Settings;
  onFormDataChange: (data: Settings) => void;
}

interface ValidationError {
  message: string;
}

export function AdditionalPathsSection({
  formData,
  onFormDataChange,
}: AdditionalPathsSectionProps) {
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const claudeProjectsPath = formData.paths.claudeProjects;
  const additionalPaths = formData.paths.additionalDiscoveryPaths ?? [];

  /**
   * Validates a new path before adding it
   * Checks for:
   * - Path existence (via IPC)
   * - Symlink resolution (via IPC)
   * - Exact duplicates in additionalDiscoveryPaths
   * - Duplicate with primary claudeProjects path
   */
  async function validatePath(newPath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Validate path via IPC (checks existence and resolves symlinks)
      const validation = await window.electronAPI.validatePath(newPath);

      if (!validation.valid) {
        return {
          valid: false,
          error: validation.error || 'Directory does not exist',
        };
      }

      const resolvedPath = validation.expandedPath;

      // Check if resolved path matches primary claudeProjects path
      const primaryValidation = await window.electronAPI.validatePath(claudeProjectsPath);
      if (primaryValidation.valid && resolvedPath === primaryValidation.expandedPath) {
        return {
          valid: false,
          error: 'This is already your primary Claude path',
        };
      }

      // Check for duplicates in existing additional paths
      for (const existingPath of additionalPaths) {
        // Check exact match first
        if (existingPath === newPath) {
          return {
            valid: false,
            error: 'Path already added',
          };
        }

        // Check resolved path match (symlink deduplication)
        const existingValidation = await window.electronAPI.validatePath(existingPath);
        if (existingValidation.valid && resolvedPath === existingValidation.expandedPath) {
          return {
            valid: false,
            error: `Duplicate path (resolves to ${resolvedPath})`,
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: 'Validation failed',
      };
    }
  }

  /**
   * Handles adding a new path via directory picker dialog
   */
  async function handleAddPath() {
    try {
      // Open directory dialog
      const result = await window.electronAPI.browseDirectory();

      if (result.canceled || !result.path) {
        return;
      }

      const selectedPath = result.path;

      // Validate the selected path
      const validation = await validatePath(selectedPath);

      if (!validation.valid) {
        setValidationError({ message: validation.error || 'Invalid path' });
        return;
      }

      // Update formData with new path (follows excludePaths pattern)
      const updatedPaths = [...additionalPaths, selectedPath];
      onFormDataChange({
        ...formData,
        paths: {
          ...formData.paths,
          additionalDiscoveryPaths: updatedPaths,
        },
      });

      // Clear any previous validation errors
      setValidationError(null);
    } catch (error) {
      setValidationError({
        message: error instanceof Error ? error.message : 'Failed to add path',
      });
    }
  }

  /**
   * Handles removing a path from the list
   */
  function handleRemovePath(pathToRemove: string) {
    // Update formData by filtering out the removed path (follows excludePaths pattern)
    const updatedPaths = additionalPaths.filter((p) => p !== pathToRemove);
    onFormDataChange({
      ...formData,
      paths: {
        ...formData.paths,
        additionalDiscoveryPaths: updatedPaths,
      },
    });

    // Clear validation errors when user removes a path
    setValidationError(null);
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Additional Session Directories</h3>
        <p className="text-xs text-muted-foreground">
          Add backup or external directories to browse sessions alongside your primary path.
          Paths are checked for duplicates and symlinks are resolved automatically.
        </p>
      </div>

      {/* Add Path Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddPath}
        aria-label="Add Directory"
      >
        Add Directory
      </Button>

      {/* Validation Error */}
      {validationError !== null && (
        <div
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {validationError.message}
        </div>
      )}

      {/* Path List */}
      {additionalPaths.length > 0 && (
        <div className="space-y-2">
          {additionalPaths.map((path) => (
            <div
              key={path}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/50 p-2"
            >
              <span className="flex-1 font-mono text-sm text-foreground">{path}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 shrink-0 p-0"
                onClick={() => handleRemovePath(path)}
                aria-label={`Remove ${path}`}
              >
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {additionalPaths.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">No additional paths configured</p>
        </div>
      )}
    </div>
  );
}
