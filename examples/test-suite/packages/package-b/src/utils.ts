/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import type { PackageResult } from './types';

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
 * Handles null, undefined, or empty strings by returning an empty string.
 * @param str The input string.
 * @returns The string with its first letter capitalized, or an empty string if the input is nil or empty.
 */
export function capitalizeFirstLetter(str: string | null | undefined): string {
  if (isNil(str) || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Reverses a string.
 * Handles null, undefined, or empty strings by returning an empty string.
 * @param str The input string.
 * @returns The reversed string, or an empty string if the input is nil or empty.
 */
export function reverseString(str: string | null | undefined): string {
  if (isNil(str) || str.length === 0) {
    return '';
  }
  return str.split('').reverse().join('');
}

/**
 * Removes duplicate objects from an array based on a key selector function.
 * The first occurrence of an item with a given key is kept.
 * @template T The type of elements in the array.
 * @param array The input array.
 * @param keySelector A function that returns a unique key (string or number) for each item.
 * @returns A new array with unique elements.
 */
export function uniqueArrayBy<T>(array: T[], keySelector: (item: T) => string | number): T[] {
  const seen = new Map<string | number, boolean>();
  const result: T[] = [];

  for (const item of array) {
    const key = keySelector(item);
    if (!seen.has(key)) {
      seen.set(key, true);
      result.push(item);
    }
  }
  return result;
}

/**
 * Converts a string to camelCase.
 * Handles spaces, hyphens, and underscores as delimiters.
 * @param str The input string.
 * @returns The camelCased string, or an empty string if the input is nil or empty.
 */
export function toCamelCase(str: string | null | undefined): string {
  if (isNil(str) || str.length === 0) {
    return '';
  }

  return str.replace(/[ -_]([a-zA-Z])/g, (_match: string, char: string) => char.toUpperCase());
}

/**
 * Generates a random alphanumeric string of a specified length.
 * @param length The desired length of the string. Must be a non-negative integer.
 * @returns A random alphanumeric string. Returns an empty string if length is less than or equal to 0.
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
 * Safely parses a JSON string into an object of the specified type.
 * Returns a PackageResult indicating success or failure, with the parsed data or an error message.
 * @template T The expected type of the parsed JSON object.
 * @param jsonString The JSON string to parse.
 * @returns A PackageResult object containing the parsed data on success, or an error message on failure.
 */
export function safeJsonParse<T>(jsonString: string): PackageResult<T> {
  try {
    const data: T = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (error: unknown) {
    let errorMessage = 'Unknown JSON parsing error.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    return { success: false, error: `Failed to parse JSON: ${errorMessage}` };
  }
}