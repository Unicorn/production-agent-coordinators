import { proxyActivities, executeChild } from '@temporalio/workflow';
import type { PackageBuildInput, PackageBuildResult, PackageBuildReport } from '../types/index';
import type * as activities from '../activities/build.activities';
import type * as agentActivities from '../activities/agent.activities';
import type * as reportActivities from '../activities/report.activities';
import type * as agentRegistryActivities from '../activities/agent-registry.activities';
import { CoordinatorWorkflow } from './coordinator.workflow.js';
import type { Problem, CoordinatorAction } from '../types/coordinator.types';

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

const { loadAgentRegistry } = proxyActivities<typeof agentRegistryActivities>({
  startToCloseTimeout: '1 minute'
});

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
          // For now, continue with normal flow
          // TODO: In future, spawn agents for specific gaps from audit.nextSteps
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

    // Activity 2: Scaffold package using package-development-agent
    const agentRegistry = await loadAgentRegistry(
      '/Users/mattbernier/projects/tools/.claude/agents'
    );

    const scaffoldProblem: Problem = {
      type: 'PACKAGE_SCAFFOLDING',
      error: {
        message: `Scaffold package ${input.packageName} from plan`,
        stderr: '',
        stdout: `Plan: ${input.planPath}\nPackage path: ${input.packagePath}`
      },
      context: {
        packageName: input.packageName,
        packagePath: input.packagePath,
        planPath: input.planPath,
        phase: 'scaffold',
        attemptNumber: 1
      }
    };

    const scaffoldAction: CoordinatorAction = await executeChild(CoordinatorWorkflow, {
      taskQueue: 'engine',
      workflowId: `coordinator-scaffold-${input.packageName}`,
      args: [{
        problem: scaffoldProblem,
        agentRegistry,
        maxAttempts: 3,
        workspaceRoot: input.workspaceRoot
      }]
    });

    // Handle coordinator decision
    // For scaffolding, RETRY means "files created successfully, operation complete"
    // RESOLVED also means success
    // ESCALATE means scaffolding failed
    if (scaffoldAction.decision === 'ESCALATE') {
      report.error = `Scaffolding escalated: ${scaffoldAction.escalation!.reason}`;
      throw new Error(`Scaffolding escalated: ${scaffoldAction.escalation!.reason}`);
    } else if (scaffoldAction.decision === 'RETRY' || scaffoldAction.decision === 'RESOLVED') {
      console.log(`[Scaffold] Package scaffolded successfully (${scaffoldAction.decision})`);
    } else {
      // Unexpected decision
      report.error = `Scaffolding failed with unexpected decision: ${scaffoldAction.decision}`;
      throw new Error(`Scaffolding failed: ${scaffoldAction.reasoning}`);
    }

    // Commit scaffolded package
    const commitResult = await commitChanges({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath,
      message: `chore: scaffold ${input.packageName}

Generated package structure from plan file.

[Automated commit by PackageBuildWorkflow]`,
      gitUser: {
        name: 'Package Builder',
        email: 'builder@bernier.llc'
      }
    });

    if (commitResult.success && commitResult.commitHash) {
      console.log(`[Git] Scaffolding committed: ${commitResult.commitHash}`);
    } else {
      console.warn(`[Git] Failed to commit scaffolding: ${commitResult.stderr || 'Unknown error'}`);
    }

    // Activity 3: Run build with coordinator retry loop
    let buildResult = await runBuild({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });
    report.buildMetrics.buildTime = buildResult.duration;

    // Coordinator loop for build failures
    let coordinatorAttempts = 0;
    const maxCoordinatorAttempts = 3;

    while (!buildResult.success && coordinatorAttempts < maxCoordinatorAttempts) {
      // Load agent registry
      const agentRegistry = await loadAgentRegistry(
        '/Users/mattbernier/projects/tools/.claude/agents'
      );

      // Create problem description
      const problem: Problem = {
        type: 'BUILD_FAILURE',
        error: {
          message: buildResult.stderr || 'Build failed',
          stderr: buildResult.stderr,
          stdout: buildResult.stdout
        },
        context: {
          packageName: input.packageName,
          packagePath: input.packagePath,
          planPath: input.planPath,
          phase: 'build',
          attemptNumber: coordinatorAttempts + 1
        }
      };

      // Spawn coordinator child workflow
      const action: CoordinatorAction = await executeChild(CoordinatorWorkflow, {
        taskQueue: 'engine',
        workflowId: `coordinator-build-${input.packageName}-${Date.now()}`,
        args: [{
          problem,
          agentRegistry,
          maxAttempts: maxCoordinatorAttempts,
          workspaceRoot: input.workspaceRoot
        }]
      });

      // Handle coordinator decision
      if (action.decision === 'RETRY') {
        console.log(`[Build] Retrying build after coordinator fixes`);
        // Retry build with agent modifications
        buildResult = await runBuild({
          workspaceRoot: input.workspaceRoot,
          packagePath: input.packagePath
        });
        coordinatorAttempts++;
      } else if (action.decision === 'ESCALATE') {
        report.error = `Build escalated: ${action.escalation!.reason}`;
        throw new Error(`Build escalated: ${action.escalation!.reason}`);
      } else {
        report.error = `Build failed after coordination: ${action.reasoning}`;
        throw new Error(`Build failed after coordination: ${action.reasoning}`);
      }
    }

    if (!buildResult.success) {
      report.error = `Build failed after ${coordinatorAttempts} coordinator attempts`;
      throw new Error(`Build failed after ${coordinatorAttempts} coordinator attempts`);
    }

    // Activity 3: Run tests with coordinator retry loop
    let testResult = await runTests({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });
    report.buildMetrics.testTime = testResult.duration;
    report.quality.testCoverage = testResult.coverage;

    coordinatorAttempts = 0;

    while (!testResult.success && coordinatorAttempts < maxCoordinatorAttempts) {
      const agentRegistry = await loadAgentRegistry(
        '/Users/mattbernier/projects/tools/.claude/agents'
      );

      const problem: Problem = {
        type: 'TEST_FAILURE',
        error: {
          message: testResult.stderr || 'Tests failed',
          stderr: testResult.stderr,
          stdout: testResult.stdout
        },
        context: {
          packageName: input.packageName,
          packagePath: input.packagePath,
          planPath: input.planPath,
          phase: 'test',
          attemptNumber: coordinatorAttempts + 1
        }
      };

      const action: CoordinatorAction = await executeChild(CoordinatorWorkflow, {
        taskQueue: 'engine',
        workflowId: `coordinator-test-${input.packageName}-${Date.now()}`,
        args: [{
          problem,
          agentRegistry,
          maxAttempts: maxCoordinatorAttempts,
          workspaceRoot: input.workspaceRoot
        }]
      });

      if (action.decision === 'RETRY') {
        console.log(`[Test] Retrying tests after coordinator fixes`);
        testResult = await runTests({
          workspaceRoot: input.workspaceRoot,
          packagePath: input.packagePath
        });
        coordinatorAttempts++;
      } else if (action.decision === 'ESCALATE') {
        report.error = `Tests escalated: ${action.escalation!.reason}`;
        throw new Error(`Tests escalated: ${action.escalation!.reason}`);
      } else {
        report.error = `Tests failed after coordination: ${action.reasoning}`;
        throw new Error(`Tests failed after coordination: ${action.reasoning}`);
      }
    }

    if (!testResult.success) {
      report.error = `Tests failed after ${coordinatorAttempts} coordinator attempts`;
      throw new Error(`Tests failed after ${coordinatorAttempts} coordinator attempts`);
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

    // Activity 4: Run quality checks
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

    // Activity 5: Publish package
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
