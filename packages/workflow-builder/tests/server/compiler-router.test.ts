/**
 * Compiler Router Tests
 * Tests for tRPC compiler routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext } from '../unit/test-helpers';
import { appRouter } from '@/server/api/root';
import { simpleWorkflow } from '../integration/compiler-execution/fixtures';

describe('Compiler Router', () => {
  const mockContext = createMockContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('compiler.compile', () => {
    it('should validate workflowId input', async () => {
      const caller = appRouter.createCaller(mockContext);

      // Missing workflowId should fail validation
      await expect(
        caller.compiler.compile({
          workflowId: '',
        })
      ).rejects.toThrow();
    });

    it('should return compilation errors for invalid workflow', async () => {
      // Mock Supabase to return a workflow with invalid definition
      const invalidContext = createMockContext({
        supabase: {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'workflow-1',
                      name: 'Invalid Workflow',
                      definition: {
                        nodes: [], // Invalid - no trigger node
                        edges: [],
                      },
                      created_by: 'user-123',
                    },
                    error: null,
                  }),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        } as any,
      });

      const caller = appRouter.createCaller(invalidContext);

      const result = await caller.compiler.compile({
        workflowId: 'workflow-1',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should compile valid workflow successfully', async () => {
      // Mock Supabase to return a valid workflow
      const validContext = createMockContext({
        supabase: {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'workflow-1',
                      name: 'Test Workflow',
                      definition: simpleWorkflow,
                      created_by: 'user-123',
                      version: '1.0.0',
                    },
                    error: null,
                  }),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        } as any,
      });

      const caller = appRouter.createCaller(validContext);

      const result = await caller.compiler.compile({
        workflowId: 'workflow-1',
      });

      expect(result.success).toBe(true);
      expect(result.workflowCode).toBeDefined();
      expect(result.activitiesCode).toBeDefined();
      expect(result.workflowCode).toContain('export async function');
    });

    it('should enforce authorization (user must own workflow)', async () => {
      // Mock Supabase to return workflow owned by different user
      const unauthorizedContext = createMockContext({
        supabase: {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Not found' },
                  }),
                })),
              })),
            })),
          })),
        } as any,
      });

      const caller = appRouter.createCaller(unauthorizedContext);

      await expect(
        caller.compiler.compile({
          workflowId: 'workflow-1',
        })
      ).rejects.toThrow(/not found|not authorized/i);
    });
  });
});

