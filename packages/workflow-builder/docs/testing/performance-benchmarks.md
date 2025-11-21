# Performance Benchmarks

**Last Updated:** 2025-11-19
**Status:** Initial Baseline

This document provides comprehensive performance benchmarks and testing guidelines for the Workflow Builder system.

## Table of Contents

- [Overview](#overview)
- [Performance Requirements](#performance-requirements)
- [Test Suite](#test-suite)
- [Baseline Metrics](#baseline-metrics)
- [Running Performance Tests](#running-performance-tests)
- [Performance Analysis](#performance-analysis)
- [Optimization Guidelines](#optimization-guidelines)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

---

## Overview

The performance test suite validates that the Workflow Builder system meets Milestone 1 requirements for handling expected production load. Tests are built using k6, an open-source load testing tool.

### Key Performance Goals

1. **Workflow Creation**: Support 10 concurrent workflow creations
2. **Workflow Deployment**: Support 10 concurrent deployments
3. **Workflow Execution**: Support 20 concurrent executions
4. **Compiler Performance**: Compile workflows with 50+ activities
5. **Response Time**: 90th percentile < 5s for all operations
6. **Reliability**: Error rate < 1% under normal load
7. **Memory Stability**: No memory leaks during 30-minute test runs

---

## Performance Requirements

### Acceptance Criteria (Milestone 1)

| Metric | Requirement | Test Coverage |
|--------|-------------|---------------|
| Concurrent Workflow Creations | 10 simultaneous | ✓ workflow-creation.k6.js |
| Concurrent Deployments | 10 simultaneous | ✓ workflow-execution.k6.js |
| Concurrent Executions | 20 simultaneous | ✓ workflow-execution.k6.js |
| Large Workflow Compilation | 50 activities | ✓ compiler-stress.k6.js |
| Response Time (p90) | < 5 seconds | ✓ All tests |
| Response Time (p95) | < 7 seconds | ✓ All tests |
| Error Rate | < 1% | ✓ All tests |
| Memory Leak Test Duration | 30 minutes | ✓ workflow-execution.k6.js |
| Database Query Efficiency | No N+1 queries | ✓ Manual verification |

### Performance Thresholds

#### HTTP Request Duration
- **p90 (90th percentile)**: < 5,000ms
- **p95 (95th percentile)**: < 7,000ms
- **p99 (99th percentile)**: < 10,000ms

#### Operation-Specific Thresholds
- **Workflow Creation** (p90): < 5,000ms
- **Workflow Deployment** (p90): < 5,000ms
- **Workflow Execution** (p90): < 5,000ms
- **Compiler (5 activities)** (p90): < 2,000ms
- **Compiler (20 activities)** (p90): < 5,000ms
- **Compiler (50 activities)** (p90): < 10,000ms
- **Compiler (100 activities)** (p90): < 20,000ms

#### Error Rates
- **Normal Load**: < 1% error rate
- **Stress Test**: < 2% error rate
- **Compiler Stress**: < 5% error rate

---

## Test Suite

### 1. Workflow Creation Test

**File:** `tests/performance/workflow-creation.k6.js`

**Purpose:** Validates concurrent workflow creation performance via tRPC API.

**Test Scenarios:**
- Warm up: 2 VUs for 10s
- Load test: 10 VUs for 30s (sustained)
- Cool down: Ramp to 0 VUs over 10s

**Metrics Tracked:**
- Workflow creation time
- HTTP request duration
- Error rate
- Workflows created count
- Validation errors

**Success Criteria:**
- 90% of workflow creations complete in < 5s
- Error rate < 1%
- All workflows can be retrieved after creation

**Usage:**
```bash
k6 run tests/performance/workflow-creation.k6.js
k6 run --vus 10 --duration 30s tests/performance/workflow-creation.k6.js
```

---

### 2. Workflow Execution Test

**File:** `tests/performance/workflow-execution.k6.js`

**Purpose:** Tests deployment and execution performance under concurrent load.

**Test Scenarios:**

1. **Deployment Scenario** (0-2 minutes)
   - 10 VUs, 1 iteration each
   - Deploy 10 workflows simultaneously

2. **Execution Scenario** (2-5 minutes)
   - 20 VUs, 1 iteration each
   - Execute 20 workflows simultaneously

3. **Sustained Load Scenario** (5-35 minutes)
   - 5 VUs constant
   - 30-minute duration for memory leak detection

**Metrics Tracked:**
- Deployment time
- Execution time
- HTTP request duration
- Workflows deployed count
- Workflows executed count
- Memory usage (if monitoring available)

**Success Criteria:**
- 90% of deployments complete in < 5s
- 90% of executions initiate in < 5s
- Error rate < 2%
- No memory growth during sustained load

**Usage:**
```bash
k6 run tests/performance/workflow-execution.k6.js
k6 run --vus 20 --duration 5m tests/performance/workflow-execution.k6.js
```

---

### 3. Compiler Stress Test

**File:** `tests/performance/compiler-stress.k6.js`

**Purpose:** Validates compiler performance with increasingly complex workflows.

**Test Scenarios:**

1. **Small Workflows** (0-1 minute)
   - 5 VUs constant
   - 5 activities per workflow
   - Baseline performance

2. **Medium Workflows** (1-3 minutes)
   - 5 VUs constant
   - 20 activities per workflow

3. **Large Workflows** (3-6 minutes)
   - 3 VUs constant
   - 50 activities per workflow (stress test)

4. **Extra Large Workflows** (6-8 minutes)
   - 2 VUs constant
   - 100 activities per workflow (extreme stress)

**Workflow Complexity:**
- Linear activity chains
- Conditional branches (every 10th activity)
- State variables (1 per 5 activities)
- Retry policies per activity
- Comprehensive metadata

**Metrics Tracked:**
- Compilation time (by workflow size)
- Validation time
- Compilations completed count
- Compilation errors count
- Workflow activity count

**Success Criteria:**
- Small workflows (5 activities): p90 < 2s
- Medium workflows (20 activities): p90 < 5s
- Large workflows (50 activities): p90 < 10s
- Extra large workflows (100 activities): p90 < 20s
- Error rate < 5%
- Generated code is syntactically valid

**Usage:**
```bash
k6 run tests/performance/compiler-stress.k6.js
```

---

## Baseline Metrics

### Expected Performance (Initial Targets)

Based on Milestone 1 requirements and system architecture:

#### Workflow Creation
| Metric | Target | Notes |
|--------|--------|-------|
| Average | 1,500ms | Includes DB writes, validation |
| p90 | 3,000ms | 90th percentile |
| p95 | 4,500ms | 95th percentile |
| p99 | 6,000ms | 99th percentile |

#### Workflow Deployment
| Metric | Target | Notes |
|--------|--------|-------|
| Average | 2,000ms | Includes compilation, registration |
| p90 | 4,000ms | 90th percentile |
| p95 | 6,000ms | 95th percentile |
| p99 | 8,000ms | 99th percentile |

#### Workflow Execution
| Metric | Target | Notes |
|--------|--------|-------|
| Average | 1,800ms | Execution initiation only |
| p90 | 3,500ms | 90th percentile |
| p95 | 5,000ms | 95th percentile |
| p99 | 7,000ms | 99th percentile |

#### Compiler Performance (by Workflow Size)
| Workflow Size | p90 Target | p95 Target | Notes |
|---------------|-----------|-----------|-------|
| Small (5 activities) | 1,500ms | 2,000ms | Baseline |
| Medium (20 activities) | 3,500ms | 5,000ms | Normal complexity |
| Large (50 activities) | 8,000ms | 10,000ms | Stress test target |
| XLarge (100 activities) | 15,000ms | 20,000ms | Extreme stress |

### Database Performance Expectations

- **Query Response Time**: < 100ms for simple queries
- **Complex Joins**: < 500ms
- **No N+1 Queries**: Verified through logging
- **Connection Pool**: Efficient reuse

---

## Running Performance Tests

### Prerequisites

1. **Install k6**
   ```bash
   # macOS
   brew install k6

   # Linux
   sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6

   # Windows
   choco install k6
   ```

2. **Set Environment Variables**

   Create or update `.env.test.local`:
   ```bash
   # Test authentication token
   SUPABASE_TEST_ACCESS_TOKEN=your_test_token_here
   SUPABASE_TEST_REFRESH_TOKEN=your_refresh_token_here

   # Optional: Override base URL
   BASE_URL=http://localhost:3010
   ```

3. **Start the Application**
   ```bash
   cd packages/workflow-builder
   npm run dev
   ```

### Running Individual Tests

#### Workflow Creation Test
```bash
# Basic run
k6 run tests/performance/workflow-creation.k6.js

# With custom parameters
k6 run --vus 10 --duration 30s \
  -e BASE_URL=http://localhost:3010 \
  -e ACCESS_TOKEN=$SUPABASE_TEST_ACCESS_TOKEN \
  tests/performance/workflow-creation.k6.js
```

#### Workflow Execution Test
```bash
k6 run tests/performance/workflow-execution.k6.js
```

#### Compiler Stress Test
```bash
k6 run tests/performance/compiler-stress.k6.js
```

### Running All Tests

```bash
# Run complete test suite
cd packages/workflow-builder
./tests/performance/run-all-tests.sh

# With specific environment
./tests/performance/run-all-tests.sh staging
```

### Test Output

All tests generate:

1. **Console Output**: Real-time metrics and results
2. **JSON Reports**: `tests/performance/reports/*-report.json`
3. **Text Summaries**: `tests/performance/reports/*-summary.txt`
4. **Combined Report**: `tests/performance/reports/combined-report-{timestamp}.md`

---

## Performance Analysis

### Reading Test Results

#### Console Output
```
✓ workflow created successfully
✓ workflow has valid ID
✓ creation time under 5s

checks.........................: 100.00% ✓ 30    ✗ 0
data_received..................: 45 kB   1.5 kB/s
data_sent......................: 38 kB   1.3 kB/s
http_req_duration..............: avg=2.45s min=1.2s med=2.3s max=4.5s p(90)=3.8s p(95)=4.2s
http_req_failed................: 0.00%   ✓ 0     ✗ 30
iterations.....................: 10      0.33/s
workflow_creation_time.........: avg=2.35s min=1.1s med=2.2s max=4.3s p(90)=3.6s p(95)=4.0s
workflows_created..............: 10      0.33/s
```

#### Key Metrics to Monitor

1. **http_req_duration**: Overall HTTP request performance
   - Focus on p(90) and p(95) percentiles
   - Should meet < 5s threshold

2. **Custom Metrics**: Operation-specific timings
   - `workflow_creation_time`
   - `workflow_deployment_time`
   - `workflow_execution_time`
   - `compilation_time`

3. **Error Rates**:
   - `http_req_failed`: HTTP error rate
   - `errors`: Custom error tracking
   - Should be < 1% for normal load

4. **Throughput**:
   - `http_reqs`: Total requests
   - `workflows_created`: Successful operations
   - `iterations`: Test iterations completed

### Analyzing JSON Reports

```bash
# View workflow creation report
cat tests/performance/reports/workflow-creation-report.json | jq

# Extract key metrics
cat tests/performance/reports/workflow-creation-report.json | jq '.summary'

# Check threshold status
cat tests/performance/reports/workflow-creation-report.json | jq '.thresholds'
```

### Performance Trends

Track metrics over time:

```bash
# Compare reports from different runs
diff -u \
  tests/performance/reports/workflow-creation-report-20251119.json \
  tests/performance/reports/workflow-creation-report-20251120.json
```

---

## Optimization Guidelines

### Identifying Bottlenecks

1. **High Response Times**:
   - Check database query performance
   - Review API endpoint complexity
   - Analyze network latency

2. **High Error Rates**:
   - Review application logs
   - Check database connection limits
   - Verify API rate limiting

3. **Memory Leaks**:
   - Monitor sustained load scenario
   - Check for resource cleanup
   - Review connection pooling

### Common Optimization Strategies

#### Database Optimization

1. **Query Optimization**
   ```sql
   -- Add indexes for frequently queried fields
   CREATE INDEX idx_workflows_created_by ON workflows(created_by);
   CREATE INDEX idx_workflows_status ON workflows(status_id);
   CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
   ```

2. **Connection Pooling**
   ```typescript
   // Ensure efficient connection reuse
   const supabase = createClient(url, key, {
     db: {
       pool: {
         min: 2,
         max: 10
       }
     }
   });
   ```

3. **Batch Operations**
   ```typescript
   // Avoid N+1 queries - use joins
   const { data } = await supabase
     .from('workflows')
     .select(`
       *,
       status:workflow_statuses(id, name),
       created_by_user:users(id, display_name)
     `)
     .eq('created_by', userId);
   ```

#### API Optimization

1. **Response Caching**
   ```typescript
   // Cache static or infrequently changing data
   import { LRUCache } from 'lru-cache';

   const statusCache = new LRUCache({
     max: 100,
     ttl: 1000 * 60 * 5 // 5 minutes
   });
   ```

2. **Request Validation**
   ```typescript
   // Use Zod for efficient input validation
   const inputSchema = z.object({
     kebabName: z.string().min(1).max(255),
     // ... other fields
   });
   ```

3. **Parallel Processing**
   ```typescript
   // Execute independent operations in parallel
   const [workflows, projects, executions] = await Promise.all([
     getWorkflows(),
     getProjects(),
     getExecutions(),
   ]);
   ```

#### Compiler Optimization

1. **Code Generation Caching**
   ```typescript
   // Cache compiled patterns
   const patternCache = new Map<string, CompiledPattern>();
   ```

2. **Streaming Compilation**
   ```typescript
   // For large workflows, use streaming
   async function* compileWorkflowStreaming(workflow) {
     yield generateImports();
     yield generateWorkflowFunction();
     yield generateActivities();
   }
   ```

3. **Validation Optimization**
   ```typescript
   // Validate in parallel
   const validationResults = await Promise.all([
     validateNodes(workflow.nodes),
     validateEdges(workflow.edges),
     validateVariables(workflow.variables),
   ]);
   ```

### Performance Budgets

Set and enforce performance budgets:

```typescript
// In CI/CD pipeline
const performanceBudget = {
  workflowCreation: { p90: 5000 },
  workflowDeployment: { p90: 5000 },
  workflowExecution: { p90: 5000 },
  compilerSmall: { p90: 2000 },
  compilerMedium: { p90: 5000 },
  compilerLarge: { p90: 10000 },
};

// Fail CI if budgets exceeded
if (metrics.p90 > performanceBudget[operation].p90) {
  throw new Error(`Performance budget exceeded for ${operation}`);
}
```

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/performance-tests.yml`:

```yaml
name: Performance Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Run daily at 2 AM

jobs:
  performance:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Install dependencies
        run: npm ci

      - name: Setup test environment
        run: |
          cp .env.test.example .env.test.local
          npm run db:migrate

      - name: Start application
        run: |
          npm run dev &
          sleep 10

      - name: Run performance tests
        env:
          ACCESS_TOKEN: ${{ secrets.TEST_ACCESS_TOKEN }}
          BASE_URL: http://localhost:3010
        run: |
          cd packages/workflow-builder
          ./tests/performance/run-all-tests.sh

      - name: Upload performance reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-reports
          path: packages/workflow-builder/tests/performance/reports/

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(
              fs.readFileSync('packages/workflow-builder/tests/performance/reports/combined-report.json')
            );

            const comment = `
            ## Performance Test Results

            **Status:** ${report.thresholds.passed ? '✅ PASSED' : '❌ FAILED'}

            ### Summary
            - Workflows Created: ${report.summary.workflows_created}
            - Error Rate: ${report.summary.error_rate}
            - p90 Response Time: ${report.summary.p90_http_duration}
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### Performance Monitoring in CI

1. **Set Performance Thresholds**: Configure thresholds in test files
2. **Fail on Regression**: Exit with error code if thresholds not met
3. **Track Trends**: Store historical performance data
4. **Alert on Degradation**: Notify team of performance regressions

---

## Troubleshooting

### Common Issues

#### 1. High Error Rates

**Symptoms:**
- Error rate > 1%
- Many failed HTTP requests

**Possible Causes:**
- Database connection limits
- Rate limiting
- Authentication issues
- Server overload

**Solutions:**
```bash
# Check application logs
tail -f logs/application.log

# Verify database connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check Supabase connection pool
# Review connection pool settings in application

# Reduce concurrent load
k6 run --vus 5 tests/performance/workflow-creation.k6.js
```

#### 2. Slow Response Times

**Symptoms:**
- p90 > 5s
- High average response time

**Possible Causes:**
- Slow database queries
- Network latency
- Inefficient API logic
- Memory pressure

**Solutions:**
```bash
# Enable query logging
export LOG_LEVEL=debug

# Profile database queries
# Check Supabase dashboard for slow queries

# Reduce workflow complexity
# Optimize database indexes
# Review N+1 query patterns
```

#### 3. Memory Leaks

**Symptoms:**
- Increasing memory usage over time
- Application crashes during sustained load

**Possible Causes:**
- Unclosed database connections
- Event listener leaks
- Cached data not cleared

**Solutions:**
```typescript
// Ensure proper cleanup
async function cleanup() {
  await supabase.removeAllChannels();
  await cache.clear();
}

// Monitor memory
process.memoryUsage();

// Use weak references for caches
const cache = new WeakMap();
```

#### 4. Test Timeouts

**Symptoms:**
- Tests timeout before completion
- k6 errors

**Possible Causes:**
- Application not responding
- Database not ready
- Network issues

**Solutions:**
```bash
# Increase timeout
k6 run --http-debug tests/performance/workflow-creation.k6.js

# Verify application is running
curl http://localhost:3010/api/health

# Check database connectivity
psql -h localhost -U postgres -c "SELECT 1;"
```

### Performance Debugging Tools

1. **K6 HTTP Debug Mode**
   ```bash
   k6 run --http-debug=full tests/performance/workflow-creation.k6.js
   ```

2. **Application Profiling**
   ```bash
   # Node.js profiling
   node --prof server.js
   node --prof-process isolate-*.log > processed.txt
   ```

3. **Database Query Analysis**
   ```sql
   -- Enable query logging in PostgreSQL
   ALTER SYSTEM SET log_min_duration_statement = 100;
   SELECT pg_reload_conf();

   -- View slow queries
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

4. **Network Analysis**
   ```bash
   # Monitor network traffic
   tcpdump -i any -s 0 -w performance.pcap port 3010

   # Analyze with Wireshark
   wireshark performance.pcap
   ```

---

## Performance Metrics Dashboard

### Recommended Monitoring

Track these metrics in production:

1. **Request Metrics**
   - Request rate (req/s)
   - Response time (p50, p90, p95, p99)
   - Error rate (%)

2. **Resource Metrics**
   - CPU usage (%)
   - Memory usage (MB)
   - Database connections
   - Network I/O

3. **Business Metrics**
   - Workflows created/hour
   - Workflows executed/hour
   - Compilation success rate
   - User active sessions

### Alerting Thresholds

```yaml
alerts:
  - name: high-response-time
    condition: p95_response_time > 7000ms
    severity: warning

  - name: critical-response-time
    condition: p95_response_time > 10000ms
    severity: critical

  - name: high-error-rate
    condition: error_rate > 1%
    severity: warning

  - name: critical-error-rate
    condition: error_rate > 5%
    severity: critical

  - name: memory-leak
    condition: memory_growth_rate > 10MB/hour
    severity: warning
```

---

## Appendix

### Test Environment Specifications

**Recommended Test Environment:**
- **CPU**: 4 cores minimum
- **RAM**: 8 GB minimum
- **Database**: PostgreSQL 15+ with 100 concurrent connections
- **Network**: Low latency (<10ms local)

### Related Documentation

- [K6 Documentation](https://k6.io/docs/)
- [tRPC Performance Guide](https://trpc.io/docs/performance)
- [Supabase Performance](https://supabase.com/docs/guides/platform/performance)
- [Temporal Performance Tuning](https://docs.temporal.io/dev-guide/performance)

### Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-19 | Performance Benchmarker | Initial baseline documentation |

---

**For questions or issues, please contact the development team or open an issue in the project repository.**
