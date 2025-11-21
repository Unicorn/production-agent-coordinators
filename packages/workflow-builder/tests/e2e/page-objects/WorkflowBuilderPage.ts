/**
 * WorkflowBuilder Page Object Model
 *
 * Encapsulates all interactions with the workflow builder UI.
 * Provides a clean, maintainable API for E2E tests.
 */

import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export interface ActivityNodeConfig {
  name: string;
  timeout?: string;
  retryPolicy?: {
    maximumAttempts?: number;
    initialInterval?: string;
    backoffCoefficient?: number;
  };
}

export interface WorkflowConfig {
  name: string;
  description?: string;
  projectName?: string;
  useDefaultProject?: boolean;
}

export class WorkflowBuilderPage {
  readonly page: Page;
  readonly baseUrl: string;

  // Main UI Elements
  readonly canvas: Locator;
  readonly componentPalette: Locator;
  readonly propertyPanel: Locator;
  readonly toolbar: Locator;

  // Toolbar Buttons
  readonly saveButton: Locator;
  readonly compileButton: Locator;
  readonly buildAndRunButton: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;

  // Modals
  readonly codeViewerModal: Locator;
  readonly executionPanel: Locator;

  constructor(page: Page, baseUrl: string = 'http://localhost:3010') {
    this.page = page;
    this.baseUrl = baseUrl;

    // Initialize locators
    this.canvas = page.locator('.react-flow');
    this.componentPalette = page.locator('[data-testid="component-palette"]').or(
      page.locator('text=Components').locator('..')
    );
    this.propertyPanel = page.locator('[data-testid="property-panel"]');
    this.toolbar = page.locator('[data-testid="workflow-toolbar"]');

    // Toolbar buttons
    this.saveButton = page.getByRole('button', { name: /^save$/i });
    this.compileButton = page.getByRole('button', { name: /compile/i });
    this.buildAndRunButton = page.getByRole('button', { name: /build.*workflow/i });
    this.undoButton = page.getByRole('button', { name: /undo/i });
    this.redoButton = page.getByRole('button', { name: /redo/i });

    // Modals
    this.codeViewerModal = page.locator('[data-testid="code-viewer-modal"]').or(
      page.getByText(/generated typescript code/i).locator('..')
    );
    this.executionPanel = page.locator('[data-testid="execution-panel"]');
  }

