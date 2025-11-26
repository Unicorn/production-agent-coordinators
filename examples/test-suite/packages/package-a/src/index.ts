/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult } from './types';

/**
 * Processes a given message and returns a PackageResult.
 * This is a placeholder function to demonstrate strict TypeScript compliance.
 *
 * @param message The string message to process.
 * @returns A PackageResult indicating the outcome of the processing.
 */
export function processMessage(message: string): PackageResult<string> {
  if (message.trim().length === 0) {
    return { success: false, error: 'Message cannot be empty.' };
  }
  return { success: true, data: `Message "${message}" processed successfully.` };
}

/**
 * An asynchronous operation example that returns a PackageResult within a Promise.
 *
 * @param id A numeric identifier.
 * @returns A Promise resolving to a PackageResult.
 */
export async function fetchData(id: number): Promise<PackageResult<{ id: number; data: string }>> {
  if (id < 0) {
    return { success: false, error: 'ID must be a non-negative number.' };
  }
  // Simulate an async operation
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { success: true, data: { id, data: `Data for ID ${id}` } };
}
```