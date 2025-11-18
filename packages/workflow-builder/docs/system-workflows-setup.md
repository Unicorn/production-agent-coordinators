# System Workflows Setup Guide

## Overview

System workflows (like the Agent Tester) are owned by the `system@example.com` user and work exactly like regular user workflows. The system user has a project, task queue, and workflows that are managed through the same infrastructure as other users.

## Setup Steps

### 1. Create System Auth User

First, create the auth user via Supabase Auth API:

```bash
# Using Supabase CLI
supabase auth admin create-user \
  --email system@example.com \
  --password "your-secure-password" \
  --email-confirmed true

# Or via Supabase Dashboard
# Go to Authentication > Users > Add User
# Email: system@example.com
# Set a secure password
```

### 2. Run Migrations

The migrations will automatically set up everything:

```bash
# Migration 20251118000001 creates the system role
# Migration 20251118000002 creates agent testing tables
# Migration 20251118000003 seeds system user, project, task queue, and workflows
```

The seed migration (`20251118000003_seed_system_user_and_workflows.sql`) will:
- Create the system user record (linked to auth user)
- Create the system task queue (`system-workflows-queue`)
- Create the system project (`System Workflows`)
- Create the Agent Tester workflow

### 3. Start System Worker

The system worker is started the same way as any other user's worker - through the project worker manager. When a workflow in the system project needs to run, the worker manager will:

1. Detect the system project
2. Load workflows from the system project
3. Start a worker on the `system-workflows-queue` task queue
4. Register the agent tester workflow and activities

## Architecture

```
system@example.com (User)
  └── System Workflows (Project)
      └── system-workflows-queue (Task Queue)
          └── Agent Tester Workflow
              ├── Signals: sendMessage, endTest
              ├── Queries: getConversation
              └── Activities: callAgent, saveTestSession
```

## Verification

After setup, verify everything is in place:

```sql
-- Check system user
SELECT id, email, display_name FROM users WHERE email = 'system@example.com';

-- Check system project
SELECT id, name, task_queue_name FROM projects 
WHERE name = 'System Workflows';

-- Check system task queue
SELECT id, name, is_system_queue FROM task_queues 
WHERE name = 'system-workflows-queue';

-- Check agent tester workflow
SELECT id, name, display_name, temporal_workflow_type FROM workflows 
WHERE name = 'agent-tester';
```

## Usage

Once set up, users can:

1. **Test Agents**: Click "Test Agent" on any agent prompt page
2. **Start Conversations**: The agent tester workflow will start automatically
3. **Interact**: Send messages via the modal interface
4. **Monitor**: The workflow maintains conversation state and handles timeouts

The system worker will automatically start when needed, just like any other project's worker.

## Troubleshooting

### System User Not Found
- Ensure auth user was created first
- Re-run migration `20251118000003_seed_system_user_and_workflows.sql`

### System Project Not Found
- Check that migration `20251118000003` ran successfully
- Verify system user exists
- Re-run the seed migration

### Worker Not Starting
- Check that the system project exists
- Verify the task queue name matches
- Ensure Temporal server is running
- Check worker manager logs

