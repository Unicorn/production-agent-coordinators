/**
 * K6 Performance Test: Workflow Creation
 *
 * Tests concurrent workflow creation performance via tRPC API
 *
 * Acceptance Criteria:
 * - Create 10 workflows simultaneously
 * - All operations complete within acceptable time (90th percentile <5s)
 * - No errors during creation
 *
 * Usage:
 *   k6 run tests/performance/workflow-creation.k6.js
 *   k6 run --vus 10 --duration 30s tests/performance/workflow-creation.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const errorRate = new Rate('errors');
const creationTime = new Trend('workflow_creation_time');
const creationCounter = new Counter('workflows_created');
const validationErrors = new Counter('validation_errors');

// Load test configuration from environment
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3010';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';

// Test stages: ramp up to 10 concurrent workflow creations
export const options = {
  stages: [
    { duration: '10s', target: 2 },   // Warm up
    { duration: '20s', target: 10 },  // Ramp to 10 concurrent users
    { duration: '30s', target: 10 },  // Stay at 10 concurrent users
    { duration: '10s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(90)<5000', 'p(95)<7000'], // 90% under 5s, 95% under 7s
    http_req_failed: ['rate<0.01'],                   // Error rate under 1%
    'workflow_creation_time': ['p(90)<5000'],         // Custom metric: 90% under 5s
    errors: ['rate<0.01'],                            // Custom error rate under 1%
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Generate unique workflow names for each virtual user
const workflowNames = new SharedArray('workflow-names', function () {
  const names = [];
  for (let i = 0; i < 1000; i++) {
    names.push(`perf-test-workflow-${Date.now()}-${i}`);
  }
  return names;
});

// Test data: sample workflow definition
function generateWorkflowDefinition(name) {
  return {
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
          label: 'Test Activity',
          activityName: 'testActivity',
          config: { message: 'Hello from performance test' }
        },
        position: { x: 300, y: 100 }
      },
      {
        id: 'end',
        type: 'end',
        data: { label: 'End' },
        position: { x: 500, y: 100 }
      }
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'activity1' },
      { id: 'e2', source: 'activity1', target: 'end' }
    ]
  };
}

// Setup: Create test project once per VU
export function setup() {
  if (!ACCESS_TOKEN) {
    throw new Error('ACCESS_TOKEN environment variable is required');
  }

  console.log('Setting up performance test environment...');
  console.log(`Base URL: ${BASE_URL}`);

  return { baseUrl: BASE_URL, token: ACCESS_TOKEN };
}

// Main test scenario
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Generate unique workflow name
  const uniqueId = `${__VU}-${__ITER}`;
  const workflowName = `perf-test-${uniqueId}-${Date.now()}`;
  const kebabName = workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Step 1: Create a test project (or use existing)
  const projectPayload = JSON.stringify({
    json: {
      name: `perf-test-project-${uniqueId}`,
      description: 'Performance test project',
      taskQueueName: `perf-test-queue-${uniqueId}`,
    }
  });

  const projectResponse = http.post(
    `${data.baseUrl}/api/trpc/projects.create`,
    projectPayload,
    { headers }
  );

  const projectSuccess = check(projectResponse, {
    'project created successfully': (r) => r.status === 200,
    'project has valid response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result && body.result.data;
      } catch (e) {
        return false;
      }
    },
  });

  if (!projectSuccess) {
    errorRate.add(1);
    console.error(`Failed to create project: ${projectResponse.status} ${projectResponse.body}`);
    return;
  }

  const projectData = JSON.parse(projectResponse.body).result.data;
  const projectId = projectData.id;
  const taskQueueId = projectData.taskQueueId;

  // Step 2: Create workflow
  const startTime = Date.now();

  const workflowPayload = JSON.stringify({
    json: {
      kebabName: kebabName,
      displayName: workflowName,
      description: `Performance test workflow created at ${new Date().toISOString()}`,
      visibility: 'private',
      projectId: projectId,
      taskQueueId: taskQueueId,
      definition: generateWorkflowDefinition(workflowName),
    }
  });

  const workflowResponse = http.post(
    `${data.baseUrl}/api/trpc/workflows.create`,
    workflowPayload,
    { headers, tags: { name: 'create_workflow' } }
  );

  const endTime = Date.now();
  const duration = endTime - startTime;

  // Record metrics
  creationTime.add(duration);

  // Validate response
  const success = check(workflowResponse, {
    'workflow created successfully': (r) => r.status === 200,
    'workflow has valid ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result && body.result.data && body.result.data.id;
      } catch (e) {
        return false;
      }
    },
    'creation time under 5s': () => duration < 5000,
  });

  if (success) {
    creationCounter.add(1);
    errorRate.add(0);
  } else {
    errorRate.add(1);
    validationErrors.add(1);
    console.error(`Workflow creation failed: ${workflowResponse.status} ${workflowResponse.body}`);
  }

  // Step 3: Verify workflow can be retrieved
  if (success) {
    const workflowData = JSON.parse(workflowResponse.body).result.data;
    const workflowId = workflowData.id;

    const getResponse = http.post(
      `${data.baseUrl}/api/trpc/workflows.get`,
      JSON.stringify({ json: { id: workflowId } }),
      { headers, tags: { name: 'get_workflow' } }
    );

    check(getResponse, {
      'workflow retrieved successfully': (r) => r.status === 200,
      'retrieved workflow matches created': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result && body.result.data && body.result.data.workflow.id === workflowId;
        } catch (e) {
          return false;
        }
      },
    });
  }

  // Realistic think time between operations
  sleep(1);
}

// Teardown: Clean up test data (optional - could be handled by separate cleanup script)
export function teardown(data) {
  console.log('Performance test completed. Check results for metrics.');
  console.log('Note: Test data cleanup should be handled separately to avoid affecting metrics.');
}

// Custom summary report
export function handleSummary(data) {
  const report = {
    timestamp: new Date().toISOString(),
    test: 'workflow-creation',
    summary: {
      total_requests: data.metrics.http_reqs.values.count,
      workflows_created: data.metrics.workflows_created.values.count,
      error_rate: (data.metrics.errors.values.rate * 100).toFixed(2) + '%',
      avg_creation_time: data.metrics.workflow_creation_time.values.avg.toFixed(2) + 'ms',
      p90_creation_time: data.metrics.workflow_creation_time.values['p(90)'].toFixed(2) + 'ms',
      p95_creation_time: data.metrics.workflow_creation_time.values['p(95)'].toFixed(2) + 'ms',
      p99_creation_time: data.metrics.workflow_creation_time.values['p(99)'].toFixed(2) + 'ms',
      avg_http_duration: data.metrics.http_req_duration.values.avg.toFixed(2) + 'ms',
      p90_http_duration: data.metrics.http_req_duration.values['p(90)'].toFixed(2) + 'ms',
      p95_http_duration: data.metrics.http_req_duration.values['p(95)'].toFixed(2) + 'ms',
    },
    thresholds: {
      passed: !data.metrics.http_req_duration.thresholds['p(90)<5000'].ok === false,
      details: {
        'p90<5s': data.metrics.http_req_duration.thresholds['p(90)<5000'].ok,
        'error_rate<1%': data.metrics.http_req_failed.thresholds['rate<0.01'].ok,
      }
    }
  };

  return {
    'stdout': JSON.stringify(report, null, 2),
    'tests/performance/reports/workflow-creation-report.json': JSON.stringify(report, null, 2),
    'tests/performance/reports/workflow-creation-summary.txt': generateTextSummary(report),
  };
}

function generateTextSummary(report) {
  return `
========================================
Workflow Creation Performance Test
========================================
Timestamp: ${report.timestamp}

RESULTS SUMMARY:
----------------
Total Requests:      ${report.summary.total_requests}
Workflows Created:   ${report.summary.workflows_created}
Error Rate:          ${report.summary.error_rate}

CREATION TIME METRICS:
---------------------
Average:             ${report.summary.avg_creation_time}
90th Percentile:     ${report.summary.p90_creation_time}
95th Percentile:     ${report.summary.p95_creation_time}
99th Percentile:     ${report.summary.p99_creation_time}

HTTP DURATION METRICS:
---------------------
Average:             ${report.summary.avg_http_duration}
90th Percentile:     ${report.summary.p90_http_duration}
95th Percentile:     ${report.summary.p95_http_duration}

THRESHOLD VALIDATION:
--------------------
Overall:             ${report.thresholds.passed ? 'PASSED ✓' : 'FAILED ✗'}
p90 < 5s:            ${report.thresholds.details['p90<5s'] ? 'PASSED ✓' : 'FAILED ✗'}
Error Rate < 1%:     ${report.thresholds.details['error_rate<1%'] ? 'PASSED ✓' : 'FAILED ✗'}

========================================
`;
}
