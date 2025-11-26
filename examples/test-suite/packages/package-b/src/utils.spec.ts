/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import {
  isNil,
  capitalizeFirstLetter,
  reverseString,
  uniqueArrayBy,
  toCamelCase,
  generateRandomAlphanumeric,
  safeJsonParse,
  PackageResult,
} from './utils';

describe('isNil', () => {
  it('should return true for null', () => {
    expect(isNil(null)).toBe(true);
  });

  it('should return true for undefined', () => {
    expect(isNil(undefined)).toBe(true);
  });

  it('should return false for an empty string', () => {
    expect(isNil('')).toBe(false);
  });

  it('should return false for a number', () => {
    expect(isNil(0)).toBe(false);
    expect(isNil(123)).toBe(false);
  });

  it('should return false for a boolean', () => {
    expect(isNil(true)).toBe(false);
    expect(isNil(false)).toBe(false);
  });

  it('should return false for an object', () => {
    expect(isNil({})).toBe(false);
    expect(isNil({ a: 1 })).toBe(false);
  });

  it('should return false for an array', () => {
    expect(isNil([])).toBe(false);
    expect(isNil([1, 2])).toBe(false);
  });
});

describe('capitalizeFirstLetter', () => {
  it('should capitalize the first letter of a string', () => {
    expect(capitalizeFirstLetter('hello')).toBe('Hello');
  });

  it('should return an empty string for an empty string input', () => {
    expect(capitalizeFirstLetter('')).toBe('');
  });

  it('should return an empty string for null input', () => {
    expect(capitalizeFirstLetter(null)).toBe('');
  });

  it('should return an empty string for undefined input', () => {
    expect(capitalizeFirstLetter(undefined)).toBe('');
  });

  it('should handle strings that are already capitalized', () => {
    expect(capitalizeFirstLetter('World')).toBe('World');
  });

  it('should handle strings with multiple words', () => {
    expect(capitalizeFirstLetter('hello world')).toBe('Hello world');
  });

  it('should handle strings with non-alphabetic first characters', () => {
    expect(capitalizeFirstLetter('123test')).toBe('123test');
    expect(capitalizeFirstLetter('!test')).toBe('!test');
  });
});

describe('reverseString', () => {
  it('should reverse a non-empty string', () => {
    expect(reverseString('hello')).toBe('olleh');
  });

  it('should return an empty string for an empty input', () => {
    expect(reverseString('')).toBe('');
  });

  it('should return an empty string for null input', () => {
    expect(reverseString(null)).toBe('');
  });

  it('should return an empty string for undefined input', () => {
    expect(reverseString(undefined)).toBe('');
  });

  it('should reverse a string with spaces', () => {
    expect(reverseString('hello world')).toBe('dlrow olleh');
  });

  it('should handle palindromes correctly', () => {
    expect(reverseString('madam')).toBe('madam');
  });

  it('should handle strings with special characters', () => {
    expect(reverseString('!@#$')).toBe('$#@!');
  });
});

describe('uniqueArrayBy', () => {
  interface Item {
    id: number;
    name: string;
  }

  it('should remove duplicate objects based on a number key', () => {
    const arr: Item[] = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 1, name: 'C' },
      { id: 3, name: 'D' },
      { id: 2, name: 'E' },
    ];
    const expected = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'D' },
    ];
    expect(uniqueArrayBy(arr, (item) => item.id)).toEqual(expected);
  });

  it('should remove duplicate objects based on a string key', () => {
    const arr: Item[] = [
      { id: 1, name: 'apple' },
      { id: 2, name: 'banana' },
      { id: 3, name: 'apple' },
      { id: 4, name: 'orange' },
    ];
    const expected = [
      { id: 1, name: 'apple' },
      { id: 2, name: 'banana' },
      { id: 4, name: 'orange' },
    ];
    expect(uniqueArrayBy(arr, (item) => item.name)).toEqual(expected);
  });

  it('should return an empty array if input is empty', () => {
    expect(uniqueArrayBy([], (item: Item) => item.id)).toEqual([]);
  });

  it('should return the same array if no duplicates exist', () => {
    const arr = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    expect(uniqueArrayBy(arr, (item) => item.id)).toEqual(arr);
  });

  it('should handle primitive types if keySelector returns the item itself', () => {
    const arr = [1, 2, 2, 3, 1, 4];
    expect(uniqueArrayBy(arr, (item) => item)).toEqual([1, 2, 3, 4]);
  });
});

