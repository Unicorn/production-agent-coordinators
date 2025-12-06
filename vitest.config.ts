import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',  // critical for Node built-ins
    globals: true,        // optional, but common
    testTimeout: 30000,   // Set a higher timeout for integration tests
    hookTimeout: 60000,   // Set higher timeout for beforeAll/afterAll hooks (Temporal connection can take time)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**', // Exclude E2E tests - they have their own config
      '**/.worktrees/**', // Exclude git worktrees to prevent test contamination
    ],
    deps: {
      inline: [
        /@coordinator\/.*/, // Inline all @coordinator packages to ensure Vitest processes them
      ],
      interopDefault: true, // Handle CJS default exports when imported as ESM
    },
  },
  // Only touch resolve/ssr if you have specific problems with 3rd-party deps.
});
