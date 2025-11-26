/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Interface for a standard package result, indicating success or failure.
 * @template T The type of data returned on success. Defaults to unknown.
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
 * Handles null or undefined inputs by returning an empty string.
 * @param str The input string.
 * @returns The string with its first letter capitalized, or an empty string if input is null/undefined.
 */
export function capitalizeFirstLetter(str: string | null | undefined): string {
  if (isNil(str) || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Reverses a string.
 * Handles null or undefined inputs by returning an empty string.
 * @param str The input string.
 * @returns The reversed string, or an empty string if input is null/undefined.
 */
export function reverseString(str: string | null | undefined): string {
  if (isNil(str)) {
    return '';
  }
  return str.split('').reverse().join('');
}

/**
 * Removes duplicates from an array based on a key selector function.
 * @template T The type of elements in the array.
 * @param array The input array.
 * @param keySelector A function that returns a unique key for each item.
 * @returns A new array with unique elements.
 */
export function uniqueArrayBy<T>(array: T[], keySelector: (item: T) => string | number): T[] {
  if (!Array.isArray(array)) {
    return [];
  }
  const seenKeys = new Set<string | number>();
  const uniqueItems: T[] = [];

  for (const item of array) {
    const key = keySelector(item);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueItems.push(item);
    }
  }
  return uniqueItems;
}

/**
 * Converts a string to camelCase.
 * Handles spaces, hyphens, and underscores as delimiters.
 * Handles null or undefined inputs by returning an empty string.
 * @param str The input string.
 * @returns The camelCased string, or an empty string if input is null/undefined.
 */
export function toCamelCase(str: string | null | undefined): string {
  if (isNil(str)) {
    return '';
  }

  // Remove leading/trailing non-alphanumeric characters, and convert to camelCase
  return str
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '') // Remove leading/trailing non-alphanumeric
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_match: string, char: string | undefined) =>
      char ? char.toUpperCase() : ''
    );
}

/**
 * Generates a random alphanumeric string of a specified length.
 * @param length The desired length of the string. Must be a non-negative number.
 * @returns A random alphanumeric string. Returns an empty string if length is invalid.
 */
export function generateRandomAlphanumeric(length: number): string {
  if (length <= 0 || !Number.isInteger(length)) {
    return '';
  }
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * Safely parses a JSON string, catching any parsing errors.
 * @template T The expected type of the parsed JSON data. Defaults to unknown.
 * @param jsonString The JSON string to parse.
 * @returns A PackageResult indicating success or failure, with data or an error message.
 */
export function safeJsonParse<T>(jsonString: string): PackageResult<T> {
  try {
    const data: T = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (e: unknown) {
    let errorMessage = 'Unknown JSON parsing error.';
    if (e instanceof Error) {
      errorMessage = e.message;
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    return { success: false, error: `Failed to parse JSON: ${errorMessage}` };
  }
}