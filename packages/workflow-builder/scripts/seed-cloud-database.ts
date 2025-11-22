/**
 * Seed cloud Supabase database after migrations
 * Creates test users and seed data
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jeaudyvxapooyfddfptr.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYXVkeXZ4YXBvb3lmZGRmcHRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE1OTg1NywiZXhwIjoyMDc4NzM1ODU3fQ.MexKBJ6VY_4rctPxHOHCHjE0gsRmGyw4Mr4Rwp3FRRE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🌱 Seeding cloud Supabase database...\n');
  
  // Step 1: Create test user
  console.log('1️⃣ Creating test user (test@example.com)...');
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: 'test@example.com',
    password: 'testpassword123',
    email_confirm: true,
    user_metadata: {
      display_name: 'Test User'
    }
  });
  
  if (userError && !userError.message.includes('already registered')) {
    console.error('   ❌ Error:', userError.message);
  } else if (userData?.user) {
    console.log('   ✅ Created user:', userData.user.email);
  } else {
    console.log('   ✅ User already exists');
  }
  
  console.log('\n✅ Seeding complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Apply migrations via Supabase Dashboard SQL Editor');
  console.log('2. Update .env.local with cloud Supabase credentials');
  console.log('3. Restart Next.js server');
  console.log('4. Login with: test@example.com / testpassword123\n');
}

main().catch(console.error);
