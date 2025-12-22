// Sonner Toast Component
// V2 Enhancement: Toast notifications for user feedback
//
// This wraps the Sonner library with our theme integration
// Used for success/error/info feedback throughout the app

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toaster Component
 *
 * Provides toast notifications with Tailwind theme integration.
 * Position: bottom-right (standard desktop app pattern)
 * Duration: 4 seconds default, configurable per toast
 *
 * Usage:
 * - Add <Toaster /> to App.tsx (once)
 * - Import { toast } from 'sonner' in any component
 * - Call toast.success('Message'), toast.error('Error'), etc.
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      // V2 Pattern: Use system theme preference
      theme="system"
      // V2 Pattern: Standard Tailwind CSS class names
      className="toaster group"
      // V2 Pattern: Bottom-right is standard for desktop apps
      position="bottom-right"
      // V2 Pattern: Max 3 visible at once to avoid clutter
      visibleToasts={3}
      // V2 Pattern: 4 second default duration
      duration={4000}
      // V2 Pattern: Close on swipe for mobile-like UX
      closeButton
      // V2 Pattern: Rich colors for better visibility
      richColors
      // V2 Pattern: Tailwind classes for styling
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton:
            'group-[.toast]:bg-background group-[.toast]:text-foreground group-[.toast]:border-border',
          success:
            'group-[.toaster]:bg-green-50 group-[.toaster]:text-green-900 group-[.toaster]:border-green-200 dark:group-[.toaster]:bg-green-950 dark:group-[.toaster]:text-green-100 dark:group-[.toaster]:border-green-800',
          error:
            'group-[.toaster]:bg-red-50 group-[.toaster]:text-red-900 group-[.toaster]:border-red-200 dark:group-[.toaster]:bg-red-950 dark:group-[.toaster]:text-red-100 dark:group-[.toaster]:border-red-800',
          warning:
            'group-[.toaster]:bg-yellow-50 group-[.toaster]:text-yellow-900 group-[.toaster]:border-yellow-200 dark:group-[.toaster]:bg-yellow-950 dark:group-[.toaster]:text-yellow-100 dark:group-[.toaster]:border-yellow-800',
          info: 'group-[.toaster]:bg-blue-50 group-[.toaster]:text-blue-900 group-[.toaster]:border-blue-200 dark:group-[.toaster]:bg-blue-950 dark:group-[.toaster]:text-blue-100 dark:group-[.toaster]:border-blue-800',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
