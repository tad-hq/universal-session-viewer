// KeyboardShortcutsModal Component
// V2 UX Polish: Comprehensive keyboard shortcuts help accessible via "?" key
//
// Provides:
// - Complete list of all keyboard shortcuts
// - Platform-aware modifier key display (Cmd/Ctrl)
// - Organized by category (Navigation, Search, Selection, Application)
// - Accessible modal dialog
// - Keyboard navigation (Escape to close)
//
// WCAG 2.1 AA Accessibility:
// - Dialog role with proper ARIA labels
// - Focus trap within modal
// - Keyboard accessible (Escape closes)
// - Screen reader announcements

import { useEffect } from 'react';

import { Keyboard } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Separator } from './ui/separator';
import { getModifierKey } from '../hooks/useKeyboardShortcuts';

// Shortcut data structure
interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

// Platform-aware modifier (Cmd on Mac, Ctrl on Windows/Linux)
const mod = getModifierKey();

// Comprehensive shortcut definitions
const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['j', 'Down Arrow'], description: 'Navigate to next session' },
      { keys: ['k', 'Up Arrow'], description: 'Navigate to previous session' },
      { keys: ['gg'], description: 'Jump to first session' },
      { keys: ['G'], description: 'Jump to last session' },
      { keys: ['Enter'], description: 'Open selected session' },
    ],
  },
  {
    title: 'Search & Filter',
    shortcuts: [
      { keys: ['/', `${mod}+K`], description: 'Focus search input' },
      { keys: ['Escape'], description: 'Clear search / close modal' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: [`${mod}+Click`], description: 'Toggle select session' },
      { keys: ['Shift+Click'], description: 'Range select sessions' },
    ],
  },
  {
    title: 'Application',
    shortcuts: [
      { keys: [`${mod}+,`], description: 'Open settings' },
      { keys: [`${mod}+R`], description: 'Refresh sessions list' },
      { keys: ['?'], description: 'Show this keyboard shortcuts help' },
    ],
  },
];

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * KeyboardShortcutsModal Component
 *
 * Displays comprehensive keyboard shortcuts help modal.
 * Opens via "?" key globally throughout the application.
 *
 * Features:
 * - Platform-aware shortcuts (Cmd on Mac, Ctrl elsewhere)
 * - Organized by category
 * - Keyboard accessible (Escape to close)
 * - Focus management
 *
 * Usage:
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * useKeyboardShortcuts({
 *   onShowKeyboardHelp: () => setIsOpen(true),
 * });
 *
 * <KeyboardShortcutsModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  // Additional Escape key handling (Dialog already handles this, but be explicit)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5" aria-hidden="true" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>Navigate and control the app using your keyboard</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {SHORTCUT_GROUPS.map((group, index) => (
            <div key={group.title}>
              {/* Separator between groups (except before first) */}
              {index > 0 && <Separator className="mb-6" />}

              {/* Group title */}
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">{group.title}</h3>

              {/* Shortcuts in this group */}
              <div className="space-y-3">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between gap-4"
                  >
                    {/* Description */}
                    <span className="text-sm">{shortcut.description}</span>

                    {/* Keys (with "or" separator if multiple) */}
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={key} className="flex items-center gap-1">
                          {i > 0 && <span className="text-xs text-muted-foreground">or</span>}
                          <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="border-t pb-2 pt-4 text-center text-xs text-muted-foreground">
          Press <kbd className="rounded border border-border bg-muted px-1 font-mono">?</kbd>{' '}
          anytime to show this help
        </div>
      </DialogContent>
    </Dialog>
  );
}
