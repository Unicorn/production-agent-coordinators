import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTask } from './createTask';

vi.mock('../cli', () => ({
  runBrainGridCommand: vi.fn()
}));

import { runBrainGridCommand } from '../cli';

describe('createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create task with title only', async () => {
    const mockTask = {
      id: 'task-123',
      reqId: 'req-456',
      title: 'Build login UI',
      status: 'TODO'
    };

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockTask);

    const result = await createTask('req-456', {
      title: 'Build login UI'
    });

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'create',
      'req-456',
      '--title',
      'Build login UI',
      '--format',
      'json'
    ]);

    expect(result.id).toBe('task-123');
    expect(result.title).toBe('Build login UI');
  });

  it('should create task with all options', async () => {
    const mockTask = {
      id: 'task-123',
      reqId: 'req-456',
      title: 'Build login UI',
      status: 'TODO',
      description: 'Create login form',
      tags: ['DEV', 'frontend'],
      dependencies: ['task-100', 'task-200']
    };

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockTask);

    const result = await createTask('req-456', {
      title: 'Build login UI',
      description: 'Create login form',
      tags: ['DEV', 'frontend'],
      dependencies: ['task-100', 'task-200']
    });

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'create',
      'req-456',
      '--title',
      'Build login UI',
      '--description',
      'Create login form',
      '--tags',
      'DEV,frontend',
      '--dependencies',
      'task-100,task-200',
      '--format',
      'json'
    ]);

    expect(result.tags).toEqual(['DEV', 'frontend']);
    expect(result.dependencies).toEqual(['task-100', 'task-200']);
  });

  it('should validate response schema', async () => {
    const invalidTask = {
      id: 123, // Should be string
      title: 'Test'
    };

    vi.mocked(runBrainGridCommand).mockResolvedValue(invalidTask);

    await expect(createTask('req-456', { title: 'Test' })).rejects.toThrow();
  });
});
