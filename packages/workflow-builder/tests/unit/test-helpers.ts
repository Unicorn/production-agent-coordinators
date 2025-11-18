/**
 * Test Helpers
 * 
 * Utilities for testing tRPC routers
 */

import type { TRPCContext } from '../../src/server/api/trpc';

export function createMockContext(overrides?: Partial<TRPCContext>): TRPCContext {
  return {
    supabase: {
      from: vi.fn(),
    } as any,
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
    getUserRecord: vi.fn().mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
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

