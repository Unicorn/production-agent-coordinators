import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listProjects } from './listProjects';

vi.mock('../cli', () => ({
  runBrainGridCommand: vi.fn()
}));

import { runBrainGridCommand } from '../cli';

describe('listProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list all projects', async () => {
    const mockProjects = [
      {
        id: 'proj-1',
        name: 'Project 1',
        description: 'First project'
      },
      {
        id: 'proj-2',
        name: 'Project 2',
        description: 'Second project'
      }
    ];

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockProjects);

    const result = await listProjects();

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'projects',
      'list',
      '--format',
      'json'
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('proj-1');
    expect(result[1].id).toBe('proj-2');
  });

  it('should return empty array when no projects', async () => {
    vi.mocked(runBrainGridCommand).mockResolvedValue([]);

    const result = await listProjects();

    expect(result).toEqual([]);
  });

  it('should validate response schema', async () => {
    const invalidProjects = [
      {
        id: 123, // Should be string
        name: 'Test'
      }
    ];

    vi.mocked(runBrainGridCommand).mockResolvedValue(invalidProjects);

    await expect(listProjects()).rejects.toThrow();
  });
});
