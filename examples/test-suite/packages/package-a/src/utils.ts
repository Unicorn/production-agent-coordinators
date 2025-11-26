/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult } from './types';

/**
 * A simple utility function to add two numbers.
 * @param a The first number.
 * @param b The second number.
 * @returns A PackageResult containing the sum or an error.
 */
export function addNumbers(a: number, b: number): PackageResult<number> {
  if (typeof a !== 'number' || typeof b !== 'number') {
    return { success: false, error: 'Inputs must be numbers.' };
  }
  const sum: number = a + b;
  return { success: true, data: sum };
}

/**
 * An asynchronous utility function that simulates a delay.
 * @param delayMs The delay in milliseconds.
 * @returns A promise that resolves to a PackageResult.
 */
export async function simulateDelay(delayMs: number): Promise<PackageResult<string>> {
  if (delayMs < 0) {
    return { success: false, error: 'Delay must be a non-negative number.' };
  }
  await new Promise<void>((resolve: (value: void | PromiseLike<void>) => void) => setTimeout(resolve, delayMs));
  return { success: true, data: `Delayed for ${delayMs}ms` };
}