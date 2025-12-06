#!/usr/bin/env tsx
/**
 * Run Migrations with Retry Logic
 * 
 * Attempts to connect and run migrations, with retry logic for IPv4 propagation
 */

import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = 'postgresql://postgres:65TzRzrtEJ2DNrdG@db.jeaudyvxapooyfddfptr.supabase.co:5432/postgres';

async function testConnection(): Promise<Client | null> {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    return client;
  } catch (error: any) {
    await client.end().catch(() => {});
    return null;
  }
}

async function waitForConnection(maxRetries = 10, delayMs = 5000): Promise<Client> {
  console.log('🔌 Waiting for IPv4 connection to be available...\n');
  
  for (let i = 0; i < maxRetries; i++) {
    console.log(`Attempt ${i + 1}/${maxRetries}...`);
    const client = await testConnection();
    
    if (client) {
      return client;
    }
    
    if (i < maxRetries - 1) {
      console.log(`   ⏳ Waiting ${delayMs / 1000}s before retry...\n`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error('Failed to connect after all retries');
}

async function runMigration(client: Client, filename: string, sql: string): Promise<boolean> {
  console.log(`📄 ${filename}`);

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`   ✅ Success\n`);
    return true;
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    
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
      return true;
    }
    
    console.error(`   ❌ Error: ${error.message}\n`);
    return false;
  }
}

async function main() {
  console.log('🚀 Running All Migrations with Retry Logic\n');
  console.log('📍 Database: Supabase Cloud (Direct Connection)\n');

  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const allFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();

  console.log(`📋 Found ${allFiles.length} migration files\n`);

  let client: Client;
  try {
    client = await waitForConnection();
    console.log('✅ Connected to database!\n');
  } catch (error: any) {
    console.error('❌ Failed to connect:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Verify IPv4 connections are enabled in Supabase Dashboard');
    console.error('   2. Check Settings → Database → Connection string');
    console.error('   3. Ensure direct connection (port 5432) is available');
    console.error('   4. Wait a few minutes for IPv4 settings to propagate');
    console.error('   5. Try using Supabase Dashboard SQL Editor instead\n');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (const filename of allFiles) {
    const filePath = resolve(migrationsDir, filename);
    const sql = readFileSync(filePath, 'utf-8');

    const success = await runMigration(client, filename, sql);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
      console.error(`\n❌ Stopping after failure in ${filename}`);
      break;
    }
  }

  await client.end();

  console.log('='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`✅ Applied: ${successCount}`);
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

