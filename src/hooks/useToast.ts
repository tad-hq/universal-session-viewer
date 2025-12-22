// useToast Hook
// V2 Enhancement: Centralized toast notification system
//
// Wraps Sonner's toast API with app-specific convenience methods
// Provides consistent toast behavior across the application

import { toast as sonnerToast } from 'sonner';

// Toast duration constants (in milliseconds)
const TOAST_DURATION = {
  short: 2000,
  default: 4000,
  long: 6000,
  persistent: Infinity,
} as const;

type ToastDuration = keyof typeof TOAST_DURATION;

interface ToastOptions {
  duration?: ToastDuration | number;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * useToast Hook
 *
 * Provides consistent toast notifications throughout the app.
 * All toast methods are stable references (no re-renders).
 *
 * Example usage:
 * ```tsx
 * const toast = useToast();
 *
 * // Success toast
 * toast.success('Session loaded');
 *
 * // Error toast with description
 * toast.error('Failed to load session', {
 *   description: 'Network connection lost'
 * });
 *
 * // Toast with action button
 * toast.info('Session modified', {
 *   action: { label: 'Reload', onClick: handleReload }
 * });
 * ```
 */
export function useToast(): {
  success: (message: string, options?: ToastOptions) => string | number;
  error: (message: string, options?: ToastOptions) => string | number;
  info: (message: string, options?: ToastOptions) => string | number;
  warning: (message: string, options?: ToastOptions) => string | number;
  loading: (message: string, options?: ToastOptions) => string | number;
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => ReturnType<typeof sonnerToast.promise>;
  custom: typeof sonnerToast;
  dismiss: (toastId?: string | number) => void;
} {
  // Helper to resolve duration
  const getDuration = (duration?: ToastDuration | number): number => {
    if (typeof duration === 'number') return duration;
    if (duration && duration in TOAST_DURATION) {
      return TOAST_DURATION[duration as ToastDuration];
    }
    return TOAST_DURATION.default;
  };

  // Build toast options
  const buildOptions = (options?: ToastOptions): Record<string, unknown> => {
    if (!options) return {};

    const result: Record<string, unknown> = {
      duration: getDuration(options.duration),
    };

    if (options.description) {
      result.description = options.description;
    }

    if (options.action) {
      result.action = {
        label: options.action.label,
        onClick: options.action.onClick,
      };
    }

    return result;
  };

  return {
    /**
     * Success toast - Green styling
     * Use for: Session loaded, settings saved, copy completed
     */
    success: (message: string, options?: ToastOptions) => {
      return sonnerToast.success(message, buildOptions(options));
    },

    /**
     * Error toast - Red styling
     * Use for: Load failures, network errors, invalid operations
     */
    error: (message: string, options?: ToastOptions) => {
      return sonnerToast.error(message, buildOptions(options));
    },

    /**
     * Info toast - Blue styling
     * Use for: Status updates, informational messages
     */
    info: (message: string, options?: ToastOptions) => {
      return sonnerToast.info(message, buildOptions(options));
    },

    /**
     * Warning toast - Yellow styling
     * Use for: Quota warnings, deprecation notices
     */
    warning: (message: string, options?: ToastOptions) => {
      return sonnerToast.warning(message, buildOptions(options));
    },

    /**
     * Loading toast - Shows spinner
     * Returns ID to update or dismiss later
     * Use for: Long-running operations
     */
    loading: (message: string, options?: ToastOptions) => {
      return sonnerToast.loading(message, buildOptions(options));
    },

    /**
     * Promise toast - Shows loading, then success/error
     * Use for: Async operations with clear success/failure
     */
    promise: <T>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: Error) => string);
      }
    ) => {
      return sonnerToast.promise(promise, messages);
    },

    /**
     * Custom toast - Full control
     * Use for: Complex custom toasts
     */
    custom: sonnerToast,

    /**
     * Dismiss a specific toast or all toasts
     */
    dismiss: (toastId?: string | number) => {
      sonnerToast.dismiss(toastId);
    },
  };
}

// Re-export raw toast for direct usage where hook is not needed
export { sonnerToast as toast };
