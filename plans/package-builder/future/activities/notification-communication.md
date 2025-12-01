# Notification and Communication Activities Plan

This document outlines notification and communication activities for keeping stakeholders informed about workflow progress, failures, and completions, ranked from highest to lowest benefit.

## Current State Analysis

### What We Have
- ✅ `notifyPublishSuccess` (Gemini-specific) - Basic notification
- ✅ `notifyHumanForHelp` (Gemini-specific) - Human intervention requests
- ✅ `updateMCPPackageStatus` - MCP status updates

### What's Missing
- ❌ Provider-agnostic notification system
- ❌ Slack integration (mentioned but not implemented)
- ❌ Email notifications
- ❌ Webhook notifications
- ❌ Status dashboard updates
- ❌ Progress tracking and reporting
- ❌ Error alerting
- ❌ Completion summaries

---

## High Priority (Implement Soon)

### 1. Slack Integration Activities
**Benefit:** Real-time team communication and visibility

**Use Cases:**
- Notify team of workflow start/completion
- Alert on failures with error details
- Share build reports and summaries
- Request human intervention
- Progress updates for long-running workflows

**Implementation:**
```typescript
export interface SlackNotificationInput {
  channel?: string; // Default: #package-builds
  message: string;
  attachments?: Array<{
    title: string;
    text: string;
    color?: 'good' | 'warning' | 'danger';
    fields?: Array<{ title: string; value: string; short?: boolean }>;
  }>;
  threadTs?: string; // Reply in thread
  blocks?: any[]; // Slack Block Kit
}

export interface SlackNotificationResult {
  success: boolean;
  ts?: string; // Message timestamp for threading
  error?: string;
}

export async function sendSlackNotification(
  input: SlackNotificationInput
): Promise<SlackNotificationResult>;

export async function sendSlackBuildReport(
  workflowRunId: string,
  report: PackageBuildReport
): Promise<SlackNotificationResult>;

export async function sendSlackErrorAlert(
  error: Error,
  context: {
    workflowRunId: string;
    stepName: string;
    packageName?: string;
  }
): Promise<SlackNotificationResult>;
```

**Workflow Integration:**
- Workflow start: "Starting build for package X"
- Workflow completion: "Build complete: X packages built, Y passed, Z failed"
- Error alerts: "Build failed at step X: error details"
- Human intervention: "Need help: [reason]"

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

### 2. Workflow Status Updates
**Benefit:** Real-time progress tracking

**Use Cases:**
- Update status at each workflow phase
- Track progress percentage
- Report current step
- Estimate completion time

**Implementation:**
```typescript
export interface StatusUpdateInput {
  workflowRunId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  phase: string;
  progress?: number; // 0-100
  currentStep?: string;
  estimatedCompletion?: Date;
  metadata?: Record<string, any>;
}

export interface StatusUpdateResult {
  success: boolean;
  updatedAt: Date;
}

export async function updateWorkflowStatus(
  input: StatusUpdateInput
): Promise<StatusUpdateResult>;
```

**Integration:**
- Update Temporal workflow status
- Store in database for dashboard
- Send to Slack/email as updates

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

### 3. Error Alerting and Escalation
**Benefit:** Fast failure detection and response

**Use Cases:**
- Alert on critical failures
- Escalate after retry attempts exhausted
- Notify on credential failures
- Alert on resource exhaustion

**Implementation:**
```typescript
export interface ErrorAlertInput {
  error: Error;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: {
    workflowRunId: string;
    stepName: string;
    packageName?: string;
    retryAttempt?: number;
  };
  channels: ('slack' | 'email' | 'webhook')[];
  escalate?: boolean; // Escalate to on-call
}

export interface ErrorAlertResult {
  success: boolean;
  alerted: string[]; // Channels that received alert
  escalated: boolean;
}
```

**Escalation Rules:**
- Critical: Immediate Slack + email + escalation
- High: Slack + email
- Medium: Slack only
- Low: Log only

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

## Medium Priority (Implement When Needed)

### 4. Email Notifications
**Benefit:** Formal notifications and summaries

**Use Cases:**
- Daily/weekly build summaries
- Critical failure notifications
- Completion reports
- Compliance reports

**Implementation:**
```typescript
export interface EmailNotificationInput {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType: string;
  }>;
}

export interface EmailNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmailNotification(
  input: EmailNotificationInput
): Promise<EmailNotificationResult>;

export async function sendBuildSummaryEmail(
  workflowRunId: string,
  recipients: string[]
): Promise<EmailNotificationResult>;
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 5. Webhook Notifications
**Benefit:** Integration with external systems

**Use Cases:**
- Integrate with CI/CD systems
- Update external dashboards
- Trigger downstream workflows
- Custom integrations

**Implementation:**
```typescript
export interface WebhookNotificationInput {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  payload: any;
  headers?: Record<string, string>;
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
  timeout?: number;
}

