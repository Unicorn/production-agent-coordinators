import { describe, it, expect } from 'vitest';
import { parseInput, searchForPackage, readPackageJson, buildDependencyTree } from '../discovery.activities';
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

  describe('readPackageJson', () => {
    it('should read package.json and extract metadata', async () => {
      // Create temp package.json for testing
      const tempDir = '/tmp/test-package';
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0',
          dependencies: {
            '@bernierllc/logger': '^1.0.0'
          }
        })
      );

      const result = await readPackageJson({
        packagePath: tempDir
      });

      expect(result.name).toBe('@bernierllc/test-package');
      expect(result.version).toBe('1.0.0');
      expect(result.dependencies).toContain('@bernierllc/logger');

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('should filter out non-workspace dependencies', async () => {
      const tempDir = '/tmp/test-package-2';
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0',
          dependencies: {
            '@bernierllc/logger': '^1.0.0',
            'axios': '^1.0.0'
          }
        })
      );

      const result = await readPackageJson({
        packagePath: tempDir
      });

      expect(result.dependencies).toContain('@bernierllc/logger');
      expect(result.dependencies).not.toContain('axios');

      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('buildDependencyTree', () => {
    it('should build complete dependency tree', async () => {
      // Setup test packages
      const workspace = '/tmp/test-workspace';
      fs.mkdirSync(path.join(workspace, 'packages/core/logger'), { recursive: true });
      fs.mkdirSync(path.join(workspace, 'packages/core/openai-client'), { recursive: true });

      fs.writeFileSync(
        path.join(workspace, 'packages/core/logger/package.json'),
        JSON.stringify({ name: '@bernierllc/logger', version: '1.0.0', dependencies: {} })
      );

      fs.writeFileSync(
        path.join(workspace, 'packages/core/openai-client/package.json'),
        JSON.stringify({
          name: '@bernierllc/openai-client',
          version: '1.0.0',
          dependencies: { '@bernierllc/logger': '^1.0.0' }
        })
      );

      const result = await buildDependencyTree({
        packageName: '@bernierllc/openai-client',
        workspaceRoot: workspace
      });

      expect(result.packages).toHaveLength(2);
      expect(result.packages.map(p => p.name)).toContain('@bernierllc/logger');
      expect(result.packages.map(p => p.name)).toContain('@bernierllc/openai-client');

      const clientPkg = result.packages.find(p => p.name === '@bernierllc/openai-client');
      expect(clientPkg?.dependencies).toContain('@bernierllc/logger');

      fs.rmSync(workspace, { recursive: true });
    });

    it('should handle packages with no dependencies', async () => {
      const workspace = '/tmp/test-workspace-2';
      fs.mkdirSync(path.join(workspace, 'packages/core/logger'), { recursive: true });

      fs.writeFileSync(
        path.join(workspace, 'packages/core/logger/package.json'),
        JSON.stringify({ name: '@bernierllc/logger', version: '1.0.0', dependencies: {} })
      );

      const result = await buildDependencyTree({
        packageName: '@bernierllc/logger',
        workspaceRoot: workspace
      });

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].dependencies).toHaveLength(0);

      fs.rmSync(workspace, { recursive: true });
    });
  });
});
