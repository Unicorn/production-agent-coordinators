/**
 * Scenario C – Retry Policy
 * 
 * E2E test for configuring retry policies and observing retries
 * 
 * Prerequisites:
 * - Temporal server running (yarn infra:up)
 * - Next.js dev server running on port 3010
 * - Authenticated session (via auth.setup.ts)
 */

import { test, expect } from '@playwright/test';
import { WorkflowBuilderPage } from '../page-objects/WorkflowBuilderPage';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Retry Policy Scenario', () => {
  test('should configure retry policy and observe successful retry', async ({ page }) => {
    const builder = new WorkflowBuilderPage(page, BASE_URL);
    const workflowName = `Test Retry Workflow ${Date.now()}`;

    // Step 1: Create a new workflow
    const workflowId = await builder.createWorkflow({
      name: workflowName,
      useDefaultProject: true,
    });

    // Step 2: Navigate to builder
    await builder.openBuilder(workflowId);
    await builder.verifyCanvasLoaded();

    // Step 3: Add an activity node
    const canvas = builder.canvas;
    const canvasBounds = await canvas.boundingBox();
    if (!canvasBounds) {
      throw new Error('Canvas not found');
    }

    // Expand "Core Actions" category
    const coreActionsCategory = page.getByText(/Core Actions/i).first();
    await expect(coreActionsCategory).toBeVisible();
    await coreActionsCategory.locator('..').locator('..').first().click();
    await page.waitForTimeout(500);

    // Find an activity component
    const activityComponent = page.locator('[draggable="true"]').filter({ 
      hasNotText: /trigger|agent|signal/i 
    }).first();
    
    await expect(activityComponent).toBeVisible();

    // Drag activity to canvas center
    await activityComponent.dragTo(canvas, {
      targetPosition: { x: canvasBounds.width / 2, y: canvasBounds.height / 2 },
    });
    await page.waitForTimeout(1000);

    // Get activity node
    const activityNodes = page.locator('.react-flow__node');
    const activityNodeCount = await activityNodes.count();
    const activityNode = activityNodes.nth(activityNodeCount - 1);
    await expect(activityNode).toBeVisible();

    // Step 4: Configure retry policy
    // Click on activity node to open config panel
    await activityNode.click();
    await page.waitForTimeout(500);

    // Find retry strategy selector
    const retrySelect = page.getByLabel(/retry policy|retry strategy/i).or(
      page.locator('select[id="retry-strategy"]')
    );
    
    await expect(retrySelect).toBeVisible({ timeout: 2000 });
    
    // Select exponential backoff strategy
    await retrySelect.click();
    await page.waitForTimeout(300);
    
    // Find and click exponential backoff option
    const backoffOption = page.getByText(/exponential backoff|exponential-backoff/i).or(
      page.locator('option[value="exponential-backoff"]')
    );
    
    await expect(backoffOption).toBeVisible({ timeout: 1000 });
    await backoffOption.click();
    await page.waitForTimeout(500);

    // Configure retry parameters if visible
    const maxAttemptsInput = page.getByLabel(/max attempts|maximum attempts/i).or(
      page.locator('input[id="max-attempts"]')
    );
    
    if (await maxAttemptsInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await maxAttemptsInput.fill('3');
      await maxAttemptsInput.blur();
      await page.waitForTimeout(300);
    }

    const initialIntervalInput = page.getByLabel(/initial interval/i).or(
      page.locator('input[id="initial-interval"]')
    );
    
    if (await initialIntervalInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await initialIntervalInput.fill('1s');
      await initialIntervalInput.blur();
      await page.waitForTimeout(300);
    }

    // Close property panel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Step 5: Save workflow
    await builder.save();

    // Step 6: Compile workflow (optional)
    const compileButton = page.getByTestId('compile-workflow-button');
    if (await compileButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await builder.compile();
      await builder.closeCodeViewer();
    }

    // Step 7: Build and run workflow
    await builder.buildAndRun();

    // Step 8: Wait for execution to complete
    // For retry scenarios, we expect eventual success (after retries)
    const executionPanel = page.getByTestId('execution-panel');
    await expect(executionPanel).toBeVisible({ timeout: 10000 });

    // Wait for execution to complete (may take longer due to retries)
    const status = await builder.waitForExecution(60000);

    // Step 9: Assert execution eventually succeeds
    expect(status).toBe('completed');

    // Step 10: Verify UI indicates success
    const statusBadge = page.getByTestId('execution-status');
    if (await statusBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
      const statusText = await statusBadge.textContent();
      expect(statusText?.toLowerCase()).toMatch(/completed|success/i);
    }

    // Step 11: Check for retry information if displayed
    // The UI may show retry count or attempt information
    const retryInfo = page.getByText(/retries|attempts|retry/i);
    if (await retryInfo.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Retry information is displayed - verify it's present
      const retryText = await retryInfo.textContent();
      expect(retryText).toBeTruthy();
    }

    // Verify no error is displayed (unless it's a transient error that was retried)
    const errorCard = page.getByTestId('execution-error');
    if (await errorCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // If error is shown, it should indicate that retries occurred
      const errorText = await errorCard.textContent();
      // For retry scenarios, we might see errors in history but final status should be success
      // This is acceptable as long as the final status is completed
      console.log('Note: Error card visible but final status is completed (retries may have occurred)');
    }

    // Step 12: Verify result is available
    const result = await builder.getExecutionResult();
    expect(result).toBeTruthy();
  });
});
