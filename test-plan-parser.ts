import { parsePlanFileWithAgent } from './packages/agents/package-builder-production/src/activities/agentic-plan-parser.activities.js';

async function test() {
  console.log('Testing parsePlanFileWithAgent...\n');

  try {
    const result = await parsePlanFileWithAgent({
      workspaceRoot: '/Users/mattbernier/projects/tools',
      planPath: 'plans/packages/service/ai-content-generator.md'
    });

    console.log('✅ Parsed packages:');
    console.log(`Total packages: ${result.length}\n`);

    result.forEach((pkg, i) => {
      console.log(`${i + 1}. ${pkg.name}`);
      console.log(`   Category: ${pkg.category}`);
      console.log(`   Layer: ${pkg.layer}`);
      console.log(`   Dependencies: ${pkg.dependencies.join(', ') || '(none)'}`);
      console.log(`   Build Status: ${pkg.buildStatus}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();
