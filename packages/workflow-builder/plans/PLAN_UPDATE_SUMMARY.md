# Plan Update Summary: Advanced Workflow Patterns

**Date:** 2025-11-16  
**Updated Plans:**
- `temporal-workflow-ui-package-plan.md` (Updated)
- `workflow-terminology-guide.md` (New)

---

## 🎯 What Was Added

### New Workflow Concepts

1. **Scheduled Workflows (Cron Child Workflows)**
   - UI Name: "Recurring Task" or "Scheduled Job"
   - Icon: ⏰ (Clock)
   - Color: Pink/Magenta
   - Purpose: Runs on a schedule, can signal back to parent

2. **Work Queues**
   - UI Name: "Work Backlog" or "Pending Tasks"
   - Icon: 📥 (Inbox)
   - Color: Yellow
   - Purpose: Queue of work items on coordinator that children can interact with

3. **Queries**
   - UI Name: "Status Check" or "Data Request"
   - Icon: 🔍 (Search)
   - Color: Teal
   - Purpose: Read-only state inspection without side effects

4. **Enhanced Child Workflows**
   - Can signal to parent (send events/data back)
   - Can query parent (check parent's state)
   - Can block until dependencies complete (`blockUntil`)

---

## 📋 New Type Definitions

### Node Types Added
```typescript
export type TemporalNodeType = 
  | 'activity'
  | 'agent'
  | 'signal'
  | 'query'                    // NEW
  | 'trigger'
  | 'child-workflow'
  | 'scheduled-workflow'        // NEW (cron)
  | 'parallel'
  | 'condition'
  | 'work-queue';               // NEW
```

### New Metadata Types
- `TemporalQueryMetadata` - Query handler configuration
- `TemporalScheduledWorkflowMetadata` - Cron workflow with schedule spec
- `TemporalChildWorkflowMetadata` - Enhanced with `signalToParent`, `queryParent`, `blockUntil`
- `TemporalWorkQueueMetadata` - Work queue with signal/query handlers

### Enhanced Workflow Definition
```typescript
interface TemporalWorkflow {
  // ... existing fields
  workQueues?: Array<WorkQueue>;  // NEW
  signals?: Array<Signal>;        // NEW (auto-generated)
  queries?: Array<Query>;         // NEW (auto-generated)
}
```

---

## 🎨 New UI Components (6 Added)

### 12. TemporalWorkQueueCard
Display and manage work queues with live status

### 13. TemporalScheduledWorkflowCard
Display cron workflows with schedule, run history, next run

### 14. TemporalQueryCard
Display query handlers with response schema and history

### 15. CronExpressionBuilder
Visual cron builder with presets and validation

### 16. TemporalChildWorkflowCard (Enhanced)
Shows parent communication indicators (📤 signal, 🔍 query, 🚫 blocked)

### 17. WorkQueueConnectionVisualizer
Overlay showing all signal/query connection paths

---

## 🏗️ Advanced Workflow Patterns Documented

### Pattern 1: Scheduled Child Workflow (Plan Writer Example)
- Cron workflow checks every 30 minutes for plans needing writing
- Signals parent to add plans to work queue
- "Hangs off the side" of main workflow

### Pattern 2: Child Workflow with Parent Query
- Child queries parent for available work before starting
- Enables dynamic work discovery

### Pattern 3: Child Workflow with Dependency Blocking
- `blockUntil` waits for other work to complete
- Creates hierarchical dependencies
- Example: Build waits for tests to complete

### Pattern 4: Child Workflow Discovering More Work
- Child finds additional work during execution
- Signals parent to queue it
- Enables self-expanding workflows

### Pattern 5: Multiple Work Queues with Priority
- High priority, normal, background queues
- Different ordering (FIFO, LIFO, priority)
- Deduplication support

---

## 📐 Visual Design Guidelines

### Scheduled Workflows
- Render as "floating" nodes attached to parent
- Dashed connection line
- Show cron schedule (e.g., "⏰ Every 30 min")
- Distinct color to differentiate from regular child workflows

### Work Queues
- Appear as "containers" or "buckets" (NOT regular nodes)
- Show queue status: count, capacity, priority
- Visual connections to nodes that add/query
- Color-coded by priority

### Signals & Queries
- Appear as connection points on workflow boundary
- Auto-generated ones marked with special icon (⚡ + "AUTO")
- Solid lines for signals, dashed for queries
- Hover shows parameters

---

## 🔧 New Utilities

### Cron Utils (`cron-utils.ts`)
- Parse cron expressions
- Validate syntax
- Calculate next N run times
- Human-readable descriptions

### Work Queue Utils (`work-queue-utils.ts`)
- Queue management operations
- Priority sorting
- Deduplication logic
- Status calculations

### Connection Path Utils (`connection-path-utils.ts`)
- Calculate signal/query paths
- Detect circular dependencies
- Validate connection integrity

---

## 📚 New Documentation

### `workflow-terminology-guide.md`
Complete guide for non-Temporal, user-friendly terminology:
- Terminology mapping table (Temporal → User-Friendly)
- UI labels and tooltips
- Validation messages
- Help text
- Button labels
- Cron expression descriptions
- Status labels
- Visual indicator guide
- Onboarding copy
- Localization keys

---

## 📅 Updated Timeline

### Original Plan: 5 weeks
- Phase 1-4: Core functionality
- Phase 5: Polish & docs

### Updated Plan: 7 weeks
- Phase 1-4: Core functionality (unchanged)
- **Phase 5 (NEW): Advanced Patterns (Week 5-6)**
  - Work queues, scheduled workflows, queries
  - Enhanced child workflows
  - Cron builder, connection visualizer
  - Validation for advanced patterns
- Phase 6: Polish & Docs (Week 7)
  - Examples including Plan Writer Coordinator
  - Advanced pattern guides
  - Storybook stories

---

## ✅ Success Criteria Added

### Advanced Patterns
- [ ] Scheduled workflows render correctly on canvas
- [ ] Work queues display as containers with connections
- [ ] Signal/query connections animate and highlight
- [ ] Child workflows configure parent communication
- [ ] Blocking dependencies visualize correctly
- [ ] Auto-generated signals/queries marked
- [ ] Cron builder validates and shows next runs
- [ ] Queue properties (FIFO/LIFO) display correctly
- [ ] Connection visualizer shows all paths
- [ ] Validation prevents circular dependencies

---

## 🎯 Key Design Decisions

1. **Work Queues as Containers, Not Nodes**
   - Appear as "buckets" on canvas
   - Not part of main workflow flow
   - Visual connections to interacting nodes

2. **Auto-Generated Signals & Queries**
   - Work queues auto-create handlers
   - Marked with special icon
   - Reduced boilerplate for users

3. **Scheduled Workflows "Hang Off the Side"**
   - Visually separate from main flow
   - Connected with dashed lines
   - Distinct color (pink/magenta)

4. **Progressive Disclosure**
   - Basic features visible by default
   - Advanced (signals, queries, blocking) in property panel
   - Tooltips explain concepts

5. **User-Friendly Terminology**
   - "Recurring Task" instead of "Cron Workflow"
   - "Work Backlog" instead of "Work Queue"
   - "Status Check" instead of "Query"
   - "Wait For" instead of "blockUntil"

---

## 🔗 Integration with Your Plan Writer Coordinator

The plan specifically addresses your use case:

```typescript
// Plan Writer Coordinator Example
const planWriterWorkflow: TemporalWorkflow = {
  stages: [
    // Main coordinator flow
    { id: 'trigger', type: 'trigger', ... },
    { id: 'processPlan', type: 'activity', ... },
    
    // Cron workflow that checks every 30 minutes
    {
      id: 'checkForPlans',
      type: 'scheduled-workflow',
      metadata: {
        scheduleSpec: '*/30 * * * *',  // Every 30 min
        signalToParent: {
          signalName: 'addPlanToQueue',
          autoCreate: true,
          queueName: 'plansToWrite',
        },
      },
    },
  ],
  
  // Work queue for plans
  workQueues: [
    {
      id: 'wq-plans',
      name: 'plansToWrite',
      signalName: 'addPlanToQueue',  // Auto-generated
      queryName: 'getPlansToWrite',  // Auto-generated
    },
  ],
};
```

---

## 🚀 Ready for Package Team

Both plan files are now complete and ready to share with your package agents:

1. **`temporal-workflow-ui-package-plan.md`** - Complete technical specification
2. **`workflow-terminology-guide.md`** - User-facing terminology guide

The plan includes:
- ✅ Complete type definitions
- ✅ All component APIs
- ✅ Visual design guidelines
- ✅ Implementation patterns with examples
- ✅ Code generation implications
- ✅ Phased implementation timeline
- ✅ Success criteria
- ✅ User-friendly terminology

---

## 📝 Next Steps

1. Share both plan files with package agents
2. They can build `@bernierllc/temporal-workflow-ui@1.1.0` with advanced patterns
3. Our workflow-builder can then integrate the new components
4. Update Supabase schema to support work queues, queries, and cron workflows

---

**Status:** ✅ Complete and Ready  
**Files Updated:** 2  
**New Components:** 6  
**New Patterns:** 5  
**Estimated Additional Time:** +2 weeks (5 weeks → 7 weeks total)

