#!/usr/bin/env tsx
/**
 * Run Migrations via Supabase Management API
 * 
 * Uses Supabase Management API to execute migrations without needing database password.
 * Requires SUPABASE_ACCESS_TOKEN or uses service role key.
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN;

// Extract project ref
const projectRef = supabaseUrl?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not extract project ref from SUPABASE_URL');
  process.exit(1);
}

// Use access token if available, otherwise try service role key
const accessToken = supabaseAccessToken || supabaseServiceKey;

async function executeSQL(sql: string, description: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Use Supabase Management API
    // Endpoint: https://api.supabase.com/v1/projects/{ref}/database/query
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: sql,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const result = await response.json();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Running Migrations via Supabase Management API\n');
  console.log(`📍 Project: ${projectRef}`);
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  if (!accessToken) {
    console.error('❌ Missing SUPABASE_ACCESS_TOKEN or SUPABASE_SERVICE_ROLE_KEY');
    console.error('\n💡 To get access token:');
    console.error('   1. Go to: https://supabase.com/dashboard/account/tokens');
    console.error('   2. Create a new access token');
    console.error('   3. Add to .env.local as SUPABASE_ACCESS_TOKEN');
    console.error('\n   Or use the Supabase Dashboard SQL Editor instead.');
    process.exit(1);
  }

  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const allFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();

  console.log(`📋 Found ${allFiles.length} migration files\n`);

  let successCount = 0;
  let failCount = 0;

  for (const filename of allFiles) {
    const filePath = resolve(migrationsDir, filename);
    const sql = readFileSync(filePath, 'utf-8');

    console.log(`\n📄 Running: ${filename}`);
    console.log('─'.repeat(60));

    const result = await executeSQL(sql, filename);

    if (result.success) {
      console.log(`✅ ${filename} - Success`);
      successCount++;
    } else {
      // Check if it's an idempotent error (already exists)
      const errorLower = (result.error || '').toLowerCase();
      const isIdempotentError = 
        errorLower.includes('already exists') ||
        errorLower.includes('duplicate') ||
        (errorLower.includes('relation') && errorLower.includes('already'));

      if (isIdempotentError) {
        console.log(`⚠️  ${filename} - Already applied (idempotent, continuing)`);
        successCount++;
      } else {
        console.error(`❌ ${filename} - Error:`, result.error);
        failCount++;
        console.error(`\n❌ Stopping after failure in ${filename}`);
        break;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total: ${allFiles.length}`);
  console.log('='.repeat(60) + '\n');

  if (failCount > 0) {
    console.error('💡 If Management API fails, use Supabase Dashboard SQL Editor:');
    console.error(`   https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

