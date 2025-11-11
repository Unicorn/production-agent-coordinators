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
  });
});
