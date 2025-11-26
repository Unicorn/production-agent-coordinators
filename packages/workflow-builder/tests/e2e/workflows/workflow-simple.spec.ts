/**
 * Scenario A – Simple Workflow Creation and Execution
 * 
 * E2E test for creating a simple workflow from scratch, compiling, deploying, and running it
 * 
 * Prerequisites:
 * - Temporal server running (yarn infra:up)
 * - Next.js dev server running on port 3010
 * - Authenticated session (via auth.setup.ts)
 */

import { test, expect } from '@playwright/test';
import { WorkflowBuilderPage } from '../page-objects/WorkflowBuilderPage';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Simple Workflow Creation and Execution', () => {
  test('should create, compile, and execute a simple workflow from scratch', async ({ page }) => {
    const builder = new WorkflowBuilderPage(page, BASE_URL);
    const workflowName = `Test Simple Workflow ${Date.now()}`;

    // Step 1: Create a new workflow (redirects to /edit)
    const workflowId = await builder.createWorkflow({
      name: workflowName,
      useDefaultProject: true,
    });

    // Verify we're on the edit page
    await expect(page).toHaveURL(/\/workflows\/.*\/edit/);

    // Step 2: Navigate to builder
    await builder.openBuilder(workflowId);

    // Step 3: Verify canvas is loaded
    await builder.verifyCanvasLoaded();

    // Step 4: Add a trigger node (API endpoint or webhook)
    // First, expand "Receive Data" category
    const receiveDataCategory = page.getByText(/Receive Data/i).first();
    await expect(receiveDataCategory).toBeVisible();
    
    // Click to expand category
    const categoryButton = receiveDataCategory.locator('..').locator('..').first();
    await categoryButton.click();
    await page.waitForTimeout(500);

    // Find a trigger component
    const triggerComponent = page.locator('[draggable="true"]').filter({ 
      hasText: /endpoint|webhook|trigger|api/i 
    }).first();
    
    // If no trigger found in Receive Data, try Core Actions
    let componentToDrag = triggerComponent;
    if (!(await triggerComponent.isVisible({ timeout: 2000 }).catch(() => false))) {
      const coreActionsCategory = page.getByText(/Core Actions/i).first();
      await coreActionsCategory.locator('..').locator('..').first().click();
      await page.waitForTimeout(500);
      
      componentToDrag = page.locator('[draggable="true"]').first();
    }

    await expect(componentToDrag).toBeVisible();

    // Drag trigger to canvas
    const canvas = builder.canvas;
    const canvasBounds = await canvas.boundingBox();
    if (!canvasBounds) {
      throw new Error('Canvas not found');
    }

    await componentToDrag.dragTo(canvas, {
      targetPosition: { x: canvasBounds.width / 2 - 150, y: canvasBounds.height / 2 },
    });
    await page.waitForTimeout(1000);

    // Get trigger node ID
    const triggerNodes = page.locator('.react-flow__node');
    const triggerNodeCount = await triggerNodes.count();
    const triggerNode = triggerNodes.nth(triggerNodeCount - 1);
    const triggerNodeId = await triggerNode.getAttribute('id') || 
                          await triggerNode.getAttribute('data-id') ||
                          `trigger-${Date.now()}`;

    // Step 5: Add an activity node
    const coreActionsCategory = page.getByText(/Core Actions/i).first();
    await coreActionsCategory.locator('..').locator('..').first().click();
    await page.waitForTimeout(500);

    // Find an activity component
    const activityComponent = page.locator('[draggable="true"]').filter({ 
      hasNotText: /trigger|agent|signal/i 
    }).first();
    
    await expect(activityComponent).toBeVisible();

    // Drag activity to right of trigger
    await activityComponent.dragTo(canvas, {
      targetPosition: { x: canvasBounds.width / 2 + 150, y: canvasBounds.height / 2 },
    });
    await page.waitForTimeout(1000);

    // Get activity node ID
    const activityNodes = page.locator('.react-flow__node');
    const activityNodeCount = await activityNodes.count();
    const activityNode = activityNodes.nth(activityNodeCount - 1);
    const activityNodeId = await activityNode.getAttribute('id') || 
                          await activityNode.getAttribute('data-id') ||
                          `activity-${Date.now()}`;

    // Step 6: Connect nodes
    // Use React Flow's connection handles
    const sourceHandle = triggerNode.locator('.react-flow__handle-right, .react-flow__handle-source').first();
    const targetHandle = activityNode.locator('.react-flow__handle-left, .react-flow__handle-target').first();

    // Try to connect via handles
    if (await sourceHandle.isVisible({ timeout: 2000 }).catch(() => false) && 
        await targetHandle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sourceHandle.hover();
      await page.mouse.down();
      await targetHandle.hover();
      await page.mouse.up();
    } else {
      // Fallback: use page object method if node IDs are available
      try {
        await builder.connectNodes(triggerNodeId, activityNodeId);
      } catch {
        // Last resort: drag from trigger center to activity center
        await triggerNode.dragTo(activityNode);
      }
    }
    await page.waitForTimeout(500);

    // Verify connection was created
    const edges = page.locator('.react-flow__edge');
    await expect(edges).toHaveCount(1, { timeout: 2000 });

    // Step 7: Save workflow
    await builder.save();

    // Step 8: Compile workflow (optional - can skip if deploy does it automatically)
    const compileButton = page.getByTestId('compile-workflow-button');
    if (await compileButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await builder.compile();
      await builder.closeCodeViewer();
    }

    // Step 9: Build and run workflow
    await builder.buildAndRun();

    // Step 10: Wait for execution to complete
    const status = await builder.waitForExecution(60000);
    
    // Step 11: Verify execution completed successfully
    expect(status).toBe('completed');

    // Verify no error is displayed
    const error = await builder.getExecutionError();
    if (error) {
      throw new Error(`Workflow execution failed: ${error}`);
    }

    // Verify result is available
    const result = await builder.getExecutionResult();
    expect(result).toBeTruthy();
  });
});
