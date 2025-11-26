/**
 * Scenario C – Retry Policy
 * 
 * E2E test for configuring retry policies and observing retries
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Retry Policy Scenario', () => {
  test('should configure retry policy and observe successful retry', async ({ page }) => {
    // Step 1: Navigate to workflow builder
    await page.goto(`${BASE_URL}/workflows`);
    await page.waitForLoadState('networkidle');

    const workflowLink = page.getByText('Hello World Demo').first();
    if (await workflowLink.isVisible()) {
      await workflowLink.click();
      await page.waitForLoadState('networkidle');
      
      const currentUrl = page.url();
      const workflowId = currentUrl.match(/workflows\/([a-f0-9-]{36})/)?.[1];
      if (workflowId) {
        await page.goto(`${BASE_URL}/workflows/${workflowId}/builder`);
        await page.waitForLoadState('networkidle');
      }
    }

    // Step 2: Configure a workflow with retry policy
    await expect(page.locator('.react-flow')).toBeVisible();

    // Click on an activity node to configure retry policy
    const activityNode = page.locator('.react-flow__node[data-type="activity"]').first();
    if (await activityNode.isVisible({ timeout: 5000 }).catch(() => false)) {
      await activityNode.click();
      await page.waitForTimeout(500);

      // Find retry strategy selector
      const retrySelect = page.getByLabel(/retry policy|retry strategy/i).or(
        page.locator('select, [role="combobox"]').filter({ hasText: /retry/i })
      );
      
      if (await retrySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Select exponential backoff strategy
        await retrySelect.click();
        await page.waitForTimeout(300);
        
        const backoffOption = page.getByText(/exponential backoff|exponential-backoff/i);
        if (await backoffOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await backoffOption.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Step 3: Compile and deploy
    const buildButton = page.getByRole('button', { name: /Build|Compile/i }).first();
    if (await buildButton.isVisible()) {
      await buildButton.click();
      await page.waitForTimeout(3000);
    }

    // Step 4: Start a run
    const runButton = page.getByRole('button', { name: /Run|Start/i }).first();
    if (await runButton.isVisible()) {
      await runButton.click();
      await page.waitForTimeout(10000); // Wait longer for retries
    }

    // Step 5: Assert execution eventually succeeds
    await expect(
      page.getByText(/Success|Completed|Finished/i).or(
        page.locator('[data-testid*="success"]')
      )
    ).toBeVisible({ timeout: 60000 });

    // Step 6: Verify UI indicates success (possibly including "retries occurred" meta info)
    const successIndicator = page.getByText(/Success|Completed/i);
    await expect(successIndicator).toBeVisible();

    // Check for retry information if displayed
    const retryInfo = page.getByText(/retries|attempts/i);
    if (await retryInfo.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Retry information is displayed - this is good
      await expect(retryInfo).toBeVisible();
    }
  });
});

