---
status: reference
priority: high
created: 2025-11-16
purpose: Quick reference for workflow terminology (Temporal vs Domain-Agnostic)
---

# Workflow Terminology Guide

**For:** Workflow Builder UI, `@bernierllc/temporal-workflow-ui`, and `@bernierllc/generic-workflow-ui`

This guide provides non-Temporal, domain-agnostic terminology for workflow concepts to make the UI accessible to users who may not be familiar with Temporal-specific terminology.

---

## 📖 Terminology Mapping

### Core Workflow Concepts

| Temporal Term | User-Friendly Term | UI Display | Icon | Description |
|---------------|-------------------|------------|------|-------------|
| **Activity** | Task / Action | "Task" | ⚡ (Zap) | A unit of work that performs a specific operation |
| **Agent** | AI Assistant / Decision Maker | "AI Assistant" | 🧠 (Brain) | An AI-powered component that makes decisions |
| **Signal** | Event / Message | "Event" | 📡 (Radio) | A way to send data to a running workflow |
| **Query** | Status Check / Data Request | "Status Check" | 🔍 (Search) | A way to read state from a workflow without affecting it |
| **Trigger** | Start Point / Initiator | "Start" | ▶️ (PlayCircle) | The entry point that starts a workflow |
| **Child Workflow** | Sub-Workflow / Nested Process | "Sub-Workflow" | 🔀 (GitBranch) | A workflow started by another workflow |
| **Scheduled Workflow** (Cron) | Recurring Task / Scheduled Job | "Recurring Task" | ⏰ (Clock) | A workflow that runs on a schedule |
| **Work Queue** | Work Backlog / Pending Tasks | "Work Backlog" | 📥 (Inbox) | A queue of work items waiting to be processed |
| **Task Queue** | Worker Group | "Worker Pool" | 📋 (List) | The pool of workers that execute activities |

---

## 🔄 Advanced Pattern Terminology

### Parent-Child Communication

| Temporal Concept | User-Friendly Term | Description |
|-----------------|-------------------|-------------|
| **Signal to Parent** | "Send Event to Parent" | Child workflow sends data/notification to parent |
| **Query Parent** | "Check Parent Status" | Child workflow reads data from parent |
| **Work Queue Signal** | "Add to Backlog" | Add work item to parent's work queue |
| **Work Queue Query** | "Check Backlog" | Check what work is available in parent's queue |

### Dependency & Blocking

| Temporal Concept | User-Friendly Term | Description |
|-----------------|-------------------|-------------|
| **blockUntil** | "Wait For" / "Depends On" | Wait for other work to complete before starting |
| **Dependency Chain** | "Task Dependencies" | Series of tasks that must complete in order |
| **Parent Close Policy** | "When Parent Ends" | What happens to child when parent completes |

### Scheduling

| Temporal Concept | User-Friendly Term | Description |
|-----------------|-------------------|-------------|
| **Cron Expression** | "Schedule" / "Recurrence Pattern" | When and how often a task repeats |
| **Schedule Spec** | "Timing Settings" | Detailed schedule configuration |
| **Max Runs** | "Run Limit" | Maximum number of times to run |
| **Start Immediately** | "Start Now" | Begin running as soon as parent starts |

---

## 🎨 UI Labels & Tooltips

### Node Type Labels

```typescript
const nodeTypeLabels = {
  'activity': 'Task',
  'agent': 'AI Assistant',
  'signal': 'Event',
  'query': 'Status Check',
  'trigger': 'Start',
  'child-workflow': 'Sub-Workflow',
  'scheduled-workflow': 'Recurring Task',
  'work-queue': 'Work Backlog',
};
```

### Action Labels

