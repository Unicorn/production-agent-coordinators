/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import {
  capitalizeFirstLetter,
  reverseString,
  removeDuplicates,
  chunkArray,
  deepMerge,
  pickKeys,
  formatDate,
  addDays,
  PackageResult
} from './index.js'; // Import from index.js which re-exports everything
import { ERROR_MESSAGES } from './constants.js';

describe('String Manipulation Helpers', () => {
  describe('capitalizeFirstLetter', () => {
    it('should capitalize the first letter of a string', () => {
      const result = capitalizeFirstLetter('hello world');
      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello world');
    });

    it('should return an empty string for an empty input', () => {
      const result = capitalizeFirstLetter('');
      expect(result.success).toBe(true);
      expect(result.data).toBe('');
    });

    it('should handle strings with only one letter', () => {
      const result = capitalizeFirstLetter('a');
      expect(result.success).toBe(true);
      expect(result.data).toBe('A');
    });

    it('should not modify already capitalized strings', () => {
      const result = capitalizeFirstLetter('Hello');
      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello');
    });

    it('should return an error for non-string input (number)', () => {
      const result = capitalizeFirstLetter(123 as unknown as string);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return an error for non-string input (null)', () => {
      const result = capitalizeFirstLetter(null as unknown as string);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return an error for non-string input (object)', () => {
      const result = capitalizeFirstLetter({} as unknown as string);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });
  });

  describe('reverseString', () => {
    it('should reverse a given string', () => {
      const result = reverseString('hello');
      expect(result.success).toBe(true);
      expect(result.data).toBe('olleh');
    });

    it('should return an empty string for an empty input', () => {
      const result = reverseString('');
      expect(result.success).toBe(true);
      expect(result.data).toBe('');
    });

    it('should handle strings with only one letter', () => {
      const result = reverseString('a');
      expect(result.success).toBe(true);
      expect(result.data).toBe('a');
    });

    it('should reverse a string with spaces and special characters', () => {
      const result = reverseString('h!@#ello world');
      expect(result.success).toBe(true);
      expect(result.data).toBe('dlrow olle#!@#h');
    });

    it('should return an error for non-string input (number)', () => {
      const result = reverseString(123 as unknown as string);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });
  });
});

describe('Array Processing Utilities', () => {
  describe('removeDuplicates', () => {
    it('should remove duplicate numbers from an array', () => {
      const result = removeDuplicates([1, 2, 2, 3, 4, 4, 5]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3, 4, 5]);
    });

    it('should remove duplicate strings from an array', () => {
      const result = removeDuplicates(['a', 'b', 'a', 'c', 'b']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(['a', 'b', 'c']);
    });

    it('should handle an array with no duplicates', () => {
      const result = removeDuplicates([1, 2, 3]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('should return an empty array for an empty input', () => {
      const result = removeDuplicates([]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle an array with all duplicates', () => {
      const result = removeDuplicates([5, 5, 5, 5]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([5]);
    });

    it('should handle mixed types if Set can compare them', () => {
      const result = removeDuplicates([1, '1', 1, '2', 2]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, '1', '2', 2]);
    });

    it('should return an error for non-array input (string)', () => {
      const result = removeDuplicates('abc' as unknown as string[]);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return an error for non-array input (null)', () => {
      const result = removeDuplicates(null as unknown as string[]);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });
  });

  describe('chunkArray', () => {
    it('should chunk an array into smaller arrays of specified size', () => {
      const result = chunkArray([1, 2, 3, 4, 5, 6, 7], 3);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it('should handle chunk size equal to array length', () => {
      const result = chunkArray([1, 2, 3], 3);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([[1, 2, 3]]);
    });

    it('should handle chunk size larger than array length', () => {
      const result = chunkArray([1, 2, 3], 5);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([[1, 2, 3]]);
    });

    it('should return an empty array of chunks for an empty input array', () => {
      const result = chunkArray([], 2);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return an error for a chunk size of 0', () => {
      const result = chunkArray([1, 2, 3], 0);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.CHUNK_INVALID_SIZE);
    });

    it('should return an error for a negative chunk size', () => {
      const result = chunkArray([1, 2, 3], -1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.CHUNK_INVALID_SIZE);
    });

    it('should return an error for a non-integer chunk size', () => {
      const result = chunkArray([1, 2, 3], 2.5);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.CHUNK_INVALID_SIZE);
    });

    it('should return an error for non-array input', () => {
      const result = chunkArray('string' as unknown as number[], 2);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });
  });
});

describe('Object Transformation Functions', () => {
  describe('deepMerge', () => {
    it('should deeply merge properties from source into target', () => {
      const target = { a: 1, b: { c: 2, d: 3 }, e: [1, 2] };
      const source1 = { b: { c: 4, f: 5 }, g: 6 };
      const source2 = { a: 10, b: { h: 7 } };
      const result = deepMerge(target, source1, source2);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: 10, b: { c: 4, d: 3, f: 5, h: 7 }, e: [1, 2], g: 6 });
    });

    it('should overwrite arrays, not merge them', () => {
      const target = { a: [1, 2], b: { c: 3 } };
      const source = { a: [3, 4] };
      const result = deepMerge(target, source);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: [3, 4], b: { c: 3 } });
    });

    it('should handle null and undefined values correctly (overwrite)', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { a: null, b: { c: undefined } };
      const result = deepMerge(target, source);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: null, b: { c: undefined } });
    });

    it('should handle empty source objects', () => {
      const target = { a: 1, b: 2 };
      const result = deepMerge(target, {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: 1, b: 2 });
    });

    it('should handle empty target object', () => {
      const result = deepMerge({}, { a: 1, b: 2 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: 1, b: 2 });
    });

    it('should return error for non-object target', () => {
      const result = deepMerge(null as unknown as Record<string, unknown>, { a: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return error for array target', () => {
      const result = deepMerge([] as unknown as Record<string, unknown>, { a: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should ignore non-object sources', () => {
      const target = { a: 1 };
      const result = deepMerge(target, null as unknown as { a?: number }, { b: 2 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: 1, b: 2 });
    });

    it('should merge multiple levels deep', () => {
      const target = { a: { b: { c: 1, d: 2 } } };
      const source = { a: { b: { e: 3 }, f: 4 } };
      const result = deepMerge(target, source);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: { b: { c: 1, d: 2, e: 3 }, f: 4 } });
    });
  });

  describe('pickKeys', () => {
    interface TestObject {
      id: string;
      name: string;
      age: number;
      city?: string;
    }
    const testObj: TestObject = { id: '1', name: 'Alice', age: 30, city: 'New York' };

    it('should pick specified keys from an object', () => {
      const result = pickKeys(testObj, ['id', 'name']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'Alice' });
    });

    it('should return an empty object if no keys are specified', () => {
      const result = pickKeys(testObj, []);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should ignore keys that do not exist in the object', () => {
      const result = pickKeys(testObj, ['id', 'email' as keyof TestObject]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1' });
    });

    it('should return all keys if all existing keys are specified', () => {
      const result = pickKeys(testObj, ['id', 'name', 'age', 'city']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'Alice', age: 30, city: 'New York' });
    });

    it('should handle objects with optional properties', () => {
      const obj = { a: 1, b: undefined };
      const result = pickKeys(obj, ['a', 'b']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: 1, b: undefined });
    });

    it('should return an error for non-object input (null)', () => {
      const result = pickKeys(null as unknown as TestObject, ['id']);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return an error for non-object input (array)', () => {
      const result = pickKeys([] as unknown as TestObject, ['id']);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return an error for non-array keys input', () => {
      const result = pickKeys(testObj, 'id' as unknown as (keyof TestObject)[]);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });
  });
});

