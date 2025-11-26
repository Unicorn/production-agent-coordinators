/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult } from './types';
import { NetworkError, UnknownError, AuthenticationError, NotFoundError, ValidationError } from './errors';

/**
 * Handles common fetch API errors and wraps them in custom `PackageResult` errors.
 * @param error - The error caught from a fetch operation.
 * @param url - The URL of the request that failed.
 * @returns A `PackageResult` with `success: false` and an appropriate error message.
 */
export function handleFetchError<T = unknown>(error: unknown, url: string): PackageResult<T> {
  let errorMessage: string;
  let specificError: Error;

  if (error instanceof SyntaxError) {
    // JSON parsing error
    errorMessage = `Invalid JSON response from ${url}: ${error.message}`;
    specificError = new NetworkError(errorMessage);
  } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    // Network issues like CORS, DNS, no internet
    errorMessage = `Network request failed to ${url}: ${error.message}`;
    specificError = new NetworkError(errorMessage);
  } else if (error instanceof Error) {
    // Generic error
    errorMessage = `An unexpected error occurred during fetch to ${url}: ${error.message}`;
    specificError = new UnknownError(errorMessage, error);
  } else {
    // Truly unknown error
    errorMessage = `An unknown error occurred during fetch to ${url}.`;
    specificError = new UnknownError(errorMessage, error);
  }

  return { success: false, error: specificError.message };
}

/**
 * Handles HTTP response status codes and converts them into appropriate `PackageResult` errors.
 * @param response - The `Response` object from a fetch operation.
 * @returns A `PackageResult` with `success: false` and an appropriate error message if the status is not OK.
 */
export async function handleHttpResponseError<T = unknown>(response: Response): Promise<PackageResult<T>> {
  if (response.ok) {
    return { success: true }; // No error
  }

  let errorDetail = `HTTP error! Status: ${response.status}`;
  try {
    const errorBody: unknown = await response.json();
    if (typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody && typeof (errorBody as { message: string }).message === 'string') {
      errorDetail = (errorBody as { message: string }).message;
    } else {
      errorDetail = await response.text();
    }
  } catch (_e: unknown) {
    errorDetail = `HTTP error! Status: ${response.status}. Could not parse error response.`;
  }

  let specificError: Error;
  switch (response.status) {
    case 400:
      specificError = new ValidationError(`Bad Request: ${errorDetail}`);
      break;
    case 401:
    case 403:
      specificError = new AuthenticationError(`Authentication Failed: ${errorDetail}`);
      break;
    case 404:
      specificError = new NotFoundError(`Resource Not Found: ${errorDetail}`);
      break;
    case 408: // Request Timeout
      specificError = new NetworkError(`Request Timeout: ${errorDetail}`, response.status);
      break;
    case 429: // Too Many Requests
      specificError = new NetworkError(`Too Many Requests: ${errorDetail}`, response.status);
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      specificError = new NetworkError(`Server Error: ${errorDetail}`, response.status);
      break;
    default:
      specificError = new NetworkError(`Unexpected HTTP error (${response.status}): ${errorDetail}`, response.status);
  }

  return { success: false, error: specificError.message };
}

/**
 * Helper to construct fetch options.
 * @param method - HTTP method (GET, POST, PUT, DELETE).
 * @param apiKey - API key for authentication.
 * @param body - Optional request body.
 * @param timeoutMs - Optional request timeout in milliseconds.
 * @returns `RequestInit` object for `fetch`.
 */
export function buildFetchOptions(method: string, apiKey: string, body?: unknown, timeoutMs?: number): RequestInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  if (timeoutMs !== undefined) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    options.signal = controller.signal;
    options.keepalive = true; // Use keepalive to prevent Node.js from terminating early on signal
    // Attach a cleanup function to the signal for client-side use, though not directly used by fetch
    options.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    });
  }

  return options;
}

/**
 * Validates if a string is a non-empty string.
 * @param value - The string to validate.
 * @param name - The name of the parameter for error messages.
 * @returns A `PackageResult` indicating success or failure.
 */
export function validateNonEmptyString(value: string | undefined | null, name: string): PackageResult<true> {
  if (typeof value !== 'string' || value.trim() === '') {
    return { success: false, error: `${name} must be a non-empty string.` };
  }
  return { success: true, data: true };
}

/**
 * Validates if a number is a non-negative integer.
 * @param value - The number to validate.
 * @param name - The name of the parameter for error messages.
 * @returns A `PackageResult` indicating success or failure.
 */
export function validateNonNegativeInteger(value: number | undefined | null, name: string): PackageResult<true> {
  if (value === undefined || value === null) {
    return { success: true, data: true }; // Optional, no validation needed if missing
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return { success: false, error: `${name} must be a non-negative integer.` };
  }
  return { success: true, data: true };
}