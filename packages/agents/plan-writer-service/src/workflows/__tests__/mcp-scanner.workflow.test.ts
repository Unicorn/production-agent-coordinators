import { describe, it, expect } from 'vitest';
import { MCPScannerWorkflow } from '../mcp-scanner.workflow';

describe('MCPScannerWorkflow', () => {
  it('should have correct workflow name', () => {
    expect(MCPScannerWorkflow.name).toBe('MCPScannerWorkflow');
  });

  it('should be an async function', () => {
    expect(MCPScannerWorkflow).toBeInstanceOf(Function);
    expect(MCPScannerWorkflow.constructor.name).toBe('AsyncFunction');
  });

  // TODO: Add integration tests with TestWorkflowEnvironment
  // Full workflow execution tests require compiled JavaScript and Temporal test environment
  // These can be added in a future phase when we set up proper integration testing
});
