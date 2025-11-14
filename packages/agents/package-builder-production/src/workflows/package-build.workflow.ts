import { proxyActivities, executeChild } from '@temporalio/workflow';
import type { PackageBuildInput, PackageBuildResult, PackageBuildReport } from '../types/index';
import type * as activities from '../activities/build.activities';
import type * as agentActivities from '../activities/agent.activities';
import type * as reportActivities from '../activities/report.activities';
import type * as agentRegistryActivities from '../activities/agent-registry.activities';
import { CoordinatorWorkflow } from './coordinator.workflow.js';
import type { Problem, CoordinatorAction } from '../types/coordinator.types';

// Create activity proxies with timeouts
const { runBuild, runTests, runQualityChecks, publishPackage } = proxyActivities<typeof activities>({
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
    // Activity 1: Verify dependencies are published
    await verifyDependencies(input.dependencies);

    // Activity 2: Run build with coordinator retry loop
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
      const agentRegistry = await loadAgentRegistry();

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
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'engine',
        workflowId: `coordinator-build-${input.packageName}-${Date.now()}`,
        args: [{
          problem,
          agentRegistry,
          maxAttempts: maxCoordinatorAttempts
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
      const agentRegistry = await loadAgentRegistry();

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
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'engine',
        workflowId: `coordinator-test-${input.packageName}-${Date.now()}`,
        args: [{
          problem,
          agentRegistry,
          maxAttempts: maxCoordinatorAttempts
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
