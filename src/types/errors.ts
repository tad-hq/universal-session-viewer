export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export type ErrorCategory =
  | 'ipc'
  | 'database'
  | 'filesystem'
  | 'network'
  | 'validation'
  | 'analysis'
  | 'ui'
  | 'unknown';

export interface AppError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: string;
  recoverable: boolean;
  context?: Record<string, unknown>;
  cause?: Error;
}

export interface IPCError extends AppError {
  category: 'ipc';
  channel: string;
  direction: 'renderer-to-main' | 'main-to-renderer';
}

export interface DatabaseError extends AppError {
  category: 'database';
  operation: 'query' | 'insert' | 'update' | 'delete' | 'transaction' | 'connection';
  table?: string;
  query?: string;
}

export interface FileSystemError extends AppError {
  category: 'filesystem';
  operation: 'read' | 'write' | 'delete' | 'stat' | 'watch' | 'access';
  path: string;
  systemCode?: string;
}

export interface ValidationError extends AppError {
  category: 'validation';
  field: string;
  value?: unknown;
  rule: string;
}

export interface AnalysisError extends AppError {
  category: 'analysis';
  sessionId: string;
  phase: 'initialization' | 'processing' | 'completion' | 'timeout';
  shouldRetry: boolean;
}

export interface NetworkError extends AppError {
  category: 'network';
  statusCode?: number;
  url?: string;
  method?: string;
}

export interface UIError extends AppError {
  category: 'ui';
  componentName: string;
  componentStack?: string;
}

export type SpecificError =
  | IPCError
  | DatabaseError
  | FileSystemError
  | ValidationError
  | AnalysisError
  | NetworkError
  | UIError;

export const ErrorCodes = {
  IPC_CHANNEL_NOT_FOUND: 'IPC_CHANNEL_NOT_FOUND',
  IPC_HANDLER_FAILED: 'IPC_HANDLER_FAILED',
  IPC_TIMEOUT: 'IPC_TIMEOUT',
  IPC_SERIALIZATION_FAILED: 'IPC_SERIALIZATION_FAILED',

  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  DB_NOT_FOUND: 'DB_NOT_FOUND',
  DB_TRANSACTION_FAILED: 'DB_TRANSACTION_FAILED',

  FS_FILE_NOT_FOUND: 'FS_FILE_NOT_FOUND',
  FS_PERMISSION_DENIED: 'FS_PERMISSION_DENIED',
  FS_READ_FAILED: 'FS_READ_FAILED',
  FS_WRITE_FAILED: 'FS_WRITE_FAILED',
  FS_WATCH_FAILED: 'FS_WATCH_FAILED',

  VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
  VALIDATION_TYPE_MISMATCH: 'VALIDATION_TYPE_MISMATCH',
  VALIDATION_RANGE: 'VALIDATION_RANGE',
  VALIDATION_FORMAT: 'VALIDATION_FORMAT',

  ANALYSIS_QUOTA_EXCEEDED: 'ANALYSIS_QUOTA_EXCEEDED',
  ANALYSIS_TIMEOUT: 'ANALYSIS_TIMEOUT',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  ANALYSIS_PARSE_ERROR: 'ANALYSIS_PARSE_ERROR',

  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_SERVER_ERROR: 'NETWORK_SERVER_ERROR',

  UI_RENDER_ERROR: 'UI_RENDER_ERROR',
  UI_STATE_ERROR: 'UI_STATE_ERROR',

  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

function createTimestamp(): string {
  return new Date().toISOString();
}

function createBaseError(
  code: string,
  message: string,
  category: ErrorCategory,
  severity: ErrorSeverity,
  recoverable: boolean,
  context?: Record<string, unknown>,
  cause?: Error
): AppError {
  return {
    code,
    message,
    category,
    severity,
    timestamp: createTimestamp(),
    recoverable,
    context,
    cause,
  };
}

export function createIPCError(
  code: string,
  message: string,
  channel: string,
  direction: 'renderer-to-main' | 'main-to-renderer',
  cause?: Error,
  context?: Record<string, unknown>
): IPCError {
  return {
    ...createBaseError(code, message, 'ipc', 'error', true, context, cause),
    category: 'ipc',
    channel,
    direction,
  };
}

export function createDatabaseError(
  code: string,
  message: string,
  operation: DatabaseError['operation'],
  table?: string,
  cause?: Error,
  context?: Record<string, unknown>
): DatabaseError {
  return {
    ...createBaseError(code, message, 'database', 'error', false, context, cause),
    category: 'database',
    operation,
    table,
  };
}

export function createFileSystemError(
  code: string,
  message: string,
  operation: FileSystemError['operation'],
  path: string,
  systemCode?: string,
  cause?: Error,
  context?: Record<string, unknown>
): FileSystemError {
  return {
    ...createBaseError(code, message, 'filesystem', 'error', true, context, cause),
    category: 'filesystem',
    operation,
    path,
    systemCode,
  };
}

export function createValidationError(
  code: string,
  message: string,
  field: string,
  rule: string,
  value?: unknown,
  context?: Record<string, unknown>
): ValidationError {
  return {
    ...createBaseError(code, message, 'validation', 'warning', true, context),
    category: 'validation',
    field,
    rule,
    value,
  };
}

export function createAnalysisError(
  code: string,
  message: string,
  sessionId: string,
  phase: AnalysisError['phase'],
  shouldRetry: boolean,
  cause?: Error,
  context?: Record<string, unknown>
): AnalysisError {
  return {
    ...createBaseError(code, message, 'analysis', 'error', shouldRetry, context, cause),
    category: 'analysis',
    sessionId,
    phase,
    shouldRetry,
  };
}

export function createNetworkError(
  code: string,
  message: string,
  statusCode?: number,
  url?: string,
  method?: string,
  cause?: Error,
  context?: Record<string, unknown>
): NetworkError {
  return {
    ...createBaseError(code, message, 'network', 'error', true, context, cause),
    category: 'network',
    statusCode,
    url,
    method,
  };
}

export function createUIError(
  code: string,
  message: string,
  componentName: string,
  componentStack?: string,
  cause?: Error,
  context?: Record<string, unknown>
): UIError {
  return {
    ...createBaseError(code, message, 'ui', 'error', true, context, cause),
    category: 'ui',
    componentName,
    componentStack,
  };
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'category' in error &&
    'severity' in error &&
    'timestamp' in error &&
    'recoverable' in error
  );
}

