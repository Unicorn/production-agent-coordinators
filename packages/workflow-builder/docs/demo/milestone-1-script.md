# Milestone 1 Demo Script - Workflow Builder
**Demo Date**: Week 6 Stakeholder Presentation
**Duration**: 15 minutes (12 minutes demo + 3 minutes Q&A)
**Presenter**: [Team Member Name]
**Environment**: demo.workflow-builder.com (or localhost:3010)

---

## Pre-Demo Checklist (30 minutes before)

### Infrastructure Verification
- [ ] Demo environment is running and accessible
- [ ] Database has been seeded with demo workflows
- [ ] Temporal server is healthy (check http://localhost:8080 or demo temporal UI)
- [ ] Kong gateway is operational (if using API endpoint trigger)
- [ ] All services passed health checks in last 10 minutes
- [ ] Browser cache cleared and logged in as demo user

### Demo Data Verification
- [ ] "Demo Workflows" project exists with 4 example workflows
- [ ] All example workflows are in "active" status
- [ ] Test execution of API Orchestration workflow completes successfully
- [ ] Generated code preview works for all workflows
- [ ] No console errors in browser developer tools

### Backup Plan Verification
- [ ] Screen recording of successful demo run is available
- [ ] Backup slides showing screenshots are ready
- [ ] Local development environment is ready as fallback

---

## Opening (1 minute)

### Context Setting
**Script**:
> "Good morning/afternoon everyone. Today I'm excited to show you the first milestone of our Workflow Builder system. Over the past 6 weeks, we've built a visual workflow orchestration platform that enables you to create, deploy, and monitor Temporal workflows without writing code."

**Visual**: Show workflow builder landing page with Demo Workflows project visible

**Key Message**: This is real, working software that solves real problems starting today.

---

## Demo Flow (12 minutes)

### Part 1: Create a Workflow in the UI (3 minutes)

**Objective**: Demonstrate visual workflow creation with drag-and-drop

**Script**:
> "Let me show you how easy it is to create a workflow. I'm going to build a simple API orchestration workflow that fetches user data, enriches it, and updates our CRM."

**Actions**:
1. Navigate to Demo Workflows project
2. Click "New Workflow" button
3. Show workflow canvas with component palette

**Script**:
> "Here's our visual workflow canvas. On the left, we have a component palette with two node types available in Milestone 1: Trigger nodes and Activity nodes."

**Actions**:
4. Drag "Manual Trigger" node to canvas at position (100, 200)
5. Drag "Activity" node to canvas at position (300, 200)
6. Drag second "Activity" node at position (550, 200)
7. Drag third "Activity" node at position (800, 200)
8. Connect nodes by dragging edges: Trigger → Activity 1 → Activity 2 → Activity 3

**Script**:
> "I've just created a linear workflow with 3 activities in under 30 seconds. Now let's configure them."

**Key Timing**: 3 minutes total (should be at 4:00 mark)

**Recovery**: If drag-and-drop fails, use pre-created "API Orchestration" example workflow

---

### Part 2: Configure Each Activity (2 minutes)

**Objective**: Show configuration panel and retry policies

**Script**:
> "Each activity can be configured with custom settings and retry policies. Let me show you."

**Actions**:
1. Click on Activity 1 node
2. Show property panel opening on right side
3. Update activity name to "Fetch User Data"
4. Set timeout to "30s"
5. Configure retry policy:
   - Strategy: Exponential Backoff
   - Max Attempts: 3
   - Initial Interval: 1s
   - Backoff Coefficient: 2

**Script**:
> "This activity will retry up to 3 times with exponential backoff if it fails. The first retry happens after 1 second, the next after 2 seconds, then 4 seconds."

**Actions**:
6. Click on Activity 2
7. Configure as "Enrich User Data" with fail-after-2 retry policy
8. Click on Activity 3
9. Configure as "Update CRM" with exponential backoff (5 attempts)

**Script**:
> "Notice how each activity can have different retry strategies. This gives you fine-grained control over error handling."

**Key Timing**: 2 minutes (should be at 6:00 mark)

**Recovery**: If configuration panel doesn't open, refresh page and use pre-configured workflow

---

### Part 3: Deploy the Workflow (2 minutes)

**Objective**: Show one-click deployment with compilation progress

**Script**:
> "Now that our workflow is configured, let's deploy it with a single click."

**Actions**:
1. Click "Deploy" button in top toolbar
2. Show deployment progress modal appearing
3. Point out compilation stages:
   - "Validating workflow definition..." (2 seconds)
   - "Generating TypeScript code..." (3 seconds)
   - "Compiling with TypeScript..." (4 seconds)
   - "Registering with Temporal worker..." (2 seconds)
   - "Workflow deployed successfully!" (1 second)

**Script**:
> "Behind the scenes, the system is:
> 1. Validating our workflow structure
> 2. Generating production-ready TypeScript code
> 3. Compiling it to ensure type safety
> 4. Registering it with our Temporal worker cluster
>
> This entire process takes about 10-15 seconds and is fully automated."

**Actions**:
4. Show success notification with "Active" badge on workflow
5. Point out workflow is now ready to execute

**Key Timing**: 2 minutes (should be at 8:00 mark)

**Recovery**: If deployment fails, use pre-deployed "API Orchestration" workflow

---

### Part 4: Execute and Monitor Workflow (3 minutes)

**Objective**: Show real-time execution monitoring

**Script**:
> "Let's run this workflow and watch it execute in real-time."

**Actions**:
1. Click "Run Workflow" button
2. Show execution input modal
3. Enter sample input:
```json
{
  "userId": "demo-user-12345",
  "source": "stakeholder-demo"
}
```
4. Click "Start Execution"

**Script**:
> "The workflow is now running. Watch this execution panel - it shows real-time progress."

**Actions**:
5. Point out execution status panel showing:
   - Progress bar (0% → 33% → 66% → 100%)
   - Current step indicator
   - Step status (pending → running → completed)
   - Step duration timings
6. Let workflow complete (should take 5-10 seconds with mock activities)
7. Show completed status with green checkmark

**Script**:
> "And we're done! The workflow executed all three activities in sequence, with all our retry policies in place. Let me show you the execution details."

**Actions**:
8. Click "View Results" to expand execution output
9. Show execution summary:
   - Total duration: ~8 seconds
   - All 3 activities completed successfully
   - No retries needed (mock activities succeed)
10. Show activity logs and output data

**Script**:
> "We can see exactly what each activity did, how long it took, and what data it produced. This level of observability is critical for debugging and monitoring production workflows."

**Key Timing**: 3 minutes (should be at 11:00 mark)

**Recovery**: If execution hangs, cancel and run pre-tested example workflow

---

### Part 5: View Generated TypeScript Code (2 minutes)

**Objective**: Show code generation quality and transparency

**Script**:
> "One of the most powerful features is that everything we just did visually is compiled to production-ready TypeScript code. Let me show you."

**Actions**:
1. Click "View Code" button in workflow toolbar
2. Show code preview dialog with tabs:
   - **Workflow** tab (select this first)
   - Activities tab
   - Worker tab
   - package.json tab
   - tsconfig.json tab

**Script**:
> "This is the actual TypeScript code that's running in Temporal. Notice:
> - Proper imports from @temporalio/workflow
> - Type-safe activity definitions
> - Our retry policies translated to Temporal's RetryPolicy objects
> - Clean, readable code with comments explaining each step"

**Actions**:
3. Scroll through workflow.ts showing:
   - Activity proxy with typed interfaces
   - Sequential execution logic
   - Retry policy configuration
   - Error handling

**Script**:
> "This isn't pseudo-code or a template - this is production-grade TypeScript that you could deploy directly. You can also copy this code, customize it further, and run it outside the workflow builder if needed."

**Actions**:
4. Click "Activities" tab
5. Show activity stubs with TODO comments for implementation
6. Click "package.json" tab
7. Show proper Temporal dependencies

**Script**:
> "The system generates a complete, deployable package with all dependencies, configuration, and code needed to run independently."

**Key Timing**: 2 minutes (should be at 13:00 mark)

**Recovery**: If code preview doesn't load, show pre-generated code file

---

### Part 6: Demonstrate Milestone 1 Capabilities (2 minutes)

**Objective**: Quick tour of example workflows showing variety

**Script**:
> "Let me quickly show you the variety of workflows you can build with Milestone 1."

**Actions**:
1. Navigate back to workflows list
2. Open "ETL Data Pipeline" example
3. Show 5-activity workflow with different retry policies

**Script**:
> "This is a more complex data pipeline with 5 activities, demonstrating:
> - Multiple retry strategies on different activities
> - Longer execution timeouts
> - Complex data transformation patterns"

**Actions**:
4. Click "View Code" to show generated complexity
5. Close and open "Order Fulfillment" workflow
6. Point out 4 activities with real-world e-commerce pattern

**Script**:
> "And here's an e-commerce order fulfillment workflow showing:
> - Payment processing
> - Inventory management
> - Shipping coordination
> - Transactional email
>
> These are production-ready patterns you can use immediately."

**Key Timing**: 2 minutes (should be at 15:00 mark)

---

## Closing and Value Summary (1 minute)

**Script**:
> "So to summarize what we've accomplished in Milestone 1:
>
> **6 Key Capabilities Delivered:**
> 1. ✅ Visual workflow creation with drag-and-drop
> 2. ✅ Activity configuration with timeouts and retry policies
> 3. ✅ One-click deployment with automated compilation
> 4. ✅ Real-time execution monitoring
> 5. ✅ Production-ready TypeScript code generation
> 6. ✅ Full observability into workflow execution
>
> **Real Value:**
> - We can now build 30-40% of our common workflows visually
> - No code required for linear orchestration patterns
> - Deployment time reduced from hours to seconds
> - Full transparency with generated code
>
> This is just the beginning. Milestone 2 will add conditionals and decision trees, Milestone 3 adds AI self-healing, and by Milestone 5 we'll have the complete PackageBuilder system running from the UI.
>
> Questions?"

**Visual**: Show summary slide with success metrics (if available)

---

## Demo Tips and Best Practices

### Speaking Tips
- **Pace**: Speak slowly and clearly. Pause after each major action.
- **Energy**: Stay enthusiastic but not rushed
- **Eye contact**: Look at stakeholders, not just the screen
- **Explain, don't assume**: Explain what you're doing before doing it

### Technical Tips
- **Mouse movements**: Move slowly and deliberately
- **Zoom**: Keep browser at 100% or 110% zoom for visibility
- **Window size**: Full screen or nearly full screen
- **Tab management**: Close all other tabs to avoid distractions
- **Notifications**: Disable system notifications (Do Not Disturb mode)

### Recovery Strategies
- **If drag-and-drop fails**: "Let me use one of our pre-configured examples instead"
- **If deployment hangs**: "While this deploys, let me show you a workflow that's already deployed"
- **If execution fails**: "Let me try this other example that we tested earlier"
- **If everything breaks**: "Let me show you this recording of a successful run we did this morning"

### Timing Management
- **Ahead of schedule**: Spend more time on code generation and examples
- **Behind schedule**: Skip Part 6 (example workflows) and go straight to closing
- **Way behind**: Use backup recording

---

## Post-Demo Actions

### Immediate (within 5 minutes)
- [ ] Collect stakeholder questions and concerns
- [ ] Note any bugs or issues encountered during demo
- [ ] Thank attendees for their time

### Follow-up (within 24 hours)
- [ ] Send demo recording to all stakeholders
- [ ] Share success metrics document
- [ ] Provide access to demo environment for hands-on exploration
- [ ] Schedule individual follow-ups with interested stakeholders

### Analysis (within 48 hours)
- [ ] Review what went well and what needs improvement
- [ ] Document lessons learned for Milestone 2 demo
- [ ] Update demo script based on feedback

---

## Emergency Contacts

**Technical Issues**:
- DevOps Engineer: [Phone/Slack]
- Backend Engineer 1: [Phone/Slack]

**Demo Environment**:
- URL: https://demo.workflow-builder.com (or http://localhost:3010)
- Admin Access: [Credentials in password manager]
- Status Page: [If available]

**Backup Materials**:
- Recording Location: `/docs/demo/milestone-1-recording.mp4`
- Slides Location: `/docs/demo/milestone-1-slides.pdf`
- Code Examples: `/examples/milestone-1/`

---

**Demo Preparation Completed**: [Date]
**Last Rehearsal**: [Date]
**Rehearsal Success Rate**: [X/Y successful runs]
**Confidence Level**: [High/Medium/Low]

**Notes**:
[Add any specific notes about demo environment, known issues, or special considerations]
