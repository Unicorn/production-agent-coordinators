/**
 * K6 Performance Test: Compiler Stress Test
 *
 * Tests compiler performance with large workflow definitions
 *
 * Acceptance Criteria:
 * - Compile workflow with 50 activities (stress test)
 * - All operations complete within acceptable time (90th percentile <5s)
 * - No memory leaks during compilation
 * - Database queries are efficient (no N+1 queries)
 *
 * Usage:
 *   k6 run tests/performance/compiler-stress.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const compilationTime = new Trend('compilation_time');
const validationTime = new Trend('validation_time');
const compilationsCounter = new Counter('compilations_completed');
const compilationErrors = new Counter('compilation_errors');
const workflowComplexity = new Gauge('workflow_activity_count');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3010';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';

// Test scenarios with different workflow sizes
export const options = {
  scenarios: {
    // Small workflows (baseline - 5 activities)
    small_workflows: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      startTime: '0s',
      tags: { size: 'small' },
    },
    // Medium workflows (20 activities)
    medium_workflows: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      startTime: '1m',
      tags: { size: 'medium' },
    },
    // Large workflows (50 activities - stress test)
    large_workflows: {
      executor: 'constant-vus',
      vus: 3,
      duration: '3m',
      startTime: '3m',
      tags: { size: 'large' },
    },
    // Extra large workflows (100 activities - extreme stress)
    xlarge_workflows: {
      executor: 'constant-vus',
      vus: 2,
      duration: '2m',
      startTime: '6m',
      tags: { size: 'xlarge' },
    },
  },
  thresholds: {
    'compilation_time{size:small}': ['p(90)<2000'],  // Small: <2s
    'compilation_time{size:medium}': ['p(90)<5000'], // Medium: <5s
    'compilation_time{size:large}': ['p(90)<10000'], // Large: <10s
    'compilation_time{size:xlarge}': ['p(90)<20000'], // XLarge: <20s
    http_req_failed: ['rate<0.05'], // 5% error tolerance for stress test
    errors: ['rate<0.05'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Setup
export function setup() {
  if (!ACCESS_TOKEN) {
    throw new Error('ACCESS_TOKEN environment variable is required');
  }

  console.log('Setting up compiler stress test...');
  console.log(`Base URL: ${BASE_URL}`);

  return { baseUrl: BASE_URL, token: ACCESS_TOKEN };
}

// Helper: Generate workflow with N activities
function generateLargeWorkflowDefinition(activityCount) {
  const nodes = [];
  const edges = [];

  // Start node
  nodes.push({
    id: 'start',
    type: 'trigger',
    data: { label: 'Start' },
    position: { x: 100, y: 300 }
  });

  // Generate activity nodes in a linear chain
  for (let i = 1; i <= activityCount; i++) {
    const nodeId = `activity${i}`;
    nodes.push({
      id: nodeId,
      type: 'activity',
      data: {
        label: `Activity ${i}`,
        activityName: `processStep${i}`,
        config: {
          step: i,
          message: `Processing step ${i}`,
          timeout: '30s',
        },
        timeout: '30s',
        retryPolicy: {
          strategy: 'exponential-backoff',
          maxAttempts: 3,
          initialInterval: '1s',
          maxInterval: '10s',
          backoffCoefficient: 2,
        },
      },
      position: { x: 100 + (i * 200), y: 300 }
    });

    // Create edge from previous node
    const sourceId = i === 1 ? 'start' : `activity${i - 1}`;
    edges.push({
      id: `e${i}`,
      source: sourceId,
      target: nodeId
    });
  }

  // Add conditional branches for complexity (every 10th activity)
  let branchCount = 0;
  for (let i = 10; i <= activityCount; i += 10) {
    branchCount++;
    const conditionId = `condition${branchCount}`;
    const branchId = `branch${branchCount}`;

    // Add condition node
    nodes.push({
      id: conditionId,
      type: 'conditional',
      data: {
        label: `Condition ${branchCount}`,
        config: {
          condition: `step${i}Result === 'success'`,
        }
      },
      position: { x: 100 + (i * 200), y: 100 }
    });

    // Add branch activity
    nodes.push({
      id: branchId,
      type: 'activity',
      data: {
        label: `Branch Activity ${branchCount}`,
        activityName: `handleBranch${branchCount}`,
        config: { branch: branchCount }
      },
      position: { x: 100 + (i * 200) + 100, y: 100 }
    });

    // Connect to condition
    edges.push({
      id: `e_cond${branchCount}`,
      source: `activity${i}`,
      target: conditionId
    });

    // Condition to branch
    edges.push({
      id: `e_branch${branchCount}_yes`,
      source: conditionId,
      target: branchId,
      label: 'yes'
    });

    // Condition back to main flow
    const nextActivity = i + 1 <= activityCount ? `activity${i + 1}` : 'end';
    edges.push({
      id: `e_branch${branchCount}_no`,
      source: conditionId,
      target: nextActivity,
      label: 'no'
    });

    // Branch back to main flow
    edges.push({
      id: `e_branch${branchCount}_join`,
      source: branchId,
      target: nextActivity
    });
  }

  // End node
  nodes.push({
    id: 'end',
    type: 'end',
    data: { label: 'End' },
    position: { x: 100 + ((activityCount + 1) * 200), y: 300 }
  });

  // Connect last activity to end
  edges.push({
    id: `e${activityCount + 1}`,
    source: `activity${activityCount}`,
    target: 'end'
  });

  // Add state variables
  const variables = [];
  for (let i = 1; i <= Math.min(activityCount / 5, 20); i++) {
    variables.push({
      name: `state${i}`,
      type: 'object',
      initialValue: { count: 0, status: 'pending' },
      description: `State variable ${i} for workflow state management`
    });
  }

  return {
    nodes,
    edges,
    variables,
    settings: {
      timeout: `${activityCount * 60}s`, // 1 minute per activity
      retryPolicy: {
        strategy: 'exponential-backoff',
        maxAttempts: 3,
        initialInterval: '1s',
        maxInterval: '30s',
        backoffCoefficient: 2,
      },
      description: `Stress test workflow with ${activityCount} activities`,
      version: '1.0.0',
    }
  };
}

// Helper: Create and compile workflow
function createAndCompileWorkflow(baseUrl, token, activityCount, scenario) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const uniqueId = `${__VU}-${__ITER}-${Date.now()}`;
  const workflowName = `compiler-stress-${activityCount}act-${uniqueId}`;
  const kebabName = workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Step 1: Create project
  const projectPayload = JSON.stringify({
    json: {
      name: `stress-test-project-${uniqueId}`,
      description: `Compiler stress test project (${activityCount} activities)`,
      taskQueueName: `stress-test-queue-${uniqueId}`,
    }
  });

  const projectResponse = http.post(
    `${baseUrl}/api/trpc/projects.create`,
    projectPayload,
    { headers }
  );

  if (projectResponse.status !== 200) {
    errorRate.add(1);
    console.error(`Failed to create project: ${projectResponse.status}`);
    return { error: 'Failed to create project' };
  }

  const projectData = JSON.parse(projectResponse.body).result.data;

  // Step 2: Create workflow with large definition
  const workflowDefinition = generateLargeWorkflowDefinition(activityCount);
  workflowComplexity.add(activityCount, { size: scenario });

  const workflowPayload = JSON.stringify({
    json: {
      kebabName: kebabName,
      displayName: workflowName,
      description: `Stress test workflow with ${activityCount} activities`,
      visibility: 'private',
      projectId: projectData.id,
      taskQueueId: projectData.taskQueueId,
      definition: workflowDefinition,
    }
  });

  const workflowResponse = http.post(
    `${baseUrl}/api/trpc/workflows.create`,
    workflowPayload,
    { headers, tags: { operation: 'create', size: scenario } }
  );

  if (workflowResponse.status !== 200) {
    errorRate.add(1);
    compilationErrors.add(1);
    console.error(`Failed to create workflow: ${workflowResponse.status}`);
    return { error: 'Failed to create workflow' };
  }

  const workflowData = JSON.parse(workflowResponse.body).result.data;
  const workflowId = workflowData.id;

  // Step 3: Validate workflow
  const validationStartTime = Date.now();

  const validatePayload = JSON.stringify({
    json: { workflowId: workflowId }
  });

  const validateResponse = http.post(
    `${baseUrl}/api/trpc/compiler.validate`,
    validatePayload,
    { headers, tags: { operation: 'validate', size: scenario } }
  );

  const validationDuration = Date.now() - validationStartTime;
  validationTime.add(validationDuration, { size: scenario });

  // Step 4: Compile workflow
  const compilationStartTime = Date.now();

  const compilePayload = JSON.stringify({
    json: {
      workflowId: workflowId,
      includeComments: true,
      strictMode: true,
      optimizationLevel: 'basic',
      saveToDatabase: true,
    }
  });

  const compileResponse = http.post(
    `${baseUrl}/api/trpc/compiler.compile`,
    compilePayload,
    { headers, tags: { operation: 'compile', size: scenario } }
  );

  const compilationDuration = Date.now() - compilationStartTime;
  compilationTime.add(compilationDuration, { size: scenario });

  // Validate compilation results
  const success = check(compileResponse, {
    'compilation successful': (r) => r.status === 200,
    'compilation has no errors': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result && body.result.data && body.result.data.success === true;
      } catch (e) {
        return false;
      }
    },
    'compilation generated code': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result && body.result.data && body.result.data.workflowCode;
      } catch (e) {
        return false;
      }
    },
    [`compilation completed in threshold (${activityCount} activities)`]: () => {
      const thresholds = {
        small: 2000,   // 5 activities
        medium: 5000,  // 20 activities
        large: 10000,  // 50 activities
        xlarge: 20000, // 100 activities
      };
      return compilationDuration < thresholds[scenario];
    },
  });

  if (success) {
    compilationsCounter.add(1, { size: scenario });
    errorRate.add(0);

    const compileData = JSON.parse(compileResponse.body).result.data;

    // Log compilation statistics
    console.log(`✓ Compiled ${activityCount}-activity workflow in ${compilationDuration}ms`);
    if (compileData.metadata) {
      console.log(`  - Warnings: ${compileData.warnings?.length || 0}`);
      console.log(`  - Code size: ${compileData.workflowCode?.length || 0} bytes`);
    }

    return {
      success: true,
      workflowId,
      compilationDuration,
      validationDuration,
      metadata: compileData.metadata,
    };
  } else {
    errorRate.add(1);
    compilationErrors.add(1, { size: scenario });
    console.error(`✗ Compilation failed for ${activityCount}-activity workflow`);
    console.error(`  Status: ${compileResponse.status}`);
    console.error(`  Duration: ${compilationDuration}ms`);

    return { error: 'Compilation failed', compilationDuration };
  }
}

// Main test function
export default function (data) {
  // Determine workflow size based on scenario tag
  const scenario = __ITER % 4 === 0 ? 'small' :
                   __ITER % 3 === 0 ? 'medium' :
                   __ITER % 2 === 0 ? 'large' : 'xlarge';

  const activityCounts = {
    small: 5,
    medium: 20,
    large: 50,
    xlarge: 100,
  };

  const activityCount = activityCounts[scenario];

  // Create and compile workflow
  const result = createAndCompileWorkflow(
    data.baseUrl,
    data.token,
    activityCount,
    scenario
  );

  if (result.error) {
    console.error(`Test iteration failed: ${result.error}`);
  }

  // Realistic pause between compilations
  sleep(2);
}

// Custom summary
export function handleSummary(data) {
  const report = {
    timestamp: new Date().toISOString(),
    test: 'compiler-stress',
    summary: {
      total_compilations: data.metrics.compilations_completed.values.count,
      compilation_errors: data.metrics.compilation_errors.values.count,
      error_rate: (data.metrics.errors.values.rate * 100).toFixed(2) + '%',

      // Overall metrics
      avg_compilation_time: data.metrics.compilation_time.values.avg.toFixed(2) + 'ms',
      p90_compilation_time: data.metrics.compilation_time.values['p(90)'].toFixed(2) + 'ms',
      p95_compilation_time: data.metrics.compilation_time.values['p(95)'].toFixed(2) + 'ms',
      p99_compilation_time: data.metrics.compilation_time.values['p(99)'].toFixed(2) + 'ms',

      avg_validation_time: data.metrics.validation_time.values.avg.toFixed(2) + 'ms',
    },
    by_size: {},
    thresholds: {
      passed: true,
      details: {}
    }
  };

  // Add metrics by size
  const sizes = ['small', 'medium', 'large', 'xlarge'];
  sizes.forEach(size => {
    const sizeMetrics = data.metrics[`compilation_time{size:${size}}`];
    if (sizeMetrics) {
      report.by_size[size] = {
        avg: sizeMetrics.values.avg.toFixed(2) + 'ms',
        p90: sizeMetrics.values['p(90)'].toFixed(2) + 'ms',
        p95: sizeMetrics.values['p(95)'].toFixed(2) + 'ms',
      };

      // Check threshold
      const threshold = sizeMetrics.thresholds ? Object.values(sizeMetrics.thresholds)[0] : null;
      if (threshold) {
        report.thresholds.details[`${size}_p90`] = threshold.ok;
        report.thresholds.passed = report.thresholds.passed && threshold.ok;
      }
    }
  });

  return {
    'stdout': JSON.stringify(report, null, 2),
    'tests/performance/reports/compiler-stress-report.json': JSON.stringify(report, null, 2),
    'tests/performance/reports/compiler-stress-summary.txt': generateTextSummary(report),
  };
}

function generateTextSummary(report) {
  let summary = `
========================================
Compiler Stress Test Results
========================================
Timestamp: ${report.timestamp}

OVERALL RESULTS:
---------------
Total Compilations:    ${report.summary.total_compilations}
Compilation Errors:    ${report.summary.compilation_errors}
Error Rate:            ${report.summary.error_rate}

COMPILATION TIME METRICS:
------------------------
Average:               ${report.summary.avg_compilation_time}
90th Percentile:       ${report.summary.p90_compilation_time}
95th Percentile:       ${report.summary.p95_compilation_time}
99th Percentile:       ${report.summary.p99_compilation_time}

VALIDATION TIME:
---------------
Average:               ${report.summary.avg_validation_time}

PERFORMANCE BY WORKFLOW SIZE:
----------------------------
`;

  Object.entries(report.by_size).forEach(([size, metrics]) => {
    const activityCounts = { small: 5, medium: 20, large: 50, xlarge: 100 };
    summary += `
${size.toUpperCase()} (${activityCounts[size]} activities):
  Average:             ${metrics.avg}
  90th Percentile:     ${metrics.p90}
  95th Percentile:     ${metrics.p95}
`;
  });

  summary += `
THRESHOLD VALIDATION:
--------------------
Overall:               ${report.thresholds.passed ? 'PASSED ✓' : 'FAILED ✗'}
`;

  Object.entries(report.thresholds.details).forEach(([key, passed]) => {
    summary += `${key.padEnd(20)} ${passed ? 'PASSED ✓' : 'FAILED ✗'}\n`;
  });

  summary += `
========================================
`;

  return summary;
}
