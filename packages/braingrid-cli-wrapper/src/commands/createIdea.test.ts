import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIdea } from './createIdea';

vi.mock('../cli', () => ({
  runBrainGridCommand: vi.fn()
}));

import { runBrainGridCommand } from '../cli';

describe('createIdea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create idea with prompt only', async () => {
    const mockReq = {
      id: 'req-123',
      projectId: 'proj-456',
      title: 'Add OAuth2',
      status: 'IDEA'
    };

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockReq);

    await createIdea('Add OAuth2 authentication');

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'specify',
      'Add OAuth2 authentication',
      '--format',
      'json'
    ]);

    expect(result.id).toBe('req-123');
    expect(result.status).toBe('IDEA');
  });

  it('should create idea with project ID', async () => {
    const mockReq = {
      id: 'req-123',
      projectId: 'proj-456',
      title: 'Add OAuth2',
      status: 'IDEA'
    };

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockReq);

    await createIdea('Add OAuth2 authentication', 'proj-456');

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'specify',
      'Add OAuth2 authentication',
      '--project',
      'proj-456',
      '--format',
      'json'
    ]);
  });

  it('should validate response schema', async () => {
    const invalidReq = {
      id: 123, // Should be string
      title: 'Test'
    };

    vi.mocked(runBrainGridCommand).mockResolvedValue(invalidReq);

    await expect(createIdea('Test')).rejects.toThrow();
  });
});
