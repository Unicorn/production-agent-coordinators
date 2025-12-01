/**
 * Optimization Analysis Activities
 * 
 * These activities analyze audit_trace.jsonl files to optimize prompts,
 * model selection, and workflow efficiency.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  workflow_run_id: string;
  step_name: string;
  timestamp: string;
  prompt_token_count?: number;
  completion_token_count?: number;
  total_token_cost?: number;
  cost_usd: number;
  context_file_hash?: string;
  validation_status: 'pass' | 'fail' | 'N/A';
  validation_error_type?: string;
  error_log_size_chars?: number;
  files_modified?: number;
  provider?: string;
  model?: string;
  session_id?: string;
}

export interface OptimizationAnalysis {
  workspacePath?: string;
  totalRuns: number;
  totalCost: number;
  averageCostPerRun: number;
  successRate: number;
  mostExpensiveSteps: Array<{
    step: string;
    totalCost: number;
    averageCost: number;
    count: number;
  }>;
  mostCommonErrors: Array<{
    errorType: string;
    count: number;
    averageCostToFix: number;
  }>;
  modelEfficiency: Array<{
    model: string;
    averageCost: number;
    successRate: number;
    usageCount: number;
  }>;
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read and parse audit trace file
 */
export async function readAuditTrace(workspacePath: string): Promise<AuditEntry[]> {
  const auditPath = path.join(workspacePath, 'audit_trace.jsonl');
  
  try {
    const content = await fs.readFile(auditPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    return lines.map(line => {
      try {
        return JSON.parse(line) as AuditEntry;
      } catch {
        return null;
      }
    }).filter((entry): entry is AuditEntry => entry !== null);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Analyze audit trace for optimization insights
 */
export async function analyzeAuditTrace(workspacePath: string): Promise<OptimizationAnalysis> {
  const entries = await readAuditTrace(workspacePath);
  
  if (entries.length === 0) {
    return {
      workspacePath,
      totalRuns: 0,
      totalCost: 0,
      averageCostPerRun: 0,
      successRate: 0,
      mostExpensiveSteps: [],
      mostCommonErrors: [],
      modelEfficiency: [],
      recommendations: ['No audit data available'],
    };
  }

  // Group by workflow run
  const runs = new Map<string, AuditEntry[]>();
  entries.forEach(entry => {
    const runId = entry.workflow_run_id;
    if (!runs.has(runId)) {
      runs.set(runId, []);
    }
    runs.get(runId)!.push(entry);
  });

  const totalRuns = runs.size;
  const totalCost = entries.reduce((sum, e) => sum + e.cost_usd, 0);
  const averageCostPerRun = totalCost / totalRuns;

  // Calculate success rate
  const successfulRuns = Array.from(runs.values()).filter(runEntries => {
    const finalValidation = runEntries
      .filter(e => e.validation_status === 'pass' || e.validation_status === 'fail')
      .pop();
    return finalValidation?.validation_status === 'pass';
  }).length;
  const successRate = successfulRuns / totalRuns;

  // Most expensive steps
  const stepCosts = new Map<string, { total: number; count: number }>();
  entries.forEach(entry => {
    const step = entry.step_name;
    if (!stepCosts.has(step)) {
      stepCosts.set(step, { total: 0, count: 0 });
    }
    const stats = stepCosts.get(step)!;
    stats.total += entry.cost_usd;
    stats.count += 1;
  });

  const mostExpensiveSteps = Array.from(stepCosts.entries())
    .map(([step, stats]) => ({
      step,
      totalCost: stats.total,
      averageCost: stats.total / stats.count,
      count: stats.count,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10);

  // Most common errors
  const errorCounts = new Map<string, { count: number; totalCost: number }>();
  entries
    .filter(e => e.validation_status === 'fail' && e.validation_error_type)
    .forEach(entry => {
      const errorType = entry.validation_error_type!;
      if (!errorCounts.has(errorType)) {
        errorCounts.set(errorType, { count: 0, totalCost: 0 });
      }
      const stats = errorCounts.get(errorType)!;
      stats.count += 1;
      // Find the repair cost for this error
      const repairEntry = entries.find(
        e => e.workflow_run_id === entry.workflow_run_id &&
        e.step_name.startsWith('repair_') &&
        e.timestamp > entry.timestamp
      );
      if (repairEntry) {
        stats.totalCost += repairEntry.cost_usd;
      }
    });

  const mostCommonErrors = Array.from(errorCounts.entries())
    .map(([errorType, stats]) => ({
      errorType,
      count: stats.count,
      averageCostToFix: stats.totalCost / stats.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Model efficiency
  const modelStats = new Map<string, { totalCost: number; successCount: number; totalCount: number }>();
  entries.forEach(entry => {
    if (!entry.model) return;
    if (!modelStats.has(entry.model)) {
      modelStats.set(entry.model, { totalCost: 0, successCount: 0, totalCount: 0 });
    }
    const stats = modelStats.get(entry.model)!;
    stats.totalCost += entry.cost_usd;
    stats.totalCount += 1;
    if (entry.validation_status === 'pass') {
      stats.successCount += 1;
    }
  });

  const modelEfficiency = Array.from(modelStats.entries())
    .map(([model, stats]) => ({
      model,
      averageCost: stats.totalCost / stats.totalCount,
      successRate: stats.successCount / stats.totalCount,
      usageCount: stats.totalCount,
    }))
    .sort((a, b) => a.averageCost - b.averageCost);

  // Generate recommendations
  const recommendations: string[] = [];

  if (mostCommonErrors.length > 0) {
    const topError = mostCommonErrors[0];
    recommendations.push(
      `Most common error: ${topError.errorType} (${topError.count} occurrences). ` +
      `Consider adding stricter constraints to GEMINI.md/CLAUDE.md to prevent this error.`
    );
  }

  if (mostExpensiveSteps.length > 0) {
    const topStep = mostExpensiveSteps[0];
    recommendations.push(
      `Most expensive step: ${topStep.step} ($${topStep.averageCost.toFixed(4)} average). ` +
      `Consider optimizing prompts or using a cheaper model for this step.`
    );
  }

  const lowSuccessModel = modelEfficiency.find(m => m.successRate < 0.5);
  if (lowSuccessModel) {
    recommendations.push(
      `Model ${lowSuccessModel.model} has low success rate (${(lowSuccessModel.successRate * 100).toFixed(1)}%). ` +
      `Consider using a different model or improving prompts.`
    );
  }

  if (successRate < 0.8) {
    recommendations.push(
      `Overall success rate is ${(successRate * 100).toFixed(1)}%. ` +
      `Review most common errors and update constraints in requirements.`
    );
  }

  return {
    workspacePath,
    totalRuns,
    totalCost,
    averageCostPerRun,
    successRate,
    mostExpensiveSteps,
    mostCommonErrors,
    modelEfficiency,
    recommendations: recommendations.length > 0 ? recommendations : ['No specific recommendations'],
  };
}

/**
 * Generate optimization report
 */
export async function generateOptimizationReport(
  workspacePath: string,
  outputPath?: string
): Promise<string> {
  const analysis = await analyzeAuditTrace(workspacePath);
  
  const report = `# Optimization Analysis Report

Generated: ${new Date().toISOString()}

## Summary

- **Total Runs**: ${analysis.totalRuns}
- **Total Cost**: $${analysis.totalCost.toFixed(4)}
- **Average Cost per Run**: $${analysis.averageCostPerRun.toFixed(4)}
- **Success Rate**: ${(analysis.successRate * 100).toFixed(1)}%

## Most Expensive Steps

${analysis.mostExpensiveSteps.map(s => 
  `- **${s.step}**: $${s.averageCost.toFixed(4)} average (${s.count} occurrences, $${s.totalCost.toFixed(4)} total)`
).join('\n')}

## Most Common Errors

${analysis.mostCommonErrors.map(e => 
  `- **${e.errorType}**: ${e.count} occurrences, $${e.averageCostToFix.toFixed(4)} average cost to fix`
).join('\n')}

## Model Efficiency

${analysis.modelEfficiency.map(m => 
  `- **${m.model}**: $${m.averageCost.toFixed(4)} average cost, ${(m.successRate * 100).toFixed(1)}% success rate (${m.usageCount} uses)`
).join('\n')}

## Recommendations

${analysis.recommendations.map(r => `- ${r}`).join('\n')}
`;

  if (outputPath) {
    await fs.writeFile(outputPath, report, 'utf-8');
  }

  return report;
}

