/**
 * Authentication Setup for E2E Tests
 * 
 * This setup script uses the existing generate-test-auth.ts script to create
 * authentication session. This ensures we use the exact same format that works.
 * 
 * 1. Avoids headless browser authentication issues
 * 2. Makes tests run 5-10x faster (no repeated sign-ins)
 * 3. More reliable than browser automation
 * 4. Follows Playwright best practices
 */

import { test as setup } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');
const generateAuthScript = path.join(__dirname, '../../scripts/generate-test-auth.ts');

setup('authenticate', async () => {
  setup.setTimeout(60000);
  console.log('🔐 Setting up authentication via generate-test-auth script...');
  
  try {
    // Run the generate-test-auth script using tsx
    execSync(`npx tsx ${generateAuthScript}`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });
    
    console.log('✅ Authentication setup complete');
  } catch (error: any) {
    console.error('❌ Failed to generate auth:', error.message);
    throw error;
  }
});

