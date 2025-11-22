/**
 * Seed Components and Agents to Cloud Supabase
 * 
 * This script applies the component seed migration to the cloud database
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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🌱 Seeding Components and Agents to Cloud Supabase\n');
  console.log(`📍 Project: ${supabaseUrl}\n`);
  
  const migrationPath = resolve(__dirname, '../supabase/migrations/20251118000002_seed_public_components.sql');
  
  console.log('📄 Reading seed migration file...');
  const sql = readFileSync(migrationPath, 'utf-8');
  console.log(`   ✅ Read ${sql.length} characters\n`);
  
  console.log('⚠️  Note: Supabase REST API cannot execute DDL statements directly.');
  console.log('📝 You need to apply this migration via Supabase Dashboard SQL Editor:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('INSTRUCTIONS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Go to: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new');
  console.log('2. Copy the ENTIRE contents of:');
  console.log(`   ${migrationPath}`);
  console.log('3. Paste into SQL Editor');
  console.log('4. Click "Run" (bottom right)');
  console.log('5. Wait for "Success" message\n');
  
  console.log('This migration will seed:');
  console.log('  ✅ Activity components (HTTP, Database, File operations, etc.)');
  console.log('  ✅ Agent components (MockAgent, etc.)');
  console.log('  ✅ Trigger components (Manual, Scheduled, Webhook, etc.)');
  console.log('  ✅ System user and task queue');
  console.log('  ✅ Component visibility settings\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ALTERNATIVE: Run via psql if you have database connection string');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Get connection string from:');
  console.log('  https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/settings/database');
  console.log('\nThen run:');
  console.log(`  psql "YOUR_CONNECTION_STRING" -f ${migrationPath}\n`);
}

main().catch(console.error);

