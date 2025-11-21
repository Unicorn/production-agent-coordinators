import * as activities from './dist/activities/index.js';

const exported = Object.keys(activities).filter(k => k !== 'ALL_ACTIVITY_NAMES' && k !== 'default');
console.log(`\n✅ Exported ${exported.length} activities from barrel file:`);
exported.sort().forEach(name => console.log(`   - ${name}`));

// Check if critical activities are present
const critical = ['executeAgentTask', 'analyzeProblem', 'parsePlanFile'];
const missing = critical.filter(a => !exported.includes(a));

if (missing.length > 0) {
  console.error(`\n❌ Missing critical activities: ${missing.join(', ')}`);
  process.exit(1);
} else {
  console.log('\n✅ All critical activities present\n');
}
