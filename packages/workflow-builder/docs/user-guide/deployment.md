# Workflow Deployment Guide

Complete guide to deploying workflows from visual designs to executable code running on Temporal.

## What is Deployment?

Deployment transforms your visual workflow design into executable TypeScript code that runs on Temporal. The deployment process:

1. **Validates** your workflow definition
2. **Compiles** it to TypeScript code
3. **Stores** the generated code in the database
4. **Starts** a Temporal worker for your project (if not running)
5. **Registers** the workflow with Temporal
6. **Activates** the workflow for execution

After deployment, your workflow is ready to execute whenever triggered.

## Prerequisites

Before deploying a workflow, ensure:

- Workflow is designed in the visual canvas
- All nodes are properly configured
- No validation errors (check Property Panel)
- Project exists and is properly configured
- You have permission to deploy (project owner)

**Optional but Recommended:**
- Test workflow design with a colleague
- Review generated code (View Code button)
- Check that required components are published

## Deployment Process Overview

```
Visual Design → Validation → Compilation → Storage → Worker Start → Registration → Active
```

**Timeline**: Typically 5-15 seconds for most workflows

## Step-by-Step Deployment

### Step 1: Validate Your Workflow

Before deploying, verify your workflow is valid.

1. Open your workflow in the visual editor
2. Check the toolbar for validation status:
   - Green checkmark = Valid
   - Red X = Has errors
3. If errors, click on invalid nodes to see details in Property Panel
4. Fix all validation errors

**Common Validation Errors:**
- Missing trigger node
- Activity without component
- Disconnected nodes
- Circular connections
- Invalid configuration

### Step 2: Preview Generated Code (Optional)

It's good practice to review the code that will be generated:

1. Click **View Code** button in toolbar
2. A modal opens with tabs:
   - **Workflow**: Main workflow code
   - **Activities**: Activity definitions
   - **Worker**: Worker configuration
   - **Package**: package.json
3. Review the TypeScript code
4. Look for any obvious issues
5. Click **Close** when done

**What to look for:**
- Correct activity names and order
- Proper timeout configurations
- Expected retry policies
- Valid TypeScript syntax

### Step 3: Build the Workflow

Now deploy your workflow:

1. Click **Build Workflow** button in toolbar
2. Build modal appears showing progress
3. Watch the build steps:

   **Phase 1: Validation (1-2 seconds)**
   ```
   ✓ Validating workflow definition...
   ✓ Checking node connections...
   ✓ Verifying component references...
   ```

   **Phase 2: Compilation (3-5 seconds)**
   ```
   ✓ Compiling workflow to TypeScript...
   ✓ Generating activity code...
   ✓ Creating worker configuration...
   ```

   **Phase 3: Storage (1 second)**
   ```
   ✓ Storing compiled code in database...
   ```

   **Phase 4: Worker Management (2-5 seconds)**
   ```
   ✓ Checking worker status...
   ✓ Starting worker (if needed)...
   ✓ Registering workflow with Temporal...
   ```

4. Wait for success message: "Workflow built successfully!"

**Progress Indicators:**
- Spinning icon = Step in progress
- Green checkmark = Step completed
- Red X = Step failed (see error details)

### Step 4: Verify Deployment

After successful build, verify deployment:

#### Check Workflow Status

1. Look at the toolbar **Status** badge:
   - Should show: **Active** (green)
   - If shows **Draft**, build wasn't successful

2. Check **Worker Status** indicator:
   - Should show: **Running** (green dot)
   - Hover to see worker details

#### Check Temporal Registration

If you have access to Temporal Web UI:

1. Open Temporal Web UI: http://localhost:8233
2. Navigate to **Workflows** section
3. Look for your workflow name in the list
4. Should show as registered and ready

#### Test Execution (Recommended)

The best verification is to test execution:

1. Click **Execute** button in toolbar
2. Provide test input (if needed)
3. Click **Start Execution**
4. Verify workflow starts and runs successfully

### Step 5: Monitor Worker Status

After deployment, keep an eye on worker status:

1. Worker status shows in toolbar (green/red dot)
2. Click on status to see details:
   - Worker ID
   - Task queue
   - Number of registered workflows
   - Worker health status

**Healthy Worker:**
- Green status indicator
- "Running" state
- Responds to health checks

**Unhealthy Worker:**
- Red status indicator
- "Stopped" or "Error" state
- Check logs for issues

## Understanding Build Output

### Success Messages

**Build Successful:**
```
✓ Workflow built successfully!
  - Status: Active
  - Worker: Running
  - Registered workflows: 1
```

**What this means:**
- Your workflow is deployed
- Ready to accept executions
- Worker is processing task queue

### Error Messages

**Validation Failed:**
```
✗ Validation failed: Workflow must have a trigger node
```
**Fix:** Add a trigger node to your workflow

