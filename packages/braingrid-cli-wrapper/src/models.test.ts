import { describe, it, expect } from 'vitest';
import {
  BrainGridProjectSchema,
  BrainGridRequirementSchema,
  BrainGridTaskSchema,
  RequirementStatus,
  TaskStatus
} from './models';

describe('BrainGrid Schemas', () => {
  describe('BrainGridProjectSchema', () => {
    it('should validate a valid project', () => {
      const validProject = {
        id: 'proj-123',
        name: 'Test Project',
        description: 'A test project'
      };

      const result = BrainGridProjectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('proj-123');
        expect(result.data.name).toBe('Test Project');
      }
    });

    it('should reject invalid project', () => {
      const invalidProject = {
        id: 123, // Should be string
        name: 'Test'
      };

      const result = BrainGridProjectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });
  });

  describe('BrainGridRequirementSchema', () => {
    it('should validate a valid requirement', () => {
      const validReq = {
        id: 'req-456',
        projectId: 'proj-123',
        title: 'Add authentication',
        status: 'IDEA' as RequirementStatus,
        description: 'Add OAuth2 auth'
      };

      const result = BrainGridRequirementSchema.safeParse(validReq);
      expect(result.success).toBe(true);
    });

    it('should accept all valid statuses', () => {
      const statuses: RequirementStatus[] = ['IDEA', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

      statuses.forEach(status => {
        const req = {
          id: 'req-456',
          projectId: 'proj-123',
          title: 'Test',
          status
        };
        const result = BrainGridRequirementSchema.safeParse(req);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('BrainGridTaskSchema', () => {
    it('should validate a valid task', () => {
      const validTask = {
        id: 'task-789',
        reqId: 'req-456',
        title: 'Build login UI',
        status: 'TODO' as TaskStatus,
        tags: ['DEV', 'frontend'],
        dependencies: ['task-123', 'task-456']
      };

      const result = BrainGridTaskSchema.safeParse(validTask);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toHaveLength(2);
        expect(result.data.dependencies).toHaveLength(2);
      }
    });

    it('should allow optional fields to be undefined', () => {
      const minimalTask = {
        id: 'task-789',
        reqId: 'req-456',
        title: 'Build login UI',
        status: 'TODO' as TaskStatus
      };

      const result = BrainGridTaskSchema.safeParse(minimalTask);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toBeUndefined();
        expect(result.data.dependencies).toBeUndefined();
      }
    });
  });
});
