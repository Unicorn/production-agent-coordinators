#!/usr/bin/env tsx

/**
 * Test Harness: Claude Execution
 *
 * Tests the executeAgentWithClaude activity to ensure it properly calls
 * the Anthropic API and returns valid responses.
 *
 * Usage: npx tsx test-harness/test-claude-execution.ts
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable must be set
 */

import { executeAgentWithClaude } from '../src/activities/agent-execution.activities.js';
import { buildAgentPrompt } from '../src/activities/prompt-builder.activities.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  console.log('🧪 Testing Claude Execution...\n');

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required');
    console.error('   Set it with: export ANTHROPIC_API_KEY=your-key-here');
    process.exit(1);
  }

  const workspaceRoot = path.resolve(process.cwd(), '../../..');

  try {
    // Step 1: Build a test prompt
    console.log('[1/3] Building test prompt...');
    const prompt = await buildAgentPrompt({
      agentName: 'package-development-agent',
      taskType: 'PACKAGE_SCAFFOLDING',
      instructions: 'Create a simple logger package with console transport only',
      packagePath: 'packages/utility/logger',
      planPath: path.join(process.cwd(), 'test-harness/fixtures/sample-plan.md'),
      workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: true,
      includeValidationChecklist: true
    });

    console.log(`✓ Prompt built (${prompt.length} chars, ~${Math.ceil(prompt.length / 4)} tokens)\n`);

    // Step 2: Execute with Claude
    console.log('[2/3] Calling Claude API...');
    console.log('  Model: claude-sonnet-4-5-20250929');
    console.log('  Temperature: 0.2');
    console.log('  Max Tokens: 8000\n');

    const startTime = Date.now();

    const response = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.2,
      maxTokens: 8000
    });

    const duration = Date.now() - startTime;

    console.log(`✓ Claude responded in ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`✓ Response length: ${response.length} chars\n`);

    // Step 3: Analyze response
    console.log('[3/3] Analyzing response...');

    // Check if response looks like JSON
    const trimmed = response.trim();
    const looksLikeJson = (trimmed.startsWith('{') || trimmed.startsWith('```')) &&
                          (trimmed.includes('"files"') || trimmed.includes('"summary"'));

    if (looksLikeJson) {
      console.log('✓ Response appears to be JSON format');
    } else {
      console.warn('⚠️  Warning: Response does not appear to be JSON');
    }

    // Check for markdown code blocks
    if (trimmed.startsWith('```')) {
      console.log('✓ Response wrapped in markdown code block (will be stripped by parser)');
    }

    // Check for required fields
    const hasFiles = response.includes('"files"');
    const hasSummary = response.includes('"summary"');
    const hasQualityChecklist = response.includes('"qualityChecklist"');

    console.log(`${hasFiles ? '✓' : '❌'} Contains "files" field`);
    console.log(`${hasSummary ? '✓' : '❌'} Contains "summary" field`);
    console.log(`${hasQualityChecklist ? '✓' : '⚠️ '} Contains "qualityChecklist" field ${hasQualityChecklist ? '' : '(optional)'}`);

    // Check for optional meta-agent fields
    const hasQuestions = response.includes('"questions"');
    const hasSuggestions = response.includes('"suggestions"');
    const hasFilesToFetch = response.includes('"filesToFetch"');

    if (hasQuestions || hasSuggestions || hasFilesToFetch) {
      console.log('\nMeta-agent fields detected:');
      if (hasQuestions) console.log('  ✓ questions');
      if (hasSuggestions) console.log('  ✓ suggestions');
      if (hasFilesToFetch) console.log('  ✓ filesToFetch');
    }

    // Save response
    console.log('\n📝 Saving response...');
    const outputDir = path.join(process.cwd(), 'test-harness/output');
    await fs.mkdir(outputDir, { recursive: true });

    await fs.writeFile(
      path.join(outputDir, 'claude-response.txt'),
      response,
      'utf-8'
    );
    console.log('  ✓ Saved: test-harness/output/claude-response.txt');

    // Save response preview
    const preview = `Response from Claude (${new Date().toISOString()})
Model: claude-sonnet-4-5-20250929
Duration: ${duration}ms
Length: ${response.length} chars

Preview (first 1000 chars):
${response.substring(0, 1000)}

... (see claude-response.txt for full response)
`;

    await fs.writeFile(
      path.join(outputDir, 'claude-response-preview.txt'),
      preview,
      'utf-8'
    );
    console.log('  ✓ Saved: test-harness/output/claude-response-preview.txt');

    // Summary
    console.log('\n' + '─'.repeat(80));
    console.log('✅ Claude Execution Test Complete!\n');
    console.log(`Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`Response Size: ${response.length} chars`);
    console.log(`Estimated Cost: ~$${((Math.ceil(prompt.length / 4) / 1000) * 0.003 + (Math.ceil(response.length / 4) / 1000) * 0.015).toFixed(4)}`);
    console.log('  (Based on Sonnet 4.5 pricing: $3/MTok input, $15/MTok output)');
    console.log('─'.repeat(80));

    // Recommendation
    console.log('\n💡 Next Steps:');
    console.log('  1. Review the response in test-harness/output/claude-response.txt');
    console.log('  2. Run: npx tsx test-harness/test-response-parser.ts');
    console.log('     to test parsing the response');

  } catch (error) {
    console.error('\n❌ Test failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('authentication')) {
        console.error('\n💡 Tip: Check that your ANTHROPIC_API_KEY is valid');
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        console.error('\n💡 Tip: Rate limit exceeded. Wait a moment and try again');
      } else if (error.message.includes('timeout')) {
        console.error('\n💡 Tip: Request timed out. Try reducing max_tokens or simplifying the prompt');
      }
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
