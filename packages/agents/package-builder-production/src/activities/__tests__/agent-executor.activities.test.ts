import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeRealAgent } from '../agent-executor.activities';
import * as promptBuilder from '../prompt-builder.activities';
import * as agentExecution from '../agent-execution.activities';
import * as responseParser from '../response-parser.activities';
import * as fileOperations from '../file-operations.activities';

vi.mock('../prompt-builder.activities');
vi.mock('../agent-execution.activities');
vi.mock('../response-parser.activities');
vi.mock('../file-operations.activities');

describe('Agent Executor Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute full pipeline successfully', async () => {
    vi.mocked(promptBuilder.buildAgentPrompt).mockResolvedValue('Built prompt');
    vi.mocked(agentExecution.executeAgentWithClaude).mockResolvedValue('{"files":[],"summary":"Done"}');
    vi.mocked(responseParser.parseAgentResponse).mockResolvedValue({ files: [], summary: 'Done' });
    vi.mocked(fileOperations.applyFileChanges).mockResolvedValue({ modifiedFiles: [], failedOperations: [] });

    const result = await executeRealAgent({
      task: { type: 'PACKAGE_SCAFFOLDING', instructions: 'Build package' },
      context: { packagePath: 'packages/core/test', workspaceRoot: '/workspace' }
    });

    expect(result.success).toBe(true);
    expect(promptBuilder.buildAgentPrompt).toHaveBeenCalled();
    expect(agentExecution.executeAgentWithClaude).toHaveBeenCalled();
    expect(responseParser.parseAgentResponse).toHaveBeenCalled();
    expect(fileOperations.applyFileChanges).toHaveBeenCalled();
  });

  it('should handle prompt building failure', async () => {
    vi.mocked(promptBuilder.buildAgentPrompt).mockRejectedValue(new Error('Plan not found'));

    const result = await executeRealAgent({
      task: { type: 'BUG_FIX', instructions: 'Fix bug' },
      context: { packagePath: 'packages/core/test', workspaceRoot: '/workspace' }
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain('Plan not found');
  });

  it('should use correct temperature for scaffolding', async () => {
    vi.mocked(promptBuilder.buildAgentPrompt).mockResolvedValue('Prompt');
    vi.mocked(agentExecution.executeAgentWithClaude).mockResolvedValue('{"files":[],"summary":"Done"}');
    vi.mocked(responseParser.parseAgentResponse).mockResolvedValue({ files: [], summary: 'Done' });
    vi.mocked(fileOperations.applyFileChanges).mockResolvedValue({ modifiedFiles: [], failedOperations: [] });

    await executeRealAgent({
      task: { type: 'PACKAGE_SCAFFOLDING', instructions: 'Scaffold' },
      context: { packagePath: 'packages/core/test', workspaceRoot: '/workspace' }
    });

    expect(agentExecution.executeAgentWithClaude).toHaveBeenCalledWith({
      prompt: 'Prompt',
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.2,
      maxTokens: 16000
    });
  });

  it('should map task types correctly', async () => {
    vi.mocked(promptBuilder.buildAgentPrompt).mockResolvedValue('Prompt');
    vi.mocked(agentExecution.executeAgentWithClaude).mockResolvedValue('{"files":[],"summary":"Done"}');
    vi.mocked(responseParser.parseAgentResponse).mockResolvedValue({ files: [], summary: 'Done' });
    vi.mocked(fileOperations.applyFileChanges).mockResolvedValue({ modifiedFiles: [], failedOperations: [] });

    await executeRealAgent({
      task: { type: 'BUILD_FAILURE', instructions: 'Fix build' },
      context: { packagePath: 'packages/core/test', workspaceRoot: '/workspace' }
    });

    expect(promptBuilder.buildAgentPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ taskType: 'BUG_FIX' })
    );
  });
});
