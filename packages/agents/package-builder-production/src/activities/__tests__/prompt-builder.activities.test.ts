import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAgentPrompt, estimateTokenCount, validatePrompt } from '../prompt-builder.activities';
import * as fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('Prompt Builder Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildAgentPrompt', () => {
    it('should build basic prompt with plan and instructions', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('# Package Plan\n\nBuild this package.');

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'PACKAGE_SCAFFOLDING',
        instructions: 'Create the package structure',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace'
      });

      expect(prompt).toContain('test-agent');
      expect(prompt).toContain('PACKAGE_SCAFFOLDING');
      expect(prompt).toContain('Create the package structure');
      expect(prompt).toContain('# Package Plan');
      expect(prompt).toContain('Build this package.');
      expect(fs.readFile).toHaveBeenCalledWith('/workspace/plans/packages/core/test.md', 'utf-8');
    });

    it('should fallback to completed/ directory when plan not found', async () => {
      vi.mocked(fs.readFile)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce('# Completed Plan');

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'BUG_FIX',
        instructions: 'Fix bugs',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace'
      });

      expect(prompt).toContain('# Completed Plan');
      expect(fs.readFile).toHaveBeenCalledWith('/workspace/plans/packages/core/test.md', 'utf-8');
      expect(fs.readFile).toHaveBeenCalledWith('/workspace/plans/completed/core/test.md', 'utf-8');
    });

    it('should fallback to packages/completed/ when completed/ not found', async () => {
      vi.mocked(fs.readFile)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce('# Packages Completed Plan');

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'BUG_FIX',
        instructions: 'Fix bugs',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace'
      });

      expect(prompt).toContain('# Packages Completed Plan');
      expect(fs.readFile).toHaveBeenCalledTimes(3);
      expect(fs.readFile).toHaveBeenNthCalledWith(3, '/workspace/plans/packages/completed/core/test.md', 'utf-8');
    });

    it('should throw error when all plan file locations fail', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await expect(
        buildAgentPrompt({
          agentName: 'test-agent',
          taskType: 'BUG_FIX',
          instructions: 'Fix bugs',
          packagePath: 'packages/core/test',
          planPath: 'plans/packages/core/test.md',
          workspaceRoot: '/workspace'
        })
<<<<<<< HEAD
      ).rejects.toThrow('Plan file not found at any of:');
    });

