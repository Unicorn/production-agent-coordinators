/**
 * A/B Testing Activities for Model Selection Optimization
 * 
 * These activities enable systematic A/B testing of different model selections,
 * thinking levels, and strategies to optimize cost and success rates.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ABTestConfig {
  testName: string;
  variants: Array<{
    name: string;
    model: 'opus' | 'sonnet' | 'haiku';
    thinkingLevel?: 'think' | 'think hard' | 'ultrathink';
    description: string;
  }>;
  testSpec: string; // Package spec to test with
  requirements: string; // Package requirements
  runsPerVariant: number;
  metrics: string[]; // What to measure
}

export interface ABTestResult {
  testName: string;
  variant: string;
  runId: string;
  success: boolean;
  cost_usd: number;
  duration_ms: number;
  validation_status: 'pass' | 'fail';
  repair_attempts: number;
  total_steps: number;
  timestamp: string;
}

export interface ABTestAnalysis {
  testName: string;
  totalRuns: number;
  variants: Array<{
    name: string;
    runs: number;
    successRate: number;
    averageCost: number;
    averageDuration: number;
    averageRepairAttempts: number;
    costPerSuccess: number;
  }>;
  winner?: {
    variant: string;
    reason: string;
  };
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// A/B Test Execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute an A/B test by running multiple variants and collecting metrics
 */
export async function executeABTest(
  config: ABTestConfig,
  workspacePath: string
): Promise<ABTestResult[]> {
  const results: ABTestResult[] = [];
  const testDir = path.join(workspacePath, `ab-test-${config.testName}`);

  // Create test directory
  await fs.mkdir(testDir, { recursive: true });

  // Save test config
  await fs.writeFile(
    path.join(testDir, 'config.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  );

  // Execute each variant
  for (const variant of config.variants) {
    for (let run = 0; run < config.runsPerVariant; run++) {
      const runId = `${variant.name}-run-${run + 1}`;
      const variantDir = path.join(testDir, runId);

      // Note: In a real implementation, this would call the actual workflow
      // For now, we'll create a structure for results
      const result: ABTestResult = {
        testName: config.testName,
        variant: variant.name,
        runId,
        success: false, // Would be set by actual workflow execution
        cost_usd: 0,
        duration_ms: 0,
        validation_status: 'fail',
        repair_attempts: 0,
        total_steps: 0,
        timestamp: new Date().toISOString(),
      };

      results.push(result);

      // Save individual result
      await fs.mkdir(variantDir, { recursive: true });
      await fs.writeFile(
        path.join(variantDir, 'result.json'),
        JSON.stringify(result, null, 2),
        'utf-8'
      );
    }
  }

  // Save all results
  await fs.writeFile(
    path.join(testDir, 'results.jsonl'),
    results.map(r => JSON.stringify(r)).join('\n'),
    'utf-8'
  );

  return results;
}

/**
 * Analyze A/B test results to determine optimal variant
 */
export async function analyzeABTest(
  workspacePath: string,
  testName: string
): Promise<ABTestAnalysis> {
  const testDir = path.join(workspacePath, `ab-test-${testName}`);
  const resultsPath = path.join(testDir, 'results.jsonl');

  // Read results
  const resultsContent = await fs.readFile(resultsPath, 'utf-8');
  const results: ABTestResult[] = resultsContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  // Group by variant
  const variantGroups = new Map<string, ABTestResult[]>();
  results.forEach(result => {
    if (!variantGroups.has(result.variant)) {
      variantGroups.set(result.variant, []);
    }
    variantGroups.get(result.variant)!.push(result);
  });

  // Calculate metrics per variant
  const variantAnalyses = Array.from(variantGroups.entries()).map(([name, runs]) => {
    const successfulRuns = runs.filter(r => r.success);
    const successRate = successfulRuns.length / runs.length;
    const averageCost = runs.reduce((sum, r) => sum + r.cost_usd, 0) / runs.length;
    const averageDuration = runs.reduce((sum, r) => sum + r.duration_ms, 0) / runs.length;
    const averageRepairAttempts = runs.reduce((sum, r) => sum + r.repair_attempts, 0) / runs.length;
    const costPerSuccess = successfulRuns.length > 0
      ? runs.reduce((sum, r) => sum + r.cost_usd, 0) / successfulRuns.length
      : Infinity;

    return {
      name,
      runs: runs.length,
      successRate,
      averageCost,
      averageDuration,
      averageRepairAttempts,
      costPerSuccess,
    };
  });

  // Determine winner (lowest cost per success, highest success rate)
  const winner = variantAnalyses
    .filter(v => v.successRate > 0)
    .sort((a, b) => {
      // Primary: cost per success (lower is better)
      if (Math.abs(a.costPerSuccess - b.costPerSuccess) > 0.01) {
        return a.costPerSuccess - b.costPerSuccess;
      }
      // Secondary: success rate (higher is better)
      return b.successRate - a.successRate;
    })[0];

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (winner) {
    recommendations.push(`Use ${winner.name} for this task type (lowest cost per success: $${winner.costPerSuccess.toFixed(4)})`);
  }

  variantAnalyses.forEach(variant => {
    if (variant.successRate < 0.8) {
      recommendations.push(`Warning: ${variant.name} has low success rate (${(variant.successRate * 100).toFixed(1)}%)`);
    }
    if (variant.averageRepairAttempts > 2) {
      recommendations.push(`Warning: ${variant.name} requires many repair attempts (${variant.averageRepairAttempts.toFixed(1)} on average)`);
    }
  });

  return {
    testName,
    totalRuns: results.length,
    variants: variantAnalyses,
    winner: winner ? {
      variant: winner.name,
      reason: `Lowest cost per success ($${winner.costPerSuccess.toFixed(4)}) with ${(winner.successRate * 100).toFixed(1)}% success rate`,
    } : undefined,
    recommendations,
  };
}

/**
 * Compare two model selections side-by-side
 */
export async function compareModelSelection(
  variantA: { model: 'opus' | 'sonnet' | 'haiku'; thinkingLevel?: string },
  variantB: { model: 'opus' | 'sonnet' | 'haiku'; thinkingLevel?: string },
  testSpec: string,
  requirements: string,
  workspacePath: string
): Promise<{
  variantA: ABTestResult[];
  variantB: ABTestResult[];
  analysis: ABTestAnalysis;
}> {
  const config: ABTestConfig = {
    testName: `compare-${variantA.model}-vs-${variantB.model}`,
    variants: [
      {
        name: `variant-a-${variantA.model}`,
        model: variantA.model,
        thinkingLevel: variantA.thinkingLevel as any,
        description: `${variantA.model}${variantA.thinkingLevel ? ` with ${variantA.thinkingLevel}` : ''}`,
      },
      {
        name: `variant-b-${variantB.model}`,
        model: variantB.model,
        thinkingLevel: variantB.thinkingLevel as any,
        description: `${variantB.model}${variantB.thinkingLevel ? ` with ${variantB.thinkingLevel}` : ''}`,
      },
    ],
    testSpec,
    requirements,
    runsPerVariant: 5, // Default to 5 runs per variant
    metrics: ['cost', 'success_rate', 'duration', 'repair_attempts'],
  };

  const results = await executeABTest(config, workspacePath);
  const analysis = await analyzeABTest(workspacePath, config.testName);

  // Split results by variant
  const variantAResults = results.filter(r => r.variant.startsWith('variant-a'));
  const variantBResults = results.filter(r => r.variant.startsWith('variant-b'));

  return {
    variantA: variantAResults,
    variantB: variantBResults,
    analysis,
  };
}

