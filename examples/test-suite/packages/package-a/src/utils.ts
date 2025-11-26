/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult, DeepPartial } from './types';
import { ERROR_MESSAGES } from './constants';

/**
 * Capitalizes the first letter of a given string.
 * @param {string} inputString The string to capitalize.
 * @returns {PackageResult<string>} A result object containing the capitalized string or an error.
 */
export function capitalizeFirstLetter(inputString: string): PackageResult<string> {
  if (typeof inputString !== 'string') {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }
  if (inputString.length === 0) {
    return { success: false, error: ERROR_MESSAGES.EMPTY_STRING };
  }
  return { success: true, data: inputString.charAt(0).toUpperCase() + inputString.slice(1) };
}

/**
 * Reverses a given string.
 * @param {string} inputString The string to reverse.
 * @returns {PackageResult<string>} A result object containing the reversed string or an error.
 */
export function reverseString(inputString: string): PackageResult<string> {
  if (typeof inputString !== 'string') {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }
  if (inputString.length === 0) {
    return { success: false, error: ERROR_MESSAGES.EMPTY_STRING };
  }
  return { success: true, data: inputString.split('').reverse().join('') };
}

/**
 * Removes duplicate elements from an array.
 * @template T The type of elements in the array.
 * @param {T[]} inputArray The array from which to remove duplicates.
 * @returns {PackageResult<T[]>} A result object containing the array with unique elements or an error.
 */
export function removeDuplicates<T>(inputArray: T[]): PackageResult<T[]> {
  if (!Array.isArray(inputArray)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }
  if (inputArray.length === 0) {
    return { success: true, data: [] }; // An empty array has no duplicates, so it's a success
  }
  return { success: true, data: Array.from(new Set(inputArray)) };
}

/**
 * Chunks an array into smaller arrays of a specified size.
 * @template T The type of elements in the array.
 * @param {T[]} inputArray The array to chunk.
 * @param {number} chunkSize The desired size of each chunk.
 * @returns {PackageResult<T[][]>} A result object containing an array of chunks or an error.
 */
export function chunkArray<T>(inputArray: T[], chunkSize: number): PackageResult<T[][]> {
  if (!Array.isArray(inputArray)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }
  if (typeof chunkSize !== 'number' || chunkSize <= 0 || !Number.isInteger(chunkSize)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_CHUNK_SIZE };
  }

  const chunks: T[][] = [];
  for (let i = 0; i < inputArray.length; i += chunkSize) {
    chunks.push(inputArray.slice(i, i + chunkSize));
  }
  return { success: true, data: chunks };
}

/**
 * Deeply merges two objects. Properties in the source object will
 * overwrite properties in the target object.
 * @template T The type of the target object.
 * @param {T} target The target object to merge into.
 * @param {DeepPartial<T>} source The source object to merge from.
 * @returns {PackageResult<T>} A result object containing the merged object or an error.
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: DeepPartial<T>): PackageResult<T> {
  if (typeof target !== 'object' || target === null || Array.isArray(target) ||
      typeof source !== 'object' || source === null || Array.isArray(source)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_OBJECT_TYPE };
  }

  const output: T = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue)
      ) {
        // Recursive merge for nested objects
        const mergeResult = deepMerge(targetValue as Record<string, any>, sourceValue as DeepPartial<Record<string, any>>);
        if (mergeResult.success) {
          output[key] = mergeResult.data as T[Extract<keyof T, string>];
        } else {
          // If a nested merge fails, propagate the error or handle it
          return { success: false, error: mergeResult.error };
        }
      } else if (sourceValue !== undefined) {
        // Overwrite or add non-object/array properties
        output[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return { success: true, data: output };
}


/**
 * Picks specified keys from an object and returns a new object with those keys.
 * @template T The type of the input object.
 * @template K The union of keys to pick.
 * @param {T} obj The object to pick keys from.
 * @param {K[]} keys An array of keys to pick.
 * @returns {PackageResult<Pick<T, K>>} A result object containing the new object with picked keys or an error.
 */
export function pickKeys<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): PackageResult<Pick<T, K>> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj) || !Array.isArray(keys)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }

  const newObj: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      newObj[key] = obj[key];
    }
  }
  return { success: true, data: newObj as Pick<T, K> };
}

/**
 * Formats a Date object into a 'YYYY-MM-DD' string.
 * @param {Date} date The Date object to format.
 * @returns {PackageResult<string>} A result object containing the formatted date string or an error.
 */
export function formatDate(date: Date): PackageResult<string> {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return { success: false, error: ERROR_MESSAGES.INVALID_DATE };
  }

  const year: number = date.getFullYear();
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  const day: string = String(date.getDate()).padStart(2, '0');

  return { success: true, data: `${year}-${month}-${day}` };
}

/**
 * Adds a specified number of days to a given Date object.
 * @param {Date} date The base Date object.
 * @param {number} days The number of days to add.
 * @returns {PackageResult<Date>} A result object containing the new Date object or an error.
 */
export function addDays(date: Date, days: number): PackageResult<Date> {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return { success: false, error: ERROR_MESSAGES.INVALID_DATE };
  }
  if (typeof days !== 'number' || !Number.isInteger(days)) {
    return { success: false, error: ERROR_MESSAGES.INVALID_INPUT };
  }

  const newDate = new Date(date);
  newDate.setDate(date.getDate() + days);
  return { success: true, data: newDate };
}