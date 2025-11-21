# Milestone 1 Demo Workflows

This document describes the example workflows created to showcase Milestone 1 capabilities of the Workflow Builder platform. These workflows demonstrate real-world use cases and best practices for building production-ready linear workflows.

## Overview

The Milestone 1 demo suite includes **4 comprehensive workflow examples** that showcase different aspects of the workflow builder:

1. **API Data Orchestration** - Simple 3-activity workflow demonstrating API integration patterns
2. **ETL Data Pipeline** - Complex 5-activity workflow with sophisticated retry policies and data processing
3. **Incident Notification Chain** - 4-activity workflow showcasing timeout handling and escalation patterns
4. **E-Commerce Order Fulfillment** - 4-activity transactional workflow demonstrating payment and inventory management

## Quick Start

### Import Demo Workflows

To import all Milestone 1 examples into your workflow builder:

```bash
# From the workflow-builder package directory
cd packages/workflow-builder

# Run the seed script
yarn tsx scripts/seed-demo-workflows.ts
```

This will create:
- A "Demo Workflows" project
- Basic demo workflows (Hello World, Agent Conversation)
- All 4 Milestone 1 example workflows

### View in Workflow Builder

After seeding:
1. Start the development server: `yarn dev`
2. Navigate to http://localhost:3010
3. Open the "Demo Workflows" project
4. Browse and inspect the example workflows

---

## Example 1: API Data Orchestration

**File**: `examples/milestone-1/api-orchestration.json`
**Complexity**: Simple (3 activities)
**Duration**: 10-30 seconds

### Purpose

Demonstrates the most common workflow pattern: orchestrating multiple API calls in sequence to accomplish a business goal. This example shows how to:
- Fetch data from external APIs
- Transform and enrich data
- Update downstream systems
- Handle API failures with retry policies

### Workflow Steps

```
Trigger → Fetch User Data → Enrich Data → Update CRM → Complete
```

#### 1. Manual Trigger
- Starts the workflow on demand
- Accepts user ID and trigger metadata

#### 2. Fetch User Data (Activity)
- **Component**: `FetchUserDataActivity`
- **Timeout**: 30 seconds
- **Retry Policy**: Exponential backoff (3 attempts)
- **Action**: Retrieves user profile from external user management API
- **Configuration**:
  - API endpoint with userId parameter
  - Bearer token authentication
  - JSON response parsing

#### 3. Enrich User Data (Activity)
- **Component**: `EnrichUserDataActivity`
- **Retry Policy**: Fail after 2 attempts
- **Action**: Adds analytics data (login history, purchases, LTV)
- **Configuration**:
  - Enrichment from analytics service
  - Result caching (1 hour TTL)
  - Specific fields to fetch

#### 4. Update CRM (Activity)
- **Component**: `UpdateCRMActivity`
- **Retry Policy**: Exponential backoff (5 attempts)
- **Action**: Upserts enriched user data into Salesforce
- **Configuration**:
  - Salesforce integration
  - Upsert operation (match on email)
  - Notification on update

### Key Features Demonstrated

- **Sequential Execution**: Each activity waits for the previous to complete
- **Retry Strategies**: Different retry policies for different failure scenarios
  - Exponential backoff for rate-limited APIs
  - Fail-fast for data quality issues
- **Configuration Management**: Environment variables and workflow variables
- **Data Flow**: Output from one activity feeds into the next

### Sample Input

```json
{
  "userId": "user-12345",
  "source": "web-app",
  "triggerReason": "profile_update"
}
```

### Expected Output

```json
{
  "status": "success",
  "userData": {
    "userId": "user-12345",
    "email": "john.doe@example.com",
    "name": "John Doe",
    "company": "Acme Corp"
  },
  "enrichedData": {
    "lastLoginDate": "2025-11-19T12:00:00Z",
    "totalPurchases": 42,
    "lifetimeValue": 12500.50,
    "preferredLanguage": "en-US"
  },
  "crmUpdateResult": {
    "recordId": "crm-67890",
    "operation": "updated",
    "timestamp": "2025-11-19T12:00:05Z"
  }
}
```

