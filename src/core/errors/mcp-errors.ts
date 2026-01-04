export type McpErrorCode = 
  | 'AUTH_INVALID_TOKEN'
  | 'RATE_LIMITED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'FEATURE_DISABLED'
  | 'INTERNAL';

export interface McpError {
  code: McpErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryAfterMs?: number;
}

export function createError(
  code: McpErrorCode,
  message: string,
  details?: Record<string, unknown>,
  retryAfterMs?: number
): McpError {
  return { code, message, details, retryAfterMs };
}

export function authError(message = 'Invalid or expired Discord token'): McpError {
  return createError('AUTH_INVALID_TOKEN', message);
}

export function rateLimitError(retryAfterMs: number): McpError {
  return createError('RATE_LIMITED', `Rate limited. Retry after ${retryAfterMs}ms`, undefined, retryAfterMs);
}

export function forbiddenError(message: string): McpError {
  return createError('FORBIDDEN', message);
}

export function notFoundError(resource: string, id: string): McpError {
  return createError('NOT_FOUND', `${resource} not found: ${id}`, { resource, id });
}

export function conflictError(message: string): McpError {
  return createError('CONFLICT', message);
}

export function validationError(message: string, details?: Record<string, unknown>): McpError {
  return createError('VALIDATION', message, details);
}

export function featureDisabledError(feature: string): McpError {
  return createError('FEATURE_DISABLED', `Feature disabled: ${feature}. Enable via config.`, { feature });
}

export function internalError(message: string, details?: Record<string, unknown>): McpError {
  return createError('INTERNAL', message, details);
}
