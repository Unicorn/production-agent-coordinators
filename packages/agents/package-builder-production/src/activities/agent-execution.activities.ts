import type { AgentExecutionResult } from '../types/coordinator.types.js'
import type { ExecuteAgentInput } from '../types/index.js'

/**
 * Execute agent task with Claude AI
 *
 * Calls the Anthropic API with the provided prompt and returns Claude's response.
 * Uses the Messages API with streaming disabled for reliable, complete responses.
 *
 * @param input - Execution configuration
 * @returns Claude's response as a string
 * @throws Error if API call fails or authentication is invalid
 */
export async function executeAgentWithClaude(input: ExecuteAgentInput): Promise<string> {
  const {
    prompt,
    model = 'claude-sonnet-4-5-20250929',
    temperature = 0.2,
    maxTokens = 8000
  } = input;

  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  // Anthropic Messages API endpoint
  const url = 'https://api.anthropic.com/v1/messages';

  const requestBody = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 401) {
        throw new Error('Authentication failed - check ANTHROPIC_API_KEY is valid');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded - please retry after a delay');
      } else if (response.status === 400) {
        throw new Error(`Bad request: ${errorText}`);
      } else {
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
      stop_reason: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    // Extract text from response content
    const textContent = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    if (!textContent) {
      throw new Error('Claude returned empty response');
    }

    // Log token usage for monitoring
    console.log(`[Claude] Input tokens: ${data.usage.input_tokens}`);
    console.log(`[Claude] Output tokens: ${data.usage.output_tokens}`);
    console.log(`[Claude] Stop reason: ${data.stop_reason}`);

    return textContent;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Claude API execution failed: ${error.message}`);
    }
    throw new Error('Claude API execution failed with unknown error');
  }
}

/**
 * Simplified agent execution for PoC (backward compatibility)
 *
 * @deprecated Use executeAgentWithClaude instead
 */
export async function executeAgentTask(
  agent: string,
  taskType: string,
  instructions: string,
  packagePath: string
): Promise<AgentExecutionResult> {
  console.log(`[AgentExecution] Agent: ${agent}`)
  console.log(`[AgentExecution] Task: ${taskType}`)
  console.log(`[AgentExecution] Instructions: ${instructions}`)
  console.log(`[AgentExecution] Package Path: ${packagePath}`)

  // For PoC, return success with explanation
  // Phase 2 will actually execute agent and modify files at packagePath
  return {
    success: true,
    changes: [`Simulated fix by ${agent}`],
    output: `Agent ${agent} analyzed the task: ${taskType}\n\nThis is a PoC stub. In Phase 2, the agent would:\n${instructions}`
  }
}
