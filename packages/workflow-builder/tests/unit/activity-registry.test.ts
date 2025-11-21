/**
 * Activity Registry Unit Tests
 *
 * Tests for activity registration, discovery, and management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityRegistry } from '@/lib/activities/activity-registry';
import type { Database } from '@/types/database';

type Activity = Database['public']['Tables']['activities']['Row'];

describe('ActivityRegistry', () => {
  let mockSupabase: any;
  let registry: ActivityRegistry;
  let mockActivity: Activity;

  beforeEach(() => {
    vi.clearAllMocks();

    mockActivity = {
      id: 'activity-123',
      name: 'testActivity',
      description: 'Test activity description',
      input_schema: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
      output_schema: { type: 'string' },
      package_name: 'test-package',
      module_path: './test.activities',
      function_name: 'testActivity',
      category: 'Sample',
      tags: ['test', 'demo'],
      examples: { basic: { input: { message: 'test' }, output: 'result' } },
      usage_count: 0,
      last_used_at: null,
      is_active: true,
      deprecated: false,
      deprecated_message: null,
      deprecated_since: null,
      migrate_to_activity_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'user-123',
    };

    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    registry = new ActivityRegistry(mockSupabase);
  });

  describe('registerActivity', () => {
    it('should create a new activity when it does not exist', async () => {
      const selectQuery: any = {
        select: vi.fn(() => selectQuery),
        eq: vi.fn(() => selectQuery),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // Not found
        }),
      };

      const insertQuery: any = {
        insert: vi.fn(() => insertQuery),
        select: vi.fn(() => insertQuery),
        single: vi.fn().mockResolvedValue({
          data: mockActivity,
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(selectQuery) // First call for checking existence
        .mockReturnValueOnce(insertQuery); // Second call for insertion

      const result = await registry.registerActivity({
        name: 'testActivity',
        description: 'Test activity description',
        inputSchema: mockActivity.input_schema,
        outputSchema: mockActivity.output_schema,
        packageName: 'test-package',
        modulePath: './test.activities',
        functionName: 'testActivity',
        category: 'Sample',
        tags: ['test', 'demo'],
        examples: mockActivity.examples,
        createdBy: 'user-123',
      });

      expect(result).toEqual(mockActivity);
      expect(mockSupabase.from).toHaveBeenCalledWith('activities');
      expect(insertQuery.insert).toHaveBeenCalled();
    });

    it('should update existing activity', async () => {
      const selectQuery: any = {
        select: vi.fn(() => selectQuery),
        eq: vi.fn(() => selectQuery),
        single: vi.fn().mockResolvedValue({
          data: { id: 'activity-123' },
          error: null,
        }),
      };

      const updateQuery: any = {
        update: vi.fn(() => updateQuery),
        eq: vi.fn(() => updateQuery),
        select: vi.fn(() => updateQuery),
        single: vi.fn().mockResolvedValue({
          data: mockActivity,
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(selectQuery) // Check existence
        .mockReturnValueOnce(updateQuery); // Update

      const result = await registry.registerActivity({
        name: 'testActivity',
        description: 'Updated description',
        inputSchema: mockActivity.input_schema,
        packageName: 'test-package',
        modulePath: './test.activities',
        functionName: 'testActivity',
        createdBy: 'user-123',
      });

      expect(result).toEqual(mockActivity);
      expect(updateQuery.update).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      const selectQuery: any = {
        select: vi.fn(() => selectQuery),
        eq: vi.fn(() => selectQuery),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      const insertQuery: any = {
        insert: vi.fn(() => insertQuery),
        select: vi.fn(() => insertQuery),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'Duplicate key' },
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(selectQuery)
        .mockReturnValueOnce(insertQuery);

      await expect(
        registry.registerActivity({
          name: 'testActivity',
          inputSchema: {},
          packageName: 'test',
          modulePath: './test',
          functionName: 'test',
          createdBy: 'user-123',
        })
      ).rejects.toEqual({ code: '23505', message: 'Duplicate key' });
    });
  });

  describe('listActivities', () => {
    it('should list all active, non-deprecated activities by default', async () => {
      const query: any = {
        from: vi.fn(() => query),
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
      };

      // Mock the final order call to resolve with data
      let orderCallCount = 0;
      query.order.mockImplementation(() => {
        orderCallCount++;
        if (orderCallCount === 2) {
          return Promise.resolve({
            data: [mockActivity],
            error: null,
          });
        }
        return query;
      });

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.listActivities();

      expect(result).toEqual([mockActivity]);
      expect(query.eq).toHaveBeenCalledWith('is_active', true);
      expect(query.eq).toHaveBeenCalledWith('deprecated', false);
      expect(query.order).toHaveBeenCalledWith('usage_count', { ascending: false });
    });

    it('should filter by category', async () => {
      const query: any = {
        from: vi.fn(() => query),
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
      };

      let orderCallCount = 0;
      query.order.mockImplementation(() => {
        orderCallCount++;
        if (orderCallCount === 2) {
          return Promise.resolve({
            data: [mockActivity],
            error: null,
          });
        }
        return query;
      });

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.listActivities({ category: 'HTTP' });

      expect(query.eq).toHaveBeenCalledWith('category', 'HTTP');
      expect(result).toEqual([mockActivity]);
    });

    it('should filter by tags', async () => {
      const query: any = {
        from: vi.fn(() => query),
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        overlaps: vi.fn(() => query),
        order: vi.fn(() => query),
      };

      let orderCallCount = 0;
      query.order.mockImplementation(() => {
        orderCallCount++;
        if (orderCallCount === 2) {
          return Promise.resolve({
            data: [mockActivity],
            error: null,
          });
        }
        return query;
      });

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.listActivities({ tags: ['test', 'demo'] });

      expect(query.overlaps).toHaveBeenCalledWith('tags', ['test', 'demo']);
      expect(result).toEqual([mockActivity]);
    });

    it('should search by name and description', async () => {
      const query: any = {
        from: vi.fn(() => query),
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        or: vi.fn(() => query),
        order: vi.fn(() => query),
      };

      let orderCallCount = 0;
      query.order.mockImplementation(() => {
        orderCallCount++;
        if (orderCallCount === 2) {
          return Promise.resolve({
            data: [mockActivity],
            error: null,
          });
        }
        return query;
      });

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.listActivities({ search: 'test' });

      expect(query.or).toHaveBeenCalled();
      expect(result).toEqual([mockActivity]);
    });

    it('should include deprecated when requested', async () => {
      const query: any = {
        from: vi.fn(() => query),
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
      };

      let orderCallCount = 0;
      query.order.mockImplementation(() => {
        orderCallCount++;
        if (orderCallCount === 2) {
          return Promise.resolve({
            data: [mockActivity],
            error: null,
          });
        }
        return query;
      });

      mockSupabase.from.mockReturnValue(query);

      await registry.listActivities({ includeDeprecated: true });

      // Should only have one eq call for is_active, not for deprecated
      const eqCalls = query.eq.mock.calls;
      const deprecatedCall = eqCalls.find((call: any) => call[0] === 'deprecated');
      expect(deprecatedCall).toBeUndefined();
    });
  });

  describe('getActivity', () => {
    it('should return activity by name', async () => {
      const query: any = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn().mockResolvedValue({
          data: mockActivity,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.getActivity('testActivity');

      expect(result).toEqual(mockActivity);
      expect(query.eq).toHaveBeenCalledWith('name', 'testActivity');
    });

    it('should return null when activity not found', async () => {
      const query: any = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // Not found
        }),
      };

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.getActivity('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const query: any = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'OTHER_ERROR', message: 'Database error' },
        }),
      };

      mockSupabase.from.mockReturnValue(query);

      await expect(registry.getActivity('testActivity')).rejects.toEqual({
        code: 'OTHER_ERROR',
        message: 'Database error',
      });
    });
  });

  describe('getActivityById', () => {
    it('should return activity by ID', async () => {
      const query: any = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn().mockResolvedValue({
          data: mockActivity,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.getActivityById('activity-123');

      expect(result).toEqual(mockActivity);
      expect(query.eq).toHaveBeenCalledWith('id', 'activity-123');
    });
  });

  describe('trackUsage', () => {
    it('should increment usage count using RPC', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await registry.trackUsage('testActivity');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_activity_usage', {
        activity_name: 'testActivity',
      });
    });

    it('should fall back to manual update if RPC does not exist', async () => {
      mockSupabase.rpc.mockResolvedValue({
        error: { code: '42883' }, // Function does not exist
      });

      const selectQuery: any = {
        select: vi.fn(() => selectQuery),
        eq: vi.fn(() => selectQuery),
        single: vi.fn().mockResolvedValue({
          data: mockActivity,
          error: null,
        }),
      };

      const updateQuery: any = {
        update: vi.fn(() => updateQuery),
        eq: vi.fn(() => updateQuery),
      };

      updateQuery.eq.mockResolvedValue({ error: null });

      mockSupabase.from
        .mockReturnValueOnce(selectQuery)
        .mockReturnValueOnce(updateQuery);

      await registry.trackUsage('testActivity');

      expect(updateQuery.update).toHaveBeenCalled();
    });
  });

  describe('getCategories', () => {
    it('should return list of category names', async () => {
      const query: any = {
        select: vi.fn(() => query),
        order: vi.fn(() => query),
      };

      query.order.mockResolvedValue({
        data: [
          { name: 'HTTP' },
          { name: 'Database' },
          { name: 'Build' },
        ],
        error: null,
      });

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.getCategories();

      expect(result).toEqual(['HTTP', 'Database', 'Build']);
      expect(mockSupabase.from).toHaveBeenCalledWith('activity_categories');
    });
  });

  describe('deprecateActivity', () => {
    it('should mark activity as deprecated', async () => {
      const query: any = {
        update: vi.fn(() => query),
        eq: vi.fn(() => query),
        select: vi.fn(() => query),
        single: vi.fn().mockResolvedValue({
          data: { ...mockActivity, deprecated: true },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.deprecateActivity(
        'activity-123',
        'Use newActivity instead',
        'new-activity-id'
      );

      expect(result.deprecated).toBe(true);
      expect(query.update).toHaveBeenCalledWith({
        deprecated: true,
        deprecated_message: 'Use newActivity instead',
        migrate_to_activity_id: 'new-activity-id',
      });
    });
  });

  describe('deactivateActivity', () => {
    it('should mark activity as inactive', async () => {
      const query: any = {
        update: vi.fn(() => query),
        eq: vi.fn(() => query),
        select: vi.fn(() => query),
        single: vi.fn().mockResolvedValue({
          data: { ...mockActivity, is_active: false },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.deactivateActivity('activity-123');

      expect(result.is_active).toBe(false);
      expect(query.update).toHaveBeenCalledWith({ is_active: false });
    });
  });

  describe('getUsageStats', () => {
    it('should return top 10 activities by usage', async () => {
      const query: any = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
      };

      const stats = [
        {
          name: 'httpRequest',
          usage_count: 100,
          last_used_at: '2024-01-01T00:00:00Z',
          category: 'HTTP',
        },
        {
          name: 'buildPackage',
          usage_count: 50,
          last_used_at: '2024-01-01T00:00:00Z',
          category: 'Build',
        },
      ];

      query.limit.mockResolvedValue({
        data: stats,
        error: null,
      });

      mockSupabase.from.mockReturnValue(query);

      const result = await registry.getUsageStats();

      expect(result).toEqual(stats);
      expect(query.limit).toHaveBeenCalledWith(10);
      expect(query.order).toHaveBeenCalledWith('usage_count', { ascending: false });
    });
  });

  describe('discoverActivities', () => {
    it('should register known sample activities', async () => {
      let callCount = 0;

      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const isEven = callCount % 2 === 0;

        if (isEven) {
          // Insert query
          const insertQuery: any = {
            insert: vi.fn(() => insertQuery),
            select: vi.fn(() => insertQuery),
            single: vi.fn().mockResolvedValue({
              data: { ...mockActivity, id: `activity-${callCount}` },
              error: null,
            }),
          };
          return insertQuery;
        } else {
          // Select query
          const selectQuery: any = {
            select: vi.fn(() => selectQuery),
            eq: vi.fn(() => selectQuery),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          };
          return selectQuery;
        }
      });

      const result = await registry.discoverActivities(
        'workflow-worker-service',
        'user-123'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('input_schema');
    });
  });
});
