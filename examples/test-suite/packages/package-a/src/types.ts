/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/
// src/types.ts
/**
 * Standardized result interface for all package operations, ensuring consistent error handling.
 *
 * @template T The type of data returned on success. Defaults to `unknown`.
 */
export interface PackageResult<T = unknown> {
  /** Indicates whether the operation was successful. */
  success: boolean;
  /** The data returned by the operation on success. Undefined if `success` is false. */
  data?: T;
  /** An error message explaining the failure, present if `success` is false. */
  error?: string;
}