  /**
   * Navigate to workflow creation page
   */
  async navigateToNewWorkflow(): Promise<void> {
    await this.page.goto(`${this.baseUrl}/workflows/new`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a new workflow through the form
   * Returns the workflow ID
   */
  async createWorkflow(config: WorkflowConfig): Promise<string> {
    await this.navigateToNewWorkflow();

    // Fill in workflow name
    await this.page.getByLabel(/workflow name/i).fill(config.name);

    // Fill in description if provided
    if (config.description) {
      const descriptionField = this.page.getByLabel(/description/i);
      if (await descriptionField.count() > 0) {
        await descriptionField.fill(config.description);
      }
    }

    // Handle project selection
    if (config.projectName) {
      const newProjectOption = this.page.getByText('+ Create New Project');
      if (await newProjectOption.count() > 0) {
        await newProjectOption.click();
        await this.page.getByPlaceholder(/enter project name/i).fill(config.projectName);
      }
    } else if (!config.useDefaultProject) {
      // Use first available project
      const projectSelect = this.page.getByRole('combobox', { name: /project/i });
      if (await projectSelect.count() > 0) {
        await projectSelect.click();
        await this.page.getByRole('option').first().click();
      }
    }

    // Submit form
    await this.page.getByRole('button', { name: /create & edit/i }).click();

    // Wait for redirect to workflow edit page
    await this.page.waitForURL(/\/workflows\/[a-f0-9-]{36}\/edit/, { timeout: 10000 });

    // Extract workflow ID from URL
    const match = this.page.url().match(/\/workflows\/([a-f0-9-]{36})/);
    if (!match) {
      throw new Error('Failed to extract workflow ID from URL');
    }

    return match[1];
  }

  /**
   * Navigate to workflow builder page for an existing workflow
   */
  async openBuilder(workflowId: string): Promise<void> {
    await this.page.goto(`${this.baseUrl}/workflows/${workflowId}/builder`);
    await this.page.waitForLoadState('networkidle');

    // Wait for canvas to load
    await expect(this.canvas).toBeVisible({ timeout: 10000 });
  }

  /**
   * Add an activity node to the canvas
   */
  async addActivityNode(config: ActivityNodeConfig): Promise<string> {
    // Find activity component in palette
    const activityComponent = this.page.getByText(/sample.*activity/i).first().or(
      this.page.locator('[data-component-type="activity"]').first()
    );
    await expect(activityComponent).toBeVisible();

    // Get canvas bounds for drop calculation
    const canvasBounds = await this.canvas.boundingBox();
    if (!canvasBounds) {
      throw new Error('Canvas not found');
    }

    // Drag component onto canvas center
    await activityComponent.hover();
    await this.page.mouse.down();
    await this.page.mouse.move(
      canvasBounds.x + canvasBounds.width / 2,
      canvasBounds.y + canvasBounds.height / 2
    );
    await this.page.mouse.up();

    // Wait for node to appear
    await this.page.waitForTimeout(500);

    // Get the newly created node
    const activityNodes = this.page.locator('[data-node-type="activity"]');
    const nodeCount = await activityNodes.count();
    const newNode = activityNodes.nth(nodeCount - 1);
    await expect(newNode).toBeVisible();

    // Click to select and configure
    await newNode.click();
    await this.page.waitForTimeout(300);

    // Configure node properties
    await this.configureActivityNode(config);

    // Get node ID
    const nodeId = await newNode.getAttribute('data-id');
    if (!nodeId) {
      throw new Error('Failed to get node ID');
    }

    return nodeId;
  }

  /**
   * Configure activity node properties in the property panel
   */
  private async configureActivityNode(config: ActivityNodeConfig): Promise<void> {
    // Configure activity name
    const nameInput = this.page.getByLabel(/activity name/i);
    if (await nameInput.count() > 0) {
      await nameInput.fill(config.name);
    }

    // Configure timeout if provided
    if (config.timeout) {
      const timeoutInput = this.page.getByLabel(/timeout/i);
      if (await timeoutInput.count() > 0) {
        await timeoutInput.fill(config.timeout);
      }
    }

    // Configure retry policy if provided
    if (config.retryPolicy) {
      if (config.retryPolicy.maximumAttempts !== undefined) {
        const maxAttemptsInput = this.page.getByLabel(/maximum attempts/i);
        if (await maxAttemptsInput.count() > 0) {
          await maxAttemptsInput.fill(config.retryPolicy.maximumAttempts.toString());
        }
      }

      if (config.retryPolicy.initialInterval) {
        const initialIntervalInput = this.page.getByLabel(/initial interval/i);
        if (await initialIntervalInput.count() > 0) {
          await initialIntervalInput.fill(config.retryPolicy.initialInterval);
        }
      }

      if (config.retryPolicy.backoffCoefficient !== undefined) {
        const backoffInput = this.page.getByLabel(/backoff coefficient/i);
        if (await backoffInput.count() > 0) {
          await backoffInput.fill(config.retryPolicy.backoffCoefficient.toString());
        }
      }
    }

    // Close property panel
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  /**
   * Delete a node from the canvas
   */
  async deleteNode(nodeId: string): Promise<void> {
    const node = this.page.locator(`[data-id="${nodeId}"]`);
    await expect(node).toBeVisible();

    // Click to select
    await node.click();
    await this.page.waitForTimeout(200);

    // Press delete key
    await this.page.keyboard.press('Delete');
    await this.page.waitForTimeout(300);

    // Verify node is removed
    await expect(node).not.toBeVisible();
  }

  /**
   * Connect two nodes on the canvas
   */
  async connectNodes(sourceNodeId: string, targetNodeId: string): Promise<void> {
    const sourceNode = this.page.locator(`[data-id="${sourceNodeId}"]`);
    const targetNode = this.page.locator(`[data-id="${targetNodeId}"]`);

    await expect(sourceNode).toBeVisible();
    await expect(targetNode).toBeVisible();

    // Find connection handles
    const sourceHandle = sourceNode.locator('.react-flow__handle-right').or(
      sourceNode.locator('.react-flow__handle-bottom')
    );
    const targetHandle = targetNode.locator('.react-flow__handle-left').or(
      targetNode.locator('.react-flow__handle-top')
    );

    // Drag from source to target
    await sourceHandle.first().hover();
    await this.page.mouse.down();
    await targetHandle.first().hover();
    await this.page.mouse.up();

    await this.page.waitForTimeout(300);
  }

  /**
   * Save the workflow
   */
  async save(): Promise<void> {
    await this.saveButton.click();
    await this.page.waitForTimeout(1000);

    // Look for save confirmation
    const saveIndicator = this.page.locator('text=/saved|saving complete/i');
    if (await saveIndicator.count() > 0) {
      await expect(saveIndicator.first()).toBeVisible({ timeout: 3000 });
    }
  }

  /**
   * Compile the workflow and view generated code
   */
  async compile(): Promise<void> {
    await expect(this.compileButton).toBeVisible();
    await this.compileButton.click();

    // Wait for compilation to complete
    await expect(
      this.page.getByText(/generated typescript code/i)
    ).toBeVisible({ timeout: 15000 });
  }

  /**
   * Get generated code from code viewer modal
   */
  async getGeneratedCode(tab: 'workflow' | 'activities' | 'worker'): Promise<string> {
    // Switch to the appropriate tab
    const tabButton = this.page.getByRole('button', { name: new RegExp(tab, 'i') });
    if (await tabButton.count() > 0) {
      await tabButton.click();
      await this.page.waitForTimeout(300);
    }

    // Extract code content
    const codeBlock = this.page.locator('pre code').or(
      this.page.locator('[data-testid="code-content"]')
    );
    const code = await codeBlock.first().textContent();

    return code || '';
  }

  /**
   * Close code viewer modal
   */
  async closeCodeViewer(): Promise<void> {
    const closeButton = this.page.getByRole('button', { name: /close/i }).last();
    await closeButton.click();

    // Wait for modal to close
    await expect(
      this.page.getByText(/generated typescript code/i)
    ).not.toBeVisible();
  }

  /**
   * Build and execute the workflow
   */
  async buildAndRun(input?: Record<string, any>): Promise<string> {
    await expect(this.buildAndRunButton).toBeVisible();
    await this.buildAndRunButton.click();

    // If input modal appears, fill it
    if (input) {
      const inputModal = this.page.locator('[data-testid="execution-input-modal"]');
      if (await inputModal.count() > 0) {
        const inputField = this.page.getByLabel(/input|payload/i);
        if (await inputField.count() > 0) {
          await inputField.fill(JSON.stringify(input));
        }

        const runButton = this.page.getByRole('button', { name: /run|execute/i });
        await runButton.click();
      }
    }

    // Wait for execution to start
    await this.page.waitForTimeout(1000);

    // Try to extract execution ID
    const executionId = await this.executionPanel.getAttribute('data-execution-id');
    if (executionId) {
      return executionId;
    }

    // Fallback: use timestamp-based ID
    return `exec-${Date.now()}`;
  }

  /**
   * Wait for execution to complete
   * Returns final status: 'completed' | 'failed'
   */
  async waitForExecution(timeout: number = 30000): Promise<'completed' | 'failed'> {
    const statusLocator = this.page.locator('[data-testid="execution-status"]').or(
      this.page.locator('text=/completed|failed/i').first()
    );

    try {
      await expect(statusLocator).toHaveText(/completed|failed/i, { timeout });
      const status = await statusLocator.textContent();
      return status?.toLowerCase().includes('completed') ? 'completed' : 'failed';
    } catch (error) {
      throw new Error(`Execution did not complete within ${timeout}ms`);
    }
  }

  /**
   * Get execution result/output
   */
  async getExecutionResult(): Promise<any> {
    const outputLocator = this.page.locator('[data-testid="execution-output"]');

    if (await outputLocator.count() === 0) {
      return null;
    }

    const outputText = await outputLocator.textContent();
    if (!outputText) {
      return null;
    }

    try {
      return JSON.parse(outputText);
    } catch {
      return outputText;
    }
  }

  /**
   * Get execution error if failed
   */
  async getExecutionError(): Promise<string | null> {
    const errorLocator = this.page.locator('[data-testid="execution-error"]').or(
      this.page.locator('text=/error:/i')
    );

    if (await errorLocator.count() === 0) {
      return null;
    }

    return await errorLocator.first().textContent();
  }

  /**
   * Check if a validation error is displayed
   */
  async hasValidationError(): Promise<boolean> {
    const errorLocator = this.page.locator('text=/must have|required|invalid|empty|missing/i');
    return await errorLocator.count() > 0;
  }

  /**
   * Get validation error message
   */
  async getValidationError(): Promise<string | null> {
    const errorLocator = this.page.locator('text=/must have|required|invalid|empty|missing/i');

    if (await errorLocator.count() === 0) {
      return null;
    }

    return await errorLocator.first().textContent();
  }

  /**
   * Get count of activity nodes on canvas
   */
  async getActivityNodeCount(): Promise<number> {
    return await this.page.locator('[data-node-type="activity"]').count();
  }

  /**
   * Verify canvas is loaded and ready
   */
  async verifyCanvasLoaded(): Promise<void> {
    await expect(this.canvas).toBeVisible({ timeout: 10000 });
  }

  /**
   * Navigate to workflow detail page
   */
  async navigateToWorkflowDetail(workflowId: string): Promise<void> {
    await this.page.goto(`${this.baseUrl}/workflows/${workflowId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to workflows list
   */
  async navigateToWorkflowsList(): Promise<void> {
    await this.page.goto(`${this.baseUrl}/workflows`);
    await this.page.waitForLoadState('networkidle');
  }
}