=======
      ).rejects.toThrow('Could not find plan file');
    });

    it('should include quality standards when requested', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('# Plan content')
        .mockResolvedValueOnce('# Quality Standards\n\n- Write tests');

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'FEATURE_IMPLEMENTATION',
        instructions: 'Add feature',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace',
        includeQualityStandards: true
      });

      expect(prompt).toContain('# Quality Standards');
      expect(prompt).toContain('- Write tests');
      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('quality-standards.md'), 'utf-8');
    });

    it('should skip quality standards when file not found', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('# Plan content')
        .mockRejectedValueOnce(new Error('ENOENT'));

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'FEATURE_IMPLEMENTATION',
        instructions: 'Add feature',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace',
        includeQualityStandards: true
      });

      expect(prompt).not.toContain('# Quality Standards');
      expect(prompt).toContain('# Plan content');
    });

    it('should include few-shot examples when requested', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('# Plan content')
        .mockResolvedValueOnce('# Few-Shot Examples\n\nExample 1...');

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'TESTING',
        instructions: 'Write tests',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace',
        includeFewShotExamples: true
      });

      expect(prompt).toContain('# Few-Shot Examples');
      expect(prompt).toContain('Example 1...');
      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('few-shot-examples.md'), 'utf-8');
    });

    it('should skip few-shot examples when file not found', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('# Plan content')
        .mockRejectedValueOnce(new Error('ENOENT'));

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'TESTING',
        instructions: 'Write tests',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace',
        includeFewShotExamples: true
      });

      expect(prompt).not.toContain('# Few-Shot Examples');
    });

    it('should include GitHub context when provided', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('# Plan content');

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'BUG_FIX',
        instructions: 'Fix issue',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace',
        githubContext: {
          issueNumber: 123,
          prNumber: 456,
          branch: 'fix/bug-123'
        }
      });

      expect(prompt).toContain('Issue: #123');
      expect(prompt).toContain('PR: #456');
      expect(prompt).toContain('Branch: fix/bug-123');
    });

    it('should include validation checklist when requested', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('# Plan content');

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'REFACTORING',
        instructions: 'Refactor code',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace',
        includeValidationChecklist: true
      });

      expect(prompt).toContain('qualityChecklist');
      expect(prompt).toContain('hasTests');
      expect(prompt).toContain('hasDocumentation');
    });

    it('should skip validation checklist when not requested', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('# Plan content');

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'DOCUMENTATION',
        instructions: 'Write docs',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace',
        includeValidationChecklist: false
      });

      expect(prompt).not.toContain('qualityChecklist');
    });

    it('should handle all optional sections together', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('# Plan content')
        .mockResolvedValueOnce('# Quality Standards')
        .mockResolvedValueOnce('# Few-Shot Examples');

      const prompt = await buildAgentPrompt({
        agentName: 'test-agent',
        taskType: 'FEATURE_IMPLEMENTATION',
        instructions: 'Add feature',
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        workspaceRoot: '/workspace',
        includeQualityStandards: true,
        includeFewShotExamples: true,
        includeValidationChecklist: true,
        githubContext: {
          issueNumber: 100,
          prNumber: 200,
          branch: 'feature/new'
        }
      });

      expect(prompt).toContain('# Plan content');
      expect(prompt).toContain('# Quality Standards');
      expect(prompt).toContain('# Few-Shot Examples');
      expect(prompt).toContain('Issue: #100');
      expect(prompt).toContain('qualityChecklist');
    });
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
  });

  describe('estimateTokenCount', () => {
    it('should estimate ~4 characters per token', () => {
      const text = 'a'.repeat(4000); // 4000 characters
      const tokens = estimateTokenCount(text);
      expect(tokens).toBeCloseTo(1000, -2); // ~1000 tokens, allow variance
    });

    it('should handle empty string', () => {
      const tokens = estimateTokenCount('');
      expect(tokens).toBe(0);
    });

    it('should handle typical prompt length', () => {
      const text = 'This is a typical prompt with instructions.'.repeat(100);
      const tokens = estimateTokenCount(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length); // Tokens < characters
    });

    it('should round up to nearest integer', () => {
      const text = 'a'.repeat(10); // 10 chars = 2.5 tokens
      const tokens = estimateTokenCount(text);
      expect(Number.isInteger(tokens)).toBe(true);
    });
  });

  describe('validatePrompt', () => {
<<<<<<< HEAD
    it('should validate prompt with all required sections', () => {
      const prompt = `
        Package Plan:
        Build this package.

        Response Format:
        Return JSON with files array.
      `;
=======
    it('should validate prompt with no issues', () => {
      const prompt = 'This is a valid prompt with good length.'.repeat(10);
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
      const result = validatePrompt(prompt);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

<<<<<<< HEAD
    it('should warn when missing Package Plan section', () => {
      const prompt = 'Response Format: Return JSON';
      const result = validatePrompt(prompt);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt missing package plan section');
    });

    it('should warn when missing Response Format section', () => {
      const prompt = 'Package Plan: Build this';
      const result = validatePrompt(prompt);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt missing response format instructions');
    });

    it('should warn when missing both required sections', () => {
      const prompt = 'Just some random text';
      const result = validatePrompt(prompt);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt missing package plan section');
      expect(result.warnings).toContain('Prompt missing response format instructions');
      expect(result.warnings).toHaveLength(2);
    });

    it('should warn on very large token count', () => {
      // Create a prompt with > 100k tokens (~400k chars)
      const longPrompt = 'Package Plan: Build this.\nResponse Format: JSON.\n' + 'a'.repeat(400000);
      const result = validatePrompt(longPrompt);

      expect(result.valid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Prompt is very large');
      expect(result.warnings[0]).toContain('tokens');
      expect(result.warnings[0]).toContain('may hit token limits');
    });

    it('should warn when prompt contains absolute paths (Unix)', () => {
      const prompt = `
        Package Plan:
        Read from /Users/john/workspace/file.ts

        Response Format:
        Return JSON
      `;
      const result = validatePrompt(prompt);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt contains absolute file paths - use relative paths instead');
    });

    it('should warn when prompt contains absolute paths (Linux)', () => {
      const prompt = `
        Package Plan:
        Read from /home/john/workspace/file.ts

        Response Format:
        Return JSON
      `;
      const result = validatePrompt(prompt);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt contains absolute file paths - use relative paths instead');
    });

    it('should warn when prompt contains absolute paths (Windows)', () => {
      const prompt = `
        Package Plan:
        Read from C:\\Users\\john\\workspace\\file.ts

        Response Format:
        Return JSON
      `;
      const result = validatePrompt(prompt);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt contains absolute file paths - use relative paths instead');
    });

    it('should handle multiple validation issues', () => {
      const prompt = '/Users/john/workspace/file.ts';
      const result = validatePrompt(prompt);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt missing package plan section');
      expect(result.warnings).toContain('Prompt missing response format instructions');
      expect(result.warnings).toContain('Prompt contains absolute file paths - use relative paths instead');
      expect(result.warnings).toHaveLength(3);
    });

    it('should accept empty prompt without warnings (no min length check)', () => {
      const result = validatePrompt('');

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt missing package plan section');
      expect(result.warnings).toContain('Prompt missing response format instructions');
    });

    it('should handle prompt with relative paths (no warning)', () => {
      const prompt = `
        Package Plan:
        Read from src/index.ts and packages/core/test.ts

        Response Format:
        Return JSON
      `;
=======
    it('should warn on empty prompt', () => {
      const result = validatePrompt('');

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt is empty');
    });

    it('should warn on very short prompt', () => {
      const result = validatePrompt('Short');

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt is very short (may lack context)');
    });

    it('should warn on very long prompt', () => {
      const longPrompt = 'a'.repeat(200001); // > 200k chars
      const result = validatePrompt(longPrompt);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Prompt is very long (may exceed token limits)');
    });

    it('should handle prompt at max safe length', () => {
      const prompt = 'a'.repeat(200000);
      const result = validatePrompt(prompt);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle prompt at min safe length', () => {
      const prompt = 'a'.repeat(50);
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
      const result = validatePrompt(prompt);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
