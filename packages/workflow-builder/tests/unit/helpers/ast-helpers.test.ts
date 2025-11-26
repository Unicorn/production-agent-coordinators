/**
 * Unit tests for AST helper utilities
 */

import { describe, it, expect } from 'vitest';
import {
  indent,
  toCamelCase,
  toPascalCase,
  toKebabCase,
  generateVariableName,
  formatImport,
  mergeImports,
  generateComment,
  generateJSDoc,
  parseDuration,
  formatValue,
  generateFunctionSignature,
  generateArrowFunction,
  wrapInTryCatch,
  generateObject,
  sanitizeIdentifier,
} from '@/lib/compiler/utils/ast-helpers';
import type { ImportStatement } from '@/lib/compiler/types';

describe('AST Helpers', () => {
  describe('indent', () => {
    it('generates correct indentation for level 0', () => {
      expect(indent(0)).toBe('');
    });

    it('generates correct indentation for level 1', () => {
      expect(indent(1)).toBe('  ');
    });

    it('generates correct indentation for level 3', () => {
      expect(indent(3)).toBe('      ');
    });
  });

  describe('toCamelCase', () => {
    it('converts simple strings to camelCase', () => {
      expect(toCamelCase('hello world')).toBe('helloWorld');
      expect(toCamelCase('hello-world')).toBe('helloWorld');
      expect(toCamelCase('hello_world')).toBe('helloWorld');
    });

    it('handles already camelCase strings', () => {
      expect(toCamelCase('helloWorld')).toBe('helloWorld');
    });

    it('handles PascalCase strings', () => {
      expect(toCamelCase('HelloWorld')).toBe('helloWorld');
    });

    it('handles strings with numbers', () => {
      expect(toCamelCase('hello 123 world')).toBe('hello123World');
    });

    it('handles empty strings', () => {
      expect(toCamelCase('')).toBe('');
    });
  });

  describe('toPascalCase', () => {
    it('converts simple strings to PascalCase', () => {
      expect(toPascalCase('hello world')).toBe('HelloWorld');
      expect(toPascalCase('hello-world')).toBe('HelloWorld');
      expect(toPascalCase('hello_world')).toBe('HelloWorld');
    });

    it('handles already PascalCase strings', () => {
      expect(toPascalCase('HelloWorld')).toBe('HelloWorld');
    });

    it('handles camelCase strings', () => {
      expect(toPascalCase('helloWorld')).toBe('HelloWorld');
    });

    it('handles strings with numbers', () => {
      expect(toPascalCase('hello 123 world')).toBe('Hello123World');
    });
  });

  describe('toKebabCase', () => {
    it('converts camelCase to kebab-case', () => {
      expect(toKebabCase('helloWorld')).toBe('hello-world');
      expect(toKebabCase('helloWorldTest')).toBe('hello-world-test');
    });

    it('converts PascalCase to kebab-case', () => {
      expect(toKebabCase('HelloWorld')).toBe('hello-world');
    });

    it('handles spaces and underscores', () => {
      expect(toKebabCase('hello world')).toBe('hello-world');
      expect(toKebabCase('hello_world')).toBe('hello-world');
    });

    it('handles already kebab-case strings', () => {
      expect(toKebabCase('hello-world')).toBe('hello-world');
    });
  });

  describe('generateVariableName', () => {
    it('generates variable names with default prefix', () => {
      // Replaces non-alphanumeric chars with underscores
      expect(generateVariableName('node-1')).toBe('result_node_1');
      expect(generateVariableName('activity_2')).toBe('result_activity_2');
    });

    it('generates variable names with custom prefix', () => {
      expect(generateVariableName('node-1', 'var')).toBe('var_node_1');
    });

    it('handles special characters', () => {
      // Special chars are replaced with underscores
      expect(generateVariableName('node@1#test')).toBe('result_node_1_test');
    });
  });

  describe('formatImport', () => {
    it('formats default imports', () => {
      const imp: ImportStatement = {
        type: 'default',
        module: './module',
        items: ['DefaultExport'],
      };
      expect(formatImport(imp)).toBe("import DefaultExport from './module';");
    });

    it('formats namespace imports', () => {
      const imp: ImportStatement = {
        type: 'namespace',
        module: './module',
        items: ['ModuleNamespace'],
      };
      expect(formatImport(imp)).toBe("import * as ModuleNamespace from './module';");
    });

    it('formats named imports', () => {
      const imp: ImportStatement = {
        type: 'named',
        module: './module',
        items: ['export1', 'export2'],
      };
      expect(formatImport(imp)).toBe("import { export1, export2 } from './module';");
    });

    it('formats side-effect imports', () => {
      const imp: ImportStatement = {
        type: 'named',
        module: './module',
        items: [],
      };
      expect(formatImport(imp)).toBe("import './module';");
    });
  });

  describe('mergeImports', () => {
    it('deduplicates imports from the same module', () => {
      const imports = [
        "import { foo } from './module';",
        "import { bar } from './module';",
        "import { foo } from './module';",
      ];
      const result = mergeImports(imports);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('foo');
      expect(result[0]).toContain('bar');
    });

    it('separates type imports from regular imports', () => {
      const imports = [
        "import { foo } from './module';",
        "import type { Bar } from './module';",
      ];
      const result = mergeImports(imports);
      expect(result.length).toBeGreaterThanOrEqual(1);
      const typeImport = result.find(imp => imp.includes('type'));
      const regularImport = result.find(imp => !imp.includes('type'));
      expect(typeImport).toBeDefined();
      expect(regularImport).toBeDefined();
    });

    it('preserves namespace imports', () => {
      const imports = [
        "import * as Namespace from './module';",
        "import { foo } from './module';",
      ];
      const result = mergeImports(imports);
      expect(result.some(imp => imp.includes('* as Namespace'))).toBe(true);
    });

    it('handles empty array', () => {
      expect(mergeImports([])).toEqual([]);
    });
  });

  describe('generateComment', () => {
    it('generates single-line comment', () => {
      expect(generateComment('test comment')).toBe('// test comment');
    });

    it('generates indented comment', () => {
      expect(generateComment('test comment', 2)).toBe('    // test comment');
    });
  });

  describe('generateJSDoc', () => {
    it('generates single-line JSDoc', () => {
      const result = generateJSDoc('test description');
      expect(result).toContain('/**');
      expect(result).toContain('*/');
      expect(result).toContain('test description');
    });

    it('generates multi-line JSDoc', () => {
      const result = generateJSDoc('line 1\nline 2\nline 3');
      expect(result).toContain('/**');
      expect(result).toContain('*/');
      expect(result.split('\n').length).toBeGreaterThan(3);
    });

    it('generates indented JSDoc', () => {
      const result = generateJSDoc('test', 2);
      expect(result.startsWith('    ')).toBe(true);
    });
  });

  describe('parseDuration', () => {
    it('parses milliseconds', () => {
      expect(parseDuration('500ms')).toBe(500);
      expect(parseDuration('1000ms')).toBe(1000);
    });

    it('parses seconds', () => {
      expect(parseDuration('2s')).toBe(2000);
      expect(parseDuration('30s')).toBe(30000);
    });

    it('parses minutes', () => {
      expect(parseDuration('1m')).toBe(60000);
      expect(parseDuration('5m')).toBe(300000);
    });

    it('parses hours', () => {
      expect(parseDuration('1h')).toBe(3600000);
      expect(parseDuration('2h')).toBe(7200000);
    });

    it('parses days', () => {
      expect(parseDuration('1d')).toBe(86400000);
      expect(parseDuration('2d')).toBe(172800000);
    });

    it('handles case-insensitive units', () => {
      expect(parseDuration('2S')).toBe(2000);
      expect(parseDuration('5M')).toBe(300000);
    });

    it('handles whitespace', () => {
      expect(parseDuration('2 s')).toBe(2000);
      expect(parseDuration('5 m')).toBe(300000);
    });

    it('throws on invalid format', () => {
      expect(() => parseDuration('invalid')).toThrow();
      expect(() => parseDuration('2x')).toThrow();
      expect(() => parseDuration('abc')).toThrow();
    });
  });

  describe('formatValue', () => {
    it('formats null', () => {
      expect(formatValue(null)).toBe('null');
    });

    it('formats undefined', () => {
      expect(formatValue(undefined)).toBe('undefined');
    });

    it('formats strings', () => {
      expect(formatValue('hello')).toBe('"hello"');
      expect(formatValue('test "quotes"')).toBe('"test \\"quotes\\""');
    });

    it('formats numbers', () => {
      expect(formatValue(42)).toBe('42');
      expect(formatValue(3.14)).toBe('3.14');
    });

    it('formats booleans', () => {
      expect(formatValue(true)).toBe('true');
      expect(formatValue(false)).toBe('false');
    });

    it('formats arrays', () => {
      expect(formatValue([1, 2, 3])).toBe('[1, 2, 3]');
      expect(formatValue(['a', 'b'])).toBe('["a", "b"]');
    });

    it('formats objects', () => {
      expect(formatValue({ a: 1, b: 'test' })).toContain('a: 1');
      expect(formatValue({ a: 1, b: 'test' })).toContain('b: "test"');
    });
  });

  describe('generateFunctionSignature', () => {
    it('generates simple function signature', () => {
      const result = generateFunctionSignature(
        'test',
        [{ name: 'x', type: 'number' }],
        'number'
      );
      expect(result).toBe('function test(x: number): number');
    });

    it('generates async function signature', () => {
      const result = generateFunctionSignature(
        'test',
        [{ name: 'x', type: 'number' }],
        'Promise<number>',
        true
      );
      expect(result).toBe('async function test(x: number): Promise<number>');
    });

    it('handles optional parameters', () => {
      const result = generateFunctionSignature(
        'test',
        [{ name: 'x', type: 'number', optional: true }],
        'number'
      );
      expect(result).toBe('function test(x?: number): number');
    });

    it('handles multiple parameters', () => {
      const result = generateFunctionSignature(
        'test',
        [
          { name: 'x', type: 'number' },
          { name: 'y', type: 'string' },
        ],
        'void'
      );
      expect(result).toBe('function test(x: number, y: string): void');
    });
  });

  describe('generateArrowFunction', () => {
    it('generates simple arrow function', () => {
      const result = generateArrowFunction(
        [{ name: 'x' }],
        'x + 1'
      );
      expect(result).toBe('(x) => x + 1');
    });

    it('generates async arrow function', () => {
      const result = generateArrowFunction(
        [{ name: 'x' }],
        'await x',
        true
      );
      expect(result).toBe('async (x) => await x');
    });

    it('handles typed parameters', () => {
      const result = generateArrowFunction(
        [{ name: 'x', type: 'number' }],
        'x + 1'
      );
      expect(result).toBe('(x: number) => x + 1');
    });

    it('handles multiple parameters', () => {
      const result = generateArrowFunction(
        [{ name: 'x' }, { name: 'y' }],
        'x + y'
      );
      expect(result).toBe('(x, y) => x + y');
    });
  });

  describe('wrapInTryCatch', () => {
    it('wraps code in try-catch', () => {
      const result = wrapInTryCatch('doSomething();', 'console.error(error);');
      expect(result).toContain('try {');
      expect(result).toContain('doSomething();');
      expect(result).toContain('catch (error) {');
      expect(result).toContain('console.error(error);');
    });

    it('handles indentation', () => {
      const result = wrapInTryCatch('doSomething();', 'console.error(error);', 2);
      expect(result.startsWith('    ')).toBe(true);
    });
  });

  describe('generateObject', () => {
    it('generates empty object', () => {
      expect(generateObject({})).toBe('{}');
    });

    it('generates object with properties', () => {
      const result = generateObject({ a: 1, b: 'test' });
      expect(result).toContain('a: 1');
      expect(result).toContain('b: "test"');
      expect(result).toContain('{');
      expect(result).toContain('}');
    });

    it('handles indentation', () => {
      const result = generateObject({ a: 1 }, 2);
      expect(result.split('\n')[0]).toBe('{');
      expect(result.split('\n')[1]).toContain('      '); // 2 levels + 1 for property
    });
  });

  describe('sanitizeIdentifier', () => {
    it('sanitizes valid identifiers', () => {
      expect(sanitizeIdentifier('hello')).toBe('hello');
      expect(sanitizeIdentifier('hello123')).toBe('hello123');
      expect(sanitizeIdentifier('_hello')).toBe('_hello');
    });

    it('replaces invalid characters', () => {
      expect(sanitizeIdentifier('hello-world')).toBe('hello_world');
      expect(sanitizeIdentifier('hello.world')).toBe('hello_world');
      expect(sanitizeIdentifier('hello@world')).toBe('hello_world');
    });

    it('handles identifiers starting with numbers', () => {
      expect(sanitizeIdentifier('123hello')).toBe('_123hello');
    });

    it('handles reserved words', () => {
      expect(sanitizeIdentifier('class')).toBe('_class');
      expect(sanitizeIdentifier('function')).toBe('_function');
      expect(sanitizeIdentifier('return')).toBe('_return');
    });

    it('handles mixed case reserved words', () => {
      // Reserved words check is case-sensitive, so 'Class' is not treated as reserved
      expect(sanitizeIdentifier('Class')).toBe('Class');
      // But lowercase 'class' is reserved
      expect(sanitizeIdentifier('class')).toBe('_class');
    });
  });
});

