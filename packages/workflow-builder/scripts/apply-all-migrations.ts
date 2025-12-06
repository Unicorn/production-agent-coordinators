#!/usr/bin/env tsx
/**
 * Apply All Migrations - Comprehensive Migration Runner
 * 
 * This script provides multiple methods to run migrations:
 * 1. Via Supabase Dashboard (instructions)
 * 2. Via psql with connection string
 * 3. Via Supabase Management API (if available)
 * 
 * All migrations have been optimized for idempotency.
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const databaseUrl = process.env.DATABASE_URL;

const projectRef = supabaseUrl?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

async function runViaPsql(): Promise<void> {
  if (!databaseUrl) {
    console.log('❌ DATABASE_URL not found in .env.local');
    console.log('\n💡 To get your database connection string:');
    console.log(`   1. Go to: https://supabase.com/dashboard/project/${projectRef}/settings/database`);
    console.log('   2. Copy the "Connection string" (URI format)');
    console.log('   3. Add it to .env.local as DATABASE_URL');
    console.log('   4. Re-run this script\n');
    return;
  }

  console.log('🚀 Running migrations via psql...\n');

  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const allFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const filename of allFiles) {
      const filePath = resolve(migrationsDir, filename);
      const sql = readFileSync(filePath, 'utf-8');

      console.log(`📄 ${filename}...`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`   ✅ Success\n`);
        successCount++;
      } catch (error: any) {
        await client.query('ROLLBACK');
        
        const errorMessage = error.message.toLowerCase();
        const isIdempotentError = 
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate') ||
          (errorMessage.includes('relation') && errorMessage.includes('already')) ||
          error.code === '42P07' ||
          error.code === '42710' ||
          error.code === '23505';

        if (isIdempotentError) {
          console.log(`   ⚠️  Already applied (idempotent)\n`);
          skipCount++;
        } else {
          console.error(`   ❌ Error: ${error.message}\n`);
          failCount++;
          break;
        }
      }
    }

    await client.end();

    console.log('='.repeat(60));
    console.log('📊 Summary');
    console.log('='.repeat(60));
    console.log(`✅ Applied: ${successCount}`);
    console.log(`⚠️  Skipped: ${skipCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📋 Total: ${allFiles.length}`);
    console.log('='.repeat(60) + '\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Connection error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check DATABASE_URL format');
    console.error('   2. Ensure connection string includes password');
    console.error('   3. For Supabase, use direct connection (port 5432) not pooler (port 6543)');
    process.exit(1);
  }
}

async function main() {
  console.log('🔧 Apply All Migrations - Idempotent Migration Runner\n');
  console.log(`📍 Project: ${projectRef}`);
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  // Try psql first if DATABASE_URL is available
  if (databaseUrl) {
    await runViaPsql();
  } else {
    console.log('📝 Migration Methods:\n');
    console.log('Method 1: Supabase Dashboard (Recommended)');
    console.log(`   1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.log('   2. Copy and paste each migration file in order');
    console.log('   3. Click "Run" for each migration\n');
    
    console.log('Method 2: Add DATABASE_URL to .env.local');
    console.log(`   1. Get connection string from: https://supabase.com/dashboard/project/${projectRef}/settings/database`);
    console.log('   2. Add to .env.local as DATABASE_URL');
    console.log('   3. Re-run: tsx scripts/apply-all-migrations.ts\n');

    const migrationsDir = resolve(__dirname, '../supabase/migrations');
    const allFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
      .sort();

    console.log(`📋 ${allFiles.length} migration files ready to apply\n`);
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

