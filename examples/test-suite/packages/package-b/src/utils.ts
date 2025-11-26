/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standard result pattern for package operations.
 * @template T - The type of data on success.
 */
export interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Checks if a value is null or undefined.
 * @param value The value to check.
 * @returns True if the value is null or undefined, false otherwise.
 */
export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Capitalizes the first letter of a string.
 * @param str The input string.
 * @returns The capitalized string, or an empty string if input is null/undefined.
 */
export function capitalizeFirstLetter(str: string | null | undefined): string {
  if (isNil(str) || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Reverses a string.
 * @param str The input string.
 * @returns The reversed string, or an empty string if input is null/undefined.
 */
export function reverseString(str: string | null | undefined): string {
  if (isNil(str) || str.length === 0) {
    return '';
  }
  return str.split('').reverse().join('');
}

/**
 * Removes duplicate elements from an array based on a key selector.
 * @template T - The type of elements in the array.
 * @param array The input array.
 * @param keySelector A function that returns a unique key for each element.
 * @returns An array with unique elements.
 */
export function uniqueArrayBy<T>(array: T[], keySelector: (item: T) => string | number): T[] {
  const seen = new Set<string | number>();
  return array.filter((item) => {
    const key = keySelector(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Converts a string to camelCase.
 * @param str The input string (e.g., "hello world", "foo-bar", "baz_qux").
 * @returns The camelCased string.
 */
export function toCamelCase(str: string | null | undefined): string {
  if (isNil(str) || str.length === 0) {
    return '';
  }
  return str.replace(/[^a-zA-Z0-9]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));
}

/**
 * Generates a random alphanumeric string of a specified length.
 * @param length The desired length of the string.
 * @returns A random alphanumeric string.
 */
export function generateRandomAlphanumeric(length: number): string {
  if (length <= 0) {
    return '';
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Safely parses a JSON string, returning a result object.
 * @template T - The expected type of the parsed JSON data.
 * @param jsonString The JSON string to parse.
 * @returns A PackageResult indicating success or failure.
 */
export function safeJsonParse<T>(jsonString: string): PackageResult<T> {
  if (isNil(jsonString) || jsonString.trim() === '') {
    return { success: false, error: 'Input string cannot be empty or null for JSON parsing.' };
  }
  try {
    const data = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Failed to parse JSON: ${errorMessage}` };
  }
}