export interface WebhookNotificationResult {
  success: boolean;
  statusCode?: number;
  response?: any;
  error?: string;
}

export async function sendWebhookNotification(
  input: WebhookNotificationInput
): Promise<WebhookNotificationResult>;
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 6. Progress Tracking and Reporting
**Benefit:** Detailed progress visibility

**Use Cases:**
- Track multi-package builds
- Show progress bars
- Estimate time remaining
- Report throughput metrics

**Implementation:**
```typescript
export interface ProgressUpdateInput {
  workflowRunId: string;
  total: number;
  completed: number;
  current?: string;
  errors?: number;
  warnings?: number;
}

export interface ProgressUpdateResult {
  success: boolean;
  progress: number; // 0-100
  estimatedCompletion?: Date;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

## Lower Priority (Advanced Features)

### 7. SMS/PagerDuty Integration
**Benefit:** Critical alert escalation

**Use Cases:**
- On-call notifications
- Critical system failures
- Service outages

**Note:** Only for critical, production-impacting issues.

**Estimated Value:** ⭐⭐ (2/5) - Only needed for production systems

---

### 8. Status Dashboard Updates
**Benefit:** Real-time dashboard visibility

**Use Cases:**
- Update web dashboard
- Real-time metrics
- Historical trends
- Health monitoring

**Estimated Value:** ⭐⭐ (2/5) - Requires dashboard infrastructure

---

## Implementation Strategy

### Phase 1: High Priority (Next Sprint)
1. ✅ Slack Integration Activities
2. ✅ Workflow Status Updates
3. ✅ Error Alerting and Escalation

### Phase 2: Medium Priority (When Needed)
4. Email Notifications
5. Webhook Notifications
6. Progress Tracking and Reporting

### Phase 3: Advanced (Lower Priority)
7. SMS/PagerDuty Integration
8. Status Dashboard Updates

---

## Integration with Workflows

### Package Build Workflow
```typescript
// Start
await sendSlackNotification({
  message: `🚀 Starting build for ${packageName}`,
  attachments: [{
    title: 'Build Details',
    fields: [
      { title: 'Package', value: packageName },
      { title: 'Workflow ID', value: workflowId }
    ]
  }]
});

// Progress
await updateWorkflowStatus({
  workflowRunId: workflowId,
  status: 'running',
  phase: 'implementation',
  progress: 50
});

// Completion
await sendSlackBuildReport(workflowId, buildReport);

// Error
await sendSlackErrorAlert(error, {
  workflowRunId: workflowId,
  stepName: 'compliance_checks',
  packageName
});
```

---

## Configuration

### Notification Channels Configuration
```typescript
interface NotificationConfig {
  slack: {
    enabled: boolean;
    webhookUrl?: string;
    botToken?: string;
    defaultChannel: string;
  };
  email: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
  };
  webhooks: Array<{
    name: string;
    url: string;
    events: string[]; // 'workflow.start', 'workflow.complete', etc.
  }>;
}
```

---

## Error Handling

### Notification Failures
- **Non-blocking:** Notification failures shouldn't block workflows
- **Retry logic:** Retry transient failures
- **Fallback channels:** Use alternative channels if primary fails
- **Logging:** Log all notification attempts

---

## Security Considerations

### Credential Management
- Store Slack tokens, email credentials securely
- Use environment variables or secret management
- Rotate credentials regularly
- Audit notification access

### Message Sanitization
- Sanitize error messages before sending
- Remove sensitive data (tokens, passwords)
- Truncate large outputs
- Escape special characters

---

## Dependencies Needed

```json
{
  "@slack/webhook": "^7.0.0",  // Slack webhooks
  "@slack/web-api": "^7.0.0",  // Slack API (for threads, etc.)
  "nodemailer": "^6.9.0",  // Email sending
  "axios": "^1.6.0"  // Webhook HTTP requests
}
```

---

## Notes

- All notifications should be **provider-agnostic** (work with both Gemini and Claude workflows)
- Notifications should be **non-blocking** - failures shouldn't stop workflows
- Support **rich formatting** (Markdown, Slack blocks, HTML email)
- **Threading support** for Slack to keep conversations organized
- **Rate limiting** to prevent notification spam
- **Batching** for multiple notifications (e.g., daily summaries)

