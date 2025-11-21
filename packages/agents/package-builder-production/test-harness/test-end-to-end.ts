#!/usr/bin/env tsx

/**
 * Test Harness: End-to-End Integration
 *
 * Tests the complete pipeline from prompt building through file creation.
 * This simulates the full agent execution workflow.
 *
 * Usage: npx tsx test-harness/test-end-to-end.ts
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable must be set
 * - GITHUB_TOKEN environment variable (optional, for GitHub integration)
 */

import { buildAgentPrompt } from '../src/activities/prompt-builder.activities.js';
import { executeAgentWithClaude } from '../src/activities/agent-execution.activities.js';
import { parseAgentResponse } from '../src/activities/response-parser.activities.js';
import { applyFileChanges } from '../src/activities/file-operations.activities.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  console.log('🧪 End-to-End Integration Test\n');
  console.log('This test runs the complete pipeline: Build Prompt → Call Claude → Parse Response → Apply Files\n');

  // Check prerequisites
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required');
    console.error('   Set it with: export ANTHROPIC_API_KEY=your-key-here');
    process.exit(1);
  }

  const workspaceRoot = path.resolve(process.cwd(), '../../..');
  const outputDir = path.join(process.cwd(), 'test-harness/output');
  const e2eWorkspace = path.join(outputDir, 'e2e-test');

  // Clean workspace
  await fs.rm(e2eWorkspace, { recursive: true, force: true });
  await fs.mkdir(e2eWorkspace, { recursive: true });

  const startTime = Date.now();

  try {
    // Step 1: Build Prompt
    console.log('[1/4] Building prompt with quality standards...');
    const promptStart = Date.now();

    const githubContext = process.env.GITHUB_TOKEN ? {
      token: process.env.GITHUB_TOKEN,
      repo: 'your-org/production-agent-coordinators',
      branch: 'main'
    } : undefined;

    const prompt = await buildAgentPrompt({
      agentName: 'package-development-agent',
      taskType: 'PACKAGE_SCAFFOLDING',
      instructions: 'Create a simple console logger package with log levels (debug, info, warn, error) and timestamp support',
      packagePath: 'packages/utility/logger',
      planPath: path.join(process.cwd(), 'test-harness/fixtures/sample-plan.md'),
      workspaceRoot,
      githubContext,
      includeQualityStandards: true,
      includeFewShotExamples: true,
      includeValidationChecklist: true
    });

    const promptDuration = Date.now() - promptStart;
    console.log(`✓ Prompt built in ${promptDuration}ms`);
    console.log(`  Length: ${prompt.length} chars (~${Math.ceil(prompt.length / 4)} tokens)`);
    console.log(`  GitHub Integration: ${githubContext ? 'enabled' : 'disabled'}\n`);

    // Step 2: Execute with Claude
    console.log('[2/4] Calling Claude API...');
    const claudeStart = Date.now();

    const response = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.2,
      maxTokens: 8000
    });

    const claudeDuration = Date.now() - claudeStart;
    console.log(`✓ Claude responded in ${claudeDuration}ms`);
    console.log(`  Response length: ${response.length} chars\n`);

    // Step 3: Parse Response
    console.log('[3/4] Parsing Claude response...');
    const parseStart = Date.now();

    const parsed = await parseAgentResponse({
      responseText: response,
      packagePath: 'packages/utility/logger'
    });

    const parseDuration = Date.now() - parseStart;
    console.log(`✓ Parsed in ${parseDuration}ms`);
    console.log(`  Files: ${parsed.files.length}`);
    console.log(`  Summary: ${parsed.summary.substring(0, 60)}...`);

    // Show file list
    console.log('\n  File Operations:');
    parsed.files.forEach((f, i) => {
      const sizeKB = (f.content?.length || 0) / 1024;
      console.log(`    ${i + 1}. ${f.operation.toUpperCase()}: ${f.path} (${sizeKB.toFixed(1)}KB)`);
    });

    // Show meta-agent fields
    if (parsed.questions && parsed.questions.length > 0) {
      console.log(`\n  Questions: ${parsed.questions.length}`);
      parsed.questions.forEach((q, i) => {
        console.log(`    ${i + 1}. ${q.question}`);
      });
    }

    if (parsed.suggestions && parsed.suggestions.length > 0) {
      console.log(`\n  Suggestions: ${parsed.suggestions.length}`);
      parsed.suggestions.forEach((s, i) => {
        console.log(`    ${i + 1}. [${s.priority}] ${s.type}`);
      });
    }

    console.log();

    // Step 4: Apply File Changes
    console.log('[4/4] Creating files in workspace...');
    const applyStart = Date.now();

    const result = await applyFileChanges({
      operations: parsed.files,
      packagePath: 'packages/utility/logger',
      workspaceRoot: e2eWorkspace
    });

    const applyDuration = Date.now() - applyStart;
    console.log(`✓ Files created in ${applyDuration}ms`);
    console.log(`  Success: ${result.modifiedFiles.length} files`);
    console.log(`  Failed: ${result.failedOperations.length} operations\n`);

    if (result.failedOperations.length > 0) {
      console.warn('⚠️  Some operations failed:');
      result.failedOperations.forEach(f => {
        console.warn(`    - ${f.operation} ${f.path}: ${f.error}`);
      });
      console.log();
    }

    // Verification
    console.log('[Verification] Checking package structure...');

    const packageJsonPath = path.join(e2eWorkspace, 'packages/utility/logger/package.json');
    const tsconfigPath = path.join(e2eWorkspace, 'packages/utility/logger/tsconfig.json');
    const srcDir = path.join(e2eWorkspace, 'packages/utility/logger/src');
    const testsDir = path.join(e2eWorkspace, 'packages/utility/logger/tests');

    const checks = [
      { name: 'package.json', path: packageJsonPath },
      { name: 'tsconfig.json', path: tsconfigPath },
      { name: 'src/ directory', path: srcDir },
      { name: 'tests/ directory', path: testsDir }
    ];

    let passedChecks = 0;
    for (const check of checks) {
      try {
        await fs.access(check.path);
        console.log(`  ✓ ${check.name}`);
        passedChecks++;
      } catch (err) {
        console.warn(`  ❌ ${check.name} - missing`);
      }
    }

    // Check package.json validity
    if (passedChecks >= 1) {
      try {
        const pkgJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        console.log(`\n  Package Details:`);
        console.log(`    Name: ${pkgJson.name}`);
        console.log(`    Version: ${pkgJson.version}`);
        console.log(`    Type: ${pkgJson.type}`);
        console.log(`    Scripts: ${Object.keys(pkgJson.scripts || {}).join(', ')}`);

        if (parsed.qualityChecklist) {
          console.log(`\n  Quality Checklist:`);
          Object.entries(parsed.qualityChecklist).forEach(([key, value]) => {
            console.log(`    ${value ? '✓' : '❌'} ${key}`);
          });
        }
      } catch (err) {
        console.warn('  ⚠️  Could not parse package.json');
      }
    }

    // Final Summary
    const totalDuration = Date.now() - startTime;

    console.log('\n' + '═'.repeat(80));
    console.log('✅ End-to-End Test Complete!\n');

    console.log('Pipeline Performance:');
    console.log(`  1. Build Prompt:    ${promptDuration.toString().padStart(6)}ms`);
    console.log(`  2. Claude API:      ${claudeDuration.toString().padStart(6)}ms`);
    console.log(`  3. Parse Response:  ${parseDuration.toString().padStart(6)}ms`);
    console.log(`  4. Apply Files:     ${applyDuration.toString().padStart(6)}ms`);
    console.log(`  ${'─'.repeat(32)}`);
    console.log(`  Total:              ${totalDuration.toString().padStart(6)}ms (${(totalDuration / 1000).toFixed(2)}s)`);

    console.log('\nResults:');
    console.log(`  Files Created: ${result.modifiedFiles.length}`);
    console.log(`  Checks Passed: ${passedChecks}/${checks.length}`);
    console.log(`  Questions: ${parsed.questions?.length || 0}`);
    console.log(`  Suggestions: ${parsed.suggestions?.length || 0}`);

    console.log('\nCost Estimate:');
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(response.length / 4);
    const cost = (inputTokens / 1000) * 0.003 + (outputTokens / 1000) * 0.015;
    console.log(`  Input: ~${inputTokens} tokens × $3/MTok = $${((inputTokens / 1000) * 0.003).toFixed(4)}`);
    console.log(`  Output: ~${outputTokens} tokens × $15/MTok = $${((outputTokens / 1000) * 0.015).toFixed(4)}`);
    console.log(`  Total: ~$${cost.toFixed(4)}`);

    console.log('\nWorkspace:');
    console.log(`  📁 ${e2eWorkspace}/packages/utility/logger/`);

    console.log('═'.repeat(80));

    console.log('\n💡 Next Steps:');
    console.log('  1. Inspect the generated package in test-harness/output/e2e-test/');
    console.log('  2. Try running the package:');
    console.log(`     cd ${e2eWorkspace}/packages/utility/logger`);
    console.log('     npm install');
    console.log('     npm run build');
    console.log('     npm test');

  } catch (error) {
    console.error('\n❌ End-to-End Test Failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('401')) {
        console.error('\n💡 Check ANTHROPIC_API_KEY is valid');
      } else if (error.message.includes('timeout')) {
        console.error('\n💡 Request timed out - try reducing max_tokens');
      } else if (error.message.includes('JSON')) {
        console.error('\n💡 Response parsing failed - Claude may have returned invalid JSON');
      }
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
