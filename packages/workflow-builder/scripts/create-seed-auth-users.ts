#!/usr/bin/env tsx
/**
 * Create Auth Users for Seed Migration
 * 
 * Creates the auth users needed for the seed migration with fixed UUIDs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const users = [
  { 
    id: '00000000-0000-0000-0000-000000000001', 
    email: 'system@example.com', 
    password: 'system-password-not-used' 
  },
  { 
    id: '11111111-0000-0000-0000-000000000001',
    email: 'admin@example.com', 
    password: 'testpassword123' 
  },
  { 
    id: '22222222-0000-0000-0000-000000000001',
    email: 'test@example.com', 
    password: 'testpassword123' 
  },
  { 
    id: '33333333-0000-0000-0000-000000000001',
    email: 'testuser@example.com', 
    password: 'testpassword123' 
  },
];

async function createAuthUsers() {
  console.log('🔐 Creating Auth Users for Seed Migration\n');

  for (const user of users) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        user_id: user.id,
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (error) {
        // Check if user already exists
        if (error.message.includes('already exists') || error.message.includes('already been registered')) {
          console.log(`⚠️  ${user.email}: Already exists`);
        } else {
          console.log(`❌ ${user.email}: ${error.message}`);
        }
      } else {
        console.log(`✅ ${user.email}: Created with UUID ${data.user?.id}`);
      }
    } catch (err: any) {
      console.log(`❌ ${user.email}: ${err.message}`);
    }
  }

  console.log('\n🎉 Auth users setup complete!');
  console.log('\nNext step: Run the seed migration');
  console.log('  psql $DATABASE_URL -f supabase/migrations/20251118000002_seed_public_components.sql\n');
}

createAuthUsers();