### Use Cases

- User profile synchronization
- Customer 360 data aggregation
- Multi-system data orchestration
- API integration workflows

---

## Example 2: ETL Data Pipeline

**File**: `examples/milestone-1/data-pipeline.json`
**Complexity**: Advanced (5 activities)
**Duration**: 5-15 minutes

### Purpose

Demonstrates a production-grade ETL (Extract, Transform, Load) pipeline with comprehensive error handling and data quality validation. This example shows how to:
- Extract data from multiple heterogeneous sources in parallel
- Transform and normalize data with complex business rules
- Validate data quality with configurable thresholds
- Load data into a data warehouse with partitioning
- Send notifications with execution statistics

### Workflow Steps

```
Scheduled Trigger → Extract → Transform → Validate → Load → Notify → Complete
```

#### 1. Scheduled Trigger
- **Schedule**: Daily at 2 AM UTC (cron: `0 2 * * *`)
- **Type**: Time-based trigger
- **Inputs**: Execution date, last run time

#### 2. Extract from Sources (Activity)
- **Component**: `ExtractDataActivity`
- **Timeout**: 10 minutes
- **Retry Policy**: Exponential backoff (5 attempts, up to 60s intervals)
- **Action**: Parallel extraction from three sources:
  1. **PostgreSQL Database**: Order updates since last run
  2. **REST API**: Customer data with pagination
  3. **S3 CSV Files**: Daily export files
- **Features**: Parallel extraction, connection pooling

#### 3. Transform Data (Activity)
- **Component**: `TransformDataActivity`
- **Retry Policy**: Keep trying (with increasing backoff)
- **Action**: Four-stage transformation pipeline:
  1. **Normalize**: Email to lowercase, phone to E.164
  2. **Deduplicate**: Remove duplicates by customer/order ID
  3. **Enrich**: Join with customer metadata
  4. **Calculate**: Compute derived fields (total value, category)
- **Output**: Parquet format with Snappy compression

#### 4. Validate Data Quality (Activity)
- **Component**: `ValidateDataActivity`
- **Retry Policy**: Fail after 2 attempts
- **Action**: Validate against configurable rules:
  - Email format validation (ERROR)
  - Positive total value (ERROR)
  - Required customer ID (ERROR)
  - Phone format validation (WARNING)
- **Thresholds**:
  - Error threshold: 5% (fail if exceeded)
  - Warning threshold: 10%
- **Output**: Data quality report to S3

#### 5. Load to Warehouse (Activity)
- **Component**: `LoadDataActivity`
- **Retry Policy**: Exponential backoff (4 attempts, up to 120s)
- **Action**: Load validated data to Snowflake
- **Configuration**:
  - Replace strategy for staging table
  - Partition by date and region
  - Cluster by customer ID
  - Post-load SQL procedures
  - Grant permissions to analyst role

#### 6. Send Notifications (Activity)
- **Component**: `SendNotificationActivity`
- **Retry Policy**: Fail after 3 attempts
- **Action**: Multi-channel notifications:
  - **Slack**: Pipeline statistics to #data-engineering
  - **Email**: Detailed report to data team
- **Content**: Record counts, validation stats, duration, status

### Key Features Demonstrated

- **Scheduled Execution**: Time-based trigger with cron expression
- **Parallel Extraction**: Multiple data sources extracted concurrently
- **Complex Transformations**: Multi-stage data processing pipeline
- **Data Quality**: Validation with error/warning thresholds
- **Retry Strategies**: Three different strategies for different scenarios:
  - **Keep Trying**: For transient network issues (transform)
  - **Exponential Backoff**: For rate-limited APIs (extract, load)
  - **Fail After X**: For validation failures (validate, notify)
- **Error Reporting**: Detailed quality reports and notifications
- **Production Patterns**: Partitioning, clustering, post-load actions

### Sample Input

```json
{
  "executionDate": "2025-11-19",
  "lastRunTime": "2025-11-18T02:00:00Z",
  "forceFull": false
}
```

