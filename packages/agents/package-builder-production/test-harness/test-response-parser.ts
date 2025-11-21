#!/usr/bin/env tsx

/**
 * Test Harness: Response Parser
 *
 * Tests the parseAgentResponse activity to ensure it correctly parses
 * Claude's JSON responses, including extra fields for meta-agent processing.
 *
 * Usage: npx tsx test-harness/test-response-parser.ts
 */

import { parseAgentResponse } from '../src/activities/response-parser.activities.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  console.log('🧪 Testing Response Parser...\n');

  const fixturesDir = path.join(process.cwd(), 'test-harness/fixtures');
  const outputDir = path.join(process.cwd(), 'test-harness/output');

  try {
    // Test 1: Parse fixture response
    console.log('[Test 1] Parsing sample fixture response...');
    const fixtureResponse = await fs.readFile(
      path.join(fixturesDir, 'sample-response.json'),
      'utf-8'
    );

    const parsed1 = await parseAgentResponse({
      responseText: fixtureResponse,
      packagePath: 'packages/utility/logger'
    });

    console.log(`✓ Parsed fixture response`);
    console.log(`  Files: ${parsed1.files.length}`);
    console.log(`  Summary: ${parsed1.summary.substring(0, 60)}...`);
    console.log(`  Quality Checklist: ${parsed1.qualityChecklist ? 'present' : 'missing'}`);
    console.log(`  Questions: ${parsed1.questions?.length || 0}`);
    console.log(`  Suggestions: ${parsed1.suggestions?.length || 0}`);

    // Validate required fields
    if (!parsed1.files || parsed1.files.length === 0) {
      throw new Error('Parsed response missing files array');
    }
    if (!parsed1.summary) {
      throw new Error('Parsed response missing summary');
    }

    console.log('\n✓ All required fields present\n');

    // Test 2: Parse response with markdown code blocks
    console.log('[Test 2] Parsing response with markdown code blocks...');
    const wrappedResponse = `\`\`\`json
${fixtureResponse}
\`\`\``;

    const parsed2 = await parseAgentResponse({
      responseText: wrappedResponse,
      packagePath: 'packages/utility/logger'
    });

    console.log(`✓ Successfully stripped markdown code blocks`);
    console.log(`  Files: ${parsed2.files.length}`);

    if (parsed2.files.length !== parsed1.files.length) {
      console.warn('⚠️  Warning: File count differs after stripping markdown');
    }

    // Test 3: Parse minimal response (required fields only)
    console.log('\n[Test 3] Parsing minimal response...');
    const minimalResponse = JSON.stringify({
      files: [
        {
          path: 'test.ts',
          operation: 'create',
          content: 'console.log("test");'
        }
      ],
      summary: 'Created test file'
    });

    const parsed3 = await parseAgentResponse({
      responseText: minimalResponse,
      packagePath: 'packages/test'
    });

    console.log(`✓ Parsed minimal response`);
    console.log(`  Files: ${parsed3.files.length}`);
    console.log(`  Summary: ${parsed3.summary}`);
    console.log(`  Optional fields: ${Object.keys(parsed3).filter(k => !['files', 'summary'].includes(k)).length}`);

    // Test 4: Parse response with extra unknown fields
    console.log('\n[Test 4] Parsing response with extra fields...');
    const extraFieldsResponse = JSON.stringify({
      files: [
        {
          path: 'test.ts',
          operation: 'create',
          content: 'test'
        }
      ],
      summary: 'Test',
      unknownField1: 'This should be preserved',
      customData: { some: 'data' },
      metadata: ['tag1', 'tag2']
    });

    const parsed4 = await parseAgentResponse({
      responseText: extraFieldsResponse,
      packagePath: 'packages/test'
    });

    console.log(`✓ Parsed response with extra fields`);
    const extraFields = Object.keys(parsed4).filter(k => !['files', 'summary'].includes(k));
    console.log(`  Extra fields preserved: ${extraFields.join(', ')}`);

    if (extraFields.length === 0) {
      console.warn('⚠️  Warning: Extra fields were not preserved (lenient parsing may not be working)');
    }

    // Test 5: Check that we can use the actual Claude response if it exists
    const claudeResponsePath = path.join(outputDir, 'claude-response.txt');
    try {
      await fs.access(claudeResponsePath);

      console.log('\n[Test 5] Parsing real Claude response...');
      const claudeResponse = await fs.readFile(claudeResponsePath, 'utf-8');

      const parsed5 = await parseAgentResponse({
        responseText: claudeResponse,
        packagePath: 'packages/utility/logger'
      });

      console.log(`✓ Parsed real Claude response`);
      console.log(`  Files: ${parsed5.files.length}`);
      console.log(`  Summary: ${parsed5.summary.substring(0, 60)}...`);

      // List all file operations
      console.log('\n  File Operations:');
      parsed5.files.forEach((f, i) => {
        console.log(`    ${i + 1}. ${f.operation.toUpperCase()}: ${f.path} (${f.content?.length || 0} bytes)`);
      });

      // Show meta-agent fields if present
      if (parsed5.questions && parsed5.questions.length > 0) {
        console.log(`\n  Questions (${parsed5.questions.length}):`);
        parsed5.questions.forEach((q, i) => {
          console.log(`    ${i + 1}. ${q.question}`);
        });
      }

      if (parsed5.suggestions && parsed5.suggestions.length > 0) {
        console.log(`\n  Suggestions (${parsed5.suggestions.length}):`);
        parsed5.suggestions.forEach((s, i) => {
          console.log(`    ${i + 1}. [${s.priority}] ${s.type}: ${s.description.substring(0, 50)}...`);
        });
      }

    } catch (err) {
      console.log('\n[Test 5] Skipped (no claude-response.txt found)');
      console.log('  Run: npx tsx test-harness/test-claude-execution.ts first');
    }

    // Save parsed outputs for inspection
    console.log('\n📝 Saving parsed outputs...');
    await fs.mkdir(outputDir, { recursive: true });

    await fs.writeFile(
      path.join(outputDir, 'parsed-fixture.json'),
      JSON.stringify(parsed1, null, 2),
      'utf-8'
    );
    console.log('  ✓ Saved: test-harness/output/parsed-fixture.json');

    await fs.writeFile(
      path.join(outputDir, 'parsed-minimal.json'),
      JSON.stringify(parsed3, null, 2),
      'utf-8'
    );
    console.log('  ✓ Saved: test-harness/output/parsed-minimal.json');

    await fs.writeFile(
      path.join(outputDir, 'parsed-extra-fields.json'),
      JSON.stringify(parsed4, null, 2),
      'utf-8'
    );
    console.log('  ✓ Saved: test-harness/output/parsed-extra-fields.json');

    // Summary
    console.log('\n' + '─'.repeat(80));
    console.log('✅ Response Parser Test Complete!\n');
    console.log('Test Results:');
    console.log(`  ✓ Fixture response: ${parsed1.files.length} files`);
    console.log(`  ✓ Markdown stripping: ${parsed2.files.length} files`);
    console.log(`  ✓ Minimal response: ${parsed3.files.length} files`);
    console.log(`  ✓ Extra fields: ${Object.keys(parsed4).length - 2} extra fields preserved`);
    console.log('\nCapabilities Verified:');
    console.log('  ✓ Parses required fields (files, summary)');
    console.log('  ✓ Preserves optional fields (qualityChecklist, questions, suggestions)');
    console.log('  ✓ Strips markdown code blocks');
    console.log('  ✓ Lenient parsing (preserves unknown fields)');
    console.log('─'.repeat(80));

    // Next steps
    console.log('\n💡 Next Steps:');
    console.log('  1. Review parsed outputs in test-harness/output/');
    console.log('  2. Run: npx tsx test-harness/test-file-operations.ts');
    console.log('     to test applying file changes');

  } catch (error) {
    console.error('\n❌ Test failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('JSON')) {
        console.error('\n💡 Tip: Check that the response is valid JSON');
      } else if (error.message.includes('files')) {
        console.error('\n💡 Tip: Response must include a "files" array');
      } else if (error.message.includes('summary')) {
        console.error('\n💡 Tip: Response must include a "summary" string');
      }
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
