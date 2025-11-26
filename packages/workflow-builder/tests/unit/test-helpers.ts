/**
 * Test Helpers
 * 
 * Utilities for testing tRPC routers
 */

import { vi } from 'vitest';
import type { TRPCContext } from '../../src/server/api/trpc';

export function createMockContext(overrides?: Partial<TRPCContext>): TRPCContext {
  return {
    supabase: {
      from: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'auth-user-123',
              email: 'test@example.com',
            },
          },
          error: null,
        }),
      },
    } as any,
    user: null, // Will be set by protectedProcedure
    authUser: {
      id: 'auth-user-123',
      email: 'test@example.com',
    } as any,
    getUserRecord: vi.fn().mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      auth_user_id: 'auth-user-123',
    }),
    ...overrides,
  };
}

export function createMockSupabaseQuery() {
  const query = {
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    single: vi.fn(),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
  };
  return query;
}

