/**
 * Workflows List and Details E2E Tests
 * 
 * Tests workflow listing, viewing details, and metadata display
 * 
 * Note: These tests use authenticated storage state from auth.setup.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Workflows List Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workflows - already authenticated via storage state
    await page.goto(`${BASE_URL}/workflows`);
  });

  test('should display workflows list page', async ({ page }) => {
    // Verify page elements
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Workflow' })).toBeVisible();
  });

  test('should display demo workflows', async ({ page }) => {
    // Verify demo workflows are visible
    await expect(page.getByText('Hello World Demo')).toBeVisible();
    await expect(page.getByText('Agent Conversation Demo')).toBeVisible();
    await expect(page.getByText('active')).toBeVisible();
  });

  test('should navigate to workflow details when clicked', async ({ page }) => {
    // Click on Hello World Demo
    await page.getByText('Hello World Demo').first().click();
    
    // Verify navigation to details page (ID will vary)
    await expect(page).toHaveURL(/workflows\/[a-f0-9-]{36}$/);
  });
});

test.describe('Workflow Details Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workflows and click on first workflow
    await page.goto(`${BASE_URL}/workflows`);
    await page.waitForLoadState('networkidle');
    await page.getByText('Hello World Demo').first().click();
    await page.waitForLoadState('networkidle');
  });

  test('should display workflow details', async ({ page }) => {
    // Verify workflow details page
    await expect(page.getByRole('heading', { name: 'Hello World Demo' })).toBeVisible();
    await expect(page.getByText(/simple greeting workflow/i)).toBeVisible();
  });

  test('should display action buttons', async ({ page }) => {
    // Verify action buttons
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('should display workflow metadata', async ({ page }) => {
    // Verify workflow metadata
    await expect(page.getByText('ID')).toBeVisible();
    await expect(page.getByText('Identifier')).toBeVisible();
    await expect(page.getByText('hello-world-demo')).toBeVisible();
    await expect(page.getByText('Version')).toBeVisible();
    await expect(page.getByText('1.0.0')).toBeVisible();
    await expect(page.getByText('Task Queue')).toBeVisible();
    await expect(page.getByText('default-queue')).toBeVisible();
  });

  test('should navigate to edit page when Edit clicked', async ({ page }) => {
    // Click Edit button
    await page.getByRole('button', { name: 'Edit' }).click();
    
    // Verify navigation to edit page
    await expect(page).toHaveURL(/workflows\/[a-f0-9-]{36}\/edit$/);
  });
});

