/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult } from './interfaces';
import { BernierError } from './errors';

/**
 * Delays execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to wait.
 * @returns A Promise that resolves after the delay.
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parses a JSON string, returning a PackageResult.
 * @param jsonString The JSON string to parse.
 * @returns A PackageResult containing the parsed object or an error.
 */
export function safeJsonParse<T>(jsonString: string): PackageResult<T> {
  try {
    const data: T = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: new BernierError(`Failed to parse JSON: ${error.message}`).message };
    }
    return { success: false, error: new BernierError('Failed to parse JSON: Unknown error during parsing').message };
  }
}

/**
 * Safely stringifies an object to a JSON string, returning a PackageResult.
 * @param data The object to stringify.
 * @returns A PackageResult containing the JSON string or an error.
 */
export function safeJsonStringify(data: unknown): PackageResult<string> {
  try {
    const jsonString: string = JSON.stringify(data);
    return { success: true, data: jsonString };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: new BernierError(`Failed to stringify object to JSON: ${error.message}`).message };
    }
    return { success: false, error: new BernierError('Failed to stringify object to JSON: Unknown error during stringification').message };
  }
}

/**
 * Generates a unique identifier string.
 * @returns A unique string.
 */
export function generateUuid(): string {
  // A simple UUID generator, can be replaced with a library if more robust UUIDs are needed.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```