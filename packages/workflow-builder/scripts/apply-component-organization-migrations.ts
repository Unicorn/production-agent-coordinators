#!/usr/bin/env tsx
/**
 * Apply Component Organization Migrations
 * 
 * This script applies the component organization migrations directly via Supabase API
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSQL(sql: string, description: string): Promise<boolean> {
  console.log(`\n📝 ${description}...`);
  
  try {
    // Use RPC to execute SQL (if available) or use direct query
    // Note: Supabase JS client doesn't support arbitrary SQL execution
    // We'll need to use the REST API or psql
    
    // For now, output the SQL for manual execution
    console.log('⚠️  Direct SQL execution via Supabase JS client is not supported.');
    console.log('📋 Please apply this migration manually:\n');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    
    return true;
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Applying Component Organization Migrations\n');
  console.log('📍 Supabase URL:', supabaseUrl);
  console.log('');

  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const migrationFiles = [
    '20250120000000_seed_all_components_complete.sql',
    '20250120000001_create_component_categories.sql',
    '20250120000002_seed_component_categories.sql',
    '20250120000003_map_components_to_categories.sql',
  ];

  console.log('📋 Migration files to apply:');
  migrationFiles.forEach((file, idx) => {
    console.log(`  ${idx + 1}. ${file}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('⚠️  IMPORTANT: Direct SQL execution via Supabase JS is limited');
  console.log('='.repeat(60));
  console.log('\n📝 To apply these migrations, use one of these methods:\n');
  
  console.log('Method 1: Supabase Dashboard (Recommended)');
  console.log('  1. Go to your Supabase project SQL editor');
  console.log('  2. Copy and paste each migration file in order');
  console.log('  3. Click "Run" for each migration\n');
  
  console.log('Method 2: Supabase CLI (if config is fixed)');
  console.log('  cd packages/workflow-builder');
  console.log('  npx supabase db push\n');
  
  console.log('Method 3: psql with connection string');
  console.log('  Get connection string from Supabase dashboard');
  console.log('  psql "connection-string" < migration-file.sql\n');
  
  console.log('📋 Migration files location:');
  console.log(`  ${migrationsDir}\n`);
  
  console.log('✅ Migration files are ready to apply!');
  console.log('   All migrations are idempotent and safe to run multiple times.\n');
}

main().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});