### Expected Output

```json
{
  "status": "success",
  "recordsExtracted": 15234,
  "recordsTransformed": 15234,
  "recordsValid": 15187,
  "recordsLoaded": 15187,
  "validationErrors": 47,
  "executionDuration": "8m 23s",
  "dataQualityScore": 99.69,
  "notifications": {
    "slack": "sent",
    "email": "sent"
  }
}
```

### Use Cases

- Daily data warehouse updates
- Customer data platform (CDP) pipelines
- Analytics data preparation
- Data lake ingestion workflows
- Compliance and audit data processing

---

## Example 3: Incident Notification Chain

**File**: `examples/milestone-1/notification-chain.json`
**Complexity**: Intermediate (4 activities)
**Duration**: 30 seconds to 10 minutes

### Purpose

Demonstrates time-sensitive incident management with escalation. This example shows how to:
- Respond to real-time incidents via signal triggers
- Implement multi-channel notifications with escalating urgency
- Handle timeouts and automatic escalation
- Use conditional logic for branching workflows
- Create audit trails for incident response

### Workflow Steps

```
Incident Signal → Notify On-Call → Wait for Ack → [Acknowledged?] → Create Post-Mortem
                                                  ↓ (timeout)
                                            Escalate to Manager
```

#### 1. Incident Detected (Trigger)
- **Type**: Signal trigger
- **Signal**: `incident_detected`
- **Source**: Monitoring systems (e.g., Datadog, PagerDuty)
- **Inputs**: Incident ID, severity, affected services, detection time

#### 2. Notify On-Call Engineer (Activity)
- **Component**: `SendPagerDutyNotification`
- **Retry Policy**: Fail after 3 attempts
- **Action**: Multi-channel alert via PagerDuty
- **Channels** (escalating):
  1. Push notification (immediate)
  2. SMS (after 30 seconds)
  3. Phone call (after 2 minutes)
- **Priority**: High urgency

#### 3. Wait for Acknowledgment (Activity)
- **Component**: `WaitForSignalActivity`
- **Timeout**: 5 minutes
- **Action**: Waits for `incident_acknowledged` signal
- **Expected Fields**: acknowledgedBy, timestamp, ETA
- **Timeout Behavior**: Proceeds to escalation if not acknowledged

#### 4a. Acknowledged Path → Create Post-Mortem
#### 4b. Timeout Path → Escalate to Manager (Activity)
- **Component**: `EscalateIncidentActivity`
- **Retry Policy**: Exponential backoff (4 attempts)
- **Action**: Multi-channel escalation:
  - **Slack**: Urgent message to #incident-escalations with @mentions
  - **Email**: To engineering manager and VP with CC to on-call
  - **Phone**: Automated call to manager with retry
- **Additional Actions**:
  - Update incident priority to P0
  - Assign to backup engineer
  - Log escalation in audit trail

#### 5. Create Post-Mortem Ticket (Activity)
- **Component**: `CreateJiraTicketActivity`
- **Retry Policy**: Fail after 3 attempts
- **Action**: Creates structured post-mortem ticket
- **Fields**:
  - Incident timeline and details
  - Acknowledgment information
  - Escalation status
  - Affected services
  - Due date (+7 days)
- **Links**: References root cause ticket if available

### Key Features Demonstrated

- **Signal-Based Triggering**: Real-time workflow activation
- **Timeout Handling**: Automatic escalation when response is slow
- **Conditional Branching**: Different paths based on acknowledgment
- **Multi-Channel Notifications**: Redundant communication channels
- **Escalation Patterns**: Automatic escalation to management
- **Audit Trail**: Complete incident response documentation

### Sample Input

```json
{
  "incidentId": "INC-2025-001",
  "incidentTitle": "Database Connection Pool Exhausted",
  "severity": "critical",
  "affectedServices": ["api-gateway", "user-service"],
  "detectedAt": "2025-11-19T14:30:00Z",
  "monitoringUrl": "https://grafana.example.com/d/incident-001",
  "impactDuration": "5 minutes"
}
```

