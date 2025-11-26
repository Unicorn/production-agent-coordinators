/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { type PackageResult } from './types';

/**
 * Simple utility function to validate a string input.
 * @param input The string to validate.
 * @param minLength Minimum required length. Defaults to 1.
 * @returns A PackageResult indicating success or failure.
 */
export function validateInput(input: string, minLength: number = 1): PackageResult<boolean> {
  if (typeof input !== 'string' || input.length < minLength) {
    return {
      success: false,
      error: `Input must be a string of at least ${minLength} characters.`,
    };
  }
  return { success: true, data: true };
}

/**
 * Creates a delay for a specified number of milliseconds.
 * Useful for mocking async operations or controlled throttling.
 * @param ms The number of milliseconds to delay.
 * @returns A Promise that resolves after the delay.
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Add any other utility functions here