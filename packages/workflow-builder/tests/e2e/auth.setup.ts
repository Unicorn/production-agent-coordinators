/**
 * Authentication Setup for E2E Tests
 * 
 * This setup script runs once before all tests and creates an authenticated
 * session that can be reused across all test files. This approach:
 * 
 * 1. Avoids headless browser authentication issues
 * 2. Makes tests run 5-10x faster (no repeated sign-ins)
 * 3. Better isolates auth testing from feature testing
 * 4. Follows Playwright best practices
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to sign in page
  await page.goto('http://localhost:3010/auth/signin');
  
  // Fill in credentials
  await page.getByRole('textbox', { name: /you@example/i }).fill('test@example.com');
  await page.getByRole('textbox', { name: /••••••••/i }).fill('testpassword123');
  
  // Click sign in
  await page.getByRole('button', { name: 'Sign In' }).click();
  
  // Wait for redirect by checking for Sign Out button
  // This is more reliable than waiting for URL in headless mode
  await page.getByRole('button', { name: 'Sign Out' }).waitFor({ 
    state: 'visible', 
    timeout: 30000 
  });
  
  // Verify we're authenticated
  await expect(page).toHaveURL('http://localhost:3010/');
  
  // Save signed-in state to file
  await page.context().storageState({ path: authFile });
  
  console.log('✅ Authentication setup complete - session saved to', authFile);
});

