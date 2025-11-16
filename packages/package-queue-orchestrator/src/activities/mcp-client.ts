/**
 * MCP Client Stub
 *
 * This is a placeholder for MCP integration.
 * In Temporal activities, MCP tools are not directly available.
 *
 * Future implementations will:
 * 1. Use REST API calls to packages-api (preferred)
 * 2. Or use MCP client library if needed
 *
 * For now, this provides the interface that activities expect.
 */

export interface MCPClient {
  callTool(toolName: string, params: any): Promise<any>;
}

/**
 * MCP Client instance
 *
 * This will be initialized based on environment configuration.
 * Currently returns a stub implementation.
 */
export const mcpClient: MCPClient = {
  async callTool(toolName: string, params: any): Promise<any> {
    // TODO: Implement actual MCP tool calls or REST API calls
    // For now, throw to indicate not implemented
    throw new Error(`MCP client not implemented yet. Tool: ${toolName}, Params: ${JSON.stringify(params)}`);
  },
};
