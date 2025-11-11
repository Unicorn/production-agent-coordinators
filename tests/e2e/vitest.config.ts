import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30s timeout for E2E tests
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@coordinator/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@coordinator/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts'),
      '@coordinator/coordinator': path.resolve(__dirname, '../../packages/coordinator/src/index.ts'),
      '@coordinator/storage': path.resolve(__dirname, '../../packages/storage/src/index.ts'),
      '@coordinator/specs-hello': path.resolve(__dirname, '../../packages/specs/hello/src/index.ts'),
      '@coordinator/specs-todo': path.resolve(__dirname, '../../packages/specs/todo/src/index.ts'),
      '@coordinator/agents-mock': path.resolve(__dirname, '../../packages/agents/mock/src/index.ts'),
    },
  },
});