describe('Date/Time Helpers', () => {
  describe('formatDate', () => {
    it('should format a Date object into YYYY-MM-DD string', () => {
      const date = new Date('2023-01-15T10:00:00Z');
      const result = formatDate(date);
      expect(result.success).toBe(true);
      expect(result.data).toBe('2023-01-15');
    });

    it('should handle single-digit months and days with leading zeros', () => {
      const date = new Date('2023-03-05T10:00:00Z');
      const result = formatDate(date);
      expect(result.success).toBe(true);
      expect(result.data).toBe('2023-03-05');
    });

    it('should return an error for invalid Date objects', () => {
      const invalidDate = new Date('invalid date string');
      const result = formatDate(invalidDate);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return an error for non-Date input (string)', () => {
      const result = formatDate('2023-01-01' as unknown as Date);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return an error for non-Date input (null)', () => {
      const result = formatDate(null as unknown as Date);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });
  });

  describe('addDays', () => {
    it('should add positive number of days to a date', () => {
      const date = new Date('2023-01-15T12:00:00Z');
      const result = addDays(date, 5);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(new Date('2023-01-20T12:00:00Z'));
    });

    it('should subtract negative number of days from a date', () => {
      const date = new Date('2023-01-15T12:00:00Z');
      const result = addDays(date, -5);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(new Date('2023-01-10T12:00:00Z'));
    });

    it('should cross month boundaries correctly', () => {
      const date = new Date('2023-01-30T12:00:00Z'); // January has 31 days
      const result = addDays(date, 5);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(new Date('2023-02-04T12:00:00Z'));
    });

    it('should cross year boundaries correctly', () => {
      const date = new Date('2023-12-30T12:00:00Z');
      const result = addDays(date, 5);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(new Date('2024-01-04T12:00:00Z'));
    });

    it('should handle zero days (return same date object with new identity)', () => {
      const date = new Date('2023-01-15T12:00:00Z');
      const result = addDays(date, 0);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(date);
      expect(result.data).not.toBe(date); // Should be a new Date object
    });

    it('should return an error for invalid Date objects', () => {
      const invalidDate = new Date('invalid date string');
      const result = addDays(invalidDate, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return an error for non-Date input', () => {
      const result = addDays('2023-01-01' as unknown as Date, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return an error for non-integer days', () => {
      const date = new Date();
      const result = addDays(date, 1.5);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });

    it('should return an error for non-number days input', () => {
      const date = new Date();
      const result = addDays(date, 'one' as unknown as number);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGES.INVALID_INPUT);
    });
  });
});