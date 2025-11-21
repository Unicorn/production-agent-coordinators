/**
 * K6 Performance Test: Workflow Execution
 *
 * Tests concurrent workflow execution performance
 *
 * Acceptance Criteria:
 * - Deploy 10 workflows simultaneously
 * - Execute 20 workflows simultaneously
 * - All operations complete within acceptable time (90th percentile <5s)
 * - No memory leaks during extended test run
 *
 * Usage:
 *   k6 run tests/performance/workflow-execution.k6.js
 *   k6 run --vus 20 --duration 5m tests/performance/workflow-execution.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const errorRate = new Rate('errors');
const deploymentTime = new Trend('workflow_deployment_time');
const executionTime = new Trend('workflow_execution_time');
const deploymentsCounter = new Counter('workflows_deployed');
const executionsCounter = new Counter('workflows_executed');
const memoryUsage = new Gauge('memory_usage_mb');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3010';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';

// Test configuration
export const options = {
  scenarios: {
    // Scenario 1: Deploy 10 workflows simultaneously
    deployment: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      maxDuration: '2m',
      startTime: '0s',
      tags: { scenario: 'deployment' },
    },
    // Scenario 2: Execute 20 workflows simultaneously (after deployments)
    execution: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 1,
      maxDuration: '3m',
      startTime: '2m', // Start after deployment scenario
      tags: { scenario: 'execution' },
    },
    // Scenario 3: Sustained execution load for memory leak testing
    sustained_load: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30m',
      startTime: '5m',
      tags: { scenario: 'sustained_load' },
    },
  },
  thresholds: {
    http_req_duration: ['p(90)<5000', 'p(95)<8000'],
    http_req_failed: ['rate<0.02'], // 2% error tolerance
    'workflow_deployment_time': ['p(90)<5000'],
    'workflow_execution_time': ['p(90)<5000'],
    errors: ['rate<0.02'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Setup: Prepare test environment
export function setup() {
  if (!ACCESS_TOKEN) {
    throw new Error('ACCESS_TOKEN environment variable is required');
  }

  console.log('Setting up execution performance test...');
  console.log(`Base URL: ${BASE_URL}`);

  return { baseUrl: BASE_URL, token: ACCESS_TOKEN };
}

// Helper: Create a workflow
function createWorkflow(baseUrl, token, name) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Create project
  const projectPayload = JSON.stringify({
    json: {
      name: `exec-test-project-${name}`,
      description: 'Execution performance test project',
      taskQueueName: `exec-test-queue-${name}`,
    }
  });

  const projectResponse = http.post(
    `${baseUrl}/api/trpc/projects.create`,
    projectPayload,
    { headers }
  );

  if (projectResponse.status !== 200) {
    return { error: 'Failed to create project' };
  }

  const projectData = JSON.parse(projectResponse.body).result.data;

  // Create workflow with multiple activities
  const workflowDefinition = {
    nodes: [
      {
        id: 'start',
        type: 'trigger',
        data: { label: 'Start' },
        position: { x: 100, y: 100 }
      },
      {
        id: 'activity1',
        type: 'activity',
        data: {
          label: 'Activity 1',
          activityName: 'processData',
          config: { step: 1 }
        },
        position: { x: 300, y: 100 }
      },
      {
        id: 'activity2',
        type: 'activity',
        data: {
          label: 'Activity 2',
          activityName: 'validateData',
          config: { step: 2 }
        },
        position: { x: 500, y: 100 }
      },
      {
        id: 'activity3',
        type: 'activity',
        data: {
          label: 'Activity 3',
          activityName: 'saveData',
          config: { step: 3 }
        },
        position: { x: 700, y: 100 }
      },
      {
        id: 'end',
        type: 'end',
        data: { label: 'End' },
        position: { x: 900, y: 100 }
      }
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'activity1' },
      { id: 'e2', source: 'activity1', target: 'activity2' },
      { id: 'e3', source: 'activity2', target: 'activity3' },
      { id: 'e4', source: 'activity3', target: 'end' }
    ]
  };

  const kebabName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const workflowPayload = JSON.stringify({
    json: {
      kebabName: kebabName,
      displayName: name,
      description: 'Execution performance test workflow',
      visibility: 'private',
      projectId: projectData.id,
      taskQueueId: projectData.taskQueueId,
      definition: workflowDefinition,
    }
  });

  const workflowResponse = http.post(
    `${baseUrl}/api/trpc/workflows.create`,
    workflowPayload,
    { headers }
  );

  if (workflowResponse.status !== 200) {
    return { error: 'Failed to create workflow' };
  }

  const workflowData = JSON.parse(workflowResponse.body).result.data;

  return {
    workflowId: workflowData.id,
    projectId: projectData.id,
  };
}

// Helper: Deploy a workflow
function deployWorkflow(baseUrl, token, workflowId) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const startTime = Date.now();

  const deployPayload = JSON.stringify({
    json: { id: workflowId }
  });

  const response = http.post(
    `${baseUrl}/api/trpc/workflows.deploy`,
    deployPayload,
    { headers, tags: { operation: 'deploy' } }
  );

  const duration = Date.now() - startTime;
  deploymentTime.add(duration);

  const success = check(response, {
    'deployment successful': (r) => r.status === 200,
    'deployment has temporal_workflow_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result && body.result.data && body.result.data.temporal_workflow_id;
      } catch (e) {
        return false;
      }
    },
    'deployment under 5s': () => duration < 5000,
  });

  if (success) {
    deploymentsCounter.add(1);
    return { success: true, duration };
  } else {
    errorRate.add(1);
    return { success: false, error: response.body };
  }
}

// Helper: Execute a workflow
function executeWorkflow(baseUrl, token, workflowId) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const startTime = Date.now();

  const executePayload = JSON.stringify({
    json: {
      workflowId: workflowId,
      input: {
        testData: 'Performance test execution',
        timestamp: new Date().toISOString(),
      }
    }
  });

  const response = http.post(
    `${baseUrl}/api/trpc/execution.build`,
    executePayload,
    { headers, tags: { operation: 'execute' } }
  );

  const duration = Date.now() - startTime;
  executionTime.add(duration);

  const success = check(response, {
    'execution started successfully': (r) => r.status === 200,
    'execution has executionId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result && body.result.data && body.result.data.executionId;
      } catch (e) {
        return false;
      }
    },
    'execution initiation under 5s': () => duration < 5000,
  });

  if (success) {
    executionsCounter.add(1);
    const data = JSON.parse(response.body).result.data;
    return { success: true, executionId: data.executionId, duration };
  } else {
    errorRate.add(1);
    return { success: false, error: response.body };
  }
}

// Helper: Monitor execution status
function monitorExecution(baseUrl, token, executionId, maxWaitTime = 30000) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const startTime = Date.now();
  let status = 'unknown';

  // Poll for completion
  while (Date.now() - startTime < maxWaitTime) {
    const statusPayload = JSON.stringify({
      json: { executionId: executionId }
    });

    const response = http.post(
      `${baseUrl}/api/trpc/execution.getStatus`,
      statusPayload,
      { headers, tags: { operation: 'monitor' } }
    );

    if (response.status === 200) {
      const data = JSON.parse(response.body).result.data;
      status = data.status;

      if (status === 'completed' || status === 'failed') {
        return {
          status,
          duration: Date.now() - startTime,
          result: data.result,
          error: data.error,
        };
      }
    }

    sleep(1); // Poll every second
  }

  return { status: 'timeout', duration: maxWaitTime };
}

// Main test function
export default function (data) {
  const scenario = __ENV.SCENARIO || 'execution';
  const uniqueId = `${__VU}-${__ITER}-${Date.now()}`;

  if (scenario === 'deployment') {
    // Deployment scenario: Create and deploy workflows
    const workflowName = `deploy-perf-${uniqueId}`;
    const workflow = createWorkflow(data.baseUrl, data.token, workflowName);

    if (workflow.error) {
      console.error(`Failed to create workflow: ${workflow.error}`);
      errorRate.add(1);
      return;
    }

    const deployResult = deployWorkflow(data.baseUrl, data.token, workflow.workflowId);

    if (!deployResult.success) {
      console.error(`Deployment failed: ${deployResult.error}`);
    }

    sleep(1);
  } else {
    // Execution scenario: Create, deploy, and execute workflows
    const workflowName = `exec-perf-${uniqueId}`;
    const workflow = createWorkflow(data.baseUrl, data.token, workflowName);

    if (workflow.error) {
      console.error(`Failed to create workflow: ${workflow.error}`);
      errorRate.add(1);
      return;
    }

    // Deploy workflow
    const deployResult = deployWorkflow(data.baseUrl, data.token, workflow.workflowId);
    if (!deployResult.success) {
      console.error(`Deployment failed: ${deployResult.error}`);
      return;
    }

    sleep(2); // Wait for deployment to complete

    // Execute workflow
    const execResult = executeWorkflow(data.baseUrl, data.token, workflow.workflowId);
    if (!execResult.success) {
      console.error(`Execution failed: ${execResult.error}`);
      return;
    }

    // Monitor execution (optional - for detailed tracking)
    // const monitorResult = monitorExecution(data.baseUrl, data.token, execResult.executionId);
    // console.log(`Execution ${execResult.executionId} status: ${monitorResult.status}`);

    sleep(1);
  }

  // Track memory usage (if available)
  // This would require additional monitoring setup
  // memoryUsage.add(process.memoryUsage().heapUsed / 1024 / 1024);
}

// Custom summary
export function handleSummary(data) {
  const report = {
    timestamp: new Date().toISOString(),
    test: 'workflow-execution',
    summary: {
      total_requests: data.metrics.http_reqs.values.count,
      workflows_deployed: data.metrics.workflows_deployed.values.count,
      workflows_executed: data.metrics.workflows_executed.values.count,
      error_rate: (data.metrics.errors.values.rate * 100).toFixed(2) + '%',
      avg_deployment_time: data.metrics.workflow_deployment_time.values.avg.toFixed(2) + 'ms',
      p90_deployment_time: data.metrics.workflow_deployment_time.values['p(90)'].toFixed(2) + 'ms',
      avg_execution_time: data.metrics.workflow_execution_time.values.avg.toFixed(2) + 'ms',
      p90_execution_time: data.metrics.workflow_execution_time.values['p(90)'].toFixed(2) + 'ms',
      p95_http_duration: data.metrics.http_req_duration.values['p(95)'].toFixed(2) + 'ms',
    },
    thresholds: {
      passed: data.metrics.http_req_duration.thresholds['p(90)<5000'].ok,
      details: {
        'p90_deployment<5s': data.metrics.workflow_deployment_time.thresholds['p(90)<5000'].ok,
        'p90_execution<5s': data.metrics.workflow_execution_time.thresholds['p(90)<5000'].ok,
        'error_rate<2%': data.metrics.http_req_failed.thresholds['rate<0.02'].ok,
      }
    }
  };

  return {
    'stdout': JSON.stringify(report, null, 2),
    'tests/performance/reports/workflow-execution-report.json': JSON.stringify(report, null, 2),
    'tests/performance/reports/workflow-execution-summary.txt': generateTextSummary(report),
  };
}

function generateTextSummary(report) {
  return `
========================================
Workflow Execution Performance Test
========================================
Timestamp: ${report.timestamp}

RESULTS SUMMARY:
----------------
Total Requests:        ${report.summary.total_requests}
Workflows Deployed:    ${report.summary.workflows_deployed}
Workflows Executed:    ${report.summary.workflows_executed}
Error Rate:            ${report.summary.error_rate}

DEPLOYMENT METRICS:
------------------
Average Time:          ${report.summary.avg_deployment_time}
90th Percentile:       ${report.summary.p90_deployment_time}

EXECUTION METRICS:
-----------------
Average Time:          ${report.summary.avg_execution_time}
90th Percentile:       ${report.summary.p90_execution_time}

HTTP METRICS:
------------
95th Percentile:       ${report.summary.p95_http_duration}

THRESHOLD VALIDATION:
--------------------
Overall:               ${report.thresholds.passed ? 'PASSED ✓' : 'FAILED ✗'}
Deployment p90<5s:     ${report.thresholds.details['p90_deployment<5s'] ? 'PASSED ✓' : 'FAILED ✗'}
Execution p90<5s:      ${report.thresholds.details['p90_execution<5s'] ? 'PASSED ✓' : 'FAILED ✗'}
Error Rate <2%:        ${report.thresholds.details['error_rate<2%'] ? 'PASSED ✓' : 'FAILED ✗'}

========================================
`;
}
