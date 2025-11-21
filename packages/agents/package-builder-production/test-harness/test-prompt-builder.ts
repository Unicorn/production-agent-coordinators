#!/usr/bin/env tsx

/**
 * Test Harness: Prompt Builder
 *
 * Tests the buildAgentPrompt activity to ensure it generates proper prompts
 * with GitHub context, quality standards, and validation checklists.
 *
 * Usage: npx tsx test-harness/test-prompt-builder.ts
 */

import { buildAgentPrompt } from '../src/activities/prompt-builder.activities.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  console.log('🧪 Testing Prompt Builder...\n');

  const workspaceRoot = path.resolve(process.cwd(), '../../..');

  try {
    // Test 1: Basic prompt without GitHub context
    console.log('[Test 1] Basic prompt generation...');
    const basicPrompt = await buildAgentPrompt({
      agentName: 'package-development-agent',
      taskType: 'PACKAGE_SCAFFOLDING',
      instructions: 'Create logger package from plan',
      packagePath: 'packages/utility/logger',
      planPath: path.join(process.cwd(), 'test-harness/fixtures/sample-plan.md'),
      workspaceRoot,
      includeQualityStandards: false,
      includeFewShotExamples: false,
      includeValidationChecklist: false
    });

    console.log(`✓ Basic prompt generated (${basicPrompt.length} chars, ~${Math.ceil(basicPrompt.length / 4)} tokens)\n`);

    // Test 2: Enhanced prompt with quality standards
    console.log('[Test 2] Enhanced prompt with quality standards...');
    const enhancedPrompt = await buildAgentPrompt({
      agentName: 'package-development-agent',
      taskType: 'PACKAGE_SCAFFOLDING',
      instructions: 'Create logger package with strict type checking',
      packagePath: 'packages/utility/logger',
      planPath: path.join(process.cwd(), 'test-harness/fixtures/sample-plan.md'),
      workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: true,
      includeValidationChecklist: true
    });

    console.log(`✓ Enhanced prompt generated (${enhancedPrompt.length} chars, ~${Math.ceil(enhancedPrompt.length / 4)} tokens)\n`);

    // Verify enhanced prompt includes quality standards
    if (!enhancedPrompt.includes('QUALITY REQUIREMENTS')) {
      console.warn('⚠️  Warning: Enhanced prompt missing quality standards section');
    } else {
      console.log('✓ Quality standards section included');
    }

    if (!enhancedPrompt.includes('EXAMPLE OF CORRECT')) {
      console.warn('⚠️  Warning: Enhanced prompt missing few-shot examples');
    } else {
      console.log('✓ Few-shot examples included');
    }

    if (!enhancedPrompt.includes('BEFORE RETURNING YOUR RESPONSE')) {
      console.warn('⚠️  Warning: Enhanced prompt missing validation checklist');
    } else {
      console.log('✓ Validation checklist included');
    }

    // Test 3: Prompt with GitHub context
    console.log('\n[Test 3] Prompt with GitHub integration...');
    const githubToken = process.env.GITHUB_TOKEN;

    if (githubToken) {
      const githubPrompt = await buildAgentPrompt({
        agentName: 'package-development-agent',
        taskType: 'PACKAGE_SCAFFOLDING',
        instructions: 'Create logger package',
        packagePath: 'packages/utility/logger',
        planPath: path.join(process.cwd(), 'test-harness/fixtures/sample-plan.md'),
        workspaceRoot,
        githubContext: {
          token: githubToken,
          repo: 'your-org/production-agent-coordinators',
          branch: 'main'
        },
        includeQualityStandards: true,
        includeFewShotExamples: true,
        includeValidationChecklist: true
      });

      console.log(`✓ GitHub-enabled prompt generated (${githubPrompt.length} chars, ~${Math.ceil(githubPrompt.length / 4)} tokens)\n`);

      if (githubPrompt.includes('https://api.github.com')) {
        console.log('✓ GitHub API instructions included');
      } else {
        console.warn('⚠️  Warning: GitHub API instructions missing');
      }
    } else {
      console.log('⚠️  Skipped (GITHUB_TOKEN not set in environment)');
    }

    // Save prompts for inspection
    console.log('\n📝 Saving prompts for manual inspection...');

    const outputDir = path.join(process.cwd(), 'test-harness/output');
    await fs.mkdir(outputDir, { recursive: true });

    await fs.writeFile(
      path.join(outputDir, 'prompt-basic.txt'),
      basicPrompt,
      'utf-8'
    );
    console.log('  ✓ Saved: test-harness/output/prompt-basic.txt');

    await fs.writeFile(
      path.join(outputDir, 'prompt-enhanced.txt'),
      enhancedPrompt,
      'utf-8'
    );
    console.log('  ✓ Saved: test-harness/output/prompt-enhanced.txt');

    // Summary
    console.log('\n' + '─'.repeat(80));
    console.log('✅ Prompt Builder Test Complete!\n');
    console.log(`Basic Prompt: ${basicPrompt.length} chars (~${Math.ceil(basicPrompt.length / 4)} tokens)`);
    console.log(`Enhanced Prompt: ${enhancedPrompt.length} chars (~${Math.ceil(enhancedPrompt.length / 4)} tokens)`);
    console.log(`Size Increase: +${enhancedPrompt.length - basicPrompt.length} chars (+${Math.ceil((enhancedPrompt.length - basicPrompt.length) / 4)} tokens)`);
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
