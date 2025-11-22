import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePlanFileWithAgent } from '../agentic-plan-parser.activities';
import * as fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';

vi.mock('fs/promises');
vi.mock('@anthropic-ai/sdk');

describe('Agentic Plan Parser Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('should parse plan with AI successfully', async () => {
    const mockPlan = `# @bernierllc/test-suite\n\n## Dependencies\n- @bernierllc/core-types\n- @bernierllc/validator-base`;

    vi.mocked(fs.readFile).mockResolvedValue(mockPlan);

    const mockMessage = {
      content: [{ type: 'text', text: JSON.stringify({
        packageName: '@bernierllc/test-suite',
        dependencies: [
          { name: '@bernierllc/core-types', category: 'core' },
          { name: '@bernierllc/validator-base', category: 'validator' }
        ]
      })}],
      usage: { input_tokens: 100, output_tokens: 50 }
    };

    const mockClient = {
      messages: { create: vi.fn().mockResolvedValue(mockMessage) }
    };
    vi.mocked(Anthropic).mockReturnValue(mockClient as any);

    const result = await parsePlanFileWithAgent({
      workspaceRoot: '/workspace',
      planPath: 'plans/packages/suite/test-suite.md'
    });

    expect(result).toHaveLength(3);

    // Verify all packages are present
    const packageNames = result.map(p => p.name);
    expect(packageNames).toContain('@bernierllc/validator-base');
    expect(packageNames).toContain('@bernierllc/core-types');
    expect(packageNames).toContain('@bernierllc/test-suite');

    // Verify packages are sorted by layer (ascending)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].layer).toBeGreaterThanOrEqual(result[i - 1].layer);
    }

    // Verify main package uses category from path
    const suite = result.find(p => p.name === '@bernierllc/test-suite');
    expect(suite?.category).toBe('suite');
  });

  it('should unwrap markdown code blocks from AI response', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('# Plan');

    const mockMessage = {
      content: [{ type: 'text', text: '```json\n{"packageName":"@bernierllc/test","dependencies":[]}\n```'}],
      usage: { input_tokens: 10, output_tokens: 10 }
    };

    const mockClient = {
      messages: { create: vi.fn().mockResolvedValue(mockMessage) }
    };
    vi.mocked(Anthropic).mockReturnValue(mockClient as any);

    const result = await parsePlanFileWithAgent({
      workspaceRoot: '/workspace',
      planPath: 'plans/packages/core/test.md'
    });

    expect(result).toBeDefined();
  });

  it('should fall back to regex parser on AI failure', async () => {
    const mockPlan = `# @bernierllc/test-package\n\n## Dependencies\n- \`@bernierllc/dep-1\``;

    vi.mocked(fs.readFile).mockResolvedValue(mockPlan);

    const mockClient = {
      messages: { create: vi.fn().mockRejectedValue(new Error('API error')) }
    };
    vi.mocked(Anthropic).mockReturnValue(mockClient as any);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await parsePlanFileWithAgent({
      workspaceRoot: '/workspace',
      planPath: 'plans/packages/core/test-package.md'
    });

    expect(consoleSpy).toHaveBeenCalledWith('[AgenticParser] Falling back to regex parser');
    expect(result).toBeDefined();
    consoleSpy.mockRestore();
  });

  it('should extract category from plan path correctly', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('# Plan');

    const mockMessage = {
      content: [{ type: 'text', text: JSON.stringify({
        packageName: '@bernierllc/api-adapter',
        dependencies: []
      })}],
      usage: { input_tokens: 10, output_tokens: 10 }
    };

    const mockClient = {
      messages: { create: vi.fn().mockResolvedValue(mockMessage) }
    };
    vi.mocked(Anthropic).mockReturnValue(mockClient as any);

    const result = await parsePlanFileWithAgent({
      workspaceRoot: '/workspace',
      planPath: 'plans/packages/service/api-adapter.md'
    });

    expect(result[0].category).toBe('service');
  });

  it('should sort packages by layer', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('# Plan');

    const mockMessage = {
      content: [{ type: 'text', text: JSON.stringify({
        packageName: '@bernierllc/suite',
        dependencies: [
          { name: '@bernierllc/validator', category: 'validator' },
          { name: '@bernierllc/core', category: 'core' },
          { name: '@bernierllc/service', category: 'service' }
        ]
      })}],
      usage: { input_tokens: 10, output_tokens: 10 }
    };

    const mockClient = {
      messages: { create: vi.fn().mockResolvedValue(mockMessage) }
    };
    vi.mocked(Anthropic).mockReturnValue(mockClient as any);

    const result = await parsePlanFileWithAgent({
      workspaceRoot: '/workspace',
      planPath: 'plans/packages/suite/suite.md'
    });

    // Verify packages are sorted by layer (ascending order)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].layer).toBeGreaterThanOrEqual(result[i - 1].layer);
    }

    // Verify suite package has highest layer
    const suite = result.find(p => p.name === '@bernierllc/suite');
    expect(suite).toBeDefined();
    expect(suite?.layer).toBe(5);

    // Verify all expected packages are present
    const packageNames = result.map(p => p.name);
    expect(packageNames).toContain('@bernierllc/validator');
    expect(packageNames).toContain('@bernierllc/core');
    expect(packageNames).toContain('@bernierllc/service');
    expect(packageNames).toContain('@bernierllc/suite');
  });
});
