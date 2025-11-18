/**
 * Dashboard/Home Page E2E Tests
 * 
 * Tests the main dashboard page elements and navigation
 * 
 * Note: These tests use authenticated storage state from auth.setup.ts
 * so no manual sign-in is required.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Dashboard/Home Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard - already authenticated via storage state
    await page.goto(BASE_URL + '/');
  });

  test('should display dashboard with welcome message', async ({ page }) => {
    // Verify dashboard elements
    await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();
    await expect(page.getByText(/Start building workflows by composing reusable components/i)).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    // Verify stats cards are visible
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible();
  });

  test('should display navigation buttons', async ({ page }) => {
    // Verify navigation buttons in sidebar or header
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workflows' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Components' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agents' })).toBeVisible();
  });

  test('should display user information', async ({ page }) => {
    // Navigate to a page that shows user info (workflows page)
    await page.goto(`${BASE_URL}/workflows`);
    await page.waitForLoadState('networkidle');
    
    // Verify user info is displayed
    await expect(page.getByText(/Test User/i)).toBeVisible();
    await expect(page.getByText(/developer/i)).toBeVisible();
  });

  test('should load without errors', async ({ page }) => {
    // Navigate to home
    await page.goto(BASE_URL + '/');
    await page.waitForLoadState('networkidle');

    // Verify page loaded successfully
    await expect(page).toHaveURL(BASE_URL + '/');
  });
});

