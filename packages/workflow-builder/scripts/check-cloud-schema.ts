/**
 * Check cloud Supabase schema to see what's missing
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jeaudyvxapooyfddfptr.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYXVkeXZ4YXBvb3lmZGRmcHRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE1OTg1NywiZXhwIjoyMDc4NzM1ODU3fQ.MexKBJ6VY_4rctPxHOHCHjE0gsRmGyw4Mr4Rwp3FRRE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🔍 Checking cloud Supabase schema...\n');
  
  // Try to query workflows table to see what columns exist
  console.log('1️⃣ Checking workflows table structure...');
  const { data: workflows, error: workflowsError } = await supabase
    .from('workflows')
    .select('*')
    .limit(0);
  
  if (workflowsError) {
    console.error('   ❌ Error querying workflows:', workflowsError.message);
    console.error('   Code:', workflowsError.code);
    console.error('   Details:', workflowsError.details);
    console.error('   Hint:', workflowsError.hint);
    
    if (workflowsError.message.includes('does not exist')) {
      console.log('\n⚠️  The workflows table may not exist yet!');
      console.log('   You need to apply the initial schema migration first.');
      console.log('   Start with: 20251114000001_initial_schema.sql');
    }
  } else {
    console.log('   ✅ Workflows table exists');
  }
  
  // Check if we can query with is_archived
  console.log('\n2️⃣ Testing is_archived column...');
  const { error: archivedError } = await supabase
    .from('workflows')
    .select('id, is_archived')
    .limit(1);
  
  if (archivedError) {
    console.error('   ❌ is_archived column missing:', archivedError.message);
  } else {
    console.log('   ✅ is_archived column exists');
  }
  
  // List all tables
  console.log('\n3️⃣ Checking what tables exist...');
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  
  if (tablesError) {
    console.log('   ⚠️  Cannot query information_schema via REST API');
    console.log('   This is expected - REST API has limited access');
  } else if (tables) {
    console.log(`   Found ${tables.length} tables`);
    tables.slice(0, 10).forEach((t: any) => {
      console.log(`     - ${t.table_name}`);
    });
  }
  
  console.log('\n📝 Next steps:');
  console.log('1. Go to Supabase Dashboard SQL Editor');
  console.log('2. Run: scripts/quick-fix-cloud-schema.sql');
  console.log('3. If workflows table doesn\'t exist, apply 20251114000001_initial_schema.sql first');
  console.log('4. Check the SQL Editor for any error messages\n');
}

main().catch(console.error);

