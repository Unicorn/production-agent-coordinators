import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateTaskStatus } from './updateTaskStatus';

vi.mock('../cli', () => ({
  runBrainGridCommand: vi.fn()
}));

import { runBrainGridCommand } from '../cli';

describe('updateTaskStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update task status', async () => {
    vi.mocked(runBrainGridCommand).mockResolvedValue(null);

    await updateTaskStatus('task-123', {
      status: 'IN_PROGRESS'
    });

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'update',
      'task-123',
      '--status',
      'IN_PROGRESS'
    ]);
  });

  it('should update task with assigned user', async () => {
    vi.mocked(runBrainGridCommand).mockResolvedValue(null);

    await updateTaskStatus('task-123', {
      status: 'IN_PROGRESS',
      assignedTo: 'user-456'
    });

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'update',
      'task-123',
      '--status',
      'IN_PROGRESS',
      '--assigned-to',
      'user-456'
    ]);
  });

  it('should update task with metadata', async () => {
    vi.mocked(runBrainGridCommand).mockResolvedValue(null);

    const metadata = {
      progress: 50,
      notes: 'Half done'
    };

    await updateTaskStatus('task-123', {
      status: 'IN_PROGRESS',
      metadata
    });

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'update',
      'task-123',
      '--status',
      'IN_PROGRESS',
      '--metadata',
      JSON.stringify(metadata)
    ]);
  });

  it('should update without status (metadata only)', async () => {
    vi.mocked(runBrainGridCommand).mockResolvedValue(null);

    await updateTaskStatus('task-123', {
      assignedTo: 'user-456'
    });

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'task',
      'update',
      'task-123',
      '--assigned-to',
      'user-456'
    ]);
  });
});
