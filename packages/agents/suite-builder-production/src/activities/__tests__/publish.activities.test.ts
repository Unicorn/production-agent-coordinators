import { describe, it, expect } from 'vitest';
import { determineVersionBump } from '../publish.activities';

describe('Publishing Activities', () => {
  describe('determineVersionBump', () => {
    it('should bump major version for breaking changes', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.0.0',
        changeType: 'major'
      });

      expect(result.newVersion).toBe('2.0.0');
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.changeType).toBe('major');
    });

    it('should bump minor version for new features', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.0.0',
        changeType: 'minor'
      });

      expect(result.newVersion).toBe('1.1.0');
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.changeType).toBe('minor');
    });

    it('should bump patch version for bug fixes', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.0.0',
        changeType: 'patch'
      });

      expect(result.newVersion).toBe('1.0.1');
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.changeType).toBe('patch');
    });

    it('should handle first version bump', async () => {
      const result = await determineVersionBump({
        currentVersion: '0.0.0',
        changeType: 'major'
      });

      expect(result.newVersion).toBe('1.0.0');
      expect(result.previousVersion).toBe('0.0.0');
      expect(result.changeType).toBe('major');
    });

    it('should handle pre-release versions', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.0.0-alpha.1',
        changeType: 'patch'
      });

      expect(result.newVersion).toBe('1.0.0');
      expect(result.previousVersion).toBe('1.0.0-alpha.1');
      expect(result.changeType).toBe('patch');
    });

    it('should throw error for empty currentVersion', async () => {
      await expect(
        determineVersionBump({
          currentVersion: '',
          changeType: 'major'
        })
      ).rejects.toThrow('currentVersion cannot be empty');
    });

    it('should throw error for invalid changeType', async () => {
      await expect(
        determineVersionBump({
          currentVersion: '1.0.0',
          changeType: 'invalid' as any
        })
      ).rejects.toThrow('Invalid changeType: invalid');
    });

    it('should throw error for invalid semver version', async () => {
      await expect(
        determineVersionBump({
          currentVersion: 'not-a-version',
          changeType: 'major'
        })
      ).rejects.toThrow('Invalid semver version: not-a-version');
    });

    it('should handle complex version numbers', async () => {
      const result = await determineVersionBump({
        currentVersion: '2.5.7',
        changeType: 'minor'
      });

      expect(result.newVersion).toBe('2.6.0');
      expect(result.previousVersion).toBe('2.5.7');
    });

    it('should reset minor and patch when bumping major', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.5.7',
        changeType: 'major'
      });

      expect(result.newVersion).toBe('2.0.0');
      expect(result.previousVersion).toBe('1.5.7');
    });

    it('should reset patch when bumping minor', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.5.7',
        changeType: 'minor'
      });

      expect(result.newVersion).toBe('1.6.0');
      expect(result.previousVersion).toBe('1.5.7');
    });
  });
});
