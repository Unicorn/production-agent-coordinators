#!/usr/bin/env tsx
/**
 * Optimize and Run All Migrations
 * 
 * 1. Checks all migrations for idempotency
 * 2. Ensures proper ordering
 * 3. Runs migrations via Supabase Management API or direct connection
 */

import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Extract project ref
const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

async function executeSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Try using Supabase Management API
    // Note: Supabase JS client doesn't support arbitrary SQL execution
    // We'll need to use the REST API or provide instructions
    
    // For now, we'll use the SQL editor approach via instructions
    // But we can also try using the Management API endpoint
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql_string: sql }),
    });

    if (response.ok) {
      return { success: true };
    }

    const error = await response.text();
    return { success: false, error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function checkMigrationIdempotency(filePath: string): Promise<{ isIdempotent: boolean; issues: string[] }> {
  const content = readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  let isIdempotent = true;

  // Check for common non-idempotent patterns
  if (content.includes('CREATE TABLE') && !content.includes('IF NOT EXISTS')) {
    issues.push('CREATE TABLE without IF NOT EXISTS');
    isIdempotent = false;
  }

  if (content.includes('CREATE INDEX') && !content.includes('IF NOT EXISTS')) {
    issues.push('CREATE INDEX without IF NOT EXISTS');
    isIdempotent = false;
  }

  if (content.includes('ALTER TABLE') && content.includes('ADD COLUMN') && !content.includes('IF NOT EXISTS')) {
    issues.push('ADD COLUMN without IF NOT EXISTS');
    isIdempotent = false;
  }

  if (content.includes('INSERT INTO') && !content.includes('ON CONFLICT') && !content.includes('DO NOTHING')) {
    // This is OK if it's in a DO block that checks first
    if (!content.includes('DO $$') && !content.includes('SELECT') && content.includes('INTO')) {
      // Might be OK, but flag for review
      issues.push('INSERT without ON CONFLICT (may be intentional)');
    }
  }

  return { isIdempotent, issues };
}

async function main() {
  console.log('🔧 Optimizing and Running Migrations\n');
  console.log(`📍 Project: ${projectRef}`);
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const allFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();

  console.log(`📋 Found ${allFiles.length} migration files\n`);

  // Step 1: Check idempotency
  console.log('🔍 Checking migration idempotency...\n');
  const idempotencyResults: Array<{ file: string; isIdempotent: boolean; issues: string[] }> = [];

  for (const file of allFiles) {
    const filePath = resolve(migrationsDir, file);
    const result = await checkMigrationIdempotency(filePath);
    idempotencyResults.push({ file, ...result });
    
    if (!result.isIdempotent || result.issues.length > 0) {
      console.log(`  ${result.isIdempotent ? '✅' : '⚠️'} ${file}`);
      if (result.issues.length > 0) {
        result.issues.forEach(issue => console.log(`     - ${issue}`));
      }
    }
  }

  const nonIdempotent = idempotencyResults.filter(r => !r.isIdempotent);
  if (nonIdempotent.length > 0) {
    console.log(`\n⚠️  Found ${nonIdempotent.length} migrations that may not be fully idempotent`);
    console.log('   These should be reviewed and fixed if needed.\n');
  } else {
    console.log('\n✅ All migrations appear to be idempotent!\n');
  }

  // Step 2: Provide instructions for running
  console.log('='.repeat(60));
  console.log('📝 To Run Migrations:');
  console.log('='.repeat(60));
  console.log('\nSince Supabase JS client cannot execute arbitrary SQL directly,');
  console.log('please use one of these methods:\n');
  
  console.log('Method 1: Supabase Dashboard (Recommended)');
  console.log(`   1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('   2. Copy and paste each migration file in order');
  console.log('   3. Click "Run" for each migration\n');
  
  console.log('Method 2: Use psql with connection string');
  console.log(`   1. Get connection string from: https://supabase.com/dashboard/project/${projectRef}/settings/database`);
  console.log('   2. Add to .env.local as DATABASE_URL');
  console.log('   3. Run: tsx scripts/run-migrations.ts\n');
  
  console.log('Method 3: Supabase CLI (if configured)');
  console.log('   npx supabase db push --linked\n');

  console.log('📋 Migration files (run in this order):\n');
  allFiles.forEach((file, idx) => {
    const result = idempotencyResults.find(r => r.file === file);
    const status = result?.isIdempotent ? '✅' : '⚠️';
    console.log(`  ${idx + 1}. ${status} ${file}`);
  });

  console.log('\n' + '='.repeat(60) + '\n');
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

