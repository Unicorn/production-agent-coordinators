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
  type PackageResult,
} from '../src';

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

  it('should return false for a string', () => {
    expect(isNil('hello')).toBe(false);
  });

  it('should return false for a number', () => {
    expect(isNil(0)).toBe(false);
  });

  it('should return false for an object', () => {
    expect(isNil({})).toBe(false);
  });

  it('should return false for an array', () => {
    expect(isNil([])).toBe(false);
  });
});

describe('capitalizeFirstLetter', () => {
  it('should capitalize the first letter of a word', () => {
    expect(capitalizeFirstLetter('hello')).toBe('Hello');
  });

  it('should capitalize the first letter of a sentence', () => {
    expect(capitalizeFirstLetter('hello world')).toBe('Hello world');
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

  it('should handle already capitalized strings', () => {
    expect(capitalizeFirstLetter('Hello')).toBe('Hello');
  });

  it('should handle single character strings', () => {
    expect(capitalizeFirstLetter('a')).toBe('A');
  });

  it('should handle non-alphabetic first characters', () => {
    expect(capitalizeFirstLetter('123test')).toBe('123test');
    expect(capitalizeFirstLetter('!hello')).toBe('!hello');
  });
});

describe('reverseString', () => {
  it('should reverse a simple string', () => {
    expect(reverseString('hello')).toBe('olleh');
  });

  it('should reverse a string with spaces', () => {
    expect(reverseString('hello world')).toBe('dlrow olleh');
  });

  it('should reverse a string with special characters', () => {
    expect(reverseString('!@#$')).toBe('$#@!');
  });

  it('should return an empty string for an empty string input', () => {
    expect(reverseString('')).toBe('');
  });

  it('should return an empty string for null input', () => {
    expect(reverseString(null)).toBe('');
  });

  it('should return an empty string for undefined input', () => {
    expect(reverseString(undefined)).toBe('');
  });

  it('should handle single character strings', () => {
    expect(reverseString('a')).toBe('a');
  });
});

describe('uniqueArrayBy', () => {
  interface Item {
    id: number;
    name: string;
    value: string;
  }

  const items: Item[] = [
    { id: 1, name: 'Apple', value: 'red' },
    { id: 2, name: 'Banana', value: 'yellow' },
    { id: 1, name: 'Apple', value: 'green' }, // Duplicate id
    { id: 3, name: 'Orange', value: 'orange' },
    { id: 2, name: 'Banana', value: 'ripe' }, // Duplicate id
    { id: 4, name: 'Grape', value: 'purple' },
  ];

  it('should remove duplicates by id', () => {
    const result = uniqueArrayBy(items, (item: Item) => item.id);
    expect(result).toEqual([
      { id: 1, name: 'Apple', value: 'red' },
      { id: 2, name: 'Banana', value: 'yellow' },
      { id: 3, name: 'Orange', value: 'orange' },
      { id: 4, name: 'Grape', value: 'purple' },
    ]);
    expect(result.length).toBe(4);
  });

  it('should remove duplicates by name', () => {
    const result = uniqueArrayBy(items, (item: Item) => item.name);
    expect(result).toEqual([
      { id: 1, name: 'Apple', value: 'red' },
      { id: 2, name: 'Banana', value: 'yellow' },
      { id: 3, name: 'Orange', value: 'orange' },
      { id: 4, name: 'Grape', value: 'purple' },
    ]);
    expect(result.length).toBe(4);
  });

  it('should return the same array if no duplicates exist', () => {
    const distinctItems: Item[] = [
      { id: 1, name: 'Apple', value: 'red' },
      { id: 2, name: 'Banana', value: 'yellow' },
    ];
    const result = uniqueArrayBy(distinctItems, (item: Item) => item.id);
    expect(result).toEqual(distinctItems);
  });

  it('should handle an empty array', () => {
    const result = uniqueArrayBy([], (item: Item) => item.id);
    expect(result).toEqual([]);
  });

  it('should handle arrays with primitive types', () => {
    const numbers = [1, 2, 2, 3, 1, 4];
    const result = uniqueArrayBy(numbers, (num: number) => num);
    expect(result).toEqual([1, 2, 3, 4]);
  });
});

describe('toCamelCase', () => {
  it('should convert space-separated words to camelCase', () => {
    expect(toCamelCase('hello world')).toBe('helloWorld');
  });

  it('should convert hyphen-separated words to camelCase', () => {
    expect(toCamelCase('hello-world')).toBe('helloWorld');
  });

  it('should convert underscore-separated words to camelCase', () => {
    expect(toCamelCase('hello_world')).toBe('helloWorld');
  });

  it('should handle mixed delimiters', () => {
    expect(toCamelCase('hello-big_world new things')).toBe('helloBigWorldNewThings');
  });

  it('should handle leading/trailing delimiters', () => {
    expect(toCamelCase('-hello_world-')).toBe('helloWorld');
    expect(toCamelCase(' hello world ')).toBe('helloWorld');
  });

  it('should return an empty string for an empty string input', () => {
    expect(toCamelCase('')).toBe('');
  });

  it('should return an empty string for null input', () => {
    expect(toCamelCase(null)).toBe('');
  });

  it('should return an empty string for undefined input', () => {
    expect(toCamelCase(undefined)).toBe('');
  });

  it('should handle already camelCase strings', () => {
    expect(toCamelCase('alreadyCamelCase')).toBe('alreadyCamelCase');
  });

  it('should handle single words', () => {
    expect(toCamelCase('word')).toBe('word');
  });

  it('should handle numbers and special characters correctly', () => {
    expect(toCamelCase('1st-place')).toBe('1stPlace');
    expect(toCamelCase('data_1_2')).toBe('data12');
  });
});

describe('generateRandomAlphanumeric', () => {
  it('should generate a string of the specified length', () => {
    const length = 10;
    const result = generateRandomAlphanumeric(length);
    expect(result.length).toBe(length);
  });

  it('should contain only alphanumeric characters', () => {
    const length = 20;
    const result = generateRandomAlphanumeric(length);
    expect(result).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it('should generate different strings on successive calls (high probability)', () => {
    const length = 5;
    const result1 = generateRandomAlphanumeric(length);
    const result2 = generateRandomAlphanumeric(length);
    expect(result1).not.toBe(result2); // This might rarely fail but is generally expected
  });

  it('should return an empty string for length 0', () => {
    expect(generateRandomAlphanumeric(0)).toBe('');
  });

  it('should return an empty string for negative length', () => {
    expect(generateRandomAlphanumeric(-5)).toBe('');
  });
});

describe('safeJsonParse', () => {
  it('should successfully parse valid JSON', () => {
    interface TestData {
      name: string;
      age: number;
    }
    const jsonString = '{"name":"John Doe","age":30}';
    const result: PackageResult<TestData> = safeJsonParse<TestData>(jsonString);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'John Doe', age: 30 });
    expect(result.error).toBeUndefined();
  });

  it('should return success: false for invalid JSON', () => {
    const invalidJsonString = '{"name":"John Doe", "age":30,';
    const result: PackageResult<{}> = safeJsonParse(invalidJsonString);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed to parse JSON:');
  });

  it('should return success: false for non-string input that leads to parse error', () => {
    // Testing runtime behavior when TypeScript type checks are bypassed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
    const nonStringInput: any = 123;
    const result: PackageResult<{}> = safeJsonParse(nonStringInput);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed to parse JSON: Expected a string but received a number');
  });

  it('should handle null JSON string as an error', () => {
    // Testing runtime behavior when TypeScript type checks are bypassed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
    const nullInput: any = null;
    const result: PackageResult<{}> = safeJsonParse(nullInput);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed to parse JSON: Expected a string but received null');
  });

  it('should return success: true for valid JSON string of an array', () => {
    interface TestItem {
      id: number;
    }
    const jsonString = '[{"id":1},{"id":2}]';
    const result: PackageResult<TestItem[]> = safeJsonParse<TestItem[]>(jsonString);

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('should return success: true for a valid JSON primitive (number)', () => {
    const jsonString = '123';
    const result: PackageResult<number> = safeJsonParse<number>(jsonString);

    expect(result.success).toBe(true);
    expect(result.data).toBe(123);
  });

  it('should return success: true for a valid JSON primitive (string)', () => {
    const jsonString = '"hello"';
    const result: PackageResult<string> = safeJsonParse<string>(jsonString);

    expect(result.success).toBe(true);
    expect(result.data).toBe('hello');
  });

  it('should return success: true for a valid JSON primitive (boolean)', () => {
    const jsonString = 'true';
    const result: PackageResult<boolean> = safeJsonParse<boolean>(jsonString);

    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
  });
});