#!/usr/bin/env tsx
/**
 * Run All Migrations - Idempotent Migration Runner
 * 
 * This script runs all migrations in order, ensuring idempotency.
 * Uses direct PostgreSQL connection via pg library.
 */

import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Get connection details
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

// Extract project ref from Supabase URL
const projectRef = supabaseUrl?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not extract project ref from SUPABASE_URL');
  process.exit(1);
}

// Construct connection string
// For Supabase, we need to use the direct connection (not pooler) for migrations
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
// But we don't have the password. Let's try using the service role key approach or direct connection

// Alternative: Use Supabase Management API or direct connection
// For now, let's construct a connection string that might work
// The user will need to provide DATABASE_URL or we'll use Supabase's connection pooler

let connectionString = databaseUrl;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in .env.local');
  console.error('💡 To get your database connection string:');
  console.error('   1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/settings/database');
  console.error('   2. Copy the "Connection string" (URI format)');
  console.error('   3. Add it to .env.local as DATABASE_URL');
  console.error('\n   Or use the Supabase Dashboard SQL Editor to run migrations manually.');
  process.exit(1);
}

async function runMigration(client: Client, filename: string, sql: string): Promise<boolean> {
  console.log(`\n📄 Running: ${filename}`);
  console.log('─'.repeat(60));

  try {
    // Wrap in transaction for safety
    await client.query('BEGIN');
    
    // Execute the SQL
    await client.query(sql);
    
    await client.query('COMMIT');
    
    console.log(`✅ ${filename} - Success`);
    return true;
  } catch (error: any) {
    await client.query('ROLLBACK');
    
    // Check if error is due to already existing (idempotency)
    const errorMessage = error.message.toLowerCase();
    const isIdempotentError = 
      errorMessage.includes('already exists') ||
      errorMessage.includes('duplicate') ||
      errorMessage.includes('relation') && errorMessage.includes('already') ||
      error.code === '42P07' || // duplicate_table
      error.code === '42710' || // duplicate_object
      error.code === '23505';   // unique_violation (for ON CONFLICT)

    if (isIdempotentError) {
      console.log(`⚠️  ${filename} - Already applied (idempotent, continuing)`);
      return true;
    }
    
    console.error(`❌ ${filename} - Error:`, error.message);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Migration Runner - Idempotent Migration Execution\n');
  console.log(`📍 Project: ${projectRef}`);
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const allFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();

  console.log(`📋 Found ${allFiles.length} migration files\n`);

  // Connect to database
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
  } catch (error: any) {
    console.error('❌ Failed to connect to database:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check DATABASE_URL in .env.local');
    console.error('   2. Ensure connection string includes password');
    console.error('   3. For Supabase, use direct connection (port 5432) not pooler (port 6543)');
    process.exit(1);
  }

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // Run migrations in order
  for (const filename of allFiles) {
    const filePath = resolve(migrationsDir, filename);
    const sql = readFileSync(filePath, 'utf-8');

    const success = await runMigration(client, filename, sql);
    
    if (success) {
      // Check if it was actually applied or just skipped
      if (sql.includes('IF NOT EXISTS') || sql.includes('ON CONFLICT')) {
        skipCount++;
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