```typescript
const actionLabels = {
  // Signal actions
  'sendSignal': 'Send Event',
  'receiveSignal': 'Wait for Event',
  'signalToParent': 'Notify Parent',
  
  // Query actions
  'sendQuery': 'Check Status',
  'receiveQuery': 'Handle Status Request',
  'queryParent': 'Check Parent Status',
  
  // Work queue actions
  'addToQueue': 'Add to Backlog',
  'getFromQueue': 'Get from Backlog',
  'checkQueue': 'Check Backlog',
  
  // Scheduling actions
  'setCronSchedule': 'Set Recurrence',
  'pauseSchedule': 'Pause Schedule',
  'resumeSchedule': 'Resume Schedule',
  'triggerNow': 'Run Now',
  
  // Dependency actions
  'blockUntil': 'Wait For',
  'dependsOn': 'Depends On',
};
```

### Tooltips

```typescript
const tooltips = {
  // Node types
  'activity': 'A task that performs specific work (e.g., send email, fetch data)',
  'agent': 'An AI assistant that makes decisions based on context',
  'signal': 'An event that sends data to a running workflow',
  'query': 'A read-only check to get workflow status or data',
  'trigger': 'The starting point of your workflow',
  'child-workflow': 'A separate workflow started by this workflow',
  'scheduled-workflow': 'A workflow that runs automatically on a schedule',
  'work-queue': 'A list of pending work items that can be processed',
  
  // Advanced features
  'signalToParent': 'This sub-workflow can send events back to its parent',
  'queryParent': 'This sub-workflow can check the parent\'s status',
  'blockUntil': 'This sub-workflow will wait for other work to complete first',
  'cronExpression': 'Set when and how often this task repeats (e.g., every 30 minutes)',
  'workQueueSize': 'Maximum number of items that can be in the backlog at once',
  'workQueuePriority': 'How items are processed: First-In-First-Out (FIFO) or Last-In-First-Out (LIFO)',
};
```

---

## 💬 User-Facing Messages

### Validation Messages

```typescript
const validationMessages = {
  // Positive feedback
  'workflowValid': '✅ Your workflow is ready to run!',
  'scheduleValid': '✅ Schedule is valid. Next run: {nextRun}',
  
  // Errors (user-friendly)
  'noStartPoint': '❌ Every workflow needs a Start point. Drag one from the components panel.',
  'invalidSchedule': '❌ Schedule format is invalid. Try using one of the presets.',
  'circularDependency': '❌ This creates a circular dependency. Task A can\'t wait for Task B if Task B waits for Task A.',
  'queueNameDuplicate': '❌ A work backlog with this name already exists. Please choose a different name.',
  'missingConnection': '❌ This task needs to be connected to show how it fits in the workflow.',
  
  // Warnings
  'noWorkQueue': '⚠️ This recurring task doesn\'t have a work backlog. It won\'t be able to queue work for the parent.',
  'highFrequency': '⚠️ This schedule runs very frequently (every minute). Are you sure?',
  'unboundedQueue': '⚠️ This work backlog has no size limit. Consider setting a maximum to prevent overload.',
};
```

### Help Text

```typescript
const helpText = {
  'scheduledWorkflow': `
    **Recurring Tasks** run automatically on a schedule (like a cron job).
    
    Common use cases:
    - Check for new work every 30 minutes
    - Generate reports daily at midnight
    - Clean up old data weekly
    
    They can:
    - Find new work and add it to the parent's backlog
    - Run independently "on the side" of the main workflow
    - Pause, resume, or trigger manually
  `,
  
  'workQueue': `
    **Work Backlogs** hold pending tasks that need to be processed.
    
    They automatically create:
    - An "Add to Backlog" event (for adding items)
    - A "Check Backlog" status check (for reading items)
    
    Sub-workflows can:
    - Add new items they discover
    - Check for available work
    - Wait until the backlog is empty
  `,
  
  'blockUntil': `
    **Wait For** lets you create dependencies between tasks.
    
    Example: A "Deploy" task can wait for all "Test" tasks to complete.
    
    This creates a task hierarchy where work completes in the right order.
  `,
};
```

