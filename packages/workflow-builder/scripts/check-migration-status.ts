#!/usr/bin/env tsx
/**
 * Check Migration Status
 * 
 * Lists all migrations and checks which ones need to be applied
 */

import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkColumnExists(table: string, column: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_column_exists', {
      table_name: table,
      column_name: column,
    });
    
    if (error) {
      // Try alternative method
      const { data: queryData, error: queryError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', table)
        .eq('column_name', column)
        .limit(1);
      
      return !queryError && (queryData?.length ?? 0) > 0;
    }
    
    return data === true;
  } catch {
    return false;
  }
}

async function checkTableExists(table: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', table)
      .limit(1);
    
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔍 Checking Migration Status\n');
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  const migrationsDir = resolve(__dirname, '../supabase/migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('OPTIMIZATION') && !f.includes('SUMMARY'))
    .sort();

  console.log(`📋 Found ${migrationFiles.length} migration files\n`);

  // Check key schema elements
  console.log('🔍 Checking Key Schema Elements:\n');

  const checks = [
    { name: 'components.is_active column', check: () => checkColumnExists('components', 'is_active') },
    { name: 'component_categories table', check: () => checkTableExists('component_categories') },
    { name: 'component_category_mapping table', check: () => checkTableExists('component_category_mapping') },
    { name: 'component_keywords table', check: () => checkTableExists('component_keywords') },
    { name: 'component_use_cases table', check: () => checkTableExists('component_use_cases') },
  ];

  const results: Array<{ name: string; exists: boolean }> = [];
  
  for (const { name, check } of checks) {
    const exists = await check();
    results.push({ name, exists });
    console.log(`  ${exists ? '✅' : '❌'} ${name}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));

  const missing = results.filter(r => !r.exists);
  if (missing.length > 0) {
    console.log(`\n⚠️  Missing ${missing.length} schema elements:\n`);
    missing.forEach(r => console.log(`  • ${r.name}`));
    console.log('\n📝 Migrations that need to be applied:\n');
    
    // Identify which migrations add these
    if (results.find(r => r.name === 'components.is_active column' && !r.exists)) {
      console.log('  • 20251117000006_add_custom_activity_code.sql (adds is_active)');
    }
    if (results.find(r => r.name.includes('component_categories') && !r.exists)) {
      console.log('  • 20250120000001_create_component_categories.sql (creates category tables)');
      console.log('  • 20250120000002_seed_component_categories.sql (seeds categories)');
      console.log('  • 20250120000003_map_components_to_categories.sql (maps components)');
    }
    
    console.log('\n📋 All migrations (in order):\n');
    migrationFiles.forEach((file, idx) => {
      const isNew = file.startsWith('20250120');
      console.log(`  ${idx + 1}. ${file}${isNew ? ' ⭐ NEW' : ''}`);
    });
  } else {
    console.log('\n✅ All key schema elements exist!');
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 To apply migrations:');
  console.log('   1. Go to Supabase Dashboard SQL Editor');
  console.log('   2. Run migrations in order (alphabetically)');
  console.log('   3. Or use: npx supabase db push (if CLI works)');
  console.log('='.repeat(60) + '\n');
}

main().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});

