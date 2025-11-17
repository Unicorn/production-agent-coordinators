/**
 * MCP Client for packages-api
 *
 * Makes HTTP requests to the MCP endpoint at MBERNIER_SERVER/api/mcp
 * using Bearer token authentication with MBERNIER_API_KEY.
 *
 * Implements JSON-RPC 2.0 protocol for MCP tool calls.
 */

export interface MCPClient {
  callTool(toolName: string, params: any): Promise<any>;
}

interface MCPRequest {
  jsonrpc: '2.0';
  id: string;
  method: 'tools/call';
  params: {
    name: string;
    arguments: any;
  };
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * MCP Client instance
 */
export const mcpClient: MCPClient = {
  async callTool(toolName: string, params: any): Promise<any> {
    const serverUrl = process.env.MBERNIER_SERVER;
    const apiKey = process.env.MBERNIER_API_KEY;

    if (!serverUrl || !apiKey) {
      throw new Error(
        'Missing MCP configuration. Required: MBERNIER_SERVER and MBERNIER_API_KEY environment variables'
      );
    }

    const mcpEndpoint = `${serverUrl}/api/mcp`;
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params,
      },
    };

    try {
      const response = await fetch(mcpEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(
          `MCP request failed: ${response.status} ${response.statusText}`
        );
      }

      // MCP over HTTP uses Server-Sent Events (SSE) format
      const text = await response.text();

      // Parse SSE format - look for data: lines
      const lines = text.split('\n');
      const dataLines = lines
        .filter(line => line.startsWith('data: '))
        .map(line => line.slice(6)); // Remove 'data: ' prefix

      if (dataLines.length === 0) {
        throw new Error('No data in SSE response');
      }

      // Parse the JSON from the SSE data line
      const mcpResponse = JSON.parse(dataLines[0]) as MCPResponse;

      // Check for JSON-RPC error
      if (mcpResponse.error) {
        throw new Error(
          `MCP tool error: ${mcpResponse.error.message} (code: ${mcpResponse.error.code})`
        );
      }

      // Extract result from MCP response
      if (!mcpResponse.result?.content?.[0]?.text) {
        throw new Error('Invalid MCP response: missing result content');
      }

      // Parse the text content as JSON (MCP returns stringified JSON)
      return JSON.parse(mcpResponse.result.content[0].text);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`MCP client error calling ${toolName}: ${error.message}`);
      }
      throw error;
    }
  },
};
