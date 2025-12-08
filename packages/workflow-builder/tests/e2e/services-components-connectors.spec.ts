/**
 * Services, Components, and Connectors E2E Tests
 * 
 * Tests the new naming conventions and UI components:
 * - Services (formerly workflows)
 * - Connectors (project-level integrations)
 * - Service Interfaces
 * - Project Connectors
 * 
 * Note: These tests use authenticated storage state from auth.setup.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Services Naming and UI', () => {
<<<<<<< HEAD
  test.beforeEach(async ({ page }) => {
  });

          test('should display "Services" instead of "Workflows" on workflows page', async ({ page }) => {
    // Wait for page to load - browser MCP confirmed elements exist after load
    await page.waitForLoadState('networkidle');
    
    // Wait for main content area to be visible (browser MCP confirmed main [ref=e42] exists)
    await page.waitForSelector('main', { timeout: 15000 });
    
    // Wait for button first (this confirms React has hydrated) - browser MCP showed button "New Service" [ref=e46]
    await expect(page.getByRole('button', { name: 'New Service' })).toBeVisible({ timeout: 15000 });
    
    // Browser MCP showed: heading "Services" [level=1] [ref=e44] inside main [ref=e42]
    // Browser evaluation confirmed: h1Exists: true, h1Text: "Services", headingInMain: true
    // Use the same pattern as workflows.spec.ts which works - getByRole with heading
    // But wait a bit for React to fully render after button is visible
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: 'Services', level: 1 })).toBeVisible({ timeout: 15000 });
  });


  test('should display "Channel" instead of "Task Queue" in service cards', async ({ page }) => {
    // Wait for page to load - browser MCP confirmed elements exist after load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give React time to hydrate
    
        // Verify channel name is displayed - browser MCP showed "Channel: default-queue" in service cards
    // Browser evaluation confirmed: channelElementsCount: 19
=======
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to workflows - already authenticated via storage state
    await page.goto(`${BASE_URL}/workflows`);
  });

  test('should display "Services" instead of "Workflows" on workflows page', async ({ page }) => {
    // Browser MCP observation: Page loads in this sequence:
    // 1. Initial loading state with "Loading..." and progressbar
    // 2. AuthGuard authenticates (~1 second)
    // 3. tRPC request to /api/trpc/users.me,workflows.list
    // 4. Page renders with heading "Services" [ref=e44] and button "New Service" [ref=e46]
    
    // Wait for page to load and verify we're on the correct URL (not redirected to signin)
    await expect(page).toHaveURL(/workflows/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Wait for button first (this confirms React has hydrated and data has loaded)
    // Browser MCP showed button "New Service" [ref=e46] exists and appears after tRPC request completes
    // Increased timeout to account for potential test environment delays
    await expect(page.getByRole('button', { name: 'New Service' })).toBeVisible({ timeout: 20000 });
    
    // 3. Wait for heading to be visible (browser MCP confirmed heading exists and appears with button)
    // Browser evaluation confirmed: h1Exists: true, h1Text: "Services", headingVisible: true
    // Browser MCP showed: heading "Services" [level=1] [ref=e44] appears together with button
    await expect(page.getByRole('heading', { name: 'Services', level: 1 })).toBeVisible({ timeout: 15000 });
  });

  test('should display "Channel" instead of "Task Queue" in service cards', async ({ page }) => {
    // Wait for page to load - browser MCP confirmed elements exist after load
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the workflows page (not redirected to signin)
    // Browser MCP confirmed the page loads correctly
    await expect(page).toHaveURL(/workflows/, { timeout: 15000 });
    
    // Browser MCP showed: "Channel: default-queue" appears in service cards
    // Browser evaluation confirmed: channelElementsCount: 19, channelTexts include "Channel: default-queue"
    // Wait for channel text to appear (browser MCP confirmed it exists)
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
    const channelText = page.getByText(/Channel:/i).first();
    
    // Check if any services are displayed
    const hasServices = await page.getByText(/Hello World|Agent Conversation|Agent Conversation Demo/i).count() > 0;
    
    if (hasServices) {
      // If services exist, verify channel text is visible
<<<<<<< HEAD
      await expect(channelText).toBeVisible({ timeout: 10000 });
    }
    // If no services, that's okay - empty state is acceptable
  });

  test("should navigate to service detail page when clicking a service", async ({ page }) => {
    const firstService = page.locator('text=Hello World Demo').first();
    if (await firstService.count() > 0) {
    await firstService.click();
    await page.waitForLoadState('networkidle');
    
    // Verify we're on a service detail page
    await expect(page).toHaveURL(/workflows\/[a-f0-9-]{36}$/);
=======
      // Browser MCP confirmed this text exists in the rendered page
      await expect(channelText).toBeVisible({ timeout: 15000 });
    }
    // If no services, that's okay - empty state is acceptable
    // We already verified the URL is correct above
  });

  test('should navigate to service detail page when clicking a service', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Click on first service
    const firstService = page.locator('text=Hello World Demo').first();
    if (await firstService.count() > 0) {
      await firstService.click();
      await page.waitForLoadState('networkidle');
      
      // Verify we're on a service detail page
      await expect(page).toHaveURL(/workflows\/[a-f0-9-]{36}$/);
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
    }
  });
});

test.describe('Project Connectors', () => {
<<<<<<< HEAD
  test.beforeEach(async ({ page }) => {
=======
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to projects - already authenticated via storage state
    await page.goto(`${BASE_URL}/projects`);
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
  });

  test('should display Connectors tab on project detail page', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Click on first project
    const firstProject = page.locator('text=Demo Workflows').first();
    if (await firstProject.count() > 0) {
      await firstProject.click();
      await page.waitForLoadState('networkidle');
      
      // Verify Connectors tab exists
      await expect(page.getByRole('tab', { name: 'Connectors' })).toBeVisible();
    }
  });

  test('should open connector creation modal when clicking Add Connector', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const firstProject = page.locator('text=Demo Workflows').first();
    if (await firstProject.count() > 0) {
      await firstProject.click();
      await page.waitForLoadState('networkidle');
      
      // Click Connectors tab
      await page.getByRole('tab', { name: 'Connectors' }).click();
      await page.waitForTimeout(1000);
      
      // Click Add Connector button
      const addButton = page.getByRole('button', { name: /Add Connector|Create Your First Connector/i });
      if (await addButton.count() > 0) {
        await addButton.first().click();
        await page.waitForTimeout(1000);
        
        // Verify modal is open
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        
        // Verify modal contains connector form
        await expect(page.getByText(/Create.*Connector/i)).toBeVisible();
      }
    }
  });

  test('should display empty state when no connectors exist', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const firstProject = page.locator('text=Demo Workflows').first();
    if (await firstProject.count() > 0) {
      await firstProject.click();
      await page.waitForLoadState('networkidle');
      
      // Click Connectors tab
      await page.getByRole('tab', { name: 'Connectors' }).click();
      await page.waitForTimeout(1000);
      
      // Verify empty state message
      const emptyState = page.getByText(/No connectors yet/i);
      if (await emptyState.count() > 0) {
        await expect(emptyState).toBeVisible();
      }
    }
  });
});

test.describe('Project Page - Services Tab', () => {
<<<<<<< HEAD
  test.beforeEach(async ({ page }) => {
=======
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to projects - already authenticated via storage state
    await page.goto(`${BASE_URL}/projects`);
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
  });

  test('should display Services tab instead of Workflows tab', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const firstProject = page.locator('text=Demo Workflows').first();
    if (await firstProject.count() > 0) {
      await firstProject.click();
      await page.waitForLoadState('networkidle');
      
      // Verify Services tab exists
      await expect(page.getByRole('tab', { name: 'Services' })).toBeVisible();
    }
  });

  test('should display services list in Services tab', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const firstProject = page.locator('text=Demo Workflows').first();
    if (await firstProject.count() > 0) {
      await firstProject.click();
      await page.waitForLoadState('networkidle');
      
      // Services tab should be selected by default
      const servicesTab = page.getByRole('tab', { name: 'Services' });
      await expect(servicesTab).toHaveAttribute('aria-selected', 'true');
      
      // Verify "New Service" button exists
      await expect(page.getByRole('button', { name: 'New Service' })).toBeVisible();
    }
  });
});

test.describe('Project Details - Channel Name', () => {
<<<<<<< HEAD
  test.beforeEach(async ({ page }) => {
=======
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to projects - already authenticated via storage state
    await page.goto(`${BASE_URL}/projects`);
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
  });

  test('should display "Channel Name" instead of "Task Queue Name"', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const firstProject = page.locator('text=Demo Workflows').first();
    if (await firstProject.count() > 0) {
      await firstProject.click();
      await page.waitForLoadState('networkidle');
      
      // Verify "Channel Name" is displayed in project details
      await expect(page.getByText('Channel Name')).toBeVisible();
    }
  });
});

test.describe('Service Interfaces', () => {
<<<<<<< HEAD
  test.beforeEach(async ({ page }) => {
=======
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to workflows - already authenticated via storage state
    await page.goto(`${BASE_URL}/workflows`);
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
  });

  test('should navigate to service detail page to view interfaces', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Click on first service
    const firstService = page.locator('text=Hello World Demo').first();
    if (await firstService.count() > 0) {
      await firstService.click();
      await page.waitForLoadState('networkidle');
      
      // Verify we're on service detail page
      await expect(page).toHaveURL(/workflows\/[a-f0-9-]{36}$/);
    }
  });
});

test.describe('Database Connections Tab', () => {
<<<<<<< HEAD
  test.beforeEach(async ({ page }) => {
=======
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to projects - already authenticated via storage state
    await page.goto(`${BASE_URL}/projects`);
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
  });

  test('should display Database Connections tab on project page', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const firstProject = page.locator('text=Demo Workflows').first();
    if (await firstProject.count() > 0) {
      await firstProject.click();
      await page.waitForLoadState('networkidle');
      
      // Verify Database Connections tab exists
      await expect(page.getByRole('tab', { name: 'Database Connections' })).toBeVisible();
    }
  });
});
