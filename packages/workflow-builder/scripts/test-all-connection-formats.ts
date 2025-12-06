#!/usr/bin/env tsx
/**
 * Test All Possible Connection String Formats
 */

import { Client } from 'pg';

const password = '65TzRzrtEJ2DNrdG';
const projectRef = 'jeaudyvxapooyfddfptr';

const connectionStrings = [
  // Format 1: As provided by user
  `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
  
  // Format 2: With project ref in username (pooler style but direct port)
  `postgresql://postgres.${projectRef}:${password}@db.${projectRef}.supabase.co:5432/postgres`,
  
  // Format 3: AWS pooler hostname with direct port
  `postgresql://postgres:${password}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
  
  // Format 4: AWS pooler with project ref in username
  `postgresql://postgres.${projectRef}:${password}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
  
  // Format 5: Direct connection pooler hostname
  `postgresql://postgres:${password}@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
  
  // Format 6: With project ref
  `postgresql://postgres.${projectRef}:${password}@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
];

async function testConnection(connStr: string, index: number): Promise<boolean> {
  console.log(`\n[${index + 1}] Testing: ${connStr.substring(0, 70)}...`);
  
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT version(), current_database()');
    console.log(`   ✅ SUCCESS!`);
    console.log(`   Database: ${result.rows[0].current_database}`);
    console.log(`   Version: ${result.rows[0].version.substring(0, 50)}...`);
    await client.end();
    return true;
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message.substring(0, 80)}`);
    await client.end().catch(() => {});
    return false;
  }
}

async function main() {
  console.log('🔍 Testing All Connection String Formats\n');
  console.log('='.repeat(70));
  
  let successCount = 0;
  let workingConnection: string | null = null;

  for (let i = 0; i < connectionStrings.length; i++) {
    const success = await testConnection(connectionStrings[i], i);
    if (success) {
      successCount++;
      if (!workingConnection) {
        workingConnection = connectionStrings[i];
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 Results');
  console.log('='.repeat(70));
  console.log(`✅ Working connections: ${successCount}`);
  console.log(`❌ Failed connections: ${connectionStrings.length - successCount}`);
  
  if (workingConnection) {
    console.log('\n✅ Working connection string:');
    console.log(workingConnection);
    console.log('\n💡 Update scripts/run-all-migrations-now.ts with this connection string');
  } else {
    console.log('\n❌ No working connections found');
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify IPv4 connections are enabled in Supabase Dashboard');
    console.log('   2. Check Settings → Database → Connection string');
    console.log('   3. Ensure you copied the correct connection string');
    console.log('   4. Wait 5-10 minutes for IPv4 settings to propagate');
    console.log('   5. Try using Supabase Dashboard SQL Editor instead');
  }
}

main().catch(console.error);