**Compilation Failed:**
```
✗ Compilation error in node 'activity-1': Component 'FetchUser' not found
```
**Fix:** Select a valid component for the activity node

**Worker Start Failed:**
```
✗ Failed to start worker: Temporal server not reachable
```
**Fix:** Ensure Temporal server is running (see Troubleshooting)

**Registration Failed:**
```
✗ Failed to register workflow: Task queue 'my-queue' is invalid
```
**Fix:** Check project task queue configuration

## Deployment Strategies

### Development Deployment

For testing and iteration:

1. Deploy frequently as you make changes
2. Use test data for executions
3. Monitor execution results
4. Iterate based on feedback

**Best Practice:**
- Test each major change before moving to production
- Keep a test project separate from production

### Production Deployment

For production workflows:

1. **Test Thoroughly**: Deploy to staging first
2. **Review Code**: Check generated code for issues
3. **Backup**: Keep previous version available
4. **Deploy**: Build the production workflow
5. **Monitor**: Watch first few executions closely
6. **Rollback Plan**: Know how to revert if needed

**Pre-Production Checklist:**
- [ ] All components tested individually
- [ ] Workflow tested end-to-end in staging
- [ ] Error handling verified
- [ ] Timeout values appropriate for production
- [ ] Retry policies configured correctly
- [ ] Monitoring and alerts set up
- [ ] Rollback plan documented

## Redeployment

When you need to redeploy an already deployed workflow:

### When to Redeploy

Redeploy when you:
- Change workflow structure (add/remove nodes)
- Modify node configuration (timeouts, retries)
- Update component references
- Fix bugs in workflow logic

### Redeployment Process

1. Make changes in visual editor
2. Save changes (auto-save or manual)
3. Click **Build Workflow** again
4. System recompiles and redeploys
5. Worker automatically loads new version

**Important:**
- Running executions continue with old version
- New executions use new version
- No downtime during redeployment

### Versioning

Currently, workflows are not versioned. Redeployment replaces the previous version.

**Coming Soon:**
- Workflow versioning
- Version history
- Rollback to previous versions

## Worker Management

### Worker Lifecycle

Workers are automatically managed:

1. **Auto-Start**: Worker starts on first workflow deployment in a project
2. **Auto-Register**: New workflows automatically registered
3. **Health Monitoring**: System monitors worker health
4. **Auto-Restart**: Worker restarts if it crashes

### Manual Worker Control

If needed, you can manually control workers:

**Stop Worker:**
1. Go to Project detail page
2. Click **Worker** tab
3. Click **Stop Worker** button

**Start Worker:**
1. Go to Project detail page
2. Click **Worker** tab
3. Click **Start Worker** button

**Restart Worker:**
1. Stop the worker
2. Wait 5 seconds
3. Start the worker again

**When to manually restart:**
- Worker shows unhealthy status
- Workflows not executing
- After major system changes
- Troubleshooting deployment issues

### Worker Logs

To debug worker issues, check worker logs:

**Via UI** (coming soon):
- Project → Worker → View Logs

**Via Command Line:**
```bash
# If running with Docker
docker logs workflow-builder-worker

# Check Temporal logs
docker logs temporal
```

## Deployment Best Practices

### Before Deployment

1. **Validate Completely**: Fix all validation errors
2. **Test Components**: Ensure all components work individually
3. **Review Configuration**: Double-check timeouts and retry policies
4. **Preview Code**: Look at generated TypeScript
5. **Plan Testing**: Know how you'll test after deployment

### During Deployment

1. **Watch Progress**: Monitor build steps for errors
2. **Don't Close Browser**: Wait for completion
3. **Note Any Warnings**: Even if build succeeds, warnings matter
4. **Verify Success**: Check status indicators

### After Deployment

1. **Test Immediately**: Run a test execution
2. **Monitor First Runs**: Watch first 3-5 executions closely
3. **Check Logs**: Look for any errors or warnings
4. **Verify Performance**: Ensure executions complete in expected time
5. **Document**: Note any issues or observations

### Deployment Checklist

Use this checklist for important deployments:

#### Pre-Deployment
- [ ] Workflow validated successfully
- [ ] All nodes configured properly
- [ ] Components tested individually
- [ ] Generated code reviewed
- [ ] Test plan prepared
- [ ] Stakeholders notified (if production)

#### Deployment
- [ ] Build initiated
- [ ] All build steps completed successfully
- [ ] Workflow status shows "Active"
- [ ] Worker status shows "Running"
- [ ] No errors in build output

#### Post-Deployment
- [ ] Test execution successful
- [ ] Execution completed as expected
- [ ] No errors in execution logs
- [ ] Performance acceptable
- [ ] Monitoring alerts working
- [ ] Documentation updated

## Troubleshooting Deployment

