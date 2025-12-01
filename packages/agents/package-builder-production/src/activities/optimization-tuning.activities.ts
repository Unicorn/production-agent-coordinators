/**
 * Thinking Level Tuning Activities
 * 
 * These activities help optimize thinking budget allocation by testing
 * different thinking keywords and measuring their impact on success and cost.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ThinkingLevelTest {
  testName: string;
  baseModel: 'opus' | 'sonnet' | 'haiku';
  thinkingLevels: Array<{
    keyword: 'think' | 'think hard' | 'ultrathink' | 'none';
    description: string;
  }>;
  testSpec: string;
  requirements: string;
  runsPerLevel: number;
}

export interface ThinkingLevelResult {
  testName: string;
  thinkingLevel: string;
  runId: string;
  success: boolean;
  cost_usd: number;
  duration_ms: number;
  validation_status: 'pass' | 'fail';
  repair_attempts: number;
  timestamp: string;
}

export interface ThinkingLevelAnalysis {
  testName: string;
  baseModel: string;
  levels: Array<{
    keyword: string;
    runs: number;
    successRate: number;
    averageCost: number;
    averageDuration: number;
    costPerSuccess: number;
    improvementOverNone?: number; // Percentage improvement
  }>;
  optimalLevel?: {
    keyword: string;
    reason: string;
    costBenefit: string;
  };
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Thinking Level Testing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test different thinking levels to find optimal allocation
 */
export async function testThinkingLevels(
  config: ThinkingLevelTest,
  workspacePath: string
): Promise<ThinkingLevelResult[]> {
  const results: ThinkingLevelResult[] = [];
  const testDir = path.join(workspacePath, `thinking-test-${config.testName}`);

  await fs.mkdir(testDir, { recursive: true });

  // Save config
  await fs.writeFile(
    path.join(testDir, 'config.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  );

  // Test each thinking level
  for (const level of config.thinkingLevels) {
    for (let run = 0; run < config.runsPerLevel; run++) {
      const runId = `${level.keyword}-run-${run + 1}`;

      const result: ThinkingLevelResult = {
        testName: config.testName,
        thinkingLevel: level.keyword,
        runId,
        success: false, // Would be set by actual workflow
        cost_usd: 0,
        duration_ms: 0,
        validation_status: 'fail',
        repair_attempts: 0,
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
 * Analyze thinking level test results
 */
export async function analyzeThinkingLevels(
  workspacePath: string,
  testName: string
): Promise<ThinkingLevelAnalysis> {
  const testDir = path.join(workspacePath, `thinking-test-${testName}`);
  const resultsPath = path.join(testDir, 'results.jsonl');
  const configPath = path.join(testDir, 'config.json');

  // Read config and results
  const configContent = await fs.readFile(configPath, 'utf-8');
  const config: ThinkingLevelTest = JSON.parse(configContent);

  const resultsContent = await fs.readFile(resultsPath, 'utf-8');
  const results: ThinkingLevelResult[] = resultsContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  // Group by thinking level
  const levelGroups = new Map<string, ThinkingLevelResult[]>();
  results.forEach(result => {
    if (!levelGroups.has(result.thinkingLevel)) {
      levelGroups.set(result.thinkingLevel, []);
    }
    levelGroups.get(result.thinkingLevel)!.push(result);
  });

  // Calculate metrics per level
  const levelAnalyses = Array.from(levelGroups.entries()).map(([keyword, runs]) => {
    const successfulRuns = runs.filter(r => r.success);
    const successRate = successfulRuns.length / runs.length;
    const averageCost = runs.reduce((sum, r) => sum + r.cost_usd, 0) / runs.length;
    const averageDuration = runs.reduce((sum, r) => sum + r.duration_ms, 0) / runs.length;
    const costPerSuccess = successfulRuns.length > 0
      ? runs.reduce((sum, r) => sum + r.cost_usd, 0) / successfulRuns.length
      : Infinity;

    return {
      keyword,
      runs: runs.length,
      successRate,
      averageCost,
      averageDuration,
      costPerSuccess,
    };
  });

  // Calculate improvement over "none"
  const noneLevel = levelAnalyses.find(l => l.keyword === 'none');
  levelAnalyses.forEach(level => {
    if (noneLevel && level.keyword !== 'none' && noneLevel.costPerSuccess > 0) {
      const improvement = ((noneLevel.costPerSuccess - level.costPerSuccess) / noneLevel.costPerSuccess) * 100;
      level.improvementOverNone = improvement;
    }
  });

  // Find optimal level (best cost/benefit ratio)
  const optimalLevel = levelAnalyses
    .filter(l => l.successRate > 0)
    .sort((a, b) => {
      // Primary: cost per success
      if (Math.abs(a.costPerSuccess - b.costPerSuccess) > 0.01) {
        return a.costPerSuccess - b.costPerSuccess;
      }
      // Secondary: success rate
      return b.successRate - a.successRate;
    })[0];

  // Generate recommendations
  const recommendations: string[] = [];

  if (optimalLevel) {
    const improvement = optimalLevel.improvementOverNone
      ? `${optimalLevel.improvementOverNone > 0 ? '+' : ''}${optimalLevel.improvementOverNone.toFixed(1)}%`
      : 'N/A';
    recommendations.push(
      `Use "${optimalLevel.keyword}" for ${config.baseModel} (cost per success: $${optimalLevel.costPerSuccess.toFixed(4)}, improvement: ${improvement})`
    );
  }

  levelAnalyses.forEach(level => {
    if (level.successRate < 0.7 && level.keyword !== 'none') {
      recommendations.push(
        `Warning: "${level.keyword}" has low success rate (${(level.successRate * 100).toFixed(1)}%) - may not be worth the extra cost`
      );
    }
  });

  return {
    testName,
    baseModel: config.baseModel,
    levels: levelAnalyses,
    optimalLevel: optimalLevel ? {
      keyword: optimalLevel.keyword,
      reason: `Best cost/benefit ratio: $${optimalLevel.costPerSuccess.toFixed(4)} per success with ${(optimalLevel.successRate * 100).toFixed(1)}% success rate`,
      costBenefit: optimalLevel.improvementOverNone
        ? `${optimalLevel.improvementOverNone > 0 ? 'Saves' : 'Costs'} ${Math.abs(optimalLevel.improvementOverNone).toFixed(1)}% compared to no thinking`
        : 'N/A',
    } : undefined,
    recommendations,
  };
}

