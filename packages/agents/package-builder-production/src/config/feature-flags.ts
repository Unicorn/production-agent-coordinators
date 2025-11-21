/**
 * Feature Flags Configuration
 *
 * Manages feature flags for gradual rollout of new functionality.
 * Supports both environment variables and programmatic configuration.
 */

export interface FeatureFlags {
  turnBasedGeneration: boolean;
}

/**
 * Load feature flags from environment variables
 *
 * @returns Feature flags configuration
 */
export function loadFeatureFlags(): FeatureFlags {
  return {
    turnBasedGeneration: process.env.ENABLE_TURN_BASED_GENERATION === 'true'
  };
}

/**
 * Get default feature flags (all disabled)
 *
 * @returns Default feature flags
 */
export function getDefaultFeatureFlags(): FeatureFlags {
  return {
    turnBasedGeneration: false
  };
}
