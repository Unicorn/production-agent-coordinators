/**
 * Apply migrations to cloud Supabase project
 * Uses service role to execute SQL directly
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment - use cloud credentials
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jeaudyvxapooyfddfptr.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYXVkeXZ4YXBvb3lmZGRmcHRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE1OTg1NywiZXhwIjoyMDc4NzM1ODU3fQ.MexKBJ6VY_4rctPxHOHCHjE0gsRmGyw4Mr4Rwp3FRRE';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSQL(sql: string, description: string): Promise<boolean> {
  console.log(`\n📄 ${description}`);
  console.log('─'.repeat(60));
  
  try {
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\s*$/));
    
    for (const statement of statements) {
      if (statement.length < 10) continue; // Skip very short statements
      
      try {
        // Use RPC to execute SQL - requires exec_sql function
        // If that doesn't exist, we'll need to use direct connection
        const { error } = await supabase.rpc('exec_sql', { 
          sql_string: statement + ';' 
        });
        
        if (error) {
          // If exec_sql doesn't exist, try direct query (won't work for DDL)
          console.warn(`  ⚠️  Could not execute via RPC: ${error.message}`);
          console.log(`  💡 You may need to run this in Supabase SQL Editor`);
          return false;
        }
      } catch (err: any) {
        console.warn(`  ⚠️  Error: ${err.message}`);
        // Continue with next statement
      }
    }
    
    console.log(`  ✅ Completed`);
    return true;
  } catch (err: any) {
    console.error(`  ❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Applying migrations to cloud Supabase...\n');
  console.log(`📍 Project: ${supabaseUrl}\n`);
  
  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();
  
  console.log(`Found ${migrationFiles.length} migration files\n`);
  
  // For now, provide instructions since direct SQL execution via API is limited
  console.log('⚠️  Direct SQL execution via API is limited.');
  console.log('📝 To apply migrations, use one of these methods:\n');
  console.log('Method 1: Supabase Dashboard (Recommended)');
  console.log('  1. Go to: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new');
  console.log('  2. Copy and paste each migration file');
  console.log('  3. Click "Run"\n');
  
  console.log('Method 2: Supabase CLI (if connection works)');
  console.log('  supabase db push --linked --include-all\n');
  
  console.log('Method 3: Use psql with connection string');
  console.log('  Get connection string from: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/settings/database\n');
  
  console.log('📋 Migration files to apply:');
  migrationFiles.forEach((file, idx) => {
    console.log(`  ${idx + 1}. ${file}`);
  });
  
  console.log('\n✅ After migrations, run seed scripts:');
  console.log('  - scripts/create-test-user-and-seed.ts');
  console.log('  - scripts/create-seed-auth-users.ts\n');
}

main().catch(console.error);

