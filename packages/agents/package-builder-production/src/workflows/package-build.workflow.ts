import { proxyActivities, executeChild } from '@temporalio/workflow';
import type { PackageBuildInput, PackageBuildResult, PackageBuildReport, PackageAuditContext } from '../types/index';
import type * as activities from '../activities/build.activities';
import type * as agentActivities from '../activities/agent.activities';
import type * as reportActivities from '../activities/report.activities';
// NOTE: Keeping Claude turn-based workflow available for reference
// import { TurnBasedCodingAgentWorkflow, type TurnBasedCodingAgentInput } from './turn-based-coding-agent.workflow.js';

// Using Gemini turn-based workflow as the active generation method
import { GeminiTurnBasedAgentWorkflow, type GeminiTurnBasedAgentInput } from './gemini-turn-based-agent.workflow.js';

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

    // Store audit context for passing to Gemini (if applicable)
    let packageAuditContext: PackageAuditContext | undefined;

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

    // Activity 2: Scaffold package using Gemini turn-based coding agent (loop-based with dynamic commands)
    console.log(`[Scaffold] Using Gemini turn-based generation (AI-driven command loop with git commits)`);

    const geminiInput: GeminiTurnBasedAgentInput = {
      packageName: input.packageName,
      packagePath: input.packagePath,
      planPath: input.planPath,
      workspaceRoot: input.workspaceRoot,
      category: input.category,
      gitUser: {
        name: 'Gemini Package Builder Agent',
        email: 'builder@bernier.llc'
      },
      // Pass audit context if package is partially complete (saves tokens by not regenerating existing files)
      initialContext: packageAuditContext
    };

    const scaffoldResult = await executeChild(GeminiTurnBasedAgentWorkflow, {
      taskQueue: 'turn-based-coding',
      workflowId: `gemini-turn-based-${input.packageName}-${Date.now()}`,
      args: [geminiInput]
    });

    // Handle Gemini turn-based generation result
    // Each code change already committed to git during generation
    if (!scaffoldResult.success) {
      report.error = `Gemini turn-based generation failed: ${scaffoldResult.error || 'Unknown error'}`;
      throw new Error(`Gemini turn-based generation failed: ${scaffoldResult.error}`);
    }

    console.log(`[Scaffold] Package generated successfully across ${scaffoldResult.totalIterations} iterations`);
    console.log(`[Scaffold] Files modified: ${scaffoldResult.filesModified.length}`);
    console.log(`[Scaffold] Action history: ${scaffoldResult.actionHistory.length} actions`);

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

    // If quality checks fail, spawn fix agent and retry (up to 3 times)
    let fixAttempt = 1;
    while (!qualityResult.passed && fixAttempt <= 3) {
      const fixStart = Date.now();

      await spawnFixAgent({
        packagePath: input.packagePath,
        planPath: input.planPath,
        failures: qualityResult.failures
      });

      const fixDuration = Date.now() - fixStart;

      report.fixAttempts.push({
        count: fixAttempt,
        types: qualityResult.failures.map(f => f.type),
        agentPromptUsed: 'generic-developer.md', // Updated by agent
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
