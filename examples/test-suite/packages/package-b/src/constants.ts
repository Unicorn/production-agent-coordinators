/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Defines a set of common status codes used across the application.
 */
export const STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const; // `as const` ensures these are literal types, not just numbers

/**
 * Defines common error messages.
 */
export const ERROR_MESSAGES = {
  INVALID_INPUT: 'Invalid input provided.',
  NOT_FOUND: 'Resource not found.',
  UNAUTHORIZED_ACCESS: 'Unauthorized access.',
  INTERNAL_SERVER_ERROR: 'An unexpected internal server error occurred.',
  PERMISSION_DENIED: 'Permission denied.',
  OPERATION_FAILED: 'The requested operation could not be completed.',
} as const;

/**
 * Application-wide configuration defaults.
 */
export const APP_CONFIG = {
  DEFAULT_TIMEOUT_MS: 5000,
  MAX_RETRIES: 3,
  LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
  DATE_FORMAT: 'YYYY-MM-DD HH:mm:ss',
} as const;