describe('toCamelCase', () => {
  it('should convert space-separated string to camelCase', () => {
    expect(toCamelCase('hello world')).toBe('helloWorld');
  });

  it('should convert hyphen-separated string to camelCase', () => {
    expect(toCamelCase('foo-bar-baz')).toBe('fooBarBaz');
  });

  it('should convert underscore-separated string to camelCase', () => {
    expect(toCamelCase('lorem_ipsum_dolor')).toBe('loremIpsumDolor');
  });

  it('should convert mixed separators to camelCase', () => {
    expect(toCamelCase('some-mixed_string with spaces')).toBe('someMixedStringWithSpaces');
  });

  it('should handle strings with leading/trailing separators', () => {
    expect(toCamelCase('-leading-hyphen')).toBe('leadingHyphen');
    expect(toCamelCase('trailing-hyphen-')).toBe('trailingHyphen');
  });

  it('should handle empty string', () => {
    expect(toCamelCase('')).toBe('');
  });

  it('should handle null input', () => {
    expect(toCamelCase(null)).toBe('');
  });

  it('should handle undefined input', () => {
    expect(toCamelCase(undefined)).toBe('');
  });

  it('should handle already camelCase strings', () => {
    expect(toCamelCase('alreadyCamelCase')).toBe('alreadyCamelCase');
  });

  it('should handle single word strings', () => {
    expect(toCamelCase('word')).toBe('word');
  });
});

describe('generateRandomAlphanumeric', () => {
  it('should generate a string of the specified length', () => {
    const length = 10;
    const result = generateRandomAlphanumeric(length);
    expect(result.length).toBe(length);
  });

  it('should generate a string containing only alphanumeric characters', () => {
    const length = 20;
    const result = generateRandomAlphanumeric(length);
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    expect(alphanumericRegex.test(result)).toBe(true);
  });

  it('should generate different strings on successive calls', () => {
    const length = 5;
    const result1 = generateRandomAlphanumeric(length);
    const result2 = generateRandomAlphanumeric(length);
    expect(result1).not.toBe(result2); // This can theoretically fail, but highly improbable for short strings
  });

  it('should return an empty string for length 0', () => {
    expect(generateRandomAlphanumeric(0)).toBe('');
  });

  it('should return an empty string for negative length', () => {
    expect(generateRandomAlphanumeric(-5)).toBe('');
  });
});

describe('safeJsonParse', () => {
  interface TestData {
    name: string;
    age: number;
    isActive: boolean;
  }

  it('should successfully parse a valid JSON string', () => {
    const jsonString = '{"name": "Alice", "age": 30, "isActive": true}';
    const result: PackageResult<TestData> = safeJsonParse<TestData>(jsonString);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Alice', age: 30, isActive: true });
    expect(result.error).toBeUndefined();
  });

  it('should return success: false for an invalid JSON string', () => {
    const jsonString = '{"name": "Alice", "age": }'; // Malformed JSON
    const result: PackageResult<TestData> = safeJsonParse<TestData>(jsonString);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed to parse JSON');
  });

  it('should return success: false for an empty string', () => {
    const jsonString = '';
    const result: PackageResult<TestData> = safeJsonParse<TestData>(jsonString);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBe('Input string cannot be empty or null for JSON parsing.');
  });

  it('should return success: false for a string with only whitespace', () => {
    const jsonString = '   ';
    const result: PackageResult<TestData> = safeJsonParse<TestData>(jsonString);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBe('Input string cannot be empty or null for JSON parsing.');
  });

  it('should handle JSON with different data types', () => {
    const jsonString = '{"value": [1, "two", null, {"key": "value"}]}';
    const result: PackageResult<{ value: unknown[] }> = safeJsonParse<{ value: unknown[] }>(jsonString);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: [1, 'two', null, { key: 'value' }] });
  });

  it('should return success: false for non-string input (TypeScript prevents this at compile time, but for runtime robustness)', () => {
    // Cast to any to bypass TS compilation for runtime check
    const jsonString = 123 as any;
    const result: PackageResult<TestData> = safeJsonParse<TestData>(jsonString);
    // JSON.parse throws error if input is not string, so it's caught
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed to parse JSON');
  });
});