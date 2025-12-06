#!/usr/bin/env node
/**
 * Hook Script: Log Response
 * 
 * This script is called by Claude CLI after each response.
 * It receives response information via environment variables and stdin,
 * and logs it to the audit trail for optimization analysis.
 * 
 * Usage: Called automatically by Claude CLI via .claude/settings.json hooks
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get workspace path from environment (Claude CLI sets this)
const workspacePath = process.env.CLAUDE_WORKSPACE || process.cwd();
const logPath = path.join(workspacePath, 'response_log.jsonl');

// Read response data from stdin (Claude CLI passes JSON)
let responseData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  responseData += chunk;
});

process.stdin.on('end', async () => {
  try {
    // Parse response data
    const response = responseData ? JSON.parse(responseData) : {};
    
    // Extract information from environment variables
    const entry = {
      timestamp: new Date().toISOString(),
      response: response.response || response,
      cost_usd: process.env.CLAUDE_COST || response.cost_usd,
      duration_ms: process.env.CLAUDE_DURATION || response.duration_ms,
      tokens: {
        prompt: process.env.CLAUDE_PROMPT_TOKENS || response.prompt_tokens,
        completion: process.env.CLAUDE_COMPLETION_TOKENS || response.completion_tokens,
        total: process.env.CLAUDE_TOTAL_TOKENS || response.total_tokens,
      },
      workspace: workspacePath,
      sessionId: process.env.CLAUDE_SESSION_ID || response.sessionId,
      workflowRunId: process.env.WORKFLOW_RUN_ID || response.workflowRunId,
      model: process.env.CLAUDE_MODEL || response.model,
    };

    // Append to log file
    const logLine = JSON.stringify(entry) + '\n';
    await fs.appendFile(logPath, logLine, 'utf-8');

    // Exit successfully
    process.exit(0);
  } catch (error) {
    // Log error but don't fail the hook (non-blocking)
    console.error(`[Hook] Failed to log response: ${error.message}`);
    process.exit(0); // Exit 0 so hook doesn't block Claude CLI
  }
});

// Handle timeout (Claude CLI will kill if timeout exceeded)
setTimeout(() => {
  console.error('[Hook] Response logging timeout');
  process.exit(0);
}, 4000); // 4 seconds (less than 5 second timeout)