### Expected Outputs

**Scenario A: Acknowledged on Time**
```json
{
  "status": "success",
  "acknowledged": true,
  "acknowledgedBy": "jane.engineer@example.com",
  "acknowledgmentTime": "2m 15s",
  "escalated": false,
  "postMortemTicket": "INCIDENT-1234"
}
```

**Scenario B: Timeout and Escalation**
```json
{
  "status": "success",
  "acknowledged": false,
  "acknowledgmentTime": "timeout (5m)",
  "escalated": true,
  "escalatedTo": ["engineering-manager@example.com"],
  "postMortemTicket": "INCIDENT-1235"
}
```

### Use Cases

- Critical incident response
- On-call engineer alerting
- SLA violation handling
- Service degradation notifications
- Security incident workflows

---

## Example 4: E-Commerce Order Fulfillment

**File**: `examples/milestone-1/order-fulfillment.json`
**Complexity**: Intermediate (4 activities)
**Duration**: 5-20 seconds

### Purpose

Demonstrates a transactional e-commerce workflow with payment processing, inventory management, and customer communications. This example shows how to:
- Process payments with idempotency protection
- Manage inventory with reservations and rollback
- Integrate with shipping carriers
- Send transactional emails with attachments
- Handle transactional integrity across multiple systems

### Workflow Steps

```
API Trigger → Process Payment → Reserve Inventory → Generate Shipping → Send Confirmation → Complete
```

#### 1. Order Placed (Trigger)
- **Type**: API endpoint trigger
- **Endpoint**: `POST /api/orders`
- **Action**: Triggered when customer completes checkout
- **Inputs**: Order details, customer info, payment method

#### 2. Process Payment (Activity)
- **Component**: `ProcessPaymentActivity`
- **Retry Policy**: Exponential backoff (3 attempts)
- **Action**: Charge customer via Stripe
- **Features**:
  - Idempotency key: `${orderId}-payment`
  - Immediate capture
  - Full payment metadata
  - PCI-compliant handling
- **Configuration**: Stripe API integration with environment-based keys

#### 3. Reserve Inventory (Activity)
- **Component**: `ReserveInventoryActivity`
- **Retry Policy**: Fail after 2 attempts
- **Action**: Reserve inventory items from warehouse
- **Features**:
  - FIFO allocation strategy
  - 24-hour reservation TTL
  - Real-time availability check
  - No backorders allowed
  - **Automatic rollback** if fulfillment fails
- **Configuration**: Warehouse selection, item quantities

#### 4. Generate Shipping Label (Activity)
- **Component**: `CreateShippingLabelActivity`
- **Retry Policy**: Exponential backoff (4 attempts, up to 20s)
- **Action**: Create shipping label with customer's carrier
- **Supported Carriers**: FedEx, UPS, USPS
- **Features**:
  - Multi-carrier API integration
  - Insurance and signature options
  - PDF label generation
  - Tracking number assignment
- **Output**: Label PDF to S3, tracking number, estimated delivery

#### 5. Send Confirmation (Activity)
- **Component**: `SendOrderConfirmationActivity`
- **Retry Policy**: Fail after 5 attempts
- **Action**: Email order confirmation to customer
- **Template**: Professional order confirmation
- **Attachments**:
  - Invoice PDF
  - Shipping label PDF
- **Content**:
  - Order summary with items
  - Payment confirmation (last 4 digits)
  - Shipping details and tracking
  - Estimated delivery date
- **Tracking**: Opens and clicks enabled

### Key Features Demonstrated

- **API-Triggered Workflows**: Webhook-based workflow activation
- **Payment Processing**: Secure payment handling with Stripe
- **Idempotency**: Protection against duplicate charges
- **Inventory Management**: Reservation with automatic rollback
- **Multi-Carrier Shipping**: Flexible carrier integration
- **Transactional Email**: Rich emails with attachments and tracking
- **Transactional Integrity**: Rollback capabilities for failed steps
- **Production Security**: PCI compliance, secure credential handling

### Sample Input

