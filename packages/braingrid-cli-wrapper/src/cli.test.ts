import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBrainGridCommand } from './cli';
import { BrainGridCliError } from './models';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn()
}));

import { execa } from 'execa';

describe('CLI Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run command successfully', async () => {
    const mockOutput = { id: 'proj-123', name: 'Test' };
    vi.mocked(execa).mockResolvedValue({
      stdout: JSON.stringify(mockOutput),
      stderr: '',
      exitCode: 0
    } as any);

    const result = await runBrainGridCommand(['projects', 'list', '--format', 'json']);

    expect(result).toEqual(mockOutput);
    expect(execa).toHaveBeenCalledWith(
      'braingrid',
      ['projects', 'list', '--format', 'json'],
      expect.any(Object)
    );
  });

  it('should handle command with no JSON output', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: 'Success',
      stderr: '',
      exitCode: 0
    } as any);

    const result = await runBrainGridCommand(['task', 'update', 'task-123']);

    expect(result).toBeNull();
  });

  it('should throw BrainGridCliError on failure', async () => {
    vi.mocked(execa).mockRejectedValue({
      exitCode: 1,
      stderr: 'Invalid command',
      stdout: ''
    });

    await expect(
      runBrainGridCommand(['invalid'])
    ).rejects.toThrow(BrainGridCliError);
  });

  it('should use custom CLI path from env', async () => {
    const originalEnv = process.env.BRAINGRID_CLI_PATH;
    process.env.BRAINGRID_CLI_PATH = '/custom/path/braingrid';

    vi.mocked(execa).mockResolvedValue({
      stdout: '{}',
      stderr: '',
      exitCode: 0
    } as any);

    await runBrainGridCommand(['projects', 'list']);

    expect(execa).toHaveBeenCalledWith(
      '/custom/path/braingrid',
      expect.any(Array),
      expect.any(Object)
    );

    process.env.BRAINGRID_CLI_PATH = originalEnv;
  });
});
