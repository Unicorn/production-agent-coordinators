/**
 * Authentication E2E Tests
 * 
 * Tests the complete authentication flow including sign up, sign in, and sign out
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestPassword123!';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('should redirect unauthenticated users to sign in', async ({ page }) => {
    // When visiting the homepage without authentication
    await page.goto(BASE_URL);
    
    // Then should redirect to sign in page
    await expect(page).toHaveURL(`${BASE_URL}/auth/signin`);
    
    // And should show sign in form
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('should sign in with valid credentials', async ({ page }) => {
    // Given I am on the sign in page
    await page.goto(`${BASE_URL}/auth/signin`);
    
    // When I fill in my credentials
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_PASSWORD);
    
    // And click sign in
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Then I should be redirected to the dashboard
    await expect(page).toHaveURL(BASE_URL + '/');
    
    // And see the welcome message
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
    
    // And see my user info in the header
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Given I am on the sign in page
    await page.goto(`${BASE_URL}/auth/signin`);
    
    // When I fill in invalid credentials
    await page.getByRole('textbox', { name: /email/i }).fill('wrong@example.com');
    await page.getByRole('textbox', { name: /password/i }).fill('wrongpassword');
    
    // And click sign in
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Then I should see an error message
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 5000 });
  });

  test('should sign out successfully', async ({ page }) => {
    // Given I am signed in
    await page.goto(`${BASE_URL}/auth/signin`);
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(BASE_URL + '/');
    
    // When I click sign out
    await page.getByRole('button', { name: 'Sign Out' }).click();
    
    // Then I should be redirected to sign in page
    await expect(page).toHaveURL(`${BASE_URL}/auth/signin`);
  });

  test('should navigate to sign up page', async ({ page }) => {
    // Given I am on the sign in page
    await page.goto(`${BASE_URL}/auth/signin`);
    
    // When I click the sign up link
    await page.getByRole('link', { name: 'Sign Up' }).click();
    
    // Then I should be on the sign up page
    await expect(page).toHaveURL(`${BASE_URL}/auth/signup`);
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
  });

  test('should validate password length on sign up', async ({ page }) => {
    // Given I am on the sign up page
    await page.goto(`${BASE_URL}/auth/signup`);
    
    // When I try to sign up with a short password
    await page.getByRole('textbox', { name: /email/i }).fill('newuser@example.com');
    await page.getByRole('textbox', { name: /^password$/i }).fill('short');
    await page.getByRole('textbox', { name: /confirm password/i }).fill('short');
    await page.getByRole('textbox', { name: /display name/i }).fill('New User');
    
    // And click sign up
    await page.getByRole('button', { name: 'Sign Up' }).click();
    
    // Then I should see a validation error
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('should validate password confirmation', async ({ page }) => {
    // Given I am on the sign up page
    await page.goto(`${BASE_URL}/auth/signup`);
    
    // When passwords don't match
    await page.getByRole('textbox', { name: /email/i }).fill('newuser@example.com');
    await page.getByRole('textbox', { name: /^password$/i }).fill('Password123!');
    await page.getByRole('textbox', { name: /confirm password/i }).fill('DifferentPassword123!');
    await page.getByRole('textbox', { name: /display name/i }).fill('New User');
    
    // And click sign up
    await page.getByRole('button', { name: 'Sign Up' }).click();
    
    // Then I should see a validation error
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});

test.describe('Protected Routes', () => {
  test('should protect dashboard route', async ({ page }) => {
    // When trying to access dashboard without auth
    await page.goto(BASE_URL + '/');
    
    // Then should redirect to sign in
    await expect(page).toHaveURL(`${BASE_URL}/auth/signin`);
  });

  test('should protect components route', async ({ page }) => {
    // When trying to access components without auth
    await page.goto(BASE_URL + '/components');
    
    // Then should redirect to sign in
    await expect(page).toHaveURL(`${BASE_URL}/auth/signin`);
  });

  test('should protect workflows route', async ({ page }) => {
    // When trying to access workflows without auth
    await page.goto(BASE_URL + '/workflows');
    
    // Then should redirect to sign in
    await expect(page).toHaveURL(`${BASE_URL}/auth/signin`);
  });

  test('should protect agents route', async ({ page }) => {
    // When trying to access agents without auth
    await page.goto(BASE_URL + '/agents');
    
    // Then should redirect to sign in
    await expect(page).toHaveURL(`${BASE_URL}/auth/signin`);
  });
});

