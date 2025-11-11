import { describe, it, expect } from 'vitest';
import { parseInput } from '../discovery.activities';

describe('Discovery Activities', () => {
  describe('parseInput', () => {
    it('should identify package name input', () => {
      const result = parseInput({
        packageName: '@bernierllc/openai-client',
        config: {} as any
      });
      expect(result.type).toBe('packageName');
      expect(result.value).toBe('@bernierllc/openai-client');
    });

    it('should identify package idea input', () => {
      const result = parseInput({
        packageIdea: 'create streaming client',
        config: {} as any
      });
      expect(result.type).toBe('packageIdea');
      expect(result.value).toBe('create streaming client');
    });

    it('should identify plan file path input', () => {
      const result = parseInput({
        planFilePath: 'plans/packages/core/test.md',
        config: {} as any
      });
      expect(result.type).toBe('planFilePath');
      expect(result.value).toBe('plans/packages/core/test.md');
    });

    it('should identify update prompt input', () => {
      const result = parseInput({
        updatePrompt: 'add streaming support',
        config: {} as any
      });
      expect(result.type).toBe('updatePrompt');
      expect(result.value).toBe('add streaming support');
    });

    it('should throw error if no input provided', () => {
      expect(() => parseInput({ config: {} as any })).toThrow('No input provided');
    });
  });
});
