import { describe, it, expect } from 'vitest';
import { MCPPollerWorkflow } from '../mcp-poller.workflow.js';

describe('MCPPollerWorkflow', () => {
  it('should be a function', () => {
    expect(typeof MCPPollerWorkflow).toBe('function');
  });

  it('should have the correct workflow signature', () => {
    // Verify the workflow is exported and callable
    expect(MCPPollerWorkflow).toBeDefined();
    expect(MCPPollerWorkflow.name).toBe('MCPPollerWorkflow');
  });
});