export function isIPCError(error: unknown): error is IPCError {
  return isAppError(error) && error.category === 'ipc' && 'channel' in error;
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return isAppError(error) && error.category === 'database' && 'operation' in error;
}

export function isFileSystemError(error: unknown): error is FileSystemError {
  return isAppError(error) && error.category === 'filesystem' && 'path' in error;
}

export function isValidationError(error: unknown): error is ValidationError {
  return isAppError(error) && error.category === 'validation' && 'field' in error;
}

export function isAnalysisError(error: unknown): error is AnalysisError {
  return isAppError(error) && error.category === 'analysis' && 'sessionId' in error;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return isAppError(error) && error.category === 'network';
}

export function isUIError(error: unknown): error is UIError {
  return isAppError(error) && error.category === 'ui' && 'componentName' in error;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createBaseError(
      ErrorCodes.UNKNOWN_ERROR,
      error.message,
      'unknown',
      'error',
      false,
      { name: error.name, stack: error.stack },
      error
    );
  }

  if (typeof error === 'string') {
    return createBaseError(ErrorCodes.UNKNOWN_ERROR, error, 'unknown', 'error', false);
  }

  return createBaseError(
    ErrorCodes.UNKNOWN_ERROR,
    'An unknown error occurred',
    'unknown',
    'error',
    false,
    { originalError: error }
  );
}

export function getUserFriendlyMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred. Please try again.';
}

export function logError(error: unknown, additionalContext?: Record<string, unknown>): void {
  const appError = toAppError(error);

  const logData = {
    ...appError,
    additionalContext,
  };

  switch (appError.severity) {
    case 'critical':
    case 'error':
      console.error('[Error]', logData);
      break;
    case 'warning':
      console.warn('[Warning]', logData);
      break;
    case 'info':
      console.info('[Info]', logData);
      break;
  }
}
