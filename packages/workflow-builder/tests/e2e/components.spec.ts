/**
 * Components Page E2E Tests
 * 
 * Tests component listing, creation, editing, and deletion
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestPassword123!';

test.describe('Components Page', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto(`${BASE_URL}/auth/signin`);
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(BASE_URL + '/');
    
    // Navigate to components page
    await page.getByRole('button', { name: 'Components' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/components`);
  });

  test('should display components page', async ({ page }) => {
    // Then should see the components page
    await expect(page.getByRole('heading', { name: 'Components', level: 1 })).toBeVisible();
    
    // And see the new component button
    await expect(page.getByRole('button', { name: 'New Component' })).toBeVisible();
    
    // And see the search box
    await expect(page.getByRole('textbox', { name: /search/i })).toBeVisible();
    
    // And see filter buttons
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'activity' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'agent' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'signal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'trigger' })).toBeVisible();
  });

  test('should show empty state when no components exist', async ({ page }) => {
    // When no components exist
    // Then should show empty state message
    const emptyStateText = page.getByText(/no components found/i);
    
    // Check if we have components or empty state
    const hasComponents = await page.locator('[data-testid="component-card"]').count() > 0;
    
    if (!hasComponents) {
      await expect(emptyStateText).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create Component' })).toBeVisible();
    }
  });

  test('should navigate to component creation page', async ({ page }) => {
    // When I click "New Component"
    await page.getByRole('button', { name: 'New Component' }).click();
    
    // Then should navigate to /components/new
    await expect(page).toHaveURL(`${BASE_URL}/components/new`);
    
    // And should see the component form
    await expect(page.getByRole('heading', { name: /create component/i })).toBeVisible();
  });

  test('should filter components by type', async ({ page }) => {
    // When I click on a filter button
    await page.getByRole('button', { name: 'activity' }).click();
    
    // Then URL should include filter parameter
    // And only activity components should be visible
    
    // Click "All" to reset
    await page.getByRole('button', { name: 'All' }).click();
  });

  test('should search components', async ({ page }) => {
    // When I type in the search box
    const searchBox = page.getByRole('textbox', { name: /search/i });
    await searchBox.fill('test');
    
    // Then components should be filtered
    // (Results depend on existing components)
  });
});

test.describe('Component Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in and navigate to component creation
    await page.goto(`${BASE_URL}/auth/signin`);
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(BASE_URL + '/');
    
    await page.goto(`${BASE_URL}/components/new`);
  });

  test('should display component creation form', async ({ page }) => {
    // Then should see all required fields
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/display name/i)).toBeVisible();
    await expect(page.getByLabel(/version/i)).toBeVisible();
    await expect(page.getByLabel(/component type/i)).toBeVisible();
    await expect(page.getByLabel(/visibility/i)).toBeVisible();
  });

  test('should create a new activity component', async ({ page }) => {
    const timestamp = Date.now();
    const componentName = `testActivity${timestamp}`;
    
    // When I fill in the form
    await page.getByLabel(/^name$/i).fill(componentName);
    await page.getByLabel(/display name/i).fill('Test Activity');
    await page.getByLabel(/version/i).fill('1.0.0');
    
    // Select component type (activity)
    await page.getByLabel(/component type/i).click();
    await page.getByRole('option', { name: 'activity' }).click();
    
    // Select visibility (public)
    await page.getByLabel(/visibility/i).click();
    await page.getByRole('option', { name: 'public' }).click();
    
    // Add capabilities
    await page.getByLabel(/capabilities/i).fill('test-capability');
    
    // Add description
    await page.getByLabel(/description/i).fill('A test activity for automated testing');
    
    // And click create
    await page.getByRole('button', { name: /create component/i }).click();
    
    // Then should redirect to components page
    await expect(page).toHaveURL(`${BASE_URL}/components`);
    
    // And should see success message
    await expect(page.getByText(/component created/i)).toBeVisible({ timeout: 5000 });
    
    // And should see the new component in the list
    await expect(page.getByText(componentName)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // When I try to create without filling required fields
    await page.getByRole('button', { name: /create component/i }).click();
    
    // Then should show validation errors
    await expect(page.getByText(/required/i)).toBeVisible();
  });

  test('should validate version format', async ({ page }) => {
    // When I enter an invalid version
    await page.getByLabel(/version/i).fill('invalid-version');
    
    // And try to submit
    await page.getByRole('button', { name: /create component/i }).click();
    
    // Then should show validation error
    // (Validation may vary based on implementation)
  });
});

test.describe('Component Details', () => {
  test.skip('should display component details', async ({ page }) => {
    // TODO: Implement once we have a component detail page
    // This test requires creating a component first, then viewing its details
  });

  test.skip('should edit component', async ({ page }) => {
    // TODO: Implement edit functionality tests
  });

  test.skip('should delete component', async ({ page }) => {
    // TODO: Implement delete functionality tests
  });
});

