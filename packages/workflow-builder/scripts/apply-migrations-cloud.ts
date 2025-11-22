/**
 * Apply migrations to cloud Supabase using service role
 * This script reads migration files and applies them via Supabase SQL API
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cloud Supabase credentials
const SUPABASE_URL = 'https://jeaudyvxapooyfddfptr.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYXVkeXZ4YXBvb3lmZGRmcHRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE1OTg1NywiZXhwIjoyMDc4NzM1ODU3fQ.MexKBJ6VY_4rctPxHOHCHjE0gsRmGyw4Mr4Rwp3FRRE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🚀 Cloud Supabase Migration Helper\n');
  console.log(`📍 Project: ${SUPABASE_URL}\n`);
  
  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();
  
  console.log(`📋 Found ${migrationFiles.length} migration files\n`);
  
  console.log('⚠️  Note: Supabase REST API cannot execute DDL statements directly.');
  console.log('📝 You need to apply migrations using one of these methods:\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Method 1: Supabase Dashboard SQL Editor (RECOMMENDED)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Go to: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new');
  console.log('2. Copy the contents of each migration file below');
  console.log('3. Paste into SQL editor and click "Run"');
  console.log('4. Repeat for each migration in order\n');
  
  console.log('Migration files (apply in this order):');
  migrationFiles.forEach((file, idx) => {
    const filePath = resolve(migrationsDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    console.log(`\n${idx + 1}. ${file} (${lines} lines)`);
    console.log(`   Path: ${filePath}`);
  });
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Method 2: After migrations, seed the database');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Run these scripts to create test users and seed data:');
  console.log('  1. tsx scripts/create-seed-auth-users.ts');
  console.log('  2. tsx scripts/create-test-user-and-seed.ts');
  console.log('\nThese will create:');
  console.log('  - test@example.com / testpassword123');
  console.log('  - admin@example.com / testpassword123');
  console.log('  - system@example.com (system user)');
  console.log('  - Demo workflows and components\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Quick Start:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Update .env.local to use cloud Supabase:');
  console.log('   NEXT_PUBLIC_SUPABASE_URL=https://jeaudyvxapooyfddfptr.supabase.co');
  console.log('   (Use the keys from .env.local.cloud)');
  console.log('');
  console.log('2. Apply migrations via Dashboard SQL Editor');
  console.log('');
  console.log('3. Run seed scripts');
  console.log('');
  console.log('4. Restart Next.js server');
  console.log('');
  console.log('5. Login with: test@example.com / testpassword123\n');
}

main().catch(console.error);

