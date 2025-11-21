import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadFeatureFlags, getDefaultFeatureFlags } from '../feature-flags';

describe('Feature Flags', () => {
  // Store original env values
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.ENABLE_TURN_BASED_GENERATION;
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv === undefined) {
      delete process.env.ENABLE_TURN_BASED_GENERATION;
    } else {
      process.env.ENABLE_TURN_BASED_GENERATION = originalEnv;
    }
  });

  describe('loadFeatureFlags', () => {
    it('should load turn-based generation as true when env var is "true"', () => {
      process.env.ENABLE_TURN_BASED_GENERATION = 'true';

      const flags = loadFeatureFlags();

      expect(flags.turnBasedGeneration).toBe(true);
    });

    it('should load turn-based generation as false when env var is "false"', () => {
      process.env.ENABLE_TURN_BASED_GENERATION = 'false';

      const flags = loadFeatureFlags();

      expect(flags.turnBasedGeneration).toBe(false);
    });

    it('should load turn-based generation as false when env var is not set', () => {
      delete process.env.ENABLE_TURN_BASED_GENERATION;

      const flags = loadFeatureFlags();

      expect(flags.turnBasedGeneration).toBe(false);
    });

    it('should load turn-based generation as false when env var is empty string', () => {
      process.env.ENABLE_TURN_BASED_GENERATION = '';

      const flags = loadFeatureFlags();

      expect(flags.turnBasedGeneration).toBe(false);
    });

    it('should load turn-based generation as false when env var is "1"', () => {
      process.env.ENABLE_TURN_BASED_GENERATION = '1';

      const flags = loadFeatureFlags();

      // Only "true" should enable the flag
      expect(flags.turnBasedGeneration).toBe(false);
    });

    it('should load turn-based generation as false when env var is "TRUE"', () => {
      process.env.ENABLE_TURN_BASED_GENERATION = 'TRUE';

      const flags = loadFeatureFlags();

      // Case sensitive - only "true" should enable
      expect(flags.turnBasedGeneration).toBe(false);
    });
  });

  describe('getDefaultFeatureFlags', () => {
    it('should return all flags disabled', () => {
      const flags = getDefaultFeatureFlags();

      expect(flags.turnBasedGeneration).toBe(false);
    });

    it('should not be affected by environment variables', () => {
      process.env.ENABLE_TURN_BASED_GENERATION = 'true';

      const flags = getDefaultFeatureFlags();

      // Should always return defaults regardless of env
      expect(flags.turnBasedGeneration).toBe(false);
    });
  });

  describe('Feature flag integration', () => {
    it('should allow programmatic override of env-based flags', () => {
      process.env.ENABLE_TURN_BASED_GENERATION = 'false';

      // Load from env (should be false)
      const envFlags = loadFeatureFlags();
      expect(envFlags.turnBasedGeneration).toBe(false);

      // Programmatic override
      const customFlags = {
        ...envFlags,
        turnBasedGeneration: true
      };

      expect(customFlags.turnBasedGeneration).toBe(true);
    });

    it('should support merging with defaults', () => {
      const defaults = getDefaultFeatureFlags();
      const overrides = { turnBasedGeneration: true };

      const merged = { ...defaults, ...overrides };

      expect(merged.turnBasedGeneration).toBe(true);
    });
  });
});
