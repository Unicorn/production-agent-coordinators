import { describe, it, expect } from 'vitest';
import {
  BrainGridProjectSchema,
  BrainGridRequirementSchema,
  BrainGridTaskSchema,
  RequirementStatus,
  TaskStatus,
  BrainGridCliError
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
      const statuses: RequirementStatus[] = ['IDEA', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PAUSED'];

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

    it('should reject invalid requirement status', () => {
      const invalidReq = {
        id: 'req-456',
        projectId: 'proj-123',
        title: 'Test',
        status: 'INVALID_STATUS'
      };

      const result = BrainGridRequirementSchema.safeParse(invalidReq);
      expect(result.success).toBe(false);
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

    it('should reject invalid task status', () => {
      const invalidTask = {
        id: 'task-789',
        reqId: 'req-456',
        title: 'Build login UI',
        status: 'INVALID_STATUS'
      };

      const result = BrainGridTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });
  });

  describe('BrainGridCliError', () => {
    it('should create error with all properties', () => {
      const error = new BrainGridCliError(
        'Command failed',
        'braingrid test-command',
        1,
        'Error output from stderr'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('BrainGridCliError');
      expect(error.message).toBe('Command failed');
      expect(error.command).toBe('braingrid test-command');
      expect(error.exitCode).toBe(1);
      expect(error.stderr).toBe('Error output from stderr');
    });

    it('should preserve error properties when thrown', () => {
      try {
        throw new BrainGridCliError(
          'Test error',
          'braingrid fail',
          2,
          'stderr content'
        );
      } catch (err) {
        expect(err).toBeInstanceOf(BrainGridCliError);
        if (err instanceof BrainGridCliError) {
          expect(err.message).toBe('Test error');
          expect(err.command).toBe('braingrid fail');
          expect(err.exitCode).toBe(2);
          expect(err.stderr).toBe('stderr content');
        }
      }
    });

    it('should handle empty stderr', () => {
      const error = new BrainGridCliError(
        'Command failed',
        'braingrid cmd',
        1,
        ''
      );

      expect(error.stderr).toBe('');
      expect(error.exitCode).toBe(1);
    });

    it('should handle different exit codes', () => {
      const exitCodes = [0, 1, 2, 127, 255];

      exitCodes.forEach(code => {
        const error = new BrainGridCliError(
          'Test',
          'cmd',
          code,
          'stderr'
        );
        expect(error.exitCode).toBe(code);
      });
    });
  });
});
