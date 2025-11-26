/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Application-wide constants.
 */
export const APP_NAME: string = "package-a";
export const APP_VERSION: string = "0.1.0";

/**
 * Default configuration values.
 */
export const DEFAULT_TIMEOUT_MS: number = 5000;
export const DEFAULT_PAGE_SIZE: number = 20;

/**
 * Standard error messages.
 */
export const ERROR_MESSAGES = {
  INVALID_INPUT: "Invalid input provided.",
  NOT_FOUND: "Resource not found.",
  UNEXPECTED_ERROR: "An unexpected error occurred.",
  OPERATION_FAILED: "Operation failed to complete.",
  EMPTY_ARRAY: "Input array cannot be empty.",
  INVALID_DATE: "Invalid date provided.",
  EMPTY_STRING: "Input string cannot be empty.",
  INVALID_CHUNK_SIZE: "Chunk size must be a positive integer.",
  INVALID_OBJECT_TYPE: "Input must be a valid object."
} as const; // `as const` ensures string literals are preserved

/**
 * Standard HTTP/operation status codes.
 */
export const STATUS_CODES = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const;