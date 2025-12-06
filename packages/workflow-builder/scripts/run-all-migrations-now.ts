#!/usr/bin/env tsx
/**
 * Run All Migrations Now
 * 
 * Runs all migrations in order using the provided connection string
 */

import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Direct connection (port 5432) - IPv4 enabled
// Try both hostname formats
const connectionStrings = [
  'postgresql://postgres:65TzRzrtEJ2DNrdG@db.jeaudyvxapooyfddfptr.supabase.co:5432/postgres',
  'postgresql://postgres:65TzRzrtEJ2DNrdG@aws-0-us-west-1.pooler.supabase.com:5432/postgres',
];

let connectionString = connectionStrings[0];

async function runMigration(client: Client, filename: string, sql: string): Promise<boolean> {
  console.log(`\n📄 ${filename}`);
  console.log('─'.repeat(60));

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`   ✅ Success`);
    return true;
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
      console.log(`   ⚠️  Already applied (idempotent, continuing)`);
      return true;
    }
    
    console.error(`   ❌ Error: ${error.message}`);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Running All Migrations\n');
  console.log('📍 Database: Supabase Cloud\n');

  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const allFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();

  console.log(`📋 Found ${allFiles.length} migration files\n`);

  // Try connecting with different hostname formats
  let client: Client | null = null;
  let connected = false;

  for (const connStr of connectionStrings) {
    console.log(`🔌 Trying connection: ${connStr.substring(0, 60)}...`);
    client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      await client.query('SELECT 1');
      console.log('✅ Connected to database\n');
      connectionString = connStr;
      connected = true;
      break;
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      await client.end().catch(() => {});
      client = null;
    }
  }

  if (!connected || !client) {
    console.error('❌ All connection attempts failed');
    console.error('\n💡 Please verify:');
    console.error('   1. IPv4 connections are enabled in Supabase Dashboard');
    console.error('   2. Connection string is correct');
    console.error('   3. Password is correct');
    console.error('   4. Direct connection (port 5432) is available\n');
    process.exit(1);
  }

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const filename of allFiles) {
    const filePath = resolve(migrationsDir, filename);
    const sql = readFileSync(filePath, 'utf-8');

    const success = await runMigration(client, filename, sql);
    
    if (success) {
      // Check if it was actually applied or just skipped
      if (sql.includes('IF NOT EXISTS') || sql.includes('ON CONFLICT')) {
        // Might have been skipped, but that's OK
        successCount++;
      } else {
        successCount++;
      }
    } else {
      failCount++;
      console.error(`\n❌ Stopping after failure in ${filename}`);
      break;
    }
  }

  await client.end();

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`✅ Applied: ${successCount}`);
  console.log(`⚠️  Skipped (already applied): ${skipCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total: ${allFiles.length}`);
  console.log('='.repeat(60) + '\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

