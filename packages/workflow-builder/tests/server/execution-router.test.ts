/**
 * Execution Router Tests
 * Tests for tRPC execution routes (build and run workflows)
 * 
 * Note: Full integration testing with Temporal is covered in integration tests.
 * These tests focus on input validation and basic structure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext } from '../unit/test-helpers';
import type { TRPCContext } from '@/server/api/trpc';

describe('Execution Router', () => {
  let mockContext: TRPCContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createMockContext();
  });

  describe('execution.build', () => {
    it('should validate workflowId input', async () => {
      // Dynamically import to avoid esbuild issues with Temporal dependencies
      const { appRouter } = await import('@/server/api/root');
      const caller = appRouter.createCaller(mockContext);

      // Empty workflowId should fail validation
      await expect(
        caller.execution.build({
          workflowId: '',
          input: {},
        })
      ).rejects.toThrow();
    });

    it('should require workflowId', async () => {
      const { appRouter } = await import('@/server/api/root');
      const caller = appRouter.createCaller(mockContext);

      // Missing workflowId should fail
      await expect(
        caller.execution.build({
          workflowId: undefined as any,
          input: {},
        })
      ).rejects.toThrow();
    });
  });
});
