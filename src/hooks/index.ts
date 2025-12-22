// Hooks barrel file
// These hooks wrap Zustand stores and provide React-specific lifecycle management

export { useSessions } from './useSessions';
export { useSessionDetails } from './useSessionDetails';
export type { ButtonState, CopyFeedback, StatusUpdate } from './useSessionDetails';
export { useSettings } from './useSettings';
export { useQuota } from './useQuota';
export { useCollapseState } from './useCollapseState';
export { useIPC, useMenuEvents, useStatus, type StatusState } from './useIPC';
export { useKeyboardNavigation } from './useKeyboardNavigation';
export {
  useKeyboardShortcuts,
  getModifierKey,
  getShortcutDisplay,
  KEYBOARD_SHORTCUTS,
} from './useKeyboardShortcuts';
export { useToast, toast } from './useToast';
// WCAG 2.1 AA: Focus management for keyboard navigation
export { useFocusManagement, getRovingTabIndex } from './useFocusManagement';
export type { UseFocusManagementOptions, UseFocusManagementReturn } from './useFocusManagement';
// V2 Enhancement: Main process error handling
export { useMainProcessErrors } from './useMainProcessErrors';
export type { MainProcessErrorData, UseMainProcessErrorsOptions } from './useMainProcessErrors';
// V2 Enhancement: Continuation cache event handling
export { useContinuationEvents } from './useContinuationEvents';
