# Performance Tests

K6-based performance testing suite for the Workflow Builder system.

## Quick Start

```bash
# Install k6
brew install k6  # macOS
# OR
sudo apt-get install k6  # Linux

# Set up environment
cp .env.test.local.example .env.test.local
# Edit .env.test.local with your access token

# Start the application
npm run dev

# Run all performance tests
./tests/performance/run-all-tests.sh

# Or run individual tests
k6 run tests/performance/workflow-creation.k6.js
k6 run tests/performance/workflow-execution.k6.js
k6 run tests/performance/compiler-stress.k6.js
```

## Test Files

### 1. workflow-creation.k6.js
Tests concurrent workflow creation performance.

**Scenarios:**
- 10 concurrent workflow creations
- Response time < 5s (p90)
- Error rate < 1%

**Run:**
```bash
k6 run tests/performance/workflow-creation.k6.js
```

### 2. workflow-execution.k6.js
Tests workflow deployment and execution under load.

**Scenarios:**
- Deploy 10 workflows simultaneously
- Execute 20 workflows simultaneously
- 30-minute sustained load test for memory leak detection

**Run:**
```bash
k6 run tests/performance/workflow-execution.k6.js
```

### 3. compiler-stress.k6.js
Stress tests the compiler with increasingly complex workflows.

**Scenarios:**
- Small workflows (5 activities)
- Medium workflows (20 activities)
- Large workflows (50 activities)
- Extra large workflows (100 activities)

**Run:**
```bash
k6 run tests/performance/compiler-stress.k6.js
```

## Configuration

Environment variables (set in `.env.test.local`):

```bash
# Required
SUPABASE_TEST_ACCESS_TOKEN=your_access_token

# Optional
BASE_URL=http://localhost:3010
TEST_ENV=local
```

## Test Output

All tests generate:

1. **Console output** - Real-time metrics
2. **JSON reports** - `reports/*-report.json`
3. **Text summaries** - `reports/*-summary.txt`

View results:
```bash
# View latest report
cat reports/workflow-creation-report.json | jq

# View summary
cat reports/workflow-creation-summary.txt
```

## Performance Thresholds

| Metric | Threshold | Notes |
|--------|-----------|-------|
| Workflow Creation (p90) | < 5s | 10 concurrent |
| Workflow Deployment (p90) | < 5s | 10 concurrent |
| Workflow Execution (p90) | < 5s | 20 concurrent |
| Compiler Small (p90) | < 2s | 5 activities |
| Compiler Medium (p90) | < 5s | 20 activities |
| Compiler Large (p90) | < 10s | 50 activities |
| Error Rate | < 1% | Normal load |

## Cleanup

Remove test data after tests:

```bash
./tests/performance/cleanup.sh
```

## Troubleshooting

### High error rates

**Check:**
- Application is running (`npm run dev`)
- Access token is valid
- Database is accessible

**Debug:**
```bash
k6 run --http-debug tests/performance/workflow-creation.k6.js
```

### Slow response times

**Check:**
- Database query performance
- Network latency
- System resources (CPU, memory)

**Profile:**
```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev
```

### Test timeouts

**Check:**
- Application health: `curl http://localhost:3010/api/health`
- Database connectivity
- System resources

## Documentation

See comprehensive documentation:
- [Performance Benchmarks](../../docs/testing/performance-benchmarks.md)

## CI/CD Integration

GitHub Actions example:

```yaml
- name: Run performance tests
  run: |
    cd packages/workflow-builder
    ./tests/performance/run-all-tests.sh
  env:
    ACCESS_TOKEN: ${{ secrets.TEST_ACCESS_TOKEN }}
```

## Support

For questions or issues:
1. Check [performance-benchmarks.md](../../docs/testing/performance-benchmarks.md)
2. Review test output and logs
3. Contact the development team