```json
{
  "orderId": "ORD-2025-5432",
  "customerId": "cus_ABC123XYZ",
  "customerEmail": "sarah.customer@example.com",
  "customerName": "Sarah Customer",
  "orderTotal": 129.99,
  "currency": "USD",
  "paymentMethodId": "pm_card_visa",
  "orderItems": [
    {
      "sku": "WIDGET-001",
      "name": "Premium Widget",
      "quantity": 2,
      "price": 49.99
    }
  ],
  "shippingCarrier": "fedex",
  "shippingService": "FEDEX_2_DAY"
}
```

### Expected Output

```json
{
  "status": "success",
  "orderId": "ORD-2025-5432",
  "payment": {
    "chargeId": "ch_3ABCDEF123456",
    "status": "succeeded",
    "amount": 129.99
  },
  "inventory": {
    "reserved": true,
    "reservationId": "RES-2025-9876"
  },
  "shipping": {
    "trackingNumber": "1Z9999999999999999",
    "carrier": "fedex",
    "estimatedDelivery": "2025-11-21"
  },
  "confirmation": {
    "emailSent": true,
    "sentAt": "2025-11-19T10:30:15Z"
  }
}
```

### Use Cases

- E-commerce order processing
- Subscription fulfillment
- Digital product delivery
- B2B order management
- Marketplace order routing

---

## Feature Coverage Matrix

| Feature | API Orch | ETL Pipeline | Incident | Order |
|---------|----------|--------------|----------|-------|
| **Triggers** |
| Manual Trigger | ✅ | - | - | - |
| Scheduled Trigger | - | ✅ | - | - |
| Signal Trigger | - | - | ✅ | - |
| API Endpoint Trigger | - | - | - | ✅ |
| **Activities** |
| Simple Activities | ✅ | - | - | - |
| Complex Activities | - | ✅ | ✅ | ✅ |
| Parallel Execution | - | ✅ | - | - |
| **Retry Policies** |
| Exponential Backoff | ✅ | ✅ | ✅ | ✅ |
| Fail After X | ✅ | ✅ | ✅ | ✅ |
| Keep Trying | - | ✅ | - | - |
| **Advanced Features** |
| Timeout Handling | - | - | ✅ | - |
| Conditional Logic | - | - | ✅ | - |
| Data Validation | - | ✅ | - | - |
| Multi-Channel Notify | - | ✅ | ✅ | - |
| Idempotency | - | - | - | ✅ |
| Rollback Support | - | - | - | ✅ |
| **Duration** |
| < 1 minute | ✅ | - | ✅ | ✅ |
| 1-10 minutes | - | - | ✅ | - |
| > 10 minutes | - | ✅ | - | - |

---

## Best Practices Demonstrated

### 1. Retry Strategy Selection

**Exponential Backoff** - Use for:
- Rate-limited APIs (API Orchestration - CRM update)
- External service calls (Data Pipeline - extract, load)
- Transient network errors (Order - payment, shipping)

**Fail After X** - Use for:
- Data validation failures (Data Pipeline - validate)
- User input errors (API Orchestration - enrich)
- Non-recoverable errors (Incident - notifications)

**Keep Trying** - Use for:
- Required operations that must succeed (Data Pipeline - transform)
- Eventually consistent systems
- Operations with no time constraint

### 2. Timeout Configuration

- **Short timeouts (30s-1m)**: API calls, database queries
- **Medium timeouts (5-10m)**: Data transformations, batch operations
- **Long timeouts (30m+)**: ETL jobs, large file processing

### 3. Error Handling

- Always configure retry policies for external system calls
- Use appropriate timeout values based on operation type
- Implement idempotency for operations that may be retried
- Log errors with sufficient context for debugging
- Send notifications for critical failures

### 4. Configuration Management

- Use environment variables for secrets (API keys, credentials)
- Use workflow variables for dynamic values
- Document configuration requirements
- Provide sensible defaults

### 5. Workflow Design

- Keep workflows focused on a single business process
- Break complex workflows into smaller, reusable components
- Design for failure scenarios (rollback, compensation)
- Include audit trails and logging
- Document expected inputs and outputs