### Build Fails - Validation Error

**Symptoms:**
- Build fails immediately
- "Validation failed" error message
- Specific nodes highlighted in red

**Solution:**
1. Click on invalid nodes
2. Read error message in Property Panel
3. Fix the issue (missing component, invalid config, etc.)
4. Try building again

### Build Fails - Compilation Error

**Symptoms:**
- Build progresses past validation
- Fails during compilation phase
- Error mentions specific node or code issue

**Solution:**
1. Check the error details
2. Review the problematic node configuration
3. Try viewing generated code to see the issue
4. Fix configuration and rebuild

**Common Causes:**
- Invalid component reference
- Circular dependency
- Unsupported configuration

### Build Succeeds but Worker Won't Start

**Symptoms:**
- Build completes successfully
- Worker status shows "Stopped" or "Error"
- Workflow can't execute

**Solution:**

1. **Check Temporal Server:**
   ```bash
   # Check if Temporal is running
   docker ps | grep temporal

   # If not running, start it
   docker-compose up -d temporal
   ```

2. **Check Task Queue:**
   - Go to Project settings
   - Verify task queue name is valid
   - Check for special characters or spaces

3. **Check Worker Logs:**
   ```bash
   docker logs workflow-builder-worker
   ```

4. **Restart Worker:**
   - Project → Worker → Stop Worker
   - Wait 5 seconds
   - Project → Worker → Start Worker

### Build Succeeds but Workflow Not Registered

**Symptoms:**
- Build completes
- Worker shows "Running"
- But workflow not in Temporal Web UI

**Solution:**
1. Wait 30 seconds (registration can take time)
2. Refresh Temporal Web UI
3. Check worker logs for registration errors
4. Try redeploying the workflow
5. Restart the worker if issue persists

### Deployment Hangs

**Symptoms:**
- Build modal stuck on one step
- Progress indicator spinning indefinitely
- No error message

**Solution:**
1. Wait 2 minutes (some steps can be slow)
2. If still hanging, check browser console for errors
3. Check internet connection
4. Refresh the page and try again
5. Check system status (server might be down)

### "Build Workflow" Button Disabled

**Symptoms:**
- Can't click Build Workflow button
- Button appears grayed out

**Possible Causes:**
1. **Validation Errors**: Fix errors first
2. **Already Building**: Wait for current build to finish
3. **No Permission**: Must be project owner
4. **Workflow Locked**: Someone else editing

**Solution:**
1. Check for validation errors (toolbar)
2. Wait if build in progress
3. Verify you have permission
4. Try refreshing the page

## Advanced Deployment Topics

### Environment-Specific Deployments

For different environments (dev, staging, prod):

1. Create separate projects for each environment
2. Deploy same workflow to each project
3. Configure environment-specific variables
4. Test in dev/staging before production

**Coming Soon:**
- Environment variable support
- Deployment pipelines
- Automated promotion across environments

### Deployment Automation

**Current**: Manual deployment via UI

**Coming Soon:**
- API-based deployment
- CLI deployment tool
- CI/CD integration
- Automated testing before deployment

### Deployment Monitoring

Monitor deployment health:

1. **Immediate Checks**:
   - Build success rate
   - Worker status
   - First execution success

2. **Ongoing Monitoring**:
   - Execution success rate
   - Average execution duration
   - Error rates
   - Worker health

**See:** [Execution Monitoring Guide](execution-monitoring.md)

## Related Topics

- **[Workflow Canvas](workflow-canvas.md)** - Design workflows
- **[Execution Monitoring](execution-monitoring.md)** - Monitor deployed workflows
- **[Troubleshooting](troubleshooting.md)** - Common deployment issues
- **[Common Errors](../troubleshooting/common-errors.md)** - Error reference

## Quick Reference

### Deployment Commands

| Action | Steps |
|--------|-------|
| Deploy workflow | Edit workflow → Build Workflow |
| Redeploy | Edit workflow → Save → Build Workflow |
| View generated code | Edit workflow → View Code |
| Check status | Look at toolbar status badges |
| Restart worker | Project → Worker → Restart Worker |
| View worker logs | Command line: `docker logs workflow-builder-worker` |

### Status Indicators

| Indicator | Meaning | Action Needed |
|-----------|---------|---------------|
| Active (green) | Workflow deployed | None - ready to execute |
| Draft (gray) | Not deployed | Click Build Workflow |
| Error (red) | Deployment failed | Check error message, fix issue |
| Running (green dot) | Worker healthy | None |
| Stopped (red dot) | Worker not running | Restart worker |

## Need Help?

- See [Troubleshooting Guide](troubleshooting.md)
- Check [Common Errors](../troubleshooting/common-errors.md)
- Review [Temporal Setup](../temporal-setup.md)
- Contact support with deployment logs

Happy deploying!
