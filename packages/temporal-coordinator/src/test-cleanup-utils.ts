/**
 * Cleanup utilities for integration tests
 * 
 * Ensures workflows, workspaces, and processes are cleaned up after tests
 */

import { Client } from '@temporalio/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export interface CleanupOptions {
  workflowIds?: string[];
  workspacePaths?: string[];
  cancelWorkflows?: boolean;
  removeWorkspaces?: boolean;
  killProcesses?: boolean;
  processPatterns?: string[]; // Patterns to match processes (e.g., ['claude', 'node.*worker'])
}

/**
 * Cancel running Temporal workflows
 */
export async function cancelWorkflows(
  client: Client,
  workflowIds: string[]
): Promise<void> {
  const cancelPromises = workflowIds.map(async (workflowId) => {
    try {
      const handle = client.workflow.getHandle(workflowId);
      const description = await handle.describe();
      
      // Only cancel if workflow is still running
      if (description.status.name === 'RUNNING') {
        await handle.cancel();
        console.log(`✅ Cancelled workflow: ${workflowId}`);
        return true;
      } else {
        console.log(`ℹ️  Workflow ${workflowId} already ${description.status.name.toLowerCase()}`);
        return false;
      }
    } catch (error: any) {
      // Workflow might already be completed or not found
      if (error?.message?.includes('not found') || error?.message?.includes('completed')) {
        console.log(`ℹ️  Workflow ${workflowId} not found or already completed`);
        return false;
      }
      console.warn(`⚠️  Could not cancel workflow ${workflowId}: ${error?.message}`);
      return false;
    }
  });

  // Wait for all cancellations with timeout
  await Promise.allSettled(
    cancelPromises.map(p =>
      Promise.race([
        p,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cancellation timeout')), 5000)
        )
      ]).catch(() => false)
    )
  );
}

/**
 * Remove workspace directories
 */
export async function removeWorkspaces(workspacePaths: string[]): Promise<void> {
  const removePromises = workspacePaths.map(async (workspacePath) => {
    try {
      await fs.access(workspacePath);
      await fs.rm(workspacePath, { recursive: true, force: true });
      console.log(`✅ Removed workspace: ${workspacePath}`);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(`ℹ️  Workspace already removed: ${workspacePath}`);
        return false;
      }
      console.warn(`⚠️  Could not remove workspace ${workspacePath}: ${error.message}`);
      return false;
    }
  });

  await Promise.allSettled(removePromises);
}

/**
 * Kill processes matching patterns
 */
export async function killProcesses(patterns: string[]): Promise<void> {
  const killPromises = patterns.map(async (pattern) => {
    try {
      // Find processes matching pattern
      const { stdout } = await execPromise(`pgrep -f "${pattern}"`, {
        env: { ...process.env }
      });
      
      const pids = stdout.trim().split('\n').filter(pid => pid.trim());
      
      if (pids.length === 0) {
        console.log(`ℹ️  No processes found matching: ${pattern}`);
        return 0;
      }

      // Kill processes
      for (const pid of pids) {
        try {
          await execPromise(`kill -TERM ${pid}`, { env: { ...process.env } });
          console.log(`✅ Sent TERM signal to process ${pid} (${pattern})`);
          
          // Wait a bit, then force kill if still running
          await new Promise(resolve => setTimeout(resolve, 2000));
          try {
            await execPromise(`kill -0 ${pid}`, { env: { ...process.env } });
            // Process still running, force kill
            await execPromise(`kill -KILL ${pid}`, { env: { ...process.env } });
            console.log(`✅ Force killed process ${pid} (${pattern})`);
          } catch {
            // Process already terminated
          }
        } catch (error: any) {
          console.warn(`⚠️  Could not kill process ${pid}: ${error.message}`);
        }
      }
      
      return pids.length;
    } catch (error: any) {
      // pgrep returns non-zero if no processes found - that's OK
      if (error.code === 1) {
        console.log(`ℹ️  No processes found matching: ${pattern}`);
        return 0;
      }
      console.warn(`⚠️  Error finding processes for pattern ${pattern}: ${error.message}`);
      return 0;
    }
  });

  await Promise.allSettled(killPromises);
}

/**
 * Comprehensive cleanup for integration tests
 */
export async function cleanupTestResources(
  client: Client,
  options: CleanupOptions
): Promise<void> {
  console.log('\n🧹 Starting cleanup...\n');

  const {
    workflowIds = [],
    workspacePaths = [],
    cancelWorkflows: shouldCancelWorkflows = true,
    removeWorkspaces: shouldRemoveWorkspaces = true,
    killProcesses: shouldKillProcesses = false,
    processPatterns = [],
  } = options;

  // 1. Cancel workflows
  if (shouldCancelWorkflows && workflowIds.length > 0) {
    console.log('📋 Cancelling workflows...');
    await cancelWorkflows(client, workflowIds);
  }

  // 2. Remove workspaces
  if (shouldRemoveWorkspaces && workspacePaths.length > 0) {
    console.log('\n📁 Removing workspaces...');
    await removeWorkspaces(workspacePaths);
  }

  // 3. Kill processes
  if (shouldKillProcesses && processPatterns.length > 0) {
    console.log('\n🔪 Killing processes...');
    await killProcesses(processPatterns);
  }

  console.log('\n✅ Cleanup completed!\n');
}

/**
 * Cleanup all test workflows matching a pattern
 */
export async function cleanupTestWorkflowsByPattern(
  client: Client,
  pattern: string
): Promise<number> {
  try {
    // List workflows matching pattern
    const workflows = await client.workflow.list({
      query: `WorkflowId LIKE '${pattern}%'`,
    });

    const workflowIds: string[] = [];
    for await (const workflow of workflows) {
      if (workflow.status.name === 'RUNNING') {
        workflowIds.push(workflow.workflowId);
      }
    }

    if (workflowIds.length > 0) {
      console.log(`Found ${workflowIds.length} running workflows matching pattern: ${pattern}`);
      await cancelWorkflows(client, workflowIds);
      return workflowIds.length;
    }

    return 0;
  } catch (error: any) {
    console.warn(`⚠️  Error cleaning up workflows by pattern: ${error.message}`);
    return 0;
  }
}

/**
 * Cleanup old test workspaces
 */
export async function cleanupOldWorkspaces(
  basePath: string,
  maxAgeHours: number = 24
): Promise<number> {
  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    let cleaned = 0;

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('build-')) {
        const dirPath = path.join(basePath, entry.name);
        try {
          const stats = await fs.stat(dirPath);
          const age = now - stats.mtimeMs;

          if (age > maxAge) {
            await fs.rm(dirPath, { recursive: true, force: true });
            console.log(`✅ Removed old workspace: ${dirPath}`);
            cleaned++;
          }
        } catch (error: any) {
          console.warn(`⚠️  Could not check/remove ${dirPath}: ${error.message}`);
        }
      }
    }

    return cleaned;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return 0; // Directory doesn't exist, nothing to clean
    }
    console.warn(`⚠️  Error cleaning up old workspaces: ${error.message}`);
    return 0;
  }
}

