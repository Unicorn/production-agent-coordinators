/**
 * Subagent Optimization Activities
 * 
 * These activities measure the cost/time tradeoffs between parallel subagent
 * execution vs sequential execution.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SubagentStrategyTest {
  testName: string;
  strategies: Array<{
    name: string;
    type: 'parallel' | 'sequential';
    description: string;
  }>;
  tasks: Array<{
    name: string;
    instruction: string;
    subagent?: string;
  }>;
  testSpec: string;
  requirements: string;
  runsPerStrategy: number;
}

export interface SubagentStrategyResult {
  testName: string;
  strategy: string;
  runId: string;
  success: boolean;
  cost_usd: number;
  duration_ms: number;
  totalTasks: number;
  tasksCompleted: number;
  timestamp: string;
}

export interface SubagentStrategyAnalysis {
  testName: string;
  strategies: Array<{
    name: string;
    type: string;
    runs: number;
    successRate: number;
    averageCost: number;
    averageDuration: number;
    averageTasksCompleted: number;
    costPerTask: number;
    timePerTask: number;
  }>;
  winner?: {
    strategy: string;
    reason: string;
  };
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Subagent Strategy Testing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test different subagent execution strategies
 */
export async function testSubagentStrategies(
  config: SubagentStrategyTest,
  workspacePath: string
): Promise<SubagentStrategyResult[]> {
  const results: SubagentStrategyResult[] = [];
  const testDir = path.join(workspacePath, `subagent-test-${config.testName}`);

  await fs.mkdir(testDir, { recursive: true });

  // Save config
  await fs.writeFile(
    path.join(testDir, 'config.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  );

  // Test each strategy
  for (const strategy of config.strategies) {
    for (let run = 0; run < config.runsPerStrategy; run++) {
      const runId = `${strategy.name}-run-${run + 1}`;

      const result: SubagentStrategyResult = {
        testName: config.testName,
        strategy: strategy.name,
        runId,
        success: false, // Would be set by actual workflow
        cost_usd: 0,
        duration_ms: 0,
        totalTasks: config.tasks.length,
        tasksCompleted: 0,
        timestamp: new Date().toISOString(),
      };

      results.push(result);
    }
  }

  // Save results
  await fs.writeFile(
    path.join(testDir, 'results.jsonl'),
    results.map(r => JSON.stringify(r)).join('\n'),
    'utf-8'
  );

  return results;
}

/**
 * Analyze subagent strategy test results
 */
export async function analyzeSubagentStrategies(
  workspacePath: string,
  testName: string
): Promise<SubagentStrategyAnalysis> {
  const testDir = path.join(workspacePath, `subagent-test-${testName}`);
  const resultsPath = path.join(testDir, 'results.jsonl');
  const configPath = path.join(testDir, 'config.json');

  // Read config and results
  const configContent = await fs.readFile(configPath, 'utf-8');
  const config: SubagentStrategyTest = JSON.parse(configContent);

  const resultsContent = await fs.readFile(resultsPath, 'utf-8');
  const results: SubagentStrategyResult[] = resultsContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  // Group by strategy
  const strategyGroups = new Map<string, SubagentStrategyResult[]>();
  results.forEach(result => {
    if (!strategyGroups.has(result.strategy)) {
      strategyGroups.set(result.strategy, []);
    }
    strategyGroups.get(result.strategy)!.push(result);
  });

  // Calculate metrics per strategy
  const strategyAnalyses = Array.from(strategyGroups.entries()).map(([name, runs]) => {
    const successfulRuns = runs.filter(r => r.success);
    const successRate = successfulRuns.length / runs.length;
    const averageCost = runs.reduce((sum, r) => sum + r.cost_usd, 0) / runs.length;
    const averageDuration = runs.reduce((sum, r) => sum + r.duration_ms, 0) / runs.length;
    const averageTasksCompleted = runs.reduce((sum, r) => sum + r.tasksCompleted, 0) / runs.length;
    const costPerTask = averageTasksCompleted > 0
      ? averageCost / averageTasksCompleted
      : Infinity;
    const timePerTask = averageTasksCompleted > 0
      ? averageDuration / averageTasksCompleted
      : Infinity;

    return {
      name,
      type: config.strategies.find(s => s.name === name)?.type || 'unknown',
      runs: runs.length,
      successRate,
      averageCost,
      averageDuration,
      averageTasksCompleted,
      costPerTask,
      timePerTask,
    };
  });

  // Find winner (best cost/time tradeoff)
  const winner = strategyAnalyses
    .filter(s => s.successRate > 0)
    .sort((a, b) => {
      // Primary: cost per task
      if (Math.abs(a.costPerTask - b.costPerTask) > 0.01) {
        return a.costPerTask - b.costPerTask;
      }
      // Secondary: time per task (lower is better)
      return a.timePerTask - b.timePerTask;
    })[0];

  // Generate recommendations
  const recommendations: string[] = [];

  if (winner) {
    const parallelStrategy = strategyAnalyses.find(s => s.type === 'parallel');
    const sequentialStrategy = strategyAnalyses.find(s => s.type === 'sequential');

    if (parallelStrategy && sequentialStrategy) {
      const timeSavings = ((sequentialStrategy.timePerTask - parallelStrategy.timePerTask) / sequentialStrategy.timePerTask) * 100;
      const costDifference = ((parallelStrategy.costPerTask - sequentialStrategy.costPerTask) / sequentialStrategy.costPerTask) * 100;

      if (timeSavings > 20 && costDifference < 10) {
        recommendations.push(
          `Parallel execution saves ${timeSavings.toFixed(1)}% time with only ${costDifference.toFixed(1)}% cost increase - recommended for this task`
        );
      } else if (costDifference > 20 && timeSavings < 10) {
        recommendations.push(
          `Sequential execution saves ${Math.abs(costDifference).toFixed(1)}% cost with minimal time impact - recommended for this task`
        );
      }
    }

    recommendations.push(
      `Use ${winner.name} strategy (cost per task: $${winner.costPerTask.toFixed(4)}, time per task: ${(winner.timePerTask / 1000).toFixed(1)}s)`
    );
  }

  return {
    testName,
    strategies: strategyAnalyses,
    winner: winner ? {
      strategy: winner.name,
      reason: `Best cost/time tradeoff: $${winner.costPerTask.toFixed(4)} per task, ${(winner.timePerTask / 1000).toFixed(1)}s per task`,
    } : undefined,
    recommendations,
  };
}

