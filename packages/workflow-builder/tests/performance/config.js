/**
 * K6 Performance Test Configuration
 *
 * Shared configuration for all performance tests
 */

// Environment detection
export const ENV = __ENV.TEST_ENV || 'local';

// Base URLs by environment
export const BASE_URLS = {
  local: 'http://localhost:3010',
  staging: process.env.STAGING_URL || 'https://staging.example.com',
  production: process.env.PRODUCTION_URL || 'https://api.example.com',
};

export const BASE_URL = __ENV.BASE_URL || BASE_URLS[ENV];

// Access tokens by environment
export const ACCESS_TOKENS = {
  local: __ENV.ACCESS_TOKEN || process.env.SUPABASE_TEST_ACCESS_TOKEN || '',
  staging: __ENV.STAGING_ACCESS_TOKEN || '',
  production: __ENV.PRODUCTION_ACCESS_TOKEN || '',
};

export const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || ACCESS_TOKENS[ENV];

// Performance thresholds
export const THRESHOLDS = {
  // HTTP request duration thresholds
  http: {
    p90: 5000,  // 90th percentile < 5s
    p95: 7000,  // 95th percentile < 7s
    p99: 10000, // 99th percentile < 10s
  },

  // Error rate thresholds
  errors: {
    rate: 0.01, // 1% error rate
  },

  // Workflow-specific thresholds
  workflow: {
    creation: {
      p90: 5000,
      p95: 7000,
    },
    deployment: {
      p90: 5000,
      p95: 8000,
    },
    execution: {
      p90: 5000,
      p95: 10000,
    },
  },

  // Compiler thresholds by workflow size
  compiler: {
    small: 2000,   // 5 activities
    medium: 5000,  // 20 activities
    large: 10000,  // 50 activities
    xlarge: 20000, // 100 activities
  },
};

// Test scenarios configuration
export const SCENARIOS = {
  smoke: {
    vus: 1,
    duration: '1m',
    description: 'Smoke test with single user',
  },
  load: {
    vus: 10,
    duration: '5m',
    description: 'Normal load test',
  },
  stress: {
    stages: [
      { duration: '2m', target: 10 },
      { duration: '5m', target: 20 },
      { duration: '2m', target: 30 },
      { duration: '5m', target: 30 },
      { duration: '2m', target: 0 },
    ],
    description: 'Stress test with increasing load',
  },
  spike: {
    stages: [
      { duration: '1m', target: 10 },
      { duration: '1m', target: 50 }, // Spike
      { duration: '3m', target: 10 },
      { duration: '1m', target: 0 },
    ],
    description: 'Spike test with sudden load increase',
  },
  soak: {
    vus: 10,
    duration: '30m',
    description: 'Soak test for memory leak detection',
  },
};

// Reporting configuration
export const REPORTING = {
  outputDir: 'tests/performance/reports',
  formats: ['json', 'txt', 'html'],
  includeTimestamp: true,
};

// Validation helpers
export function validateConfig() {
  const errors = [];

  if (!BASE_URL) {
    errors.push('BASE_URL is not configured');
  }

  if (!ACCESS_TOKEN) {
    errors.push('ACCESS_TOKEN is not configured');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }

  return true;
}

// Get configuration summary
export function getConfigSummary() {
  return {
    environment: ENV,
    baseUrl: BASE_URL,
    hasAccessToken: !!ACCESS_TOKEN,
    thresholds: THRESHOLDS,
  };
}
