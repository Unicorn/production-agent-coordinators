/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Defines shared application-wide constants.
 */

/**
 * Application Name.
 */
export const APP_NAME: string = 'package-a';

/**
 * Application Version.
 */
export const APP_VERSION: string = '0.1.0';

/**
 * Default timeout for asynchronous operations in milliseconds.
 */
export const DEFAULT_TIMEOUT_MS: number = 5000;

/**
 * Default page size for pagination.
 */
export const DEFAULT_PAGE_SIZE: number = 20;

/**
 * Collection of standardized error messages.
 * These can be used with `PackageResult` for consistent error reporting.
 */
export const ERROR_MESSAGES = {
  INVALID_INPUT: 'Invalid input provided.',
  NOT_FOUND: 'Resource not found.',
  UNAUTHORIZED: 'Authentication required or not authorized.',
  FORBIDDEN: 'Access to this resource is forbidden.',
  SERVER_ERROR: 'An unexpected server error occurred.',
  TIMEOUT_EXCEEDED: 'Operation timed out.',
  EMPTY_ARRAY: 'Input array cannot be empty.',
  INVALID_LENGTH: 'Input does not meet required length.',
  DEEP_MERGE_ERROR: 'Error during deep merge operation.',
  CHUNK_INVALID_SIZE: 'Chunk size must be a positive integer.'
} as const; // 'as const' makes values readonly string literals

/**
 * Collection of common HTTP-like status codes.
 */
export const STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const; // 'as const' makes values readonly number literals