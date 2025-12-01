#!/usr/bin/env node
/**
 * Hook Script: Log Tool Call
 * 
 * This script is called by Claude CLI after each tool call.
 * It receives tool call information via environment variables and stdin,
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
const logPath = path.join(workspacePath, 'tool_call_log.jsonl');

// Read tool call data from stdin (Claude CLI passes JSON)
let toolCallData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  toolCallData += chunk;
});

process.stdin.on('end', async () => {
  try {
    // Parse tool call data
    const toolCall = toolCallData ? JSON.parse(toolCallData) : {};
    
    // Extract information from environment variables (Claude CLI may set these)
    const entry = {
      timestamp: new Date().toISOString(),
      tool: process.env.CLAUDE_TOOL || toolCall.tool || 'unknown',
      toolCall: toolCall.toolCall || toolCall,
      workspace: workspacePath,
      sessionId: process.env.CLAUDE_SESSION_ID || toolCall.sessionId,
      workflowRunId: process.env.WORKFLOW_RUN_ID || toolCall.workflowRunId,
    };

    // Append to log file
    const logLine = JSON.stringify(entry) + '\n';
    await fs.appendFile(logPath, logLine, 'utf-8');

    // Exit successfully
    process.exit(0);
  } catch (error) {
    // Log error but don't fail the hook (non-blocking)
    console.error(`[Hook] Failed to log tool call: ${error.message}`);
    process.exit(0); // Exit 0 so hook doesn't block Claude CLI
  }
});

// Handle timeout (Claude CLI will kill if timeout exceeded)
setTimeout(() => {
  console.error('[Hook] Tool call logging timeout');
  process.exit(0);
}, 4000); // 4 seconds (less than 5 second timeout)

