#!/usr/bin/env node
/**
 * Optimization Test Runner
 * 
 * CLI tool for running A/B tests, thinking level tuning, and subagent optimization
 */

import { parseArgs } from 'node:util';
import * as path from 'path';
import * as fs from 'fs/promises';
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

const options = {
  test: { type: 'string' as const },
  workspace: { type: 'string' as const },
  help: { type: 'boolean' as const },
};

async function main() {
  const { values, positionals } = parseArgs({ options, allowPositionals: true });

  if (values.help || positionals.length === 0) {
    console.log(`
Usage: optimization-runner <command> [options]

Commands:
  ab-test <test-name>          Run A/B test for model selection
  thinking <test-name>          Test thinking level optimization
  subagent <test-name>          Test subagent strategy optimization
  analyze <test-type> <name>   Analyze test results

Options:
  --workspace <path>            Workspace directory (default: /tmp/optimization)
  --test <name>                 Test name
  --help                        Show this help

Examples:
  optimization-runner ab-test architecture-comparison --workspace /tmp/opt
  optimization-runner analyze ab-test architecture-comparison
    `);
    process.exit(0);
  }

  const command = positionals[0];
  const workspacePath = values.workspace || '/tmp/optimization';
  await fs.mkdir(workspacePath, { recursive: true });

  switch (command) {
    case 'ab-test': {
      const testName = values.test || positionals[1] || 'default-test';
      console.log(`[AB Test] Running test: ${testName}`);

      // Example config - in real usage, this would come from a file or CLI args
      const config: ABTestConfig = {
        testName,
        variants: [
          {
            name: 'opus-ultrathink',
            model: 'opus',
            thinkingLevel: 'ultrathink',
            description: 'Opus with ultrathink for architecture',
          },
          {
            name: 'sonnet-think-hard',
            model: 'sonnet',
            thinkingLevel: 'think hard',
            description: 'Sonnet with think hard for architecture',
          },
        ],
        testSpec: 'Example package spec',
        requirements: 'Example requirements',
        runsPerVariant: 5,
        metrics: ['cost', 'success_rate', 'duration'],
      };

      const results = await executeABTest(config, workspacePath);
      console.log(`[AB Test] Completed ${results.length} runs`);

      const analysis = await analyzeABTest(workspacePath, testName);
      console.log('\n[AB Test] Analysis:');
      console.log(JSON.stringify(analysis, null, 2));
      break;
    }

    case 'thinking': {
      const testName = values.test || positionals[1] || 'default-thinking';
      console.log(`[Thinking Test] Running test: ${testName}`);

      const config: ThinkingLevelTest = {
        testName,
        baseModel: 'opus',
        thinkingLevels: [
          { keyword: 'none', description: 'No extended thinking' },
          { keyword: 'think', description: 'Basic extended thinking' },
          { keyword: 'think hard', description: 'More computation' },
          { keyword: 'ultrathink', description: 'Maximum thinking budget' },
        ],
        testSpec: 'Example package spec',
        requirements: 'Example requirements',
        runsPerLevel: 5,
      };

      const results = await testThinkingLevels(config, workspacePath);
      console.log(`[Thinking Test] Completed ${results.length} runs`);

      const analysis = await analyzeThinkingLevels(workspacePath, testName);
      console.log('\n[Thinking Test] Analysis:');
      console.log(JSON.stringify(analysis, null, 2));
      break;
    }

    case 'subagent': {
      const testName = values.test || positionals[1] || 'default-subagent';
      console.log(`[Subagent Test] Running test: ${testName}`);

      const config: SubagentStrategyTest = {
        testName,
        strategies: [
          {
            name: 'parallel',
            type: 'parallel',
            description: 'Execute subagents in parallel',
          },
          {
            name: 'sequential',
            type: 'sequential',
            description: 'Execute subagents sequentially',
          },
        ],
        tasks: [
          { name: 'types', instruction: 'Implement types' },
          { name: 'core', instruction: 'Implement core logic' },
          { name: 'tests', instruction: 'Write tests' },
        ],
        testSpec: 'Example package spec',
        requirements: 'Example requirements',
        runsPerStrategy: 5,
      };

      const results = await testSubagentStrategies(config, workspacePath);
      console.log(`[Subagent Test] Completed ${results.length} runs`);

      const analysis = await analyzeSubagentStrategies(workspacePath, testName);
      console.log('\n[Subagent Test] Analysis:');
      console.log(JSON.stringify(analysis, null, 2));
      break;
    }

    case 'analyze': {
      const testType = positionals[1];
      const testName = positionals[2];

      if (!testType || !testName) {
        console.error('Error: analyze requires test-type and test-name');
        process.exit(1);
      }

      switch (testType) {
        case 'ab-test': {
          const analysis = await analyzeABTest(workspacePath, testName);
          console.log(JSON.stringify(analysis, null, 2));
          break;
        }
        case 'thinking': {
          const analysis = await analyzeThinkingLevels(workspacePath, testName);
          console.log(JSON.stringify(analysis, null, 2));
          break;
        }
        case 'subagent': {
          const analysis = await analyzeSubagentStrategies(workspacePath, testName);
          console.log(JSON.stringify(analysis, null, 2));
          break;
        }
        default:
          console.error(`Error: Unknown test type: ${testType}`);
          process.exit(1);
      }
      break;
    }

    default:
      console.error(`Error: Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

