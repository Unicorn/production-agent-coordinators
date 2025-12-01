import { proxyActivities } from '@temporalio/workflow';
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
  executeCLIAgent, 
  setupCLIWorkspace, 
  selectCLIProvider,
  readPlanFileContent,
  readRequirementsContent
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

export async function PackageBuildWorkflow(input: PackageBuildInput): Promise<PackageBuildResult> {
  const startTime = Date.now();
  const report: PackageBuildReport = {
    packageName: input.packageName,
    workflowId: 'wf-placeholder', // Set by Temporal
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
    const provider = await selectCLIProvider('scaffold');
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

    // Activity 6: Scaffold package using CLI agent
    if (!codeExists || (resumePoint && resumePoint.phase === 'scaffold')) {
      console.log(`[Scaffold] Using ${provider.name} CLI for scaffolding...`);
      
      const scaffoldInstruction = resumePoint?.resumeInstruction || `Create the package structure for: ${input.packageName}

Read the plan file and requirements. Create:
- package.json with all required scripts and dependencies
- tsconfig.json (strict mode enabled)
- jest.config.js (coverage thresholds per requirements)
- .eslintrc.js (strict rules per requirements)
- README.md (with usage examples)
- Directory structure (src/, __tests__/)`;

      const scaffoldResult = await executeCLIAgent({
        instruction: scaffoldInstruction,
        workingDir: packageFullPath,
        contextContent: `# BernierLLC Package Requirements\n\n${requirementsContent}\n\n---\n\n# Package Specification\n\n${planContent}`,
        task: 'scaffold',
      }, provider.name);

      if (!scaffoldResult.success) {
        report.error = `${provider.name} CLI scaffolding failed: ${scaffoldResult.error || 'Unknown error'}`;
        throw new Error(`${provider.name} CLI scaffolding failed: ${scaffoldResult.error}`);
      }

      console.log(`[Scaffold] Scaffolding complete (cost: $${scaffoldResult.cost_usd})`);
    } else {
      console.log(`[Scaffold] Skipping - package structure already exists`);
    }

    // Activity 7: Implement package using CLI agent
    if (!codeExists || (resumePoint && (resumePoint.phase === 'implement' || resumePoint.phase === 'scaffold'))) {
      console.log(`[Implement] Using ${provider.name} CLI for implementation...`);
      
      const implementInstruction = resumePoint?.resumeInstruction || `Implement the full package based on the specification.

Create:
- All TypeScript source files in src/
- Comprehensive tests in __tests__/
- TSDoc comments on all public exports

Ensure all requirements are met.`;

      let sessionId: string | undefined;
      if (provider.name === 'claude' && resumePoint) {
        // For Claude, we could resume session if we had it stored
        // For now, we'll start fresh but include resume context
      }

      const implementResult = await executeCLIAgent({
        instruction: implementInstruction,
        workingDir: packageFullPath,
        contextContent: `# BernierLLC Package Requirements\n\n${requirementsContent}\n\n---\n\n# Package Specification\n\n${planContent}`,
        sessionId,
        task: 'implement',
      }, provider.name);

      if (!implementResult.success) {
        report.error = `${provider.name} CLI implementation failed: ${implementResult.error || 'Unknown error'}`;
        throw new Error(`${provider.name} CLI implementation failed: ${implementResult.error}`);
      }

      console.log(`[Implement] Implementation complete (cost: $${implementResult.cost_usd})`);
      
      // For Claude, capture session ID for potential future use
      if (provider.name === 'claude' && implementResult.session_id) {
        sessionId = implementResult.session_id;
      }
    } else {
      console.log(`[Implement] Skipping - package implementation already exists`);
    }

    // Note: CLI workspace files need to be copied to actual package path
    // This will be handled in a follow-up activity if needed

    // Activity 3: Run build (turn-based generation already validated build during BUILD_VALIDATION phase)
    const buildResult = await runBuild({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
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
