/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/
import { PackageResult } from './types';

/**
 * A simple example function that processes a string input.
 * It demonstrates basic synchronous logic and the use of PackageResult.
 * @param input The string to process.
 * @returns A PackageResult indicating success and the processed data, or an error.
 */
export function processInput(input: string): PackageResult<string> {
  if (input.trim() === '') {
    return { success: false, error: 'Input cannot be empty or just whitespace.' };
  }
  const processedData: string = `Processed: ${input.toUpperCase()}`;
  return { success: true, data: processedData };
}

/**
 * An asynchronous example function that simulates a delay.
 * It demonstrates proper async/await usage and returns a PackageResult.
 * @param delayMs The delay in milliseconds before the operation completes. Must be non-negative.
 * @returns A promise that resolves to a PackageResult with a boolean indicating completion, or an error.
 */
export async function asyncOperation(delayMs: number): Promise<PackageResult<boolean>> {
  if (delayMs < 0) {
    return { success: false, error: 'Delay must be non-negative.' };
  }

  // Simulate an asynchronous task with a delay
  await new Promise<void>((resolve: () => void) => setTimeout(resolve, delayMs));

  return { success: true, data: true };
}
```