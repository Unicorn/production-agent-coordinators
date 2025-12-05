import { proxyActivities, workflowInfo } from '@temporalio/workflow';
import type { PackageBuildInput, PackageBuildResult, PackageBuildReport } from '../types/index';
import type * as activities from '../activities/build.activities';
import type * as agentActivities from '../activities/agent.activities';
import type * as reportActivities from '../activities/report.activities';
import type * as cliActivities from '../activities/cli-agent.activities';
import type * as resumeActivities from '../activities/resume-detector.activities';

// MCP activities (registered by orchestrator worker)
interface MCPActivities {
  updateMCPPackageStatus(packageName: string, status: string, errorDetails?: string): Promise<void>;
}

// Create activity proxies with timeouts
const { runBuild, runTests, runQualityChecks, publishPackage, commitChanges, pushChanges, checkPackageExists, checkNpmPublished, checkIfUpgradePlan, auditPackageState, auditPackageUpgrade } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes'
});

const { verifyDependencies, spawnFixAgent } = proxyActivities<typeof agentActivities>({
  startToCloseTimeout: '30 minutes'
});

const { writePackageBuildReport } = proxyActivities<typeof reportActivities>({
  startToCloseTimeout: '1 minute'
});

const { 
  setupCLIWorkspace, 
  selectCLIProvider,
  readPlanFileContent,
  readRequirementsContent,
  checkCLICreditsForExecution,
  selectClaudeModel,
  requestTaskBreakdown,
  executeAgentActivityRequest,
  executeTaskWithCLI,
  runTaskValidations,
  executeFixWithCLI
} = proxyActivities<typeof cliActivities>({
  startToCloseTimeout: '30 minutes' // CLI operations can take time
});

const { 
  detectResumePoint
} = proxyActivities<typeof resumeActivities>({
  startToCloseTimeout: '5 minutes'
});

// loadAgentRegistry no longer needed - coordinator workflow removed

const { updateMCPPackageStatus } = proxyActivities<MCPActivities>({
  startToCloseTimeout: '1 minute'
});

/**
 * Sanitize package name from content to prevent Gemini CLI ImportProcessor errors
 * Replaces both @scope/name and scope/name formats with [PACKAGE_NAME] placeholder
 * Uses word boundaries to avoid partial matches
 */
function sanitizePackageName(content: string, packageName: string): string {
  // Extract scope/name part (remove @ if present)
  const namePart = packageName.startsWith('@') ? packageName.substring(1) : packageName;
  const scopePart = namePart.split('/')[0];
  const packagePart = namePart.split('/')[1] || namePart;
  
  // Escape special regex characters
  const escapedNamePart = namePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedScope = scopePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedPackage = packagePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Replace patterns with word boundaries to avoid partial matches
  // Match: @scope/name, scope/name, or just the name part if it appears standalone
  const patterns = [
    new RegExp(`@${escapedNamePart}\\b`, 'g'),  // @scope/name
    new RegExp(`\\b${escapedNamePart}\\b`, 'g'), // scope/name (word boundary)
    new RegExp(`\\b${escapedScope}/${escapedPackage}\\b`, 'g'), // scope/package (if different from full name)
  ];
  
  let sanitized = content;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, '[PACKAGE_NAME]');
  }
  
  return sanitized;
}

/**
 * Extract only scaffolding-relevant content from plan file
 * For scaffolding, we only need: package info, dependencies, basic structure
 * Not needed: full implementation details, API specs, etc.
 */
function extractScaffoldRelevantContent(planContent: string): string {
  const lines = planContent.split('\n');
  const relevant: string[] = [];
  let inRelevantSection = false;
  let skipUntilNextHeader = false;
  
  // Sections relevant for scaffolding
  const relevantSections = [
    /^#+\s*(package|overview|description|dependencies|structure|requirements|configuration)/i,
    /^#+\s*(name|version|type|category)/i,
  ];
  
  // Sections to skip (implementation details)
  const skipSections = [
    /^#+\s*(implementation|api|examples|usage|code|functions|methods|classes|interfaces)/i,
    /^#+\s*(testing|tests|test cases)/i,
    /^#+\s*(architecture|design|patterns)/i,
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a header
    if (line.match(/^#+\s+/)) {
      const isRelevant = relevantSections.some(regex => regex.test(line));
      const shouldSkip = skipSections.some(regex => regex.test(line));
      
      if (isRelevant) {
        inRelevantSection = true;
        skipUntilNextHeader = false;
        relevant.push(line);
      } else if (shouldSkip) {
        inRelevantSection = false;
        skipUntilNextHeader = true;
      } else if (line.match(/^#+\s+/)) {
        // Other headers - include if we're in a relevant section
        inRelevantSection = false;
        skipUntilNextHeader = false;
      }
    } else if (!skipUntilNextHeader) {
      // Include lines from relevant sections or before first skip section
      if (inRelevantSection || relevant.length === 0) {
        relevant.push(line);
      }
    }
  }
  
  // If we didn't find much, include first 50 lines (usually has package info)
  if (relevant.length < 20) {
    return lines.slice(0, 50).join('\n') + '\n\n[... rest of plan will be provided in implementation phase ...]';
  }
  
  return relevant.join('\n') + '\n\n[... rest of plan will be provided in implementation phase ...]';
}

/**
 * Extract only scaffolding-relevant requirements
 * For scaffolding, we need: TypeScript config, build setup, quality gates summary
 * Not needed: detailed testing requirements, full quality standards
 */
function extractScaffoldRelevantRequirements(requirementsContent: string): string {
  const lines = requirementsContent.split('\n');
  const relevant: string[] = [];
  let inRelevantSection = false;
  
  // Sections relevant for scaffolding
  const relevantSections = [
    /^#+\s*(typescript|code quality|build|package|structure|configuration)/i,
    /^#+\s*(package\.json|tsconfig|eslint|jest)/i,
  ];
  
  // Sections to skip
  const skipSections = [
    /^#+\s*(testing|tests|coverage|test cases)/i,
    /^#+\s*(documentation|docs|examples)/i,
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.match(/^#+\s+/)) {
      const isRelevant = relevantSections.some(regex => regex.test(line));
      const shouldSkip = skipSections.some(regex => regex.test(line));
      
      if (isRelevant) {
        inRelevantSection = true;
        relevant.push(line);
      } else if (shouldSkip) {
        inRelevantSection = false;
      } else {
        inRelevantSection = false;
      }
    } else if (inRelevantSection || relevant.length < 30) {
      // Include lines from relevant sections or first 30 lines (usually has key info)
      relevant.push(line);
    }
  }
  
  // If we didn't find much, include first 40 lines
  if (relevant.length < 20) {
    return lines.slice(0, 40).join('\n') + '\n\n[... full requirements will be provided in implementation phase ...]';
  }
  
  return relevant.join('\n') + '\n\n[... full requirements will be provided in implementation phase ...]';
}

export async function PackageBuildWorkflow(input: PackageBuildInput): Promise<PackageBuildResult> {
  const startTime = Date.now();
  const workflowId = workflowInfo().workflowId;
  const report: PackageBuildReport = {
    packageName: input.packageName,
    workflowId: workflowId,
    startTime: new Date(startTime).toISOString(),
    endTime: '',
    duration: 0,
    buildMetrics: {
      buildTime: 0,
      testTime: 0,
      qualityCheckTime: 0,
      publishTime: 0
    },
    quality: {
      lintScore: 0,
      testCoverage: 0,
      typeScriptErrors: 0,
      passed: false
    },
    fixAttempts: [],
    status: 'success',
    dependencies: input.dependencies,
    waitedFor: []
  };

  try {
    // ========================================================================
    // PRE-FLIGHT VALIDATION: Check package state before proceeding
    // ========================================================================

    // Store audit context for resume detection (if applicable)
    let packageAuditContext: { status: string; completionPercentage: number; existingFiles: string[]; missingFiles?: string[]; nextSteps?: string[] } | undefined;

    console.log(`[PreFlight] Validating package state for ${input.packageName}...`);

    // Check if package code already exists
    const codeExists = await checkPackageExists({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });

    if (codeExists) {
      console.log(`[PreFlight] ✅ Package code exists at ${input.packagePath}`);

      // Check npm registry
      const npmStatus = await checkNpmPublished(input.packageName);

      if (npmStatus.published) {
        console.log(`[PreFlight] 📦 Package already published to npm at v${npmStatus.version}`);

        // Check if this is an upgrade plan
        const isUpgrade = await checkIfUpgradePlan({
          workspaceRoot: input.workspaceRoot,
          planPath: input.planPath
        });

        if (isUpgrade) {
          // SCENARIO 2: Upgrade existing published package
          console.log(`[PreFlight] Upgrade plan detected, auditing changes needed...`);

          const audit = await auditPackageUpgrade({
            workspaceRoot: input.workspaceRoot,
            packagePath: input.packagePath,
            planPath: input.planPath,
            currentVersion: npmStatus.version!
          });

          console.log(`[PreFlight] Upgrade audit:`, audit);

          // TODO: Continue with upgrade implementation based on audit
          // For now, this will fall through to normal flow
          // In future, we'll skip to implementation phase based on audit.nextSteps

        } else {
          // Already published, no upgrade needed - we're done!
          console.log(`[PreFlight] ⏭️  SKIPPING: Package already published (v${npmStatus.version}), no upgrade plan detected.`);
          console.log(`[PreFlight] ℹ️  To republish, either update the version or create an upgrade plan.`);

          // Update MCP status to 'published' in case it wasn't synced
          await updateMCPPackageStatus(input.packageName, 'published');

          report.status = 'success';
          report.quality.passed = true;

          return {
            success: true,
            packageName: input.packageName,
            report
          };
        }

      } else {
        // SCENARIO 1: Partial implementation (code exists, not published)
        console.log(`[PreFlight] 🔨 Code exists locally but NOT published to npm`);
        console.log(`[PreFlight] 📋 Auditing package state to determine completion...`);

        const audit = await auditPackageState({
          workspaceRoot: input.workspaceRoot,
          packagePath: input.packagePath,
          planPath: input.planPath
        });

        console.log(`[PreFlight] 📊 Audit results:`, audit);
        console.log(`[PreFlight] 📈 Completion: ${audit.completionPercentage}%`);

        report.quality.lintScore = audit.completionPercentage;

        if (audit.status === 'complete') {
          // Code is complete, skip to build/test/publish
          console.log(`[PreFlight] ✅ Package code complete (100%), proceeding to build → test → publish`);
          // Skip scaffolding, jump to build below
        } else {
          // Continue with implementation based on audit findings
          console.log(`[PreFlight] ⚠️  Package incomplete (${audit.completionPercentage}%), will attempt fixes`);
          console.log(`[PreFlight] 📝 Next steps:`, audit.nextSteps);

          // Store audit context to pass to Gemini workflow
          // Parse findings to extract existing/missing files
          const existingFiles = audit.findings
            .filter(f => f.startsWith('✅'))
            .map(f => f.replace('✅ ', '').replace(' exists', '').trim());
          const missingFiles = audit.findings
            .filter(f => f.startsWith('❌'))
            .map(f => f.replace('❌ ', '').replace(' missing', '').trim());

          packageAuditContext = {
            completionPercentage: audit.completionPercentage,
            existingFiles,
            missingFiles,
            nextSteps: audit.nextSteps || [],
            // We're in the 'else' branch so status is not 'complete'
            status: 'incomplete'
          };
          console.log(`[PreFlight] 📦 Audit context prepared for Gemini (${existingFiles.length} existing, ${missingFiles.length} missing)`);
        }
      }
    } else {
      // Fresh start - no code exists, not published
      console.log(`[PreFlight] 🆕 No existing code found, starting fresh scaffolding`);
    }

    console.log(`[PreFlight] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[PreFlight] 🎯 Decision: Proceeding with full build pipeline`);
    console.log(`[PreFlight] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // ========================================================================
    // NORMAL WORKFLOW: Continue with package building
    // ========================================================================

    // Activity 1: Verify dependencies are published
    await verifyDependencies(input.dependencies);

    // Activity 2: Read plan and requirements files
    console.log(`[Setup] Reading plan and requirements files...`);
    
    const [planContent, requirementsContent] = await Promise.all([
      readPlanFileContent(input.workspaceRoot, input.planPath),
      readRequirementsContent(input.workspaceRoot),
    ]);
    
    console.log(`[Setup] Plan file read (${planContent.length} chars)`);
    console.log(`[Setup] Requirements file read (${requirementsContent.length} chars)`);

    // Activity 3: Detect resume point if package is partially complete
    let resumePoint: resumeActivities.ResumePoint | undefined;
    const packageFullPath = `${input.workspaceRoot}/${input.packagePath}`;
    
    if (packageAuditContext && packageAuditContext.status === 'incomplete') {
      console.log(`[Resume] Detecting resume point for ${input.packageName}...`);
      resumePoint = await detectResumePoint({
        workspaceRoot: input.workspaceRoot,
        packagePath: input.packagePath,
        planPath: input.planPath,
      });
      console.log(`[Resume] Resuming from phase: ${resumePoint.phase} (${resumePoint.completionPercentage}% complete)`);
    }

    // Activity 4: Select CLI provider (prefer Gemini, fallback to Claude)
    // Use preferred provider from input if specified (useful for testing)
    if (input.preferredProvider) {
      console.log(`[CLI] Preferred provider specified: ${input.preferredProvider}`);
    }
    const provider = await selectCLIProvider('scaffold', input.preferredProvider);
    console.log(`[CLI] Using provider: ${provider.name}`);

    // Activity 5: Set up CLI workspace in package directory
    // For Gemini: Write GEMINI.md with context
    // For Claude: Write CLAUDE.md once, then use sessions
    if (!codeExists || (resumePoint && resumePoint.phase === 'scaffold')) {
      console.log(`[CLI] Setting up workspace in package directory...`);
      // Set up provider-specific workspace (writes context files and creates directory if needed)
      await setupCLIWorkspace({
        basePath: packageFullPath,
        requirementsContent,
        provider: provider.name,
      });
      console.log(`[CLI] Workspace set up in: ${packageFullPath}`);
    }

    // Activity 6: Scaffold package using CLI agent (broken into smaller tasks)
    if (!codeExists || (resumePoint && resumePoint.phase === 'scaffold')) {
      console.log(`[Scaffold] Using ${provider.name} CLI for scaffolding...`);
      
      // For scaffolding, we only need structure info, not full implementation details
      // Extract just the scaffolding-relevant parts from the plan
      // For task breakdown, we need the FULL plan and requirements so the agent can understand
      // the complete scope and break it down into appropriate scaffolding tasks.
      // The truncation was designed for direct execution (to save tokens), but for planning
      // the agent needs full context to make good decisions.
      const sanitizedFullPlanContent = sanitizePackageName(planContent, input.packageName);
      const sanitizedFullRequirementsContent = sanitizePackageName(requirementsContent, input.packageName);
      
      // For actual task execution context, we can still use truncated versions to save tokens
      const scaffoldRelevantPlan = extractScaffoldRelevantContent(planContent);
      const scaffoldRelevantRequirements = extractScaffoldRelevantRequirements(requirementsContent);
      const sanitizedScaffoldPlan = sanitizePackageName(scaffoldRelevantPlan, input.packageName);
      const sanitizedScaffoldRequirements = sanitizePackageName(scaffoldRelevantRequirements, input.packageName);
      
      const baseContextContent = `# BernierLLC Package Requirements (Scaffolding Summary)\n\n${sanitizedScaffoldRequirements}\n\n---\n\n# Package Specification (Scaffolding Summary)\n\n${sanitizedScaffoldPlan}\n\n---\n\n# IMPORTANT: Package Name Sanitization\n\nThe package name "${input.packageName}" has been replaced with "[PACKAGE_NAME]" in this context to prevent import errors.\nDO NOT try to import or reference the package by name. Work directly in the current directory using relative paths only.`;

      // Check credits (optional, for visibility)
      await checkCLICreditsForExecution(provider.name);

      // Request task breakdown from CLI agent (iterative planning)
      // NOTE: We pass the FULL plan/requirements for breakdown, but the agent will focus on scaffolding tasks
      let completedTaskIds: string[] = [];
      let scaffoldSessionId: string | undefined;
      let totalScaffoldCost = 0;
      let moreTasksAvailable = true;

      while (moreTasksAvailable) {
        console.log(`[Scaffold] Requesting task breakdown from ${provider.name} CLI...`);
        const taskBreakdown = await requestTaskBreakdown({
          planContent: sanitizedFullPlanContent, // Full plan for proper task breakdown
          requirementsContent: sanitizedFullRequirementsContent, // Full requirements for proper task breakdown
          phase: 'scaffold',
          workingDir: packageFullPath,
          provider: provider.name,
          contextContent: baseContextContent, // Truncated context for actual task execution
          completedTaskIds: completedTaskIds.length > 0 ? completedTaskIds : undefined,
        });

        console.log(`[Scaffold] Received ${taskBreakdown.tasks.length} tasks from CLI agent`);
        if (taskBreakdown.outline) {
          console.log(`[Scaffold] Outline: ${taskBreakdown.outline.map(p => p.title).join(', ')}`);
        }

        // Execute activity requests first (agent needs information)
        if (taskBreakdown.activities && taskBreakdown.activities.length > 0) {
          console.log(`[Scaffold] Executing ${taskBreakdown.activities.length} activity requests from agent...`);
          for (const activity of taskBreakdown.activities) {
            const activityResult = await executeAgentActivityRequest({
              type: activity.type,
              args: activity.args,
              workingDir: packageFullPath,
            });
            if (!activityResult.success) {
              console.warn(`[Scaffold] Activity ${activity.type} failed: ${activityResult.error}`);
            }
            // Note: Activity results could be fed back to agent in next iteration
          }
        }

        // Execute each task from the breakdown
        for (let i = 0; i < taskBreakdown.tasks.length; i++) {
          const task = taskBreakdown.tasks[i];
          console.log(`[Scaffold] Task ${i + 1}/${taskBreakdown.tasks.length}: ${task.title} (${task.id})`);
          
          // Check dependencies
          if (task.dependencies && task.dependencies.length > 0) {
            const unmetDeps = task.dependencies.filter(depId => !completedTaskIds.includes(depId));
            if (unmetDeps.length > 0) {
              console.warn(`[Scaffold] Task ${task.id} has unmet dependencies: ${unmetDeps.join(', ')}`);
              // Could skip or wait, but for now we'll proceed
            }
          }

          // Execute activity requests for this task (if any)
          if (task.activity_requests && task.activity_requests.length > 0) {
            for (const activityReq of task.activity_requests) {
              const activityResult = await executeAgentActivityRequest({
                type: activityReq.type,
                args: activityReq.args,
                workingDir: packageFullPath,
              });
              if (!activityResult.success) {
                console.warn(`[Scaffold] Task ${task.id} activity ${activityReq.type} failed: ${activityResult.error}`);
              }
            }
          }

          // Task Activity Loop: Execute task until agent signals completion
          let taskComplete = false;
          let taskSequence = 0;
          let previousLogFilePath: string | undefined;
          const claudeModelConfig = provider.name === 'claude' 
            ? await selectClaudeModel('scaffold', undefined)
            : undefined;

          while (!taskComplete && taskSequence < 10) { // Max 10 iterations per task
            const taskResult = await executeTaskWithCLI({
              task,
              sessionId: scaffoldSessionId,
              workingDir: packageFullPath,
              workflowId: workflowId,
              sequenceNumber: taskSequence,
              continueTask: taskSequence > 0,
              previousLogFilePath,
              contextContent: baseContextContent,
              provider: provider.name,
              model: claudeModelConfig?.model,
              permissionMode: claudeModelConfig?.permissionMode,
            });

            // Update session ID and state
            if (taskResult.sessionId) {
              scaffoldSessionId = taskResult.sessionId;
            }
            previousLogFilePath = taskResult.logFilePath;
            taskComplete = taskResult.taskComplete;
            taskSequence++;

            if (!taskResult.success) {
              report.error = `${provider.name} CLI task execution failed on ${task.title}: ${taskResult.error || 'Unknown error'}`;
              throw new Error(`${provider.name} CLI task execution failed on ${task.title}: ${taskResult.error}`);
            }

            if (!taskComplete) {
              console.log(`[Scaffold] Task ${task.id} continuing (iteration ${taskSequence})`);
            }
          }

          if (!taskComplete) {
            report.error = `Task ${task.id} did not complete after ${taskSequence} iterations`;
            throw new Error(`Task ${task.id} did not complete after ${taskSequence} iterations`);
          }

          console.log(`[Scaffold] Task "${task.title}" (${task.id}) complete, starting validation...`);

          // Validation Task Activity Loop: Run validations and fix errors until all pass
          let allValidationsPassed = false;
          let validationSequence = 0;

          while (!allValidationsPassed && validationSequence < 5) { // Max 5 validation attempts
            const validationResult = await runTaskValidations({
              task,
              workingDir: packageFullPath,
              workflowId: workflowId,
            });

            if (validationResult.allPassed) {
              allValidationsPassed = true;
              console.log(`[Scaffold] Task ${task.id} all validations passed`);
              break;
            }

            console.log(`[Scaffold] Task ${task.id} validation errors found: ${validationResult.errors.length}`);
            console.log(`[Scaffold] Errors written to: ${validationResult.validationErrorsFilePath}`);

            // Fix errors
            const fixResult = await executeFixWithCLI({
              task,
              validationErrorsFilePath: validationResult.validationErrorsFilePath,
              sessionId: scaffoldSessionId,
        workingDir: packageFullPath,
              workflowId: workflowId,
              sequenceNumber: validationSequence,
              provider: provider.name,
              model: claudeModelConfig?.model,
              permissionMode: claudeModelConfig?.permissionMode,
              contextContent: baseContextContent,
            });

            if (fixResult.sessionId) {
              scaffoldSessionId = fixResult.sessionId;
            }

            if (!fixResult.success) {
              report.error = `Fix failed for task ${task.id}: ${fixResult.error || 'Unknown error'}`;
              throw new Error(`Fix failed for task ${task.id}: ${fixResult.error}`);
            }

            if (!fixResult.fixed) {
              report.error = `Agent could not fix validation errors for task ${task.id}`;
              throw new Error(`Agent could not fix validation errors for task ${task.id}`);
            }

            validationSequence++;
            console.log(`[Scaffold] Task ${task.id} fix applied (validation attempt ${validationSequence})`);
          }

          if (!allValidationsPassed) {
            report.error = `Task ${task.id} validations did not pass after ${validationSequence} attempts`;
            throw new Error(`Task ${task.id} validations did not pass after ${validationSequence} attempts`);
          }

          // Mark task as completed
          completedTaskIds.push(task.id);
          totalScaffoldCost += 0; // Cost tracked in individual activities
          console.log(`[Scaffold] Task "${task.title}" (${task.id}) ✅ complete and validated`);
      }

        // Check if more tasks are available
        moreTasksAvailable = taskBreakdown.more_tasks === true;
        if (moreTasksAvailable) {
          console.log(`[Scaffold] More tasks available, requesting next batch...`);
        }
      }

      console.log(`[Scaffold] All scaffolding tasks complete (total cost: $${totalScaffoldCost}, ${completedTaskIds.length} tasks completed)`);
    } else {
      console.log(`[Scaffold] Skipping - package structure already exists`);
    }

    // Activity 7: Implement package using CLI agent
    if (!codeExists || (resumePoint && (resumePoint.phase === 'implement' || resumePoint.phase === 'scaffold'))) {
      console.log(`[Implement] Using ${provider.name} CLI for implementation...`);

      let sessionId: string | undefined;
      if (provider.name === 'claude' && resumePoint) {
        // For Claude, we could resume session if we had it stored
        // For now, we'll start fresh but include resume context
      }

      // Sanitize package name from context to prevent ImportProcessor errors
      const sanitizedPlanContent = sanitizePackageName(planContent, input.packageName);
      const sanitizedRequirementsContent = sanitizePackageName(requirementsContent, input.packageName);
      const implementContextContent = `# BernierLLC Package Requirements\n\n${sanitizedRequirementsContent}\n\n---\n\n# Package Specification\n\n${sanitizedPlanContent}\n\n---\n\n# IMPORTANT: Package Name Sanitization\n\nThe package name "${input.packageName}" has been replaced with "[PACKAGE_NAME]" in this context to prevent import errors.\nDO NOT try to import or reference the package by name. Work directly in the current directory using relative paths only.`;

      // Check credits (optional, for visibility)
      await checkCLICreditsForExecution(provider.name);

      // Request task breakdown from CLI agent for implementation phase (iterative planning)
      let implementCompletedTaskIds: string[] = [];
      let totalImplementCost = 0;
      let moreImplementTasksAvailable = true;

      while (moreImplementTasksAvailable) {
        console.log(`[Implement] Requesting task breakdown from ${provider.name} CLI...`);
        const implementTaskBreakdown = await requestTaskBreakdown({
          planContent: sanitizedPlanContent,
          requirementsContent: sanitizedRequirementsContent,
          phase: 'implement',
          workingDir: packageFullPath,
          provider: provider.name,
          contextContent: implementContextContent,
          completedTaskIds: implementCompletedTaskIds.length > 0 ? implementCompletedTaskIds : undefined,
        });

        console.log(`[Implement] Received ${implementTaskBreakdown.tasks.length} tasks from CLI agent`);
        if (implementTaskBreakdown.outline) {
          console.log(`[Implement] Outline: ${implementTaskBreakdown.outline.map(p => p.title).join(', ')}`);
        }

        // Execute activity requests first (agent needs information)
        if (implementTaskBreakdown.activities && implementTaskBreakdown.activities.length > 0) {
          console.log(`[Implement] Executing ${implementTaskBreakdown.activities.length} activity requests from agent...`);
          for (const activity of implementTaskBreakdown.activities) {
            const activityResult = await executeAgentActivityRequest({
              type: activity.type,
              args: activity.args,
              workingDir: packageFullPath,
            });
            if (!activityResult.success) {
              console.warn(`[Implement] Activity ${activity.type} failed: ${activityResult.error}`);
            }
          }
        }

        // Execute each task from the breakdown
        for (let i = 0; i < implementTaskBreakdown.tasks.length; i++) {
          const task = implementTaskBreakdown.tasks[i];
          console.log(`[Implement] Task ${i + 1}/${implementTaskBreakdown.tasks.length}: ${task.title} (${task.id})`);
          
          // Check dependencies
          if (task.dependencies && task.dependencies.length > 0) {
            const unmetDeps = task.dependencies.filter(depId => !implementCompletedTaskIds.includes(depId));
            if (unmetDeps.length > 0) {
              console.warn(`[Implement] Task ${task.id} has unmet dependencies: ${unmetDeps.join(', ')}`);
            }
          }

          // Execute activity requests for this task (if any)
          if (task.activity_requests && task.activity_requests.length > 0) {
            for (const activityReq of task.activity_requests) {
              const activityResult = await executeAgentActivityRequest({
                type: activityReq.type,
                args: activityReq.args,
                workingDir: packageFullPath,
              });
              if (!activityResult.success) {
                console.warn(`[Implement] Task ${task.id} activity ${activityReq.type} failed: ${activityResult.error}`);
              }
            }
          }

          // Task Activity Loop: Execute task until agent signals completion
          let taskComplete = false;
          let taskSequence = 0;
          let previousLogFilePath: string | undefined;
          const implementClaudeModelConfig = provider.name === 'claude' 
            ? await selectClaudeModel('implement', undefined)
            : undefined;

          while (!taskComplete && taskSequence < 10) { // Max 10 iterations per task
            const taskResult = await executeTaskWithCLI({
              task,
              sessionId: sessionId, // Reuse session from scaffold phase
              workingDir: packageFullPath,
              workflowId: workflowId,
              sequenceNumber: taskSequence,
              continueTask: taskSequence > 0,
              previousLogFilePath,
              contextContent: implementContextContent,
              provider: provider.name,
              model: implementClaudeModelConfig?.model,
              permissionMode: implementClaudeModelConfig?.permissionMode,
            });

            // Update session ID and state
            if (taskResult.sessionId) {
              sessionId = taskResult.sessionId;
            }
            previousLogFilePath = taskResult.logFilePath;
            taskComplete = taskResult.taskComplete;
            taskSequence++;

            if (!taskResult.success) {
              report.error = `${provider.name} CLI task execution failed on ${task.title}: ${taskResult.error || 'Unknown error'}`;
              throw new Error(`${provider.name} CLI task execution failed on ${task.title}: ${taskResult.error}`);
            }

            if (!taskComplete) {
              console.log(`[Implement] Task ${task.id} continuing (iteration ${taskSequence})`);
            }
          }

          if (!taskComplete) {
            report.error = `Task ${task.id} did not complete after ${taskSequence} iterations`;
            throw new Error(`Task ${task.id} did not complete after ${taskSequence} iterations`);
          }

          console.log(`[Implement] Task "${task.title}" (${task.id}) complete, starting validation...`);

          // Validation Task Activity Loop: Run validations and fix errors until all pass
          let allValidationsPassed = false;
          let validationSequence = 0;

          while (!allValidationsPassed && validationSequence < 5) { // Max 5 validation attempts
            const validationResult = await runTaskValidations({
              task,
              workingDir: packageFullPath,
              workflowId: workflowId,
            });

            if (validationResult.allPassed) {
              allValidationsPassed = true;
              console.log(`[Implement] Task ${task.id} all validations passed`);
              break;
            }

            console.log(`[Implement] Task ${task.id} validation errors found: ${validationResult.errors.length}`);
            console.log(`[Implement] Errors written to: ${validationResult.validationErrorsFilePath}`);

            // Fix errors
            const fixResult = await executeFixWithCLI({
              task,
              validationErrorsFilePath: validationResult.validationErrorsFilePath,
              sessionId: sessionId,
              workingDir: packageFullPath,
              workflowId: workflowId,
              sequenceNumber: validationSequence,
              provider: provider.name,
              model: implementClaudeModelConfig?.model,
              permissionMode: implementClaudeModelConfig?.permissionMode,
              contextContent: implementContextContent,
            });

            if (fixResult.sessionId) {
              sessionId = fixResult.sessionId;
            }

            if (!fixResult.success) {
              report.error = `Fix failed for task ${task.id}: ${fixResult.error || 'Unknown error'}`;
              throw new Error(`Fix failed for task ${task.id}: ${fixResult.error}`);
            }

            if (!fixResult.fixed) {
              report.error = `Agent could not fix validation errors for task ${task.id}`;
              throw new Error(`Agent could not fix validation errors for task ${task.id}`);
            }

            validationSequence++;
            console.log(`[Implement] Task ${task.id} fix applied (validation attempt ${validationSequence})`);
          }

          if (!allValidationsPassed) {
            report.error = `Task ${task.id} validations did not pass after ${validationSequence} attempts`;
            throw new Error(`Task ${task.id} validations did not pass after ${validationSequence} attempts`);
          }

          // Mark task as completed
          implementCompletedTaskIds.push(task.id);
          totalImplementCost += 0; // Cost tracked in individual activities
          console.log(`[Implement] Task "${task.title}" (${task.id}) ✅ complete and validated`);
        }

        // Check if more tasks are available
        moreImplementTasksAvailable = implementTaskBreakdown.more_tasks === true;
        if (moreImplementTasksAvailable) {
          console.log(`[Implement] More tasks available, requesting next batch...`);
        }
      }

      console.log(`[Implement] All implementation tasks complete (total cost: $${totalImplementCost}, ${implementCompletedTaskIds.length} tasks completed)`);
    } else {
      console.log(`[Implement] Skipping - package implementation already exists`);
    }

    // Note: CLI workspace files need to be copied to actual package path
    // This will be handled in a follow-up activity if needed

    // Activity 3: Run build (turn-based generation already validated build during BUILD_VALIDATION phase)
    const buildResult = await runBuild({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath,
      expectedPackageName: input.packageName
    });
    report.buildMetrics.buildTime = buildResult.duration;

    if (!buildResult.success) {
      report.error = `Build failed: ${buildResult.stderr}`;
      throw new Error(`Build failed: ${buildResult.stderr}`);
    }

    // Activity 4: Run tests (turn-based generation already validated tests during BUILD_VALIDATION phase)
    const testResult = await runTests({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });
    report.buildMetrics.testTime = testResult.duration;
    report.quality.testCoverage = testResult.coverage;

    if (!testResult.success) {
      report.error = `Tests failed: ${testResult.stderr}`;
      throw new Error(`Tests failed: ${testResult.stderr}`);
    }

    // Commit successful build and tests
    const testCommitResult = await commitChanges({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath,
      message: `test: passing tests for ${input.packageName}

Build and tests completed successfully.
Coverage: ${testResult.coverage}%

[Automated commit by PackageBuildWorkflow]`,
      gitUser: {
        name: 'Package Builder',
        email: 'builder@bernier.llc'
      }
    });

    if (testCommitResult.success && testCommitResult.commitHash) {
      console.log(`[Git] Tests committed: ${testCommitResult.commitHash}`);
    }

    // Activity 5: Run quality checks
    let qualityResult = await runQualityChecks({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });
    report.buildMetrics.qualityCheckTime = qualityResult.duration;

    // If quality checks fail, use CLI agent to fix and retry (up to 3 times)
    let fixAttempt = 1;
    while (!qualityResult.passed && fixAttempt <= 3) {
      const fixStart = Date.now();

      console.log(`[Quality] Fix attempt ${fixAttempt}/3 for ${qualityResult.failures.length} issues`);
      
      await spawnFixAgent({
        packagePath: input.packagePath,
        planPath: input.planPath,
        failures: qualityResult.failures,
        workspaceRoot: input.workspaceRoot,
      });

      const fixDuration = Date.now() - fixStart;

      report.fixAttempts.push({
        count: fixAttempt,
        types: qualityResult.failures.map(f => f.type),
        agentPromptUsed: 'cli-agent', // Using CLI agent now
        fixDuration
      });

      // Retry quality checks
      qualityResult = await runQualityChecks({
        workspaceRoot: input.workspaceRoot,
        packagePath: input.packagePath
      });

      fixAttempt++;
    }

    if (!qualityResult.passed) {
      throw new Error(`Quality checks failed after 3 fix attempts`);
    }

    report.quality.passed = true;

    // Activity 6: Publish package
    const publishResult = await publishPackage({
      packageName: input.packageName,
      packagePath: input.packagePath,
      config: input.config
    });
    report.buildMetrics.publishTime = publishResult.duration;

    if (!publishResult.success) {
      throw new Error(`Publish failed: ${publishResult.stdout}`);
    }

    // Push all commits to remote
    const pushResult = await pushChanges({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath,
      remote: 'origin',
      branch: 'main'
    });

    if (pushResult.success) {
      console.log(`[Git] Changes pushed to origin/main`);
    } else {
      console.warn(`[Git] Failed to push changes: ${pushResult.stderr || 'Unknown error'}`);
      // Don't fail the workflow if push fails - package is already published
    }

    report.status = 'success';

    return {
      success: true,
      packageName: input.packageName,
      report
    };

  } catch (error) {
    report.status = 'failed';
    report.error = error instanceof Error ? error.message : String(error);

    const errorMsg = error instanceof Error ? error.message : String(error);
    const failedPhase = errorMsg.includes('Build failed') ? 'build' :
                        errorMsg.includes('Tests failed') ? 'test' :
                        errorMsg.includes('Quality checks failed') ? 'quality' :
                        errorMsg.includes('Publish failed') ? 'publish' : 'build';

    return {
      success: false,
      packageName: input.packageName,
      failedPhase,
      error: errorMsg,
      fixAttempts: report.fixAttempts.length,
      report
    };

  } finally {
    report.endTime = new Date().toISOString();
    report.duration = Date.now() - startTime;

    // Write package build report
    await writePackageBuildReport(report, input.workspaceRoot);
  }
}
