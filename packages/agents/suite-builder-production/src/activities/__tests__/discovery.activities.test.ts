import { describe, it, expect } from 'vitest';
import { parseInput, searchForPackage } from '../discovery.activities';
import * as fs from 'fs';
import * as path from 'path';

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

  describe('searchForPackage', () => {
    it('should find package in workspace', async () => {
      // Find the monorepo root by looking for the packages directory
      let workspaceRoot = path.resolve(process.cwd());
      while (!fs.existsSync(path.join(workspaceRoot, 'packages')) && workspaceRoot !== '/') {
        workspaceRoot = path.dirname(workspaceRoot);
      }

      if (workspaceRoot === '/') {
        throw new Error('Could not find monorepo root');
      }

      const result = await searchForPackage({
        searchQuery: '@coordinator/agent-suite-builder-production',
        workspaceRoot
      });

      expect(result.found).toBe(true);
      expect(result.packagePath).toBeDefined();
      expect(result.packagePath).toContain('packages/agents/suite-builder-production');
    });

    it('should return not found if package does not exist', async () => {
      // Find the monorepo root by looking for the packages directory
      let workspaceRoot = path.resolve(process.cwd());
      while (!fs.existsSync(path.join(workspaceRoot, 'packages')) && workspaceRoot !== '/') {
        workspaceRoot = path.dirname(workspaceRoot);
      }

      if (workspaceRoot === '/') {
        throw new Error('Could not find monorepo root');
      }

      const result = await searchForPackage({
        searchQuery: 'non-existent-package-xyz-12345',
        workspaceRoot
      });

      expect(result.found).toBe(false);
      expect(result.searchedLocations).toContain('plans/packages/**');
      expect(result.searchedLocations).toContain('packages/**');
    });
  });
});
