/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult, BernierConfig } from './types';

/**
 * Initializes the Bernier LLC package with the provided configuration.
 * This function performs basic validation of the configuration parameters.
 *
 * @param config The configuration object for the package.
 * @returns A `PackageResult` indicating whether the initialization was successful.
 */
export function initialize(config: BernierConfig): PackageResult<boolean> {
  if (config.apiKey.length === 0) {
    return { success: false, error: 'API Key is required for initialization.' };
  }
  if (!(config.endpoint instanceof URL)) {
    return { success: false, error: 'Endpoint must be a valid URL object.' };
  }
  if (config.timeoutMs !== undefined && (config.timeoutMs <= 0 || !Number.isInteger(config.timeoutMs))) {
    return { success: false, error: 'Timeout must be a positive integer if provided.' };
  }

  // In a real scenario, this would involve setting up clients, authenticating, etc.
  console.log(`Bernier package initialized with endpoint: ${config.endpoint.toString()}`);
  console.log(`API Key (first 5 chars): ${config.apiKey.substring(0, 5)}...`);

  return { success: true, data: true };
}

/**
 * Performs a simulated asynchronous operation.
 * This function demonstrates the use of `async`/`await` and the `PackageResult` pattern
 * for handling both successful results and errors.
 *
 * @param payload The string payload to be processed asynchronously.
 * @returns A promise that resolves to a `PackageResult` containing the processed string data.
 */
export async function performAsyncOperation(payload: string): Promise<PackageResult<string>> {
  if (payload.trim().length === 0) {
    return { success: false, error: 'Payload for async operation cannot be empty.' };
  }

  try {
    // Simulate an asynchronous task, e.g., an API call or complex computation
    const processedData: string = await new Promise((resolve) => {
      setTimeout(() => {
        resolve(`Processed: ${payload.toUpperCase()} (timestamp: ${new Date().toISOString()})`);
      }, 500); // Simulate network latency
    });

    return { success: true, data: processedData };
  } catch (error: unknown) {
    let errorMessage: string = 'An unexpected error occurred during async operation.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: `Async operation failed: ${errorMessage}` };
  }
}

/**
 * A utility function to demonstrate strict typing and internal helper pattern.
 * This function is not exported, making it an internal helper.
 * @param value The value to check.
 * @returns True if the value is a string, false otherwise.
 */
function _isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Example of how _isString might be used internally (e.g., in another unexported function)
// function _processInputSafely(input: unknown): string | null {
//   if (_isString(input)) {
//     return input.trim();
//   }
//   return null;
// }