/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult } from './types';

/**
 * A utility function that performs a simple operation and returns a PackageResult.
 * This function adheres to strict TypeScript, error handling patterns, and Bernier LLC coding standards.
 *
 * @param {string} input - A string input to be processed.
 * @returns {Promise<PackageResult<string>>} A result object containing the processed data or an error message.
 */
export async function processString(input: string): Promise<PackageResult<string>> {
  if (input.length === 0) {
    return { success: false, error: "Input string cannot be empty." };
  }

  try {
    const processedData: string = input.toUpperCase();
    return { success: true, data: processedData };
  } catch (error: unknown) {
    let errorMessage: string = "An unknown error occurred during string processing.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}