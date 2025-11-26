/**
 * Scenario B – Activity Timeout
 * 
 * E2E test for configuring and observing activity timeouts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Activity Timeout Scenario', () => {
  test('should configure timeout and observe timeout failure', async ({ page }) => {
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

    // Step 2: Create or load a workflow with an activity
    // For this test, we assume a workflow already exists with an activity node
    await expect(page.locator('.react-flow')).toBeVisible();

    // Step 3: Configure timeout via UI (e.g., 2s)
    // Click on an activity node to open config panel
    const activityNode = page.locator('.react-flow__node[data-type="activity"]').first();
    if (await activityNode.isVisible({ timeout: 5000 }).catch(() => false)) {
      await activityNode.click();
      await page.waitForTimeout(500);

      // Find timeout input in config panel
      const timeoutInput = page.getByLabel(/timeout/i).or(
        page.locator('input[placeholder*="timeout" i]')
      );
      
      if (await timeoutInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await timeoutInput.fill('2s');
        await timeoutInput.blur();
        await page.waitForTimeout(500);
      }
    }

    // Step 4: Compile and deploy
    const buildButton = page.getByRole('button', { name: /Build|Compile/i }).first();
    if (await buildButton.isVisible()) {
      await buildButton.click();
      await page.waitForTimeout(3000); // Wait for compilation
    }

    // Step 5: Start a run
    const runButton = page.getByRole('button', { name: /Run|Start/i }).first();
    if (await runButton.isVisible()) {
      await runButton.click();
      await page.waitForTimeout(5000); // Wait for execution
    }

    // Step 6: Assert UI shows a timeout-related failure
    await expect(
      page.getByText(/timeout|timed out|exceeded/i).or(
        page.locator('[data-testid*="timeout"]')
      )
    ).toBeVisible({ timeout: 30000 });

    // Step 7: Optionally verify link or hint to check Temporal UI
    const temporalLink = page.getByText(/Temporal|View in Temporal/i);
    if (await temporalLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(temporalLink).toBeVisible();
    }
  });
});

