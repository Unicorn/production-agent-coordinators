#!/usr/bin/env tsx
/**
 * Prepare Migrations for Supabase Dashboard
 * 
 * Outputs all migrations in a format ready to copy-paste into Supabase Dashboard
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('📋 Preparing Migrations for Supabase Dashboard\n');
  console.log('='.repeat(60));
  console.log('INSTRUCTIONS:');
  console.log('='.repeat(60));
  console.log('1. Go to: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new');
  console.log('2. Copy and paste each migration below in order');
  console.log('3. Click "Run" for each migration');
  console.log('4. Verify success before moving to next migration\n');
  console.log('='.repeat(60) + '\n');

  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const allFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();

  console.log(`📋 Total migrations: ${allFiles.length}\n`);

  allFiles.forEach((filename, index) => {
    const filePath = resolve(migrationsDir, filename);
    const sql = readFileSync(filePath, 'utf-8');
    
    console.log('\n' + '='.repeat(60));
    console.log(`Migration ${index + 1}/${allFiles.length}: ${filename}`);
    console.log('='.repeat(60));
    console.log(sql);
    console.log('\n--- End of migration ---\n');
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ All migrations prepared!');
  console.log('='.repeat(60));
  console.log('\n💡 Tip: Run migrations in batches of 5-10 for easier tracking');
}

main().catch(console.error);

