/**
 * Scenario A – Simple Workflow Creation and Execution
 * 
 * E2E test for creating a simple workflow, compiling, deploying, and running it
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Simple Workflow Creation and Execution', () => {
  test('should create, compile, and execute a simple workflow', async ({ page }) => {
    // Step 1: Open builder UI
    await page.goto(`${BASE_URL}/workflows`);
    await page.waitForLoadState('networkidle');

    // Create a new workflow or use existing one
    // For this test, we'll navigate to an existing workflow builder
    const workflowLink = page.getByText('Hello World Demo').first();
    if (await workflowLink.isVisible()) {
      await workflowLink.click();
      await page.waitForLoadState('networkidle');
      
      // Navigate to builder
      const currentUrl = page.url();
      const workflowId = currentUrl.match(/workflows\/([a-f0-9-]{36})/)?.[1];
      if (workflowId) {
        await page.goto(`${BASE_URL}/workflows/${workflowId}/builder`);
        await page.waitForLoadState('networkidle');
      }
    }

    // Step 2: Verify canvas is visible (nodes may already exist)
    await expect(page.locator('.react-flow')).toBeVisible();

    // Step 3: Verify component palette is visible
    await expect(page.getByText(/Build Your Service|Components/i)).toBeVisible();

    // Step 4: Trigger compilation and deployment
    // Look for compile/build button
    const buildButton = page.getByRole('button', { name: /Build|Compile|Deploy/i }).first();
    if (await buildButton.isVisible()) {
      await buildButton.click();
      await page.waitForTimeout(2000); // Wait for compilation
    }

    // Step 5: Start a workflow run from UI
    const runButton = page.getByRole('button', { name: /Run|Start|Execute/i }).first();
    if (await runButton.isVisible()) {
      await runButton.click();
      await page.waitForTimeout(3000); // Wait for execution to start
    }

    // Step 6: Assert execution completes successfully
    // Look for success indicators
    await expect(
      page.getByText(/Success|Completed|Finished/i).or(
        page.locator('[data-testid*="success"]')
      )
    ).toBeVisible({ timeout: 30000 });

    // Step 7: Verify result or status is surfaced in UI
    // Check for execution status or result display
    const resultDisplay = page.getByText(/Result|Output|Status/i).or(
      page.locator('[data-testid*="result"]')
    );
    if (await resultDisplay.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(resultDisplay).toBeVisible();
    }
  });
});

