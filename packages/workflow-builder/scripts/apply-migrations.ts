/**
 * Apply database migrations to Supabase
 * Run with: tsx scripts/apply-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration(filename: string, sql: string) {
  console.log(`\n📄 Running migration: ${filename}`);
  console.log('─'.repeat(60));

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      console.error(`❌ Error in ${filename}:`, error.message);
      return false;
    }

    console.log(`✅ Migration ${filename} completed successfully`);
    return true;
  } catch (err: any) {
    console.error(`❌ Exception in ${filename}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting migration process...\n');

  // Read migration files
  const migration1Path = resolve(__dirname, '../supabase/migrations/20251116000001_add_advanced_workflow_patterns.sql');
  const migration2Path = resolve(__dirname, '../supabase/migrations/20251116000002_seed_advanced_patterns.sql');

  let migration1: string;
  let migration2: string;

  try {
    migration1 = readFileSync(migration1Path, 'utf-8');
    migration2 = readFileSync(migration2Path, 'utf-8');
  } catch (err: any) {
    console.error('❌ Error reading migration files:', err.message);
    process.exit(1);
  }

  // Run migrations in order
  let success = true;

  // Migration 1: Schema changes
  success = await runMigration('20251116000001_add_advanced_workflow_patterns.sql', migration1);
  
  if (!success) {
    console.error('\n❌ Migration 1 failed. Stopping here.');
    process.exit(1);
  }

  // Migration 2: Seed data
  success = await runMigration('20251116000002_seed_advanced_patterns.sql', migration2);

  if (!success) {
    console.warn('\n⚠️  Migration 2 (seed data) failed. This is OK if no users exist yet.');
    console.log('You can run it again after creating your first user.');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Migration process complete!');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

