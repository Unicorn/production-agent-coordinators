/**
 * Agents Page E2E Tests
 * 
 * Tests agent prompts listing, creation, and management
 * 
 * Note: These tests use authenticated storage state from auth.setup.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Agents Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to agents page - already authenticated
    await page.goto(`${BASE_URL}/agents`);
    await page.waitForLoadState('networkidle');
  });

  test('should display agents page', async ({ page }) => {
    // Verify page elements
    await expect(page.getByRole('heading', { name: 'Agent Prompts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Agent Prompt' })).toBeVisible();
  });

  test('should show empty state when no agents exist', async ({ page }) => {
    // Check if we have agents or empty state
    const hasAgents = await page.locator('[data-testid="agent-card"]').count() > 0;
    
    if (!hasAgents) {
      // Verify empty state
      await expect(page.getByText(/No agent prompts/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Create Your First Agent/i })).toBeVisible();
    }
  });

  test('should navigate to create agent page', async ({ page }) => {
    // Click Create Manually button (updated UI)
    const createButton = page.getByRole('button', { name: /Create Manually|New Agent Prompt/i });
    await createButton.click();
    
    // Verify navigation to new agent page
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/agents/new`));
  });
});

test.describe('Agent Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to agents - already authenticated
    await page.goto(`${BASE_URL}/agents/new`);
  });

  test('should display agent creation form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Create Agent Prompt/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Build with AI Assistant/i })).toBeVisible();
    
    // Verify form fields exist
    await expect(page.getByRole('textbox', { name: /Name/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Display Name/i })).toBeVisible();
  });

  test('should create a new agent prompt', async ({ page }) => {
    const timestamp = Date.now();
    const agentName = `test-agent-${timestamp}`;
    
    await page.getByRole('textbox', { name: /Name/i }).fill(agentName);
    await page.getByRole('textbox', { name: /Display Name/i }).fill(`Test Agent ${timestamp}`);
    await page.getByRole('textbox', { name: /Prompt Content/i }).fill('You are a helpful assistant.');
    
    await page.getByRole('button', { name: /Create Agent Prompt/i }).click();
    
    // Should redirect to agents list
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/agents`), { timeout: 10000 });
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit without filling fields
    const submitButton = page.getByRole('button', { name: /Create Agent Prompt/i });
    await submitButton.click();
    
    // Should stay on the same page (validation prevents submission)
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/agents/new`));
  });
});

test.describe('Agent Management', () => {
  test('should display agent details', async ({ page }) => {
    // Navigate to agents list first
    await page.goto(`${BASE_URL}/agents`);
    await page.waitForLoadState('networkidle');
    
    // Try to find and click an agent card
    const agentCard = page.locator('[data-testid="agent-card"]').first();
    const hasAgents = await agentCard.isVisible().catch(() => false);
    
    if (hasAgents) {
      await agentCard.click();
      
      // Should navigate to agent detail page
      await expect(page).toHaveURL(new RegExp(`${BASE_URL}/agents/[^/]+`), { timeout: 5000 });
      
      // Should show agent details
      await expect(page.getByRole('button', { name: /Test Agent/i })).toBeVisible({ timeout: 3000 });
    } else {
      // Skip if no agents exist
      test.skip();
    }
  });

  test.skip('should edit agent prompt', async ({ page }) => {
    // TODO: Implement edit functionality tests when edit page exists
  });

  test.skip('should delete agent prompt', async ({ page }) => {
    // TODO: Implement delete functionality tests
  });
});

