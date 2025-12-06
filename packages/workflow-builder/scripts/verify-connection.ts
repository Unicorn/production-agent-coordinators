#!/usr/bin/env tsx
/**
 * Verify Database Connection
 * 
 * Tests the connection string and provides troubleshooting help
 */

import { Client } from 'pg';

const connectionString = 'postgresql://postgres:65TzRzrtEJ2DNrdG@db.jeaudyvxapooyfddfptr.supabase.co:5432/postgres';

async function testConnection() {
  console.log('🔍 Testing Database Connection\n');
  console.log(`Connection String: ${connectionString.substring(0, 50)}...\n`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('Attempting to connect...');
    await client.connect();
    console.log('✅ Connection successful!\n');
    
    const result = await client.query('SELECT version(), current_database(), current_user');
    console.log('Database Info:');
    console.log(`  Version: ${result.rows[0].version}`);
    console.log(`  Database: ${result.rows[0].current_database}`);
    console.log(`  User: ${result.rows[0].current_user}\n`);
    
    await client.end();
    return true;
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    console.error(`   Code: ${error.code || 'N/A'}\n`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Connection Refused - Possible causes:');
      console.log('   1. IPv4 connections not fully enabled yet (wait 5-10 minutes)');
      console.log('   2. Wrong hostname or port');
      console.log('   3. Firewall blocking connection');
      console.log('   4. Need to use different connection string format\n');
    } else if (error.message.includes('password')) {
      console.log('💡 Password Authentication Failed - Check:');
      console.log('   1. Password is correct');
      console.log('   2. User has proper permissions\n');
    }
    
    return false;
  }
}

async function main() {
  const connected = await testConnection();
  
  if (connected) {
    console.log('✅ Ready to run migrations!');
    console.log('   Run: tsx scripts/run-all-migrations-now.ts\n');
  } else {
    console.log('📝 Alternative: Use Supabase Dashboard');
    console.log('   1. Go to: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new');
    console.log('   2. Run migrations in alphabetical order');
    console.log('   3. All migrations are idempotent\n');
    
    console.log('🔧 To get correct connection string:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/settings/database');
    console.log('   2. Copy "Connection string" (URI format)');
    console.log('   3. Use direct connection (port 5432) for migrations\n');
  }
}

main().catch(console.error);

