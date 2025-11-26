/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standard result interface for package operations.
 * It indicates success or failure, providing data on success or an error message on failure.
 *
 * @template T The type of the data returned on success. Defaults to unknown.
 */
export interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}