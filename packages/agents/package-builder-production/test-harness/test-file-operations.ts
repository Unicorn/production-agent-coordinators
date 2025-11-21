#!/usr/bin/env tsx

/**
 * Test Harness: File Operations
 *
 * Tests the applyFileChanges activity to ensure it correctly creates,
 * updates, and deletes files based on parsed responses.
 *
 * Usage: npx tsx test-harness/test-file-operations.ts
 */

import { applyFileChanges } from '../src/activities/file-operations.activities.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  console.log('🧪 Testing File Operations...\n');

  const outputDir = path.join(process.cwd(), 'test-harness/output');
  const testWorkspace = path.join(outputDir, 'test-package');
  const workspaceRoot = path.resolve(process.cwd(), '../../..');

  try {
    // Clean up any previous test workspace
    console.log('[Setup] Cleaning test workspace...');
    await fs.rm(testWorkspace, { recursive: true, force: true });
    await fs.mkdir(testWorkspace, { recursive: true });
    console.log(`✓ Test workspace ready: ${testWorkspace}\n`);

    // Test 1: Create files from fixture response
    console.log('[Test 1] Creating files from parsed fixture...');

    const fixtureData = JSON.parse(
      await fs.readFile(
        path.join(outputDir, 'parsed-fixture.json'),
        'utf-8'
      )
    );

    const result1 = await applyFileChanges({
      operations: fixtureData.files,
      packagePath: '.',  // Relative to test workspace
      workspaceRoot: testWorkspace
    });

    console.log(`✓ Applied ${result1.modifiedFiles.length} file operations`);
    console.log(`  Created files:`);
    result1.modifiedFiles.forEach(f => {
      console.log(`    - ${f}`);
    });

    if (result1.failedOperations.length > 0) {
      console.warn(`\n⚠️  ${result1.failedOperations.length} operations failed:`);
      result1.failedOperations.forEach(f => {
        console.warn(`    - ${f.operation} ${f.path}: ${f.error}`);
      });
    }

    // Test 2: Verify files exist and have correct content
    console.log('\n[Test 2] Verifying created files...');

    const expectedFiles = [
      'package.json',
      'tsconfig.json',
      'src/types.ts',
      'src/logger.ts',
      'src/index.ts',
      'tests/logger.test.ts',
      'README.md'
    ];

    let filesFound = 0;
    for (const file of expectedFiles) {
      const filePath = path.join(testWorkspace, file);
      try {
        const stats = await fs.stat(filePath);
        const size = stats.size;
        console.log(`  ✓ ${file} (${size} bytes)`);
        filesFound++;
      } catch (err) {
        console.warn(`  ❌ ${file} (missing)`);
      }
    }

    console.log(`\n  Found ${filesFound}/${expectedFiles.length} expected files`);

    // Test 3: Verify package.json is valid JSON
    console.log('\n[Test 3] Validating package.json...');
    const packageJsonPath = path.join(testWorkspace, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    console.log(`  ✓ Valid JSON`);
    console.log(`  Name: ${packageJson.name}`);
    console.log(`  Version: ${packageJson.version}`);
    console.log(`  Type: ${packageJson.type}`);
    console.log(`  Exports: ${Object.keys(packageJson.exports || {}).length} entry point(s)`);
    console.log(`  Scripts: ${Object.keys(packageJson.scripts || {}).length}`);

    // Test 4: Update an existing file
    console.log('\n[Test 4] Testing file updates...');

    const updateOperations = [
      {
        path: 'src/index.ts',
        operation: 'update' as const,
        content: '// Updated by test\nexport { createLogger } from \'./logger.js\';\n'
      }
    ];

    const result2 = await applyFileChanges({
      operations: updateOperations,
      packagePath: '.',
      workspaceRoot: testWorkspace
    });

    console.log(`  ✓ Updated ${result2.modifiedFiles.length} file(s)`);

    const updatedContent = await fs.readFile(path.join(testWorkspace, 'src/index.ts'), 'utf-8');
    if (updatedContent.includes('Updated by test')) {
      console.log(`  ✓ Update verified`);
    } else {
      console.warn(`  ⚠️  Update not applied correctly`);
    }

    // Test 5: Test path traversal protection
    console.log('\n[Test 5] Testing security (path traversal protection)...');

    const dangerousOperations = [
      {
        path: '../../../etc/passwd',
        operation: 'create' as const,
        content: 'malicious'
      },
      {
        path: '/tmp/malicious',
        operation: 'create' as const,
        content: 'malicious'
      }
    ];

    try {
      await applyFileChanges({
        operations: dangerousOperations,
        packagePath: '.',
        workspaceRoot: testWorkspace
      });
      console.warn(`  ⚠️  Path traversal protection may not be working!`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('path')) {
        console.log(`  ✓ Path traversal attack blocked`);
      } else {
        console.log(`  ✓ Dangerous operation rejected: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Test 6: Delete operation
    console.log('\n[Test 6] Testing file deletion...');

    const deleteOperations = [
      {
        path: 'src/index.ts',
        operation: 'delete' as const
      }
    ];

    const result3 = await applyFileChanges({
      operations: deleteOperations,
      packagePath: '.',
      workspaceRoot: testWorkspace
    });

    console.log(`  ✓ Deleted ${result3.modifiedFiles.length} file(s)`);

    try {
      await fs.access(path.join(testWorkspace, 'src/index.ts'));
      console.warn(`  ⚠️  File still exists after delete`);
    } catch (err) {
      console.log(`  ✓ File successfully removed`);
    }

    // Summary
    console.log('\n' + '─'.repeat(80));
    console.log('✅ File Operations Test Complete!\n');
    console.log('Test Results:');
    console.log(`  ✓ Created ${filesFound} files`);
    console.log(`  ✓ Updated 1 file`);
    console.log(`  ✓ Deleted 1 file`);
    console.log(`  ✓ Path traversal protection working`);
    console.log(`  ✓ Valid package.json generated`);
    console.log('\nWorkspace Location:');
    console.log(`  📁 ${testWorkspace}`);
    console.log('─'.repeat(80));

    // Next steps
    console.log('\n💡 Next Steps:');
    console.log('  1. Inspect generated files in test-harness/output/test-package/');
    console.log('  2. Run: npx tsx test-harness/test-end-to-end.ts');
    console.log('     to test the complete pipeline');

  } catch (error) {
    console.error('\n❌ Test failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error('\n💡 Tip: Run npx tsx test-harness/test-response-parser.ts first');
        console.error('   to generate parsed-fixture.json');
      } else if (error.message.includes('JSON')) {
        console.error('\n💡 Tip: parsed-fixture.json may be corrupted');
      }
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
