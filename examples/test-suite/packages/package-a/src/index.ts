/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standard interface for operation results.
 * @template T The type of data returned on success. Defaults to unknown.
 */
export interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * A simple example function that adds two numbers.
 * @param a The first number.
 * @param b The second number.
 * @returns A PackageResult indicating success or failure, with the sum of a and b if successful.
 */
export function addNumbers(a: number, b: number): PackageResult<number> {
  if (isNaN(a) || isNaN(b)) {
    return { success: false, error: 'Inputs must be valid numbers.' };
  }
  return { success: true, data: a + b };
}

/**
 * A simple example asynchronous function that simulates fetching data.
 * @param id The ID of the item to fetch.
 * @returns A PackageResult indicating success or failure, with a message if successful.
 */
export async function fetchData(id: string): Promise<PackageResult<string>> {
  if (id === 'invalid') {
    return { success: false, error: 'Invalid ID provided.' };
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, data: `Data for ID: ${id}` });
    }, 100);
  });
}