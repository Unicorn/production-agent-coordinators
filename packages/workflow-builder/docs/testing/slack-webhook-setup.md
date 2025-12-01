# Slack Webhook Setup for Testing

This guide explains how to set up a Slack webhook URL for testing notification activities in the workflow builder.

## Prerequisites

- A Slack workspace where you have permission to create apps
- Admin access to the workspace (or permission to install apps)

## Step-by-Step Instructions

### 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter an app name (e.g., "Workflow Builder Test")
5. Select your workspace
6. Click **"Create App"**

### 2. Enable Incoming Webhooks

1. In your app's settings, go to **"Incoming Webhooks"** in the left sidebar
2. Toggle **"Activate Incoming Webhooks"** to **ON**

### 3. Create a Webhook

1. Scroll down to **"Webhook URLs for Your Workspace"**
2. Click **"Add New Webhook to Workspace"**
3. Select the channel where you want test notifications to appear (e.g., `#testing` or `#workflow-builder`)
4. Click **"Allow"**
5. **Copy the webhook URL** - it will look like:
   ```
   https://hooks.slack.com/services/YOUR_WORKSPACE_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN
   ```
   ⚠️ **Keep this URL secret** - it's a private webhook that anyone with the URL can post to your channel

### 4. Configure for Testing

#### Option A: Environment Variable (Recommended for Local Testing)

1. Create or update `.env.local` in the `packages/workflow-builder` directory:
   ```bash
   cd packages/workflow-builder
   ```

2. Add the webhook URL:
   ```bash
   TEST_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WORKSPACE_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN
   ```

3. Load the environment variable in your test environment:
   ```bash
   export TEST_SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR_WORKSPACE_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN
   ```

#### Option B: Direct Test Execution

You can also pass the webhook URL directly when running tests:

```bash
TEST_SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR_WORKSPACE_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN npm test -- tests/integration/activities/notifications.integration.test.ts
```

### 5. Test the Webhook

#### Quick Manual Test

You can test the webhook directly using curl:

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test message from workflow builder"}' \
  https://hooks.slack.com/services/YOUR_WORKSPACE_ID/YOUR_CHANNEL_ID/YOUR_WEBHOOK_TOKEN
```

If successful, you should see the message appear in your selected Slack channel.

#### Run Integration Tests

Once the environment variable is set, run the integration tests:

```bash
cd packages/workflow-builder
npm test -- tests/integration/activities/notifications.integration.test.ts
```

The tests that were previously skipped (marked with `.skip`) will now run:
- `should send notification to real Slack webhook`
- `should send error alert to Slack when configured`

### 6. Verify Test Results

After running the tests, check your Slack channel for:
- Test notification messages
- Error alert notifications with formatted attachments
- Different severity levels (low, medium, high, critical)

## Security Best Practices

1. **Never commit webhook URLs to version control**
   - Add `.env.local` to `.gitignore` if not already there
   - Use environment variables, not hardcoded URLs

2. **Use separate webhooks for different environments**
   - Development: `#dev-testing` channel
   - Staging: `#staging-alerts` channel
   - Production: `#production-alerts` channel

3. **Rotate webhooks periodically**
   - Delete old webhooks when no longer needed
   - Create new ones if a webhook is compromised

4. **Limit channel access**
   - Use private channels for sensitive notifications
   - Only add necessary team members to notification channels

## Troubleshooting

### "Invalid webhook URL" error

- Verify the webhook URL is correct (no extra spaces or characters)
- Check that the webhook is still active in Slack app settings
- Ensure the webhook hasn't been revoked

### "Channel not found" error

- Verify the channel exists and the webhook has permission to post
- Check that the channel name in the webhook settings matches

### Tests still skipped

- Verify `TEST_SLACK_WEBHOOK_URL` is set in your environment
- Check that the environment variable is loaded in your test process
- Try running with explicit variable: `TEST_SLACK_WEBHOOK_URL="..." npm test ...`

### No messages appearing in Slack

- Check the Slack channel for the webhook
- Verify the webhook is active in Slack app settings
- Check network connectivity
- Review test output for error messages

## Alternative: Use Webhook Testing Service

If you don't want to use a real Slack workspace, you can use a webhook testing service:

1. Go to [https://webhook.site](https://webhook.site)
2. Copy the unique webhook URL provided
3. Use it as `TEST_SLACK_WEBHOOK_URL`
4. View requests at the webhook.site dashboard

Note: This won't test Slack-specific formatting, but will verify HTTP requests work correctly.

## Next Steps

Once your webhook is configured:

1. Run the full notification integration test suite
2. Test error alerts with different severity levels
3. Verify Slack message formatting (attachments, colors, fields)
4. Test progress updates and status notifications

## References

- [Slack Incoming Webhooks Documentation](https://api.slack.com/messaging/webhooks)
- [Slack API Apps](https://api.slack.com/apps)
- Workflow Builder Notification Activities: `src/lib/activities/notifications.activities.ts`