---

## 🎯 UI Copy Guidelines

### General Principles

1. **Use Active Voice**: "Send event" instead of "Event is sent"
2. **Be Specific**: "Check parent status" instead of "Query"
3. **Avoid Jargon**: "Work backlog" instead of "Work queue" or "Signal handler"
4. **Show Outcomes**: "This will notify the parent" instead of "Sends a signal"

### Button Labels

```typescript
const buttonLabels = {
  // Primary actions
  'create': 'Create Workflow',
  'save': 'Save Changes',
  'deploy': 'Deploy & Run',
  'test': 'Test Workflow',
  
  // Node actions
  'addTask': 'Add Task',
  'addAI': 'Add AI Assistant',
  'addSubWorkflow': 'Add Sub-Workflow',
  'addRecurringTask': 'Add Recurring Task',
  'addWorkBacklog': 'Add Work Backlog',
  
  // Configuration
  'setSchedule': 'Set Schedule',
  'configureDependencies': 'Set Dependencies',
  'editEvent': 'Edit Event',
  'viewBacklog': 'View Backlog',
};
```

### Section Headers

```typescript
const sectionHeaders = {
  'basicInfo': 'Basic Information',
  'schedule': 'Schedule & Timing',
  'parentCommunication': 'Communication with Parent',
  'dependencies': 'Dependencies & Prerequisites',
  'workBacklog': 'Work Backlog Settings',
  'retrySettings': 'Retry & Error Handling',
  'advanced': 'Advanced Options',
};
```

---

## 🔤 Cron Expression Human-Readable Descriptions

```typescript
const cronDescriptions = {
  '* * * * *': 'Every minute',
  '*/5 * * * *': 'Every 5 minutes',
  '*/15 * * * *': 'Every 15 minutes',
  '*/30 * * * *': 'Every 30 minutes',
  '0 * * * *': 'Every hour (at :00)',
  '0 */2 * * *': 'Every 2 hours',
  '0 0 * * *': 'Daily at midnight',
  '0 9 * * *': 'Daily at 9:00 AM',
  '0 12 * * *': 'Daily at noon',
  '0 0 * * 1': 'Weekly on Monday at midnight',
  '0 9 * * 1-5': 'Weekdays at 9:00 AM',
  '0 0 1 * *': 'Monthly on the 1st at midnight',
  '0 0 1 1 *': 'Yearly on January 1st at midnight',
};
```

---

## 📊 Status Labels

```typescript
const statusLabels = {
  // Execution status
  'pending': 'Waiting to Start',
  'running': 'In Progress',
  'completed': 'Completed Successfully',
  'failed': 'Failed',
  'blocked': 'Waiting for Dependencies',
  'paused': 'Paused',
  'canceled': 'Canceled',
  
  // Work queue status
  'empty': 'No Pending Work',
  'hasItems': '{count} Item(s) Pending',
  'full': 'Backlog Full ({count}/{max})',
  'processing': 'Processing {count} Item(s)',
};
```

---

## 🎨 Visual Indicators

### Icon Meanings

| Icon | Meaning | Context |
|------|---------|---------|
| ⏰ | Scheduled/Recurring | Cron workflows, scheduled tasks |
| 📤 | Sending | Signal to parent, outbound events |
| 📥 | Receiving | Incoming signals, work queue |
| 🔍 | Querying | Status checks, read operations |
| 🚫 | Blocked | Waiting for dependencies |
| ⚡ | Active | Currently executing |
| ✅ | Success | Completed successfully |
| ❌ | Failed | Encountered an error |
| ⏸️ | Paused | Temporarily stopped |
| 🔗 | Connected | Has dependencies or connections |

### Color Coding

