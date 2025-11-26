/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import type { PackageResult, DeepPartial } from './types.js';
import { ERROR_MESSAGES } from './constants.js';

/**
 * String Manipulation Helpers
 */

/**
 * Capitalizes the first letter of a given string.
 * @param {string} inputString - The string to capitalize.
 * @returns {PackageResult<string>} A result object containing the capitalized string or an error.
 */
export function capitalizeFirstLetter(inputString: string): PackageResult<string> {
  if (typeof inputString !== 'string') {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }
  if (inputString.length === 0) {
    return { success: true, data: '' };
  }
  return { success: true, data: inputString.charAt(0).toUpperCase() + inputString.slice(1) };
}

/**
 * Reverses a given string.
 * @param {string} inputString - The string to reverse.
 * @returns {PackageResult<string>} A result object containing the reversed string or an error.
 */
export function reverseString(inputString: string): PackageResult<string> {
  if (typeof inputString !== 'string') {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }
  return { success: true, data: inputString.split('').reverse().join('') };
}

/**
 * Array Processing Utilities
 */

/**
 * Removes duplicate elements from an array.
 * @param {T[]} inputArray - The array from which to remove duplicates.
 * @returns {PackageResult<T[]>} A result object containing the array with unique elements or an error.
 * @template T
 */
export function removeDuplicates<T>(inputArray: T[]): PackageResult<T[]> {
  if (!Array.isArray(inputArray)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }
  // Using Set to ensure uniqueness, then converting back to array
  return { success: true, data: Array.from(new Set(inputArray)) };
}

/**
 * Chunks an array into smaller arrays of a specified size.
 * @param {T[]} inputArray - The array to chunk.
 * @param {number} chunkSize - The desired size of each chunk.
 * @returns {PackageResult<T[][]>} A result object containing an array of chunks or an error.
 * @template T
 */
export function chunkArray<T>(inputArray: T[], chunkSize: number): PackageResult<T[][]> {
  if (!Array.isArray(inputArray)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }
  if (typeof chunkSize !== 'number' || chunkSize <= 0 || !Number.isInteger(chunkSize)) {
    return { success: false, error: ERROR_MESSAGES.CHUNK_INVALID_SIZE };
  }

  const result: T[][] = [];
  for (let i = 0; i < inputArray.length; i += chunkSize) {
    result.push(inputArray.slice(i, i + chunkSize));
  }
  return { success: true, data: result };
}

/**
 * Object Transformation Functions
 */

/**
 * Recursively merges properties from one or more source objects into a target object.
 * Existing properties in the target will be overwritten by source properties.
 * Arrays are replaced, not merged.
 * @param {T} target - The target object to merge into.
 * @param {...DeepPartial<T>[]} sources - One or more source objects to merge from.
 * @returns {PackageResult<T>} A result object containing the merged object or an error.
 * @template T
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: DeepPartial<T>[]
): PackageResult<T> {
  if (typeof target !== 'object' || target === null || Array.isArray(target)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }

  const output: T = { ...target }; // Start with a shallow copy of target

  for (const source of sources) {
    if (typeof source !== 'object' || source === null || Array.isArray(source)) {
      continue; // Skip invalid sources
    }

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = output[key as keyof T];

        if (sourceValue !== null && typeof sourceValue === 'object' && !Array.isArray(sourceValue) &&
            targetValue !== null && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
          // Both are objects, recurse
          const mergeResult = deepMerge(
            targetValue as Record<string, unknown>, // Cast to base object for recursive call
            sourceValue as DeepPartial<Record<string, unknown>>
          );
          if (mergeResult.success && mergeResult.data) {
            output[key as keyof T] = mergeResult.data as T[keyof T];
          } else {
            // Propagate merge error from nested calls
            return { success: false, error: ERROR_MESSAGES.DEEP_MERGE_ERROR + (mergeResult.error ? `: ${mergeResult.error}` : '') };
          }
        } else {
          // Overwrite primitive, array, or if target value is not an object
          output[key as keyof T] = sourceValue as T[keyof T];
        }
      }
    }
  }

  return { success: true, data: output };
}


/**
 * Creates a new object by picking only specified keys from the original object.
 * @param {T} obj - The original object.
 * @param {K[]} keys - An array of keys to pick.
 * @returns {PackageResult<Pick<T, K>>} A result object containing the new object with picked keys or an error.
 * @template T
 * @template K
 */
export function pickKeys<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): PackageResult<Pick<T, K>> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }
  if (!Array.isArray(keys)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }

  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return { success: true, data: result };
}

/**
 * Date/Time Helpers
 */

/**
 * Formats a Date object into a 'YYYY-MM-DD' string.
 * @param {Date} date - The Date object to format.
 * @returns {PackageResult<string>} A result object containing the formatted date string or an error.
 */
export function formatDate(date: Date): PackageResult<string> {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
  const day = date.getDate().toString().padStart(2, '0');

  return { success: true, data: `${year}-${month}-${day}` };
}

/**
 * Adds a specified number of days to a given Date object.
 * @param {Date} date - The original Date object.
 * @param {number} days - The number of days to add. Can be negative.
 * @returns {PackageResult<Date>} A result object containing the new Date object or an error.
 */
export function addDays(date: Date, days: number): PackageResult<Date> {
  if (!(date instanceof Date) || isNaN(date.getTime()) || typeof days !== 'number' || !Number.isInteger(days)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }

  const newDate = new Date(date); // Create a new Date object to avoid mutating the original
  newDate.setDate(date.getDate() + days);
  return { success: true, data: newDate };
}