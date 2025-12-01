/**
 * Tests for Optimization Activities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'os';
import {
  executeABTest,
  analyzeABTest,
  compareModelSelection,
  type ABTestConfig,
} from '../activities/optimization-ab-testing.activities.js';
import {
  testThinkingLevels,
  analyzeThinkingLevels,
  type ThinkingLevelTest,
} from '../activities/optimization-tuning.activities.js';
import {
  testSubagentStrategies,
  analyzeSubagentStrategies,
  type SubagentStrategyTest,
} from '../activities/optimization-subagent.activities.js';

describe('Optimization Activities', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'optimization-test-'));
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  describe('A/B Testing', () => {
    it('should execute A/B test and create results', async () => {
      const config: ABTestConfig = {
        testName: 'test-ab',
        variants: [
          {
            name: 'variant-a',
            model: 'opus',
            thinkingLevel: 'ultrathink',
            description: 'Opus with ultrathink',
          },
          {
            name: 'variant-b',
            model: 'sonnet',
            thinkingLevel: 'think hard',
            description: 'Sonnet with think hard',
          },
        ],
        testSpec: 'Test spec',
        requirements: 'Test requirements',
        runsPerVariant: 3,
        metrics: ['cost', 'success_rate'],
      };

      const results = await executeABTest(config, testWorkspace);

      expect(results.length).toBe(6); // 2 variants * 3 runs
      expect(results.every(r => r.testName === 'test-ab')).toBe(true);
      expect(results.some(r => r.variant === 'variant-a')).toBe(true);
      expect(results.some(r => r.variant === 'variant-b')).toBe(true);

      // Verify results file exists
      const resultsPath = path.join(testWorkspace, 'ab-test-test-ab', 'results.jsonl');
      const resultsExist = await fs.access(resultsPath).then(() => true).catch(() => false);
      expect(resultsExist).toBe(true);
    });

    it('should analyze A/B test results', async () => {
      // Create mock results
      const testDir = path.join(testWorkspace, 'ab-test-test-ab');
      await fs.mkdir(testDir, { recursive: true });

      const mockResults = [
        {
          testName: 'test-ab',
          variant: 'variant-a',
          runId: 'run-1',
          success: true,
          cost_usd: 0.25,
          duration_ms: 40000,
          validation_status: 'pass' as const,
          repair_attempts: 0,
          total_steps: 5,
          timestamp: new Date().toISOString(),
        },
        {
          testName: 'test-ab',
          variant: 'variant-b',
          runId: 'run-1',
          success: true,
          cost_usd: 0.15,
          duration_ms: 35000,
          validation_status: 'pass' as const,
          repair_attempts: 1,
          total_steps: 6,
          timestamp: new Date().toISOString(),
        },
      ];

      await fs.writeFile(
        path.join(testDir, 'results.jsonl'),
        mockResults.map(r => JSON.stringify(r)).join('\n'),
        'utf-8'
      );

      const analysis = await analyzeABTest(testWorkspace, 'test-ab');

      expect(analysis.testName).toBe('test-ab');
      expect(analysis.totalRuns).toBe(2);
      expect(analysis.variants.length).toBe(2);
      expect(analysis.variants[0].name).toBe('variant-a');
      expect(analysis.variants[1].name).toBe('variant-b');
    });
  });

  describe('Thinking Level Tuning', () => {
    it('should test thinking levels and create results', async () => {
      const config: ThinkingLevelTest = {
        testName: 'test-thinking',
        baseModel: 'opus',
        thinkingLevels: [
          { keyword: 'none', description: 'No thinking' },
          { keyword: 'think hard', description: 'Think hard' },
        ],
        testSpec: 'Test spec',
        requirements: 'Test requirements',
        runsPerLevel: 2,
      };

      const results = await testThinkingLevels(config, testWorkspace);

      expect(results.length).toBe(4); // 2 levels * 2 runs
      expect(results.every(r => r.testName === 'test-thinking')).toBe(true);
      expect(results.some(r => r.thinkingLevel === 'none')).toBe(true);
      expect(results.some(r => r.thinkingLevel === 'think hard')).toBe(true);
    });

    it('should analyze thinking level results', async () => {
      // Create mock results
      const testDir = path.join(testWorkspace, 'thinking-test-test-thinking');
      await fs.mkdir(testDir, { recursive: true });

      const config: ThinkingLevelTest = {
        testName: 'test-thinking',
        baseModel: 'opus',
        thinkingLevels: [
          { keyword: 'none', description: 'No thinking' },
          { keyword: 'think hard', description: 'Think hard' },
        ],
        testSpec: 'Test spec',
        requirements: 'Test requirements',
        runsPerLevel: 2,
      };

      await fs.writeFile(
        path.join(testDir, 'config.json'),
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      const mockResults = [
        {
          testName: 'test-thinking',
          thinkingLevel: 'none',
          runId: 'run-1',
          success: true,
          cost_usd: 0.20,
          duration_ms: 30000,
          validation_status: 'pass' as const,
          repair_attempts: 1,
          timestamp: new Date().toISOString(),
        },
        {
          testName: 'test-thinking',
          thinkingLevel: 'think hard',
          runId: 'run-1',
          success: true,
          cost_usd: 0.25,
          duration_ms: 35000,
          validation_status: 'pass' as const,
          repair_attempts: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      await fs.writeFile(
        path.join(testDir, 'results.jsonl'),
        mockResults.map(r => JSON.stringify(r)).join('\n'),
        'utf-8'
      );

      const analysis = await analyzeThinkingLevels(testWorkspace, 'test-thinking');

      expect(analysis.testName).toBe('test-thinking');
      expect(analysis.baseModel).toBe('opus');
      expect(analysis.levels.length).toBe(2);
      expect(analysis.levels.some(l => l.keyword === 'none')).toBe(true);
      expect(analysis.levels.some(l => l.keyword === 'think hard')).toBe(true);
    });
  });

  describe('Subagent Optimization', () => {
    it('should test subagent strategies and create results', async () => {
      const config: SubagentStrategyTest = {
        testName: 'test-subagent',
        strategies: [
          {
            name: 'parallel',
            type: 'parallel',
            description: 'Parallel execution',
          },
          {
            name: 'sequential',
            type: 'sequential',
            description: 'Sequential execution',
          },
        ],
        tasks: [
          { name: 'task1', instruction: 'Task 1' },
          { name: 'task2', instruction: 'Task 2' },
        ],
        testSpec: 'Test spec',
        requirements: 'Test requirements',
        runsPerStrategy: 2,
      };

      const results = await testSubagentStrategies(config, testWorkspace);

      expect(results.length).toBe(4); // 2 strategies * 2 runs
      expect(results.every(r => r.testName === 'test-subagent')).toBe(true);
      expect(results.some(r => r.strategy === 'parallel')).toBe(true);
      expect(results.some(r => r.strategy === 'sequential')).toBe(true);
    });

    it('should analyze subagent strategy results', async () => {
      // Create mock results
      const testDir = path.join(testWorkspace, 'subagent-test-test-subagent');
      await fs.mkdir(testDir, { recursive: true });

      const config: SubagentStrategyTest = {
        testName: 'test-subagent',
        strategies: [
          {
            name: 'parallel',
            type: 'parallel',
            description: 'Parallel execution',
          },
          {
            name: 'sequential',
            type: 'sequential',
            description: 'Sequential execution',
          },
        ],
        tasks: [
          { name: 'task1', instruction: 'Task 1' },
          { name: 'task2', instruction: 'Task 2' },
        ],
        testSpec: 'Test spec',
        requirements: 'Test requirements',
        runsPerStrategy: 2,
      };

      await fs.writeFile(
        path.join(testDir, 'config.json'),
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      const mockResults = [
        {
          testName: 'test-subagent',
          strategy: 'parallel',
          runId: 'run-1',
          success: true,
          cost_usd: 0.30,
          duration_ms: 60000,
          totalTasks: 2,
          tasksCompleted: 2,
          timestamp: new Date().toISOString(),
        },
        {
          testName: 'test-subagent',
          strategy: 'sequential',
          runId: 'run-1',
          success: true,
          cost_usd: 0.25,
          duration_ms: 90000,
          totalTasks: 2,
          tasksCompleted: 2,
          timestamp: new Date().toISOString(),
        },
      ];

      await fs.writeFile(
        path.join(testDir, 'results.jsonl'),
        mockResults.map(r => JSON.stringify(r)).join('\n'),
        'utf-8'
      );

      const analysis = await analyzeSubagentStrategies(testWorkspace, 'test-subagent');

      expect(analysis.testName).toBe('test-subagent');
      expect(analysis.strategies.length).toBe(2);
      expect(analysis.strategies.some(s => s.name === 'parallel')).toBe(true);
      expect(analysis.strategies.some(s => s.name === 'sequential')).toBe(true);
      expect(analysis.strategies.find(s => s.name === 'parallel')?.type).toBe('parallel');
      expect(analysis.strategies.find(s => s.name === 'sequential')?.type).toBe('sequential');
    });
  });
});

