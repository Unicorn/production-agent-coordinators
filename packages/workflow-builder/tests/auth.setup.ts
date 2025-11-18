/**
 * Authentication Setup for E2E Tests
 * 
 * This setup script runs once before all tests to authenticate and save
 * the session state. This avoids repeated sign-ins and headless auth issues.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';
const TEST_USER = {
  email: process.env.TEST_EMAIL || 'test@example.com',
  password: process.env.TEST_PASSWORD || 'testpassword123',
};

setup('authenticate', async ({ page }) => {
  console.log('🔐 Setting up authentication...');
  
  // Navigate to sign in page
  await page.goto(`${BASE_URL}/auth/signin`);
  
  // Fill in credentials
  console.log(`📧 Signing in as ${TEST_USER.email}`);
  await page.getByRole('textbox', { name: /you@example/i }).fill(TEST_USER.email);
  await page.getByRole('textbox', { name: /••••••••/i }).fill(TEST_USER.password);
  
  // Click sign in
  await page.getByRole('button', { name: 'Sign In' }).click();
  
  // Wait for navigation to complete
  await page.waitForURL(BASE_URL + '/', { timeout: 30000 });
  
  // Verify we're authenticated by checking for sign-out button
  await expect(page.getByRole('button', { name: 'Sign Out' }))
    .toBeVisible({ timeout: 10000 });
  
  console.log('✅ Authentication successful!');
  
  // Save signed-in state to file
  await page.context().storageState({ path: authFile });
  console.log(`💾 Session saved to ${authFile}`);
});

