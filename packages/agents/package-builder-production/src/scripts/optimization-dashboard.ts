#!/usr/bin/env node
/**
 * Optimization Dashboard CLI
 * 
 * Analyzes audit_trace.jsonl files from package builds to provide insights
 * for optimizing prompts, model selection, and workflow efficiency.
 * 
 * Usage:
 *   npm run optimization-dashboard <workspace-path>
 *   npm run optimization-dashboard <workspace-path> -- --format json
 *   npm run optimization-dashboard <workspace-path> -- --export report.md
 * 
 * Or with tsx directly:
 *   npx tsx src/scripts/optimization-dashboard.ts <workspace-path> [options]
 */

/* eslint-disable no-console */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { analyzeAuditTrace, generateOptimizationReport, type OptimizationAnalysis } from '../activities/optimization.activities.js';

interface CLIArgs {
  workspacePath: string;
  format?: 'text' | 'json' | 'markdown';
  export?: string;
  verbose?: boolean;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const workspacePath = args[0];
  
  if (!workspacePath) {
    console.error('Usage: optimization-dashboard <workspace-path> [--format text|json|markdown] [--export <file>] [--verbose]');
    process.exit(1);
  }

  const format = args.includes('--format') 
    ? args[args.indexOf('--format') + 1] as 'text' | 'json' | 'markdown'
    : 'text';

  const exportPath = args.includes('--export')
    ? args[args.indexOf('--export') + 1]
    : undefined;

  const verbose = args.includes('--verbose') || args.includes('-v');

  return { workspacePath, format, export: exportPath, verbose };
}

async function displayAnalysis(analysis: OptimizationAnalysis, format: 'text' | 'json' | 'markdown'): Promise<string> {
  if (format === 'json') {
    return JSON.stringify(analysis, null, 2);
  }

  if (format === 'markdown') {
    return generateOptimizationReport(analysis.workspacePath || '', undefined);
  }

  // Text format (default)
  const lines: string[] = [];
  
  lines.push('='.repeat(80));
  lines.push('OPTIMIZATION ANALYSIS REPORT');
  lines.push('='.repeat(80));
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push(`Total Runs: ${analysis.totalRuns}`);
  lines.push(`Total Cost: $${analysis.totalCost.toFixed(4)}`);
  lines.push(`Average Cost per Run: $${analysis.averageCostPerRun.toFixed(4)}`);
  lines.push(`Success Rate: ${(analysis.successRate * 100).toFixed(1)}%`);
  lines.push('');

  // Most Expensive Steps
  if (analysis.mostExpensiveSteps.length > 0) {
    lines.push('## Most Expensive Steps');
    analysis.mostExpensiveSteps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step.step}`);
      lines.push(`   Average: $${step.averageCost.toFixed(4)} | Total: $${step.totalCost.toFixed(4)} | Count: ${step.count}`);
    });
    lines.push('');
  }

  // Most Common Errors
  if (analysis.mostCommonErrors.length > 0) {
    lines.push('## Most Common Errors');
    analysis.mostCommonErrors.forEach((error, i) => {
      lines.push(`${i + 1}. ${error.errorType}`);
      lines.push(`   Occurrences: ${error.count} | Avg Fix Cost: $${error.averageCostToFix.toFixed(4)}`);
    });
    lines.push('');
  }

  // Model Efficiency
  if (analysis.modelEfficiency.length > 0) {
    lines.push('## Model Efficiency');
    analysis.modelEfficiency.forEach((model, i) => {
      lines.push(`${i + 1}. ${model.model}`);
      lines.push(`   Avg Cost: $${model.averageCost.toFixed(4)} | Success Rate: ${(model.successRate * 100).toFixed(1)}% | Uses: ${model.usageCount}`);
    });
    lines.push('');
  }

  // Recommendations
  if (analysis.recommendations.length > 0) {
    lines.push('## Recommendations');
    analysis.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
    lines.push('');
  }

  lines.push('='.repeat(80));

  return lines.join('\n');
}

async function main() {
  const args = parseArgs();
  const workspacePath = path.resolve(args.workspacePath);

  try {
    // Check if workspace exists
    await fs.access(workspacePath);

    // Analyze audit trace
    const analysis = await analyzeAuditTrace(workspacePath);

    // Display results
    const output = await displayAnalysis(analysis, args.format || 'text');
    console.log(output);

    // Export if requested
    if (args.export) {
      const exportPath = path.resolve(args.export);
      await fs.writeFile(exportPath, output, 'utf-8');
      console.log(`\n✅ Report exported to: ${exportPath}`);
    }

    // Exit with error code if success rate is low
    if (analysis.successRate < 0.5) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main().catch(console.error);

