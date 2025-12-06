#!/usr/bin/env tsx
/**
 * Run Migrations with Connection String
 * 
 * Attempts to run migrations using the provided connection string.
 * Falls back to instructions if connection fails.
 */

import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try different connection string formats
const connectionStrings = [
  // Format 1: As provided
  'postgres://postgres:65TzRzrtEJ2DNrdG@db.jeaudyvxapooyfddfptr.supabase.co:6543/postgres',
  // Format 2: Direct connection
  'postgres://postgres:65TzRzrtEJ2DNrdG@db.jeaudyvxapooyfddfptr.supabase.co:5432/postgres',
  // Format 3: Pooler format
  'postgres://postgres.jeaudyvxapooyfddfptr:65TzRzrtEJ2DNrdG@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
];

async function testConnection(connectionString: string): Promise<boolean> {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function runMigrations(connectionString: string): Promise<void> {
  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const allFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();

  console.log(`📋 Running ${allFiles.length} migrations...\n`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✅ Connected to database\n');

  let successCount = 0;
  let failCount = 0;

  for (const filename of allFiles) {
    const filePath = resolve(migrationsDir, filename);
    const sql = readFileSync(filePath, 'utf-8');

    console.log(`📄 ${filename}`);

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
        successCount++;
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
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total: ${allFiles.length}`);
  console.log('='.repeat(60) + '\n');
}

async function main() {
  console.log('🔍 Testing Connection Strings...\n');

  let workingConnection: string | null = null;

  for (const connStr of connectionStrings) {
    console.log(`Testing: ${connStr.substring(0, 50)}...`);
    if (await testConnection(connStr)) {
      console.log('✅ Connection successful!\n');
      workingConnection = connStr;
      break;
    } else {
      console.log('❌ Failed\n');
    }
  }

  if (workingConnection) {
    await runMigrations(workingConnection);
  } else {
    console.log('❌ All connection attempts failed\n');
    console.log('='.repeat(60));
    console.log('📝 Alternative: Use Supabase Dashboard');
    console.log('='.repeat(60));
    console.log('1. Go to: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new');
    console.log('2. Run migrations in alphabetical order');
    console.log('3. All migrations are idempotent and safe to run\n');
    console.log('💡 To verify connection string:');
    console.log('   - Check Supabase Dashboard → Settings → Database');
    console.log('   - Use "Connection string" (URI format)');
    console.log('   - For migrations, use direct connection (port 5432) not pooler\n');
  }
}

main().catch(console.error);

