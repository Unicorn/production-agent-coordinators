import { defineConfig } from 'vitest/config';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next'],
    setupFiles: ['./tests/setup.ts'],
    // Use jsdom for UI component tests
    environmentMatchGlobs: [
      ['tests/ui/**', 'jsdom'],
      ['tests/unit/**/*.test.tsx', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