---

## Running the Examples

### Prerequisites

1. Workflow Builder running locally or deployed
2. Required environment variables configured:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
3. User account created

### Import Examples

```bash
# From workflow-builder directory
yarn tsx scripts/seed-demo-workflows.ts
```

### Execute Examples

1. **Via UI**:
   - Navigate to http://localhost:3010
   - Select "Demo Workflows" project
   - Click on an example workflow
   - Click "Execute" button
   - Provide sample input
   - Monitor execution in real-time

2. **Via API**:
   ```bash
   curl -X POST http://localhost:3010/api/workflows/execute \
     -H "Content-Type: application/json" \
     -d '{
       "workflowId": "api-data-orchestration-demo",
       "input": {
         "userId": "user-12345",
         "source": "web-app"
       }
     }'
   ```

### Monitor Execution

- **Execution History**: View in the workflow detail page
- **Activity Logs**: Inspect individual activity executions
- **Error Details**: Review failure reasons and retry attempts
- **Performance Metrics**: Duration, retry counts, success rates

---

## Customizing Examples

All examples are designed to be templates you can customize:

### Modify Activity Configuration

Edit the JSON files in `examples/milestone-1/`:

```json
{
  "data": {
    "config": {
      "apiEndpoint": "YOUR_API_ENDPOINT",
      "timeout": "60s"
    }
  }
}
```

### Add New Activities

1. Define the activity component
2. Add a new node to the workflow definition
3. Connect it with appropriate edges
4. Configure retry policies and timeouts

### Change Retry Policies

```json
{
  "retryPolicy": {
    "strategy": "exponential-backoff",
    "maxAttempts": 5,
    "initialInterval": "2s",
    "maxInterval": "60s",
    "backoffCoefficient": 2
  }
}
```

---

## Testing Examples

### Unit Testing

Test individual activities in isolation:

```typescript
describe('FetchUserDataActivity', () => {
  it('should fetch user data successfully', async () => {
    const result = await fetchUserData({ userId: 'user-123' });
    expect(result.status).toBe('success');
  });

  it('should retry on timeout', async () => {
    // Test retry behavior
  });
});
```

### Integration Testing

Test complete workflows end-to-end:

```typescript
describe('API Orchestration Workflow', () => {
  it('should complete successfully with valid input', async () => {
    const execution = await executeWorkflow('api-orchestration', {
      userId: 'user-12345'
    });

    expect(execution.status).toBe('completed');
    expect(execution.output.crmUpdateResult).toBeDefined();
  });
});
```

### See E2E Tests

Comprehensive E2E tests are available in:
```
tests/e2e/milestone-1-examples.spec.ts
```

---

## Troubleshooting

### Common Issues

**Workflow Not Importing**
- Verify JSON syntax is valid
- Check that all required fields are present
- Ensure referenced components exist

**Execution Failures**
- Review activity logs for error details
- Verify environment variables are set
- Check retry policy configuration
- Ensure timeout values are appropriate

**Timeout Errors**
- Increase timeout values for long-running operations
- Check network connectivity to external services
- Review activity implementation for performance issues

**Retry Exhausted**
- Verify retry policy is appropriate for the error type
- Check if external service is available
- Review error messages for root cause
- Consider increasing max retry attempts

---

## Next Steps

After exploring these examples:

1. **Create Your Own Workflows**: Use these as templates
2. **Implement Custom Activities**: Build domain-specific components
3. **Deploy to Production**: Follow deployment best practices
4. **Monitor Performance**: Set up observability and alerting
5. **Iterate and Improve**: Gather feedback and optimize

## Additional Resources

- **Workflow Builder Documentation**: `/docs/workflow-builder/`
- **API Reference**: `/docs/api/workflows/`
- **Activity Development Guide**: `/docs/activities/development/`
- **Production Deployment Guide**: `/docs/deployment/`

---

**Questions or Issues?**

- Open an issue on GitHub
- Contact the workflow builder team
- Check the FAQ in the main documentation
