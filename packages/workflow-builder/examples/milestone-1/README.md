# Milestone 1 Example Workflows

This directory contains production-ready workflow examples demonstrating Milestone 1 capabilities.

## Examples

### 1. API Data Orchestration (`api-orchestration.json`)
**Complexity**: Simple (3 activities)
**Duration**: 10-30 seconds

Demonstrates basic API orchestration: fetch user data, enrich it, and update CRM.

**Key Features**:
- Sequential activity execution
- Exponential backoff retry policies
- External API integration
- Data transformation

### 2. ETL Data Pipeline (`data-pipeline.json`)
**Complexity**: Advanced (5 activities)
**Duration**: 5-15 minutes

Complete ETL pipeline with extraction, transformation, validation, and loading.

**Key Features**:
- Multi-source parallel extraction
- Complex data transformations
- Data quality validation with thresholds
- All three retry strategies (exponential-backoff, fail-after-x, keep-trying)
- Multi-channel notifications

### 3. Incident Notification Chain (`notification-chain.json`)
**Complexity**: Intermediate (4 activities)
**Duration**: 30 seconds to 10 minutes

Incident management workflow with timeout-based escalation.

**Key Features**:
- Signal-based triggering
- Timeout handling (5-minute acknowledgment window)
- Conditional branching based on response
- Automatic escalation to management
- Multi-channel notifications (PagerDuty, Slack, Email, Phone)

### 4. E-Commerce Order Fulfillment (`order-fulfillment.json`)
**Complexity**: Intermediate (4 activities)
**Duration**: 5-20 seconds

Complete order processing from payment to confirmation.

**Key Features**:
- API endpoint trigger
- Payment processing with Stripe
- Idempotency protection
- Inventory reservation with rollback
- Multi-carrier shipping integration
- Transactional email with attachments

## Quick Start

### Import All Examples

```bash
# From workflow-builder directory
yarn tsx scripts/seed-demo-workflows.ts
```

This will:
1. Create a "Demo Workflows" project
2. Import all 4 Milestone 1 examples
3. Make them available in the UI

### Inspect Example Files

Each JSON file contains:
- Complete workflow definition (nodes and edges)
- Sample input data
- Expected output data
- Demo notes explaining the pattern
- Full configuration for all activities

### View in UI

1. Start the app: `yarn dev`
2. Navigate to http://localhost:3010
3. Open "Demo Workflows" project
4. Browse and inspect the examples

## Documentation

For comprehensive documentation including:
- Detailed workflow descriptions
- Step-by-step breakdowns
- Use cases and best practices
- Customization guides
- Troubleshooting

See: [`docs/examples/milestone-1-demos.md`](../../docs/examples/milestone-1-demos.md)

## Testing

E2E tests verify all examples:

```bash
# Run tests
npx playwright test tests/e2e/milestone-1-examples.spec.ts
```

Tests verify:
- JSON structure and validity
- Node and edge configuration
- Retry policy correctness
- Feature coverage and variety
- Documentation completeness

## Feature Coverage

| Feature | API Orch | ETL | Incident | Order |
|---------|----------|-----|----------|-------|
| Manual Trigger | ✅ | - | - | - |
| Scheduled Trigger | - | ✅ | - | - |
| Signal Trigger | - | - | ✅ | - |
| API Trigger | - | - | - | ✅ |
| Exponential Backoff | ✅ | ✅ | ✅ | ✅ |
| Fail After X | ✅ | ✅ | ✅ | ✅ |
| Keep Trying | - | ✅ | - | - |
| Timeout Handling | - | - | ✅ | - |
| Conditional Logic | - | - | ✅ | - |
| Parallel Execution | - | ✅ | - | - |

## Customization

To customize an example:

1. Copy the JSON file
2. Modify activity configurations
3. Update retry policies as needed
4. Change node positions for layout
5. Import via UI or seed script

Example:
```json
{
  "data": {
    "config": {
      "apiEndpoint": "YOUR_ENDPOINT",
      "timeout": "60s"
    },
    "retryPolicy": {
      "strategy": "exponential-backoff",
      "maxAttempts": 5
    }
  }
}
```

## Next Steps

After exploring these examples:

1. **Understand Patterns**: Study how different patterns solve different problems
2. **Create Custom Workflows**: Use examples as templates
3. **Implement Activities**: Build domain-specific components
4. **Deploy to Production**: Follow deployment best practices
5. **Monitor Performance**: Set up observability

## Support

- Full documentation: `docs/examples/milestone-1-demos.md`
- API reference: `docs/api/workflows/`
- Activity development: `docs/activities/development/`

---

**Generated for Milestone 1 Demo (Week 6)**
