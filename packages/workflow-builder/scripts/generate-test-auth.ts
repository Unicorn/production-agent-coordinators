/**
 * Generate Test Authentication Session
 * 
 * This script creates or signs in a test user via Supabase API
 * and saves the session to be used in Playwright tests.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54332';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
};

async function generateTestAuth() {
  console.log('🔧 Setting up Supabase client...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log('🔑 Attempting to sign in test user...');
    
    // Try to sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_USER.email,
      password: TEST_USER.password,
    });

    if (signInError) {
      console.log('⚠️  Sign in failed:', signInError.message);
      console.log('📝 Attempting to create test user...');
      
      // Try to sign up
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: TEST_USER.email,
        password: TEST_USER.password,
        options: {
          emailRedirectTo: 'http://localhost:3010/',
        },
      });

      if (signUpError) {
        console.error('❌ Failed to create test user:', signUpError.message);
        process.exit(1);
      }

      console.log('✅ Test user created successfully');
      
      if (!signUpData.session) {
        console.log('⚠️  No session returned from sign up, trying to sign in...');
        const { data: retrySignIn, error: retryError } = await supabase.auth.signInWithPassword({
          email: TEST_USER.email,
          password: TEST_USER.password,
        });
        
        if (retryError || !retrySignIn.session) {
          console.error('❌ Failed to get session after sign up');
          process.exit(1);
        }
        
        return retrySignIn.session;
      }
      
      return signUpData.session;
    }

    if (!signInData.session) {
      console.error('❌ No session returned from sign in');
      process.exit(1);
    }

    console.log('✅ Successfully signed in test user');
    return signInData.session;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

async function saveAuthSession(session: any) {
  console.log('💾 Saving authentication session...');
  
  // Create Playwright storage state format
  const storageState = {
    cookies: [
      {
        name: 'sb-127-0-0-1-54332-auth-token',
        value: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          token_type: session.token_type,
          user: session.user,
        }),
        domain: '127.0.0.1',
        path: '/',
        expires: session.expires_at ? session.expires_at : -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'sb-localhost-auth-token',
        value: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          token_type: session.token_type,
          user: session.user,
        }),
        domain: 'localhost',
        path: '/',
        expires: session.expires_at ? session.expires_at : -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  };

  // Save to playwright/.auth/user.json
  const authDir = path.join(__dirname, '../playwright/.auth');
  const authFile = path.join(authDir, 'user.json');
  
  // Ensure directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));
  console.log('✅ Auth session saved to:', authFile);

  // Also save token to .env for optional direct token usage
  const envFile = path.join(__dirname, '../.env.test.local');
  const envContent = `# Test authentication token
# Generated: ${new Date().toISOString()}
# Expires: ${session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'Never'}
SUPABASE_TEST_ACCESS_TOKEN=${session.access_token}
SUPABASE_TEST_REFRESH_TOKEN=${session.refresh_token}
`;
  
  fs.writeFileSync(envFile, envContent);
  console.log('✅ Auth tokens saved to:', envFile);

  console.log('\n📊 Session Info:');
  console.log('  User ID:', session.user.id);
  console.log('  Email:', session.user.email);
  console.log('  Expires:', session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'Never');
  console.log('  Access Token:', session.access_token.substring(0, 20) + '...');
}

async function main() {
  console.log('🚀 Generating test authentication session...\n');
  
  const session = await generateTestAuth();
  await saveAuthSession(session);
  
  console.log('\n✨ Done! You can now run Playwright tests with authentication.');
  console.log('\n📝 Next steps:');
  console.log('  1. Run: npx playwright test');
  console.log('  2. Tests will use the saved authentication session');
  console.log('\n⚠️  Note: Tokens expire after 1 hour. Re-run this script if tests fail with auth errors.');
}

main().catch(console.error);

