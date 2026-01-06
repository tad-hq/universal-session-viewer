/**
 * AdditionalPathsSection Component Tests
 *
 * Tests for the Additional Discovery Paths settings section.
 * This component allows users to add/remove additional directories
 * to browse sessions from, with validation for:
 * - Path existence
 * - Exact duplicates
 * - Symlink resolution duplicates
 * - Primary path conflicts
 * - Parent/child relationships
 *
 * Follows the controlled form pattern (no separate store action).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdditionalPathsSection } from '@/components/settings/AdditionalPathsSection';
import type { Settings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { getMockElectronAPI } from '../../setup';

let mockElectronAPI: ReturnType<typeof getMockElectronAPI>;

beforeEach(() => {
  // Get the mock from the test setup
  mockElectronAPI = getMockElectronAPI();
});

describe('AdditionalPathsSection', () => {
  describe('Path Input and Validation', () => {
    it('renders empty state with add button', () => {
      const formData: Settings = {
        ...DEFAULT_SETTINGS,
        paths: {
          ...DEFAULT_SETTINGS.paths,
          additionalDiscoveryPaths: [],
        },
      };
      const onFormDataChange = vi.fn();

      render(
        <AdditionalPathsSection
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      );

      // Should show empty state message
      expect(screen.getByText(/no additional paths configured/i)).toBeInTheDocument();

      // Should have enabled add button
      const addButton = screen.getByRole('button', { name: /add directory/i });
      expect(addButton).toBeInTheDocument();
      expect(addButton).not.toBeDisabled();
    });

    it('adds valid directory path', async () => {
      const formData: Settings = {
        ...DEFAULT_SETTINGS,
        paths: {
          ...DEFAULT_SETTINGS.paths,
          claudeProjects: '~/.claude/projects',
          additionalDiscoveryPaths: [],
        },
      };
      const onFormDataChange = vi.fn();

      mockElectronAPI.__mocks__.browseDirectory.mockResolvedValue({
        canceled: false,
        path: '/Users/test/projects',
      });

      // Mock validatePath to handle all validation calls
      mockElectronAPI.__mocks__.validatePath.mockImplementation(async (path: string) => {
        if (path === '/Users/test/projects') {
          return { valid: true, expandedPath: '/Users/test/projects' };
        }
        if (path === '~/.claude/projects') {
          return { valid: true, expandedPath: '/Users/me/.claude/projects' };
        }
        return { valid: true, expandedPath: path };
      });

      render(
        <AdditionalPathsSection
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      );

      // Click add button
      const addButton = screen.getByRole('button', { name: /add directory/i });
      fireEvent.click(addButton);

      // Wait for async operations
      await waitFor(() => {
        expect(mockElectronAPI.__mocks__.browseDirectory).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(onFormDataChange).toHaveBeenCalledWith({
          ...formData,
          paths: {
            ...formData.paths,
            additionalDiscoveryPaths: ['/Users/test/projects'],
          },
        });
      });
    });

    it('prevents duplicate paths (exact match)', async () => {
      const formData: Settings = {
        ...DEFAULT_SETTINGS,
        paths: {
          ...DEFAULT_SETTINGS.paths,
          claudeProjects: '~/.claude/projects',
          additionalDiscoveryPaths: ['/path/a'],
        },
      };
      const onFormDataChange = vi.fn();

      mockElectronAPI.__mocks__.browseDirectory.mockResolvedValue({
        canceled: false,
        path: '/path/a',
      });

      // Mock validatePath to handle all paths being checked
      mockElectronAPI.__mocks__.validatePath.mockImplementation(async (path: string) => {
        if (path === '/path/a') {
          return { valid: true, expandedPath: '/path/a' };
        }
        if (path === '~/.claude/projects') {
          return { valid: true, expandedPath: '/Users/me/.claude/projects' };
        }
        return { valid: true, expandedPath: path };
      });

      render(
        <AdditionalPathsSection
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      );

      // Click add button
      const addButton = screen.getByRole('button', { name: /add directory/i });
      fireEvent.click(addButton);

      // Wait for async operations
      await waitFor(() => {
        expect(mockElectronAPI.__mocks__.browseDirectory).toHaveBeenCalled();
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/path already added/i)).toBeInTheDocument();
      });

      // Should NOT call onFormDataChange
      expect(onFormDataChange).not.toHaveBeenCalled();
    });

    it('prevents duplicate paths (symlink resolution)', async () => {
      const formData: Settings = {
        ...DEFAULT_SETTINGS,
        paths: {
          ...DEFAULT_SETTINGS.paths,
          additionalDiscoveryPaths: ['/real/path'],
        },
      };
      const onFormDataChange = vi.fn();

      mockElectronAPI.__mocks__.browseDirectory.mockResolvedValue({
        canceled: false,
        path: '/symlink/path',
      });

      // Mock validatePath to return different expanded paths based on input
      mockElectronAPI.__mocks__.validatePath.mockImplementation(async (path: string) => {
        if (path === '/symlink/path') {
          return { valid: true, expandedPath: '/real/path' };
        }
        if (path === '/real/path') {
          return { valid: true, expandedPath: '/real/path' };
        }
        if (path === '~/.claude/projects') {
          return { valid: true, expandedPath: '/Users/me/.claude/projects' };
        }
        return { valid: true, expandedPath: path };
      });

      render(
        <AdditionalPathsSection
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      );

      // Click add button
      const addButton = screen.getByRole('button', { name: /add directory/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockElectronAPI.__mocks__.browseDirectory).toHaveBeenCalled();
      });

      // Should show error about duplicate resolved path
      await waitFor(() => {
        expect(
          screen.getByText(/duplicate path.*resolves to.*\/real\/path/i)
        ).toBeInTheDocument();
      });

      // Should NOT call onFormDataChange
      expect(onFormDataChange).not.toHaveBeenCalled();
    });

    it('prevents adding primary claudeProjects path', async () => {
      const formData: Settings = {
        ...DEFAULT_SETTINGS,
        paths: {
          ...DEFAULT_SETTINGS.paths,
          claudeProjects: '~/.claude/projects',
          additionalDiscoveryPaths: [],
        },
      };
      const onFormDataChange = vi.fn();

      mockElectronAPI.__mocks__.browseDirectory.mockResolvedValue({
        canceled: false,
        path: '~/.claude/projects',
      });

      // Mock validatePath to return expanded paths
      mockElectronAPI.__mocks__.validatePath.mockImplementation(async (path: string) => {
        if (path === '~/.claude/projects') {
          return { valid: true, expandedPath: '/Users/me/.claude/projects' };
        }
        return { valid: true, expandedPath: path };
      });

      render(
        <AdditionalPathsSection
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      );

      // Click add button
      const addButton = screen.getByRole('button', { name: /add directory/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockElectronAPI.__mocks__.browseDirectory).toHaveBeenCalled();
      });

      // Should show error about primary path conflict
      await waitFor(() => {
        expect(
          screen.getByText(/already your primary claude path/i)
        ).toBeInTheDocument();
      });

      // Should NOT call onFormDataChange
      expect(onFormDataChange).not.toHaveBeenCalled();
    });

    it('validates path exists before adding', async () => {
      const formData: Settings = {
        ...DEFAULT_SETTINGS,
        paths: {
          ...DEFAULT_SETTINGS.paths,
          additionalDiscoveryPaths: [],
        },
      };
      const onFormDataChange = vi.fn();

      mockElectronAPI.__mocks__.browseDirectory.mockResolvedValue({
        canceled: false,
        path: '/nonexistent/path',
      });

      // validatePath returns invalid for non-existent path
      mockElectronAPI.__mocks__.validatePath.mockResolvedValue({
        valid: false,
        expandedPath: '/nonexistent/path',
        error: 'Directory does not exist',
      });

      render(
        <AdditionalPathsSection
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      );

      // Click add button
      const addButton = screen.getByRole('button', { name: /add directory/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockElectronAPI.__mocks__.browseDirectory).toHaveBeenCalled();
      });

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/directory does not exist/i)).toBeInTheDocument();
      });

      // Should NOT call onFormDataChange
      expect(onFormDataChange).not.toHaveBeenCalled();
    });
  });

  describe('Path Removal', () => {
    it('removes path when delete clicked', () => {
      const formData: Settings = {
        ...DEFAULT_SETTINGS,
        paths: {
          ...DEFAULT_SETTINGS.paths,
          additionalDiscoveryPaths: ['/path/a', '/path/b'],
        },
      };
      const onFormDataChange = vi.fn();

      render(
        <AdditionalPathsSection
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      );

      // Should display both paths
      expect(screen.getByText('/path/a')).toBeInTheDocument();
      expect(screen.getByText('/path/b')).toBeInTheDocument();

      // Find and click delete button for /path/a
      const deleteButtons = screen.getAllByLabelText(/remove/i);
      fireEvent.click(deleteButtons[0]); // First delete button

      // Should call onFormDataChange with updated paths
      expect(onFormDataChange).toHaveBeenCalledWith({
        ...formData,
        paths: {
          ...formData.paths,
          additionalDiscoveryPaths: ['/path/b'],
        },
      });
    });
  });

  describe('Settings Save Integration', () => {
    it('includes additionalPaths in formData on save', () => {
      const formData: Settings = {
        ...DEFAULT_SETTINGS,
        paths: {
          ...DEFAULT_SETTINGS.paths,
          additionalDiscoveryPaths: ['/path/a', '/path/b'],
        },
      };
      const onFormDataChange = vi.fn();

      render(
        <AdditionalPathsSection
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      );

      // Should display both paths
      expect(screen.getByText('/path/a')).toBeInTheDocument();
      expect(screen.getByText('/path/b')).toBeInTheDocument();

      // formData already includes the paths
      expect(formData.paths.additionalDiscoveryPaths).toEqual(['/path/a', '/path/b']);
    });
  });

  describe('UI Display', () => {
    it('displays list of configured paths', () => {
      const formData: Settings = {
        ...DEFAULT_SETTINGS,
        paths: {
          ...DEFAULT_SETTINGS.paths,
          additionalDiscoveryPaths: [
            '/Volumes/T7/.claude-archive/jsonl/projects',
            '/Users/work/claude-sessions',
          ],
        },
      };
      const onFormDataChange = vi.fn();

      render(
        <AdditionalPathsSection
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      );

      // Should display both paths
      expect(
        screen.getByText('/Volumes/T7/.claude-archive/jsonl/projects')
      ).toBeInTheDocument();
      expect(screen.getByText('/Users/work/claude-sessions')).toBeInTheDocument();

      // Should NOT show empty state
      expect(screen.queryByText(/no additional paths configured/i)).not.toBeInTheDocument();
    });

    it('handles canceled browse dialog', async () => {
      const formData: Settings = {
        ...DEFAULT_SETTINGS,
        paths: {
          ...DEFAULT_SETTINGS.paths,
          additionalDiscoveryPaths: [],
        },
      };
      const onFormDataChange = vi.fn();

      mockElectronAPI.__mocks__.browseDirectory.mockResolvedValue({
        canceled: true,
      });

      render(
        <AdditionalPathsSection
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      );

      // Click add button
      const addButton = screen.getByRole('button', { name: /add directory/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockElectronAPI.__mocks__.browseDirectory).toHaveBeenCalled();
      });

      // Should NOT call onFormDataChange
      expect(onFormDataChange).not.toHaveBeenCalled();

      // Should NOT show any error
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });
});
