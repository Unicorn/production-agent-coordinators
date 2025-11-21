import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listTasks } from './listTasks';

vi.mock('../cli', () => ({
  runBrainGridCommand: vi.fn()
}));

import { runBrainGridCommand } from '../cli';

describe('listTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list all tasks with no filters', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        reqId: 'req-123',
        title: 'Task 1',
        status: 'TODO'
      },
      {
        id: 'task-2',
        reqId: 'req-123',
        title: 'Task 2',
        status: 'IN_PROGRESS'
      }
    ];

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockTasks);

    const result = await listTasks();

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'list',
      '--format',
      'json'
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('task-1');
  });

  it('should filter tasks by requirement ID', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        reqId: 'req-123',
        title: 'Task 1',
        status: 'TODO'
      }
    ];

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockTasks);

    const result = await listTasks({ reqId: 'req-123' });

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'list',
      '--req',
      'req-123',
      '--format',
      'json'
    ]);
  });

  it('should filter tasks by status', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        reqId: 'req-123',
        title: 'Task 1',
        status: 'TODO'
      }
    ];

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockTasks);

    const result = await listTasks({
      status: ['TODO', 'READY']
    });

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'list',
      '--status',
      'TODO,READY',
      '--format',
      'json'
    ]);
  });

  it('should filter tasks by tags', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        reqId: 'req-123',
        title: 'Task 1',
        status: 'TODO',
        tags: ['DEV', 'frontend']
      }
    ];

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockTasks);

    const result = await listTasks({
      tags: ['DEV', 'frontend']
    });

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'list',
      '--tags',
      'DEV,frontend',
      '--format',
      'json'
    ]);
  });

  it('should combine all filters', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        reqId: 'req-123',
        title: 'Task 1',
        status: 'TODO',
        tags: ['DEV']
      }
    ];

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockTasks);

    const result = await listTasks({
      reqId: 'req-123',
      status: ['TODO'],
      tags: ['DEV']
    });

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'list',
      '--req',
      'req-123',
      '--status',
      'TODO',
      '--tags',
      'DEV',
      '--format',
      'json'
    ]);
  });

  it('should return empty array when no tasks', async () => {
    vi.mocked(runBrainGridCommand).mockResolvedValue([]);

    const result = await listTasks();

    expect(result).toEqual([]);
  });

  it('should validate response schema', async () => {
    const invalidTasks = [
      {
        id: 123, // Should be string
        title: 'Test'
      }
    ];

    vi.mocked(runBrainGridCommand).mockResolvedValue(invalidTasks);

    await expect(listTasks()).rejects.toThrow();
  });
});
