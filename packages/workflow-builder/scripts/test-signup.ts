/**
 * Test Signup Flow
 * 
 * This script tests the signup process and helps diagnose issues
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testSignup() {
  console.log('🧪 Testing Signup Flow\n');
  console.log('📊 Supabase URL:', supabaseUrl);
  console.log('');

  // Test 1: Check database connection
  console.log('1️⃣ Testing database connection...');
  try {
    const { data: roles, error } = await supabase.from('user_roles').select('*');
    if (error) throw error;
    console.log('   ✅ Connected to database');
    console.log('   📋 Available roles:', roles?.map(r => r.name).join(', '));
  } catch (err: any) {
    console.error('   ❌ Database connection failed:', err.message);
    return;
  }

  // Test 2: Check trigger function exists
  console.log('\n2️⃣ Checking trigger function...');
  try {
    const { data, error } = await supabase.rpc('handle_new_user' as any);
    console.log('   ⚠️  Cannot directly test trigger (expected)');
  } catch (err: any) {
    // Expected to fail, just checking if function exists
    if (err.message.includes('does not exist')) {
      console.error('   ❌ Trigger function not found!');
      return;
    } else {
      console.log('   ✅ Trigger function exists');
    }
  }

  // Test 3: Check current users
  console.log('\n3️⃣ Checking existing users...');
  try {
    const { data: users, error } = await supabase.from('users').select('id, email, display_name');
    if (error) throw error;
    console.log('   ✅ Found', users?.length || 0, 'users');
    users?.forEach(u => console.log('      -', u.email, `(${u.display_name})`));
  } catch (err: any) {
    console.error('   ❌ Failed to fetch users:', err.message);
  }

  // Test 4: Check auth users
  console.log('\n4️⃣ Checking auth users...');
  try {
    const { data: { users: authUsers }, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    console.log('   ✅ Found', authUsers?.length || 0, 'auth users');
    authUsers?.forEach(u => console.log('      -', u.email, `(confirmed: ${u.email_confirmed_at ? '✓' : '✗'})`));
  } catch (err: any) {
    console.error('   ❌ Failed to fetch auth users:', err.message);
  }

  // Test 5: Test signup with disposable email
  const testEmail = `test.user.${Date.now()}@gmail.com`;
  const testPassword = 'TestPassword123!';
  
  console.log('\n5️⃣ Testing signup with:', testEmail);
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          display_name: 'Test User',
        },
      },
    });

    if (error) throw error;

    console.log('   ✅ Signup API succeeded');
    console.log('   📧 User ID:', data.user?.id);
    console.log('   📧 Email:', data.user?.email);
    console.log('   📧 Confirmed:', data.user?.email_confirmed_at ? 'Yes' : 'No');
    
    if (data.user?.identities?.length === 0) {
      console.log('   ⚠️  Email already registered!');
    }

    // Wait a moment for trigger to execute
    console.log('   ⏳ Waiting for trigger to execute...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if user was created in users table
    console.log('   🔍 Checking if user record created...');
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', data.user?.id)
      .single();

    if (userError) {
      console.error('   ❌ User record NOT created:', userError.message);
      console.error('   💡 This is likely the issue!');
      
      // Try to manually create the user
      console.log('\n6️⃣ Attempting manual user creation...');
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'developer')
        .single();

      if (roleData) {
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            auth_user_id: data.user?.id,
            email: data.user?.email,
            display_name: 'Test User',
            role_id: roleData.id,
          });

        if (insertError) {
          console.error('   ❌ Manual creation failed:', insertError.message);
        } else {
          console.log('   ✅ Manual creation succeeded');
        }
      }
    } else {
      console.log('   ✅ User record created successfully!');
      console.log('   📋 User:', userRecord);
    }

  } catch (err: any) {
    console.error('   ❌ Signup failed:', err.message);
    console.error('   📄 Full error:', err);
  }

  console.log('\n✅ Diagnostic complete');
}

testSignup().catch(console.error);

