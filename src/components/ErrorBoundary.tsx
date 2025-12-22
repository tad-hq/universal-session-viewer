import { Component, type ErrorInfo, type ReactNode } from 'react';

import { AlertTriangle, RefreshCw, Bug, ChevronDown, ChevronUp } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { createUIError, ErrorCodes, logError, type UIError, type AppError } from '@/types/errors';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional fallback component to render on error */
  fallback?: ReactNode;
  /** Optional callback when error occurs */
  onError?: (error: AppError) => void;
  /** Optional callback when user resets the error boundary */
  onReset?: () => void;
  /** Component name for error tracking */
  componentName?: string;
  /** Whether to show detailed error info (development mode) */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: UIError | null;
  errorInfo: ErrorInfo | null;
  showStack: boolean;
}

// ============================================================================
// ErrorBoundary Component
// ============================================================================

/**
 * React Error Boundary with user-friendly UI
 *
 * Features:
 * - Catches React component errors and prevents app crash
 * - Displays user-friendly error message with shadcn/ui Alert
 * - Provides reset functionality to retry rendering
 * - Logs errors using centralized error logging
 * - Optionally shows stack trace for debugging
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary componentName="SessionList">
 *   <SessionList />
 * </ErrorBoundary>
 * ```
 *
 * With custom fallback:
 * ```tsx
 * <ErrorBoundary
 *   fallback={<CustomErrorUI />}
 *   onError={(error) => trackError(error)}
 * >
 *   <RiskyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
    };
  }

  /**
   * Static lifecycle method to update state when error occurs
   * Called during "render" phase, so no side effects allowed
   */
  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    // Update state so next render shows fallback UI
    return { hasError: true };
  }

  /**
   * Lifecycle method called after an error has been thrown
   * Suitable for logging and side effects
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentName = 'Unknown', onError } = this.props;

    // Create typed UI error
    const uiError = createUIError(
      ErrorCodes.UI_RENDER_ERROR,
      `An error occurred in ${componentName}: ${error.message}`,
      componentName,
      errorInfo.componentStack ?? undefined,
      error,
      {
        errorName: error.name,
        errorStack: error.stack,
      }
    );

    // Update state with full error info
    this.setState({
      error: uiError,
      errorInfo,
    });

    // Log the error
    logError(uiError, {
      componentName,
      componentStack: errorInfo.componentStack,
    });

    // Call optional error callback
    if (onError) {
      onError(uiError);
    }
  }

  /**
   * Resets the error boundary state
   * Allows the component tree to attempt re-rendering
   */
  handleReset = (): void => {
    const { onReset } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
    });

    if (onReset) {
      onReset();
    }
  };

  /**
   * Toggles the visibility of the stack trace
   */
  toggleStackTrace = (): void => {
    this.setState((prevState) => ({
      showStack: !prevState.showStack,
    }));
  };

  /**
   * Copies error details to clipboard for bug reporting
   */
  copyErrorDetails = async (): Promise<void> => {
    const { error } = this.state;
    if (!error) return;

    const errorDetails = [
      `Error: ${error.message}`,
      `Code: ${error.code}`,
      `Component: ${error.componentName}`,
      `Timestamp: ${error.timestamp}`,
      '',
      'Stack Trace:',
      error.componentStack ?? 'Not available',
      '',
      'Error Stack:',
      error.cause instanceof Error ? error.cause.stack : 'Not available',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(errorDetails);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  render(): ReactNode {
    const { hasError, error, showStack } = this.state;
    const { children, fallback, showDetails = false } = this.props;

    // No error, render children normally
    if (!hasError) {
      return children;
    }

    // Custom fallback provided
    if (fallback !== undefined) {
      return fallback;
    }

    // Default error UI
    return (
      <div className="flex min-h-[200px] w-full items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              <CardTitle className="text-lg">Something went wrong</CardTitle>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error?.message ?? 'An unexpected error occurred while rendering this component.'}
              </AlertDescription>
            </Alert>

            <p className="text-sm text-muted-foreground">
              This error has been logged. You can try resetting the component or refreshing the
              page.
            </p>

            {/* Stack trace toggle (development mode) */}
            {showDetails && error?.componentStack && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.toggleStackTrace}
                  className="flex items-center gap-1 text-xs"
                >
                  {showStack ? (
                    <>
                      <ChevronUp className="size-3" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3" />
                      Show Details
                    </>
                  )}
                </Button>

                {showStack && (
                  <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                    <code>{error.componentStack}</code>
                  </pre>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button onClick={this.handleReset} variant="default" size="sm" className="flex-1">
              <RefreshCw className="mr-2 size-4" />
              Try Again
            </Button>

            {showDetails && (
              <Button
                onClick={this.copyErrorDetails}
                variant="outline"
                size="sm"
                title="Copy error details for bug report"
              >
                <Bug className="size-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }
}

// ============================================================================
// Higher-Order Component Wrapper
// ============================================================================

/**
 * HOC to wrap a component with ErrorBoundary
 *
 * Usage:
 * ```tsx
 * const SafeSessionList = withErrorBoundary(SessionList, {
 *   componentName: 'SessionList',
 *   showDetails: process.env.NODE_ENV === 'development',
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component';

  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps} componentName={displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

// ============================================================================
// Default Export
// ============================================================================

export default ErrorBoundary;