- **Blue** - Activities/Tasks (work being done)
- **Purple** - AI Assistants (intelligent decisions)
- **Orange** - Events/Signals (communication)
- **Teal** - Status Checks/Queries (reading state)
- **Green** - Start Points/Triggers (entry)
- **Cyan** - Sub-Workflows (nested processes)
- **Pink** - Recurring Tasks (scheduled)
- **Yellow** - Work Backlogs (queues)

---

## 🧑‍🏫 Onboarding Copy

### First-Time User Tutorial

```markdown
## Welcome to Workflow Builder!

Let's build your first workflow in 3 steps:

### 1. Add a Start Point
Every workflow needs a starting point. Drag the **"Start"** component from the left panel onto the canvas.

### 2. Add Your First Task
Tasks do the actual work. Try adding a **"Task"** or **"AI Assistant"** and connect it to your Start point.

### 3. Save & Deploy
When you're ready, click **"Save Changes"** to save your workflow, then **"Deploy & Run"** to make it live!

---

## Advanced Features (Optional)

### Recurring Tasks (Cron Workflows)
Need something to happen automatically on a schedule? Add a **"Recurring Task"** that runs every few minutes, hours, or days.

### Sub-Workflows
Breaking work into smaller pieces? Use **"Sub-Workflows"** to organize complex processes. They can even communicate back to the parent!

### Work Backlogs
Need to queue up work? Add a **"Work Backlog"** to hold pending items. Other parts of your workflow can add to it or check what's available.
```

---

## 📝 Component Descriptions (for Palette)

```typescript
const componentDescriptions = {
  'activity': 'Add a task that performs specific work like sending emails, fetching data, or processing files.',
  
  'agent': 'Add an AI assistant that can make decisions, analyze content, or provide recommendations.',
  
  'signal': 'Add an event handler to receive notifications or data from other workflows or external systems.',
  
  'query': 'Add a status check that lets other workflows or systems read data without changing anything.',
  
  'child-workflow': 'Add a sub-workflow to break complex processes into manageable pieces. Great for organizing work!',
  
  'scheduled-workflow': 'Add a recurring task that runs automatically on a schedule (every hour, daily, etc.). Perfect for monitoring or cleanup tasks.',
  
  'work-queue': 'Add a work backlog to hold pending items. Other parts of your workflow can add work or check what\'s available.',
};
```

---

## 🌐 Localization Keys

For future internationalization:

```typescript
const i18nKeys = {
  // Node types
  'node.activity': 'Task',
  'node.agent': 'AI Assistant',
  'node.signal': 'Event',
  'node.query': 'Status Check',
  'node.trigger': 'Start',
  'node.childWorkflow': 'Sub-Workflow',
  'node.scheduledWorkflow': 'Recurring Task',
  'node.workQueue': 'Work Backlog',
  
  // Actions
  'action.addToQueue': 'Add to Backlog',
  'action.checkStatus': 'Check Status',
  'action.waitFor': 'Wait For',
  'action.setSchedule': 'Set Schedule',
  
  // Status
  'status.pending': 'Waiting to Start',
  'status.running': 'In Progress',
  'status.completed': 'Completed Successfully',
  'status.blocked': 'Waiting for Dependencies',
};
```

---

## 🎯 Best Practices for UI Copy

1. **Start with the user's goal**: "Send event to parent" (goal) vs "Signal configuration" (implementation)
2. **Use consistent terminology**: Pick one term (e.g., "Work Backlog") and stick with it
3. **Provide context in tooltips**: Don't assume users know Temporal concepts
4. **Show examples**: "e.g., every 30 minutes" is clearer than just explaining cron syntax
5. **Use progressive disclosure**: Show simple options first, advanced in "Show More"
6. **Validate with helpful messages**: Explain what's wrong AND how to fix it
7. **Test with non-technical users**: If they understand it, you've succeeded!

---

**Last Updated:** 2025-11-16  
**Applies To:** `@bernierllc/temporal-workflow-ui`, `@coordinator/workflow-builder`  
**Status:** Living Document - Update as terminology evolves

