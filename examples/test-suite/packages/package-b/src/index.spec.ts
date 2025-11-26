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
} from './utils'; // Import from utils to test the actual implementation

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
  });

  it('should return false for a boolean', () => {
    expect(isNil(true)).toBe(false);
  });

  it('should return false for an object', () => {
    expect(isNil({})).toBe(false);
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

  it('should handle already capitalized string', () => {
    expect(capitalizeFirstLetter('Hello')).toBe('Hello');
  });

  it('should handle string starting with a number', () => {
    expect(capitalizeFirstLetter('123test')).toBe('123test');
  });
});

describe('reverseString', () => {
  it('should reverse a simple string', () => {
    expect(reverseString('hello')).toBe('olleh');
  });

  it('should reverse a string with spaces', () => {
    expect(reverseString('hello world')).toBe('dlrow olleh');
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

  it('should handle special characters', () => {
    expect(reverseString('!@#$')).toBe('$#@!');
  });
});

describe('uniqueArrayBy', () => {
  type Item = { id: number; value: string };
  const items: Item[] = [
    { id: 1, value: 'a' },
    { id: 2, value: 'b' },
    { id: 1, value: 'c' },
    { id: 3, value: 'd' },
    { id: 2, value: 'e' },
  ];

  it('should return unique items based on id', () => {
    const result = uniqueArrayBy(items, (item: Item) => item.id);
    expect(result).toEqual([
      { id: 1, value: 'a' },
      { id: 2, value: 'b' },
      { id: 3, value: 'd' },
    ]);
  });

  it('should return unique items based on value', () => {
    const result = uniqueArrayBy(items, (item: Item) => item.value);
    expect(result).toEqual([
      { id: 1, value: 'a' },
      { id: 2, value: 'b' },
      { id: 1, value: 'c' },
      { id: 3, value: 'd' },
      { id: 2, value: 'e' },
    ]); // All values are unique in the example, so all should be returned.
  });

  it('should handle empty array', () => {
    expect(uniqueArrayBy([], (item: Item) => item.id)).toEqual([]);
  });

  it('should handle array with all unique items', () => {
    const uniqueItems = [
      { id: 1, value: 'a' },
      { id: 2, value: 'b' },
    ];
    expect(uniqueArrayBy(uniqueItems, (item: Item) => item.id)).toEqual(uniqueItems);
  });

  it('should handle arrays with non-object types (e.g., numbers)', () => {
    const numbers = [1, 2, 2, 3, 1, 4];
    expect(uniqueArrayBy(numbers, (num: number) => num)).toEqual([1, 2, 3, 4]);
  });

  it('should handle arrays with non-object types (e.g., strings)', () => {
    const strings = ['a', 'b', 'a', 'c', 'b'];
    expect(uniqueArrayBy(strings, (s: string) => s)).toEqual(['a', 'b', 'c']);
  });

  it('should handle null/undefined key selector results', () => {
    type TestItem = { id: number | null | undefined; name: string };
    const testItems: TestItem[] = [
      { id: 1, name: 'one' },
      { id: null, name: 'two' },
      { id: 1, name: 'one again' },
      { id: undefined, name: 'three' },
      { id: null, name: 'two again' },
    ];

    const result = uniqueArrayBy(testItems, (item: TestItem) => {
        if (item.id === null) return 'null_id'; // Treat null as a specific key string
        if (item.id === undefined) return 'undefined_id'; // Treat undefined as a specific key string
        return item.id;
    });

    expect(result).toEqual([
      { id: 1, name: 'one' },
      { id: null, name: 'two' },
      { id: undefined, name: 'three' },
    ]);
  });

  it('should return empty array if input is not an array', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    expect(uniqueArrayBy(null as any, (item: Item) => item.id)).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    expect(uniqueArrayBy(undefined as any, (item: Item) => item.id)).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    expect(uniqueArrayBy('not an array' as any, (item: Item) => item.id)).toEqual([]);
  });
});

describe('toCamelCase', () => {
  it('should convert space-separated string to camelCase', () => {
    expect(toCamelCase('hello world')).toBe('helloWorld');
  });

  it('should convert hyphen-separated string to camelCase', () => {
    expect(toCamelCase('hello-world')).toBe('helloWorld');
  });

  it('should convert underscore-separated string to camelCase', () => {
    expect(toCamelCase('hello_world')).toBe('helloWorld');
  });

  it('should handle mixed separators', () => {
    expect(toCamelCase('hello-world_test')).toBe('helloWorldTest');
  });

  it('should handle multiple spaces/hyphens/underscores', () => {
    expect(toCamelCase('hello   world---test___again')).toBe('helloWorldTestAgain');
  });

  it('should handle leading/trailing separators', () => {
    expect(toCamelCase('-hello_world-')).toBe('helloWorld');
    expect(toCamelCase('  hello world  ')).toBe('helloWorld');
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

  it('should handle already camelCase string', () => {
    expect(toCamelCase('alreadyCamelCase')).toBe('alreadyCamelCase');
  });

  it('should handle string with only one word', () => {
    expect(toCamelCase('word')).toBe('word');
  });

  it('should handle string with numbers', () => {
    expect(toCamelCase('v1 0 final')).toBe('v10Final');
  });

  it('should handle leading numbers/symbols', () => {
    expect(toCamelCase('1test-string')).toBe('1testString');
    expect(toCamelCase('$test_string')).toBe('testString'); // Leading non-alphanumeric stripped
    expect(toCamelCase('#hello-world')).toBe('helloWorld');
  });
});

describe('generateRandomAlphanumeric', () => {
  it('should generate a string of the specified length', () => {
    const length = 10;
    const result = generateRandomAlphanumeric(length);
    expect(result).toHaveLength(length);
  });

  it('should contain only alphanumeric characters', () => {
    const length = 20;
    const result = generateRandomAlphanumeric(length);
    expect(result).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it('should return an empty string for length 0', () => {
    expect(generateRandomAlphanumeric(0)).toBe('');
  });

  it('should return an empty string for negative length', () => {
    expect(generateRandomAlphanumeric(-5)).toBe('');
  });

  it('should return an empty string for non-integer length', () => {
    expect(generateRandomAlphanumeric(5.5)).toBe('');
  });

  it('should generate different strings on successive calls', () => {
    const length = 15;
    const result1 = generateRandomAlphanumeric(length);
    const result2 = generateRandomAlphanumeric(length);
    expect(result1).not.toBe(result2); // This might fail rarely due to randomness, but highly unlikely for length 15
  });
});

describe('safeJsonParse', () => {
  interface TestData {
    name: string;
    age: number;
    isActive: boolean;
  }

  it('should successfully parse valid JSON object', () => {
    const jsonString = '{"name": "John Doe", "age": 30, "isActive": true}';
    const result: PackageResult<TestData> = safeJsonParse<TestData>(jsonString);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'John Doe', age: 30, isActive: true });
    expect(result.error).toBeUndefined();
  });

  it('should return an error for invalid JSON string', () => {
    const jsonString = '{"name": "John Doe", "age": 30, "isActive": true'; // Missing closing brace
    const result: PackageResult<TestData> = safeJsonParse<TestData>(jsonString);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toContain('Failed to parse JSON:');
    expect(result.error).toContain('Unexpected end of JSON input');
  });

  it('should handle empty string as invalid JSON', () => {
    const jsonString = '';
    const result: PackageResult<TestData> = safeJsonParse<TestData>(jsonString);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toContain('Failed to parse JSON:');
    expect(result.error).toContain('Unexpected end of JSON input');
  });

  it('should successfully parse JSON string "null"', () => {
    const jsonString = 'null';
    const result: PackageResult<null> = safeJsonParse<null>(jsonString);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(result.error).toBeUndefined();
  });

  it('should successfully parse JSON string "true"', () => {
    const jsonString = 'true';
    const result: PackageResult<boolean> = safeJsonParse<boolean>(jsonString);
    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should successfully parse JSON string "123"', () => {
    const jsonString = '123';
    const result: PackageResult<number> = safeJsonParse<number>(jsonString);
    expect(result.success).toBe(true);
    expect(result.data).toBe(123);
    expect(result.error).toBeUndefined();
  });

  it('should handle parsing non-string input gracefully', () => {
    // JSON.parse expects a string. Providing anything else leads to a TypeError.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    const nonStringInput = 123 as any;
    const result: PackageResult<TestData> = safeJsonParse<TestData>(nonStringInput);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toContain('Failed to parse JSON:');
    // Error message might vary depending on JS engine/Node version, but typically 'Unexpected token' or 'invalid JSON string'
    expect(result.error).toMatch(/Unexpected token|invalid JSON|must be a string/);
  });
});