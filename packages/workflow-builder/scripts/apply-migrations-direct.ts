/**
 * Apply database migrations directly via Supabase postgREST
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Applying migrations to Supabase...\n');
  
  // Read migration 1
  const migration1Path = resolve(__dirname, '../supabase/migrations/20251116000001_add_advanced_workflow_patterns.sql');
  const sql = readFileSync(migration1Path, 'utf-8');
  
  console.log('📄 Migration file read successfully');
  console.log(`   Size: ${(sql.length / 1024).toFixed(2)} KB`);
  console.log(`   Lines: ${sql.split('\n').length}`);
  
  console.log('\n⚠️  To apply this migration, please:');
  console.log('\n1. Go to: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new');
  console.log('\n2. Copy the entire contents of:');
  console.log('   packages/workflow-builder/supabase/migrations/20251116000001_add_advanced_workflow_patterns.sql');
  console.log('\n3. Paste into the SQL editor');
  console.log('\n4. Click "Run" (bottom right)');
  console.log('\n5. (Optional) Repeat for migration 20251116000002 (seed data)');
  
  console.log('\n✅ This will create:');
  console.log('   - 3 new tables (workflow_work_queues, workflow_signals, workflow_queries)');
  console.log('   - Extended workflows table (scheduled workflow support)');
  console.log('   - Extended workflow_nodes table (parent communication)');
  console.log('   - RLS policies and triggers');
  
  console.log('\n📖 See APPLY_MIGRATIONS.md for detailed instructions\n');
}

main();

