import { describe, it, expect } from 'vitest';
import { validatePackageStructure } from '../quality.activities';
import * as fs from 'fs';
import * as path from 'path';

describe('Quality Activities', () => {
  describe('validatePackageStructure', () => {
    it('should pass for valid package structure', async () => {
      const tempDir = '/tmp/valid-package';
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test',
          version: '1.0.0',
          description: 'Test package',
          main: 'dist/index.js',
          types: 'dist/index.d.ts',
          author: 'Bernier LLC',
          license: 'MIT'
        })
      );

      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'jest.config.js'), '');
      fs.writeFileSync(path.join(tempDir, '.eslintrc.js'), '');

      const result = await validatePackageStructure({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.missingFiles).toHaveLength(0);
      expect(result.invalidFields).toHaveLength(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for missing required files', async () => {
      const tempDir = '/tmp/invalid-package';
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: '@bernierllc/test' })
      );

      const result = await validatePackageStructure({ packagePath: tempDir });

      expect(result.passed).toBe(false);
      expect(result.missingFiles).toContain('tsconfig.json');

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for empty packagePath', async () => {
      await expect(validatePackageStructure({ packagePath: '' }))
        .rejects.toThrow('packagePath cannot be empty');
    });

    it('should throw error for non-existent packagePath', async () => {
      await expect(validatePackageStructure({ packagePath: '/tmp/does-not-exist-xyz' }))
        .rejects.toThrow('packagePath does not exist');
    });

    it('should throw error if packagePath is not a directory', async () => {
      const tempFile = '/tmp/test-file.txt';
      fs.writeFileSync(tempFile, 'test');

      await expect(validatePackageStructure({ packagePath: tempFile }))
        .rejects.toThrow('packagePath is not a directory');

      fs.rmSync(tempFile);
    });

    it('should throw error for malformed package.json', async () => {
      const tempDir = '/tmp/malformed-json-package';
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(path.join(tempDir, 'package.json'), 'invalid json {');
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'jest.config.js'), '');
      fs.writeFileSync(path.join(tempDir, '.eslintrc.js'), '');

      await expect(validatePackageStructure({ packagePath: tempDir }))
        .rejects.toThrow('Failed to parse package.json');

      fs.rmSync(tempDir, { recursive: true });
    });
  });
});
