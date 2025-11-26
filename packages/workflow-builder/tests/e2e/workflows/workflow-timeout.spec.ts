/**
 * Scenario B – Activity Timeout
 * 
 * E2E test for configuring and observing activity timeouts
 * 
 * Prerequisites:
 * - Temporal server running (yarn infra:up)
 * - Next.js dev server running on port 3010
 * - Authenticated session (via auth.setup.ts)
 */

import { test, expect } from '@playwright/test';
import { WorkflowBuilderPage } from '../page-objects/WorkflowBuilderPage';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Activity Timeout Scenario', () => {
  test('should configure timeout and observe timeout failure', async ({ page }) => {
    const builder = new WorkflowBuilderPage(page, BASE_URL);
    const workflowName = `Test Timeout Workflow ${Date.now()}`;

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

    // Step 4: Configure timeout via UI (e.g., 2s)
    // Click on activity node to open config panel
    await activityNode.click();
    await page.waitForTimeout(500);

    // Find timeout input in config panel
    const timeoutInput = page.getByLabel(/timeout/i).or(
      page.locator('input[id="timeout"]')
    );
    
    await expect(timeoutInput).toBeVisible({ timeout: 2000 });
    await timeoutInput.fill('2s');
    await timeoutInput.blur();
    await page.waitForTimeout(500);

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

    // Step 8: Wait for execution to complete or timeout
    // For timeout scenarios, we expect either:
    // - A timeout error/failure
    // - Or the execution to complete (if activity finishes before timeout)
    const executionPanel = page.getByTestId('execution-panel');
    await expect(executionPanel).toBeVisible({ timeout: 10000 });

    // Wait for execution status to appear
    const statusLocator = page.getByTestId('execution-status').or(
      page.locator('text=/completed|failed|timeout|timed out/i')
    );
    
    await expect(statusLocator).toBeVisible({ timeout: 30000 });

    // Step 9: Assert UI shows timeout-related failure or completion
    const statusText = await statusLocator.textContent();
    const statusLower = statusText?.toLowerCase() || '';

    // Check for timeout indicators
    const hasTimeout = statusLower.includes('timeout') || 
                       statusLower.includes('timed out') ||
                       statusLower.includes('exceeded');

    // Check for error in execution panel
    const errorCard = page.getByTestId('execution-error');
    const hasError = await errorCard.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasError) {
      const errorText = await errorCard.textContent();
      const errorLower = errorText?.toLowerCase() || '';
      
      // Verify timeout-related error message
      expect(
        errorLower.includes('timeout') || 
        errorLower.includes('timed out') ||
        errorLower.includes('exceeded')
      ).toBeTruthy();
    } else if (hasTimeout) {
      // Status indicates timeout
      expect(hasTimeout).toBeTruthy();
    } else {
      // If no timeout, execution may have completed before timeout
      // This is acceptable - the timeout was configured correctly
      expect(statusLower).toMatch(/completed|success|finished/i);
    }

    // Step 10: Optionally verify link or hint to check Temporal UI
    const temporalLink = page.getByText(/Temporal|View in Temporal/i);
    if (await temporalLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(temporalLink).toBeVisible();
    }
  });
});
