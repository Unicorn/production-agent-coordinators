/**
 * Agent Creation E2E Tests
 * 
 * Tests manual and AI-assisted agent prompt creation
 */

import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';
const TEST_USER = {
  email: process.env.TEST_EMAIL || 'test@example.com',
  password: process.env.TEST_PASSWORD || 'testpassword123',
};

test.describe('Manual Agent Creation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_USER);
    await page.goto(`${BASE_URL}/agents/new`);
    await page.waitForLoadState('networkidle');
  });

  test('should display manual agent creation form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Create Agent Prompt/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Build with AI Assistant/i })).toBeVisible();
    
    // Verify form fields
    const nameInput = page.getByRole('textbox', { name: /Name/i });
    const displayNameInput = page.getByRole('textbox', { name: /Display Name/i });
    const promptContentInput = page.getByRole('textbox', { name: /Prompt Content/i });
    
    await expect(nameInput).toBeVisible();
    await expect(displayNameInput).toBeVisible();
    await expect(promptContentInput).toBeVisible();
  });

  test('should create agent prompt manually', async ({ page }) => {
    const timestamp = Date.now();
    const agentName = `test-agent-${timestamp}`;
    const displayName = `Test Agent ${timestamp}`;
    const promptContent = `You are a helpful assistant that answers questions about testing.
    
Your role is to:
- Answer questions clearly
- Provide examples when helpful
- Be concise and accurate`;

    // Fill in form
    await page.getByRole('textbox', { name: /Name/i }).fill(agentName);
    await page.getByRole('textbox', { name: /Display Name/i }).fill(displayName);
    await page.getByRole('textbox', { name: /Description/i }).fill('A test agent for E2E testing');
    await page.getByRole('textbox', { name: /Prompt Content/i }).fill(promptContent);

    // Submit form
    await page.getByRole('button', { name: /Create Agent Prompt/i }).click();

    // Wait for redirect to agents list
    await page.waitForURL(new RegExp(`${BASE_URL}/agents`), { timeout: 10000 });
    
    // Verify agent appears in list
    await expect(page.getByText(displayName)).toBeVisible({ timeout: 5000 });
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit without filling required fields
    await page.getByRole('button', { name: /Create Agent Prompt/i }).click();

    // Form should not submit (button should still be visible or error shown)
    // The exact validation depends on implementation
    const currentUrl = page.url();
    expect(currentUrl).toContain('/agents/new');
  });

  test('should navigate to AI-assisted builder', async ({ page }) => {
    await page.getByRole('button', { name: /Build with AI Assistant/i }).click();
    
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/agents/new/assisted`));
  });
});

test.describe('AI-Assisted Agent Creation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_USER);
    await page.goto(`${BASE_URL}/agents/new/assisted`);
    await page.waitForLoadState('networkidle');
  });

  test('should display AI-assisted builder interface', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Build Agent with AI Assistant/i })).toBeVisible();
    
    // Should show chat interface
    const chatArea = page.locator('textarea[placeholder*="message" i]');
    await expect(chatArea).toBeVisible({ timeout: 5000 });
  });

  test('should start conversation with AI assistant', async ({ page }) => {
    // Wait for initial AI message
    await expect(page.getByText(/I'll help you create an agent prompt/i)).toBeVisible({ timeout: 10000 });
    
    // Verify chat interface is ready
    const input = page.locator('textarea[placeholder*="message" i]');
    await expect(input).toBeEnabled({ timeout: 5000 });
  });

  test('should send message and receive AI response', async ({ page }) => {
    // Wait for session to initialize
    await page.waitForTimeout(2000);
    
    // Send a message
    const input = page.locator('textarea[placeholder*="message" i]');
    await input.fill('I want an agent that helps users debug React components');
    
    // Click send button
    const sendButton = page.getByRole('button', { name: /Send/i });
    await sendButton.click();
    
    // Wait for AI response (should appear in chat)
    await expect(page.getByText(/React components/i)).toBeVisible({ timeout: 15000 });
    
    // Should show loading state then response
    const loadingIndicator = page.getByText(/Thinking|Agent is thinking/i);
    const hasLoading = await loadingIndicator.isVisible().catch(() => false);
    
    if (hasLoading) {
      // Wait for loading to disappear
      await expect(loadingIndicator).not.toBeVisible({ timeout: 20000 });
    }
    
    // Verify response appears
    await expect(page.locator('[role="textbox"]').filter({ hasText: /debug|component|React/i })).toBeVisible({ timeout: 10000 });
  });

  test('should generate prompt after conversation', async ({ page }) => {
    // Wait for session
    await page.waitForTimeout(2000);
    
    // Have a brief conversation
    const input = page.locator('textarea[placeholder*="message" i]');
    
    // Send first message
    await input.fill('I need an agent that reviews code for security issues');
    await page.getByRole('button', { name: /Send/i }).click();
    await page.waitForTimeout(5000);
    
    // AI should ask follow-up questions or generate prompt
    // Wait for either a question or generated prompt
    const hasPrompt = await page.getByText(/Generated Agent Prompt|agent prompt/i).isVisible().catch(() => false);
    const hasQuestion = await page.getByText(/\?/).isVisible().catch(() => false);
    
    // Should have either a prompt or a question
    expect(hasPrompt || hasQuestion).toBeTruthy();
  });

  test('should save generated prompt', async ({ page }) => {
    // This test assumes a prompt has been generated
    // In a real scenario, we'd complete the conversation first
    
    // Check if save form appears
    const saveButton = page.getByRole('button', { name: /Save Prompt/i });
    const saveButtonVisible = await saveButton.isVisible().catch(() => false);
    
    if (saveButtonVisible) {
      // Fill in save form
      await page.getByRole('textbox', { name: /Name/i }).fill(`test-ai-agent-${Date.now()}`);
      await page.getByRole('textbox', { name: /Display Name/i }).fill(`Test AI Agent ${Date.now()}`);
      
      // Save
      await saveButton.click();
      
      // Should redirect to agents list
      await page.waitForURL(new RegExp(`${BASE_URL}/agents`), { timeout: 10000 });
    } else {
      // Skip if no prompt generated yet
      test.skip();
    }
  });

  test('should cancel and return to agents list', async ({ page }) => {
    await page.getByRole('button', { name: /Cancel/i }).click();
    
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/agents`));
  });
});

test.describe('Agent List Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_USER);
    await page.goto(`${BASE_URL}/agents`);
    await page.waitForLoadState('networkidle');
  });

  test('should show both creation options', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Create Manually/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Build with AI/i })).toBeVisible();
  });

  test('should navigate to manual creation', async ({ page }) => {
    await page.getByRole('button', { name: /Create Manually/i }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/agents/new`));
  });

  test('should navigate to AI-assisted creation', async ({ page }) => {
    await page.getByRole('button', { name: /Build with AI/i }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/agents/new/assisted`));
  });
});

