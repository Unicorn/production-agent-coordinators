/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standard result interface for all package operations to ensure consistent error handling.
 * @template T The type of data returned on success. Defaults to `unknown`.
 */
export interface PackageResult<T = unknown> {
  /** Indicates whether the operation was successful. */
  success: boolean;
  /** The data returned on success. Present only if `success` is true. */
  data?: T;
  /** A descriptive error message on failure. Present only if `success` is false. */
  error?: string;
}

/**
 * Interface for the core configuration of the Bernier LLC package.
 */
export interface BernierConfig {
  /** The API key required for authentication with Bernier services. */
  apiKey: string;
  /** The base URL endpoint for Bernier services. Must be a valid URL object. */
  endpoint: URL;
  /** Optional timeout for network requests in milliseconds. */
  timeoutMs?: number;
}