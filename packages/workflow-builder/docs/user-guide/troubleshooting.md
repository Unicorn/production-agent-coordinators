# Troubleshooting Guide

Quick solutions to common issues you may encounter while using Workflow Builder.

## Quick Diagnostics

Before diving into specific issues, try these quick diagnostic steps:

### 1. The "Refresh First" Rule

Many issues resolve with a simple refresh:
1. Save your work (if possible)
2. Refresh the browser page (`Ctrl/Cmd + R`)
3. Try the action again

### 2. Check Your Internet Connection

Network issues cause many problems:
```bash
# Try pinging Google
ping google.com

# Or check if you can load other websites
```

### 3. Clear Browser Cache

Sometimes cached data causes issues:
1. Open browser settings
2. Clear cache and cookies
3. Refresh the page
4. Log in again

### 4. Check System Status

Before troubleshooting deeply:
- Check if Temporal is running: http://localhost:8233
- Check if the app is accessible: http://localhost:3010
- Look for system maintenance messages

## Common Issues by Feature

### Workflow Canvas Issues

#### Canvas Won't Load / Blank Canvas

**Symptoms:**
- Canvas area is blank
- Nodes don't appear
- Loading spinner forever

**Solutions:**
1. **Refresh the page**
2. **Check browser console** for errors:
   - Press F12 to open developer tools
   - Look for red error messages
3. **Try different browser** (Chrome recommended)
4. **Check workflow exists**:
   - Go back to workflow list
   - Verify workflow is still there
   - Try opening a different workflow first

**Still not working?**
- Clear browser cache
- Disable browser extensions
- Try incognito/private mode

#### Can't Drag Nodes onto Canvas

**Symptoms:**
- Clicking and dragging doesn't work
- Nodes don't appear when dropped
- Cursor doesn't change during drag

**Solutions:**
1. **Ensure you're dragging from palette**, not clicking
2. **Check browser compatibility** - use Chrome or Firefox
3. **Try double-click** method instead:
   - Double-click node type in palette
   - Node appears on canvas automatically
4. **Disable browser zoom**:
   - Reset to 100% zoom (Ctrl/Cmd + 0)
5. **Check for JavaScript errors** in console

#### Can't Connect Nodes

**Symptoms:**
- Dragging from handle doesn't create connection
- Connection disappears immediately
- Red error indicator appears

**Common Causes:**

1. **Creating a Cycle**:
   - Can't connect nodes in a loop
   - Solution: Restructure workflow to avoid cycles
   - Or use Loop node for intentional loops

2. **Invalid Connection Type**:
   - Not all nodes can connect
   - Check if node types are compatible

3. **Node Already Has Input**:
   - Most nodes allow only one incoming connection
   - Delete existing connection first

**Solutions:**
- Read error message in Property Panel
- Verify connection is logically valid
- Try connecting different nodes to test

#### Workflow Won't Save / "Saving..." Never Completes

**Symptoms:**
- "Saving..." message stays forever
- Changes disappear after refresh
- No "Saved" confirmation

**Solutions:**
1. **Check internet connection**
2. **Try manual save**: Click Save button or Ctrl/Cmd + S
3. **Check for validation errors**:
   - Look for red nodes
   - Fix errors first, then save
4. **Check browser console** for network errors
5. **Wait 30 seconds** - large workflows take longer
6. **Try saving in smaller increments**:
   - Save after each major change
   - Don't make too many changes at once

**Emergency Backup:**
If you can't save and need to preserve work:
1. Click **View Code** button
2. Copy the generated code
3. Save to a text file
4. Report the issue to support

### Deployment Issues

#### "Build Workflow" Button Is Disabled

**Symptoms:**
- Can't click Build button
- Button appears grayed out

**Causes and Solutions:**

1. **Validation Errors Exist**:
   - Look for red nodes on canvas
   - Check toolbar for error indicator
   - Fix all validation errors
   - Button will enable automatically

2. **Build Already in Progress**:
   - Wait for current build to complete
   - Check for build modal

3. **Not Workflow Owner**:
   - Only project owner can deploy
   - Contact project owner

4. **Workflow is Locked**:
   - Someone else is editing
   - Wait for them to finish
   - Or ask them to close the editor

#### Build Fails: "Workflow must have a trigger node"

**Solution:**
1. Add a Trigger node to your workflow:
   - Find **Trigger** in Component Palette
   - Drag onto canvas
   - Should be the leftmost node
2. Connect trigger to your first activity
3. Try building again

#### Build Fails: "Activity must reference a component"

**Symptoms:**
- Build fails during validation
- Error mentions specific node

**Solution:**
1. Click on the activity node mentioned in error
2. In Property Panel, click **Select Component**
3. Choose a component from the list
4. Or create a new component if needed
5. Save and try building again

#### Build Fails: "Compilation error"

**Symptoms:**
- Build progresses past validation
- Fails during compilation phase

**Solutions:**
1. **Check error details** in build modal
2. **Review node configuration**:
   - Click on mentioned node
   - Check all fields are filled correctly
   - Verify timeout format (e.g., "30s", "5m")
3. **View generated code**:
   - Click **View Code** before building
   - Look for syntax issues
4. **Simplify workflow**:
   - Remove complex nodes temporarily
   - Build minimal version
   - Add nodes back one by one

#### Build Succeeds but Worker Won't Start

**Symptoms:**
- Build completes successfully
- Worker status shows "Stopped" (red dot)
- Can't execute workflow

**Solutions:**

1. **Check if Temporal is running**:
   ```bash
   # Open Temporal Web UI
   open http://localhost:8233

   # Or check Docker
   docker ps | grep temporal
   ```

2. **Start Temporal if stopped**:
   ```bash
   docker-compose up -d temporal
   ```

3. **Restart the worker**:
   - Go to Project detail page
   - Click **Worker** tab
   - Click **Stop Worker**
   - Wait 5 seconds
   - Click **Start Worker**

4. **Check worker logs**:
   ```bash
   docker logs workflow-builder-worker
   ```

5. **Verify task queue**:
   - Project Settings → Task Queue
   - Should be valid (no special characters)

### Execution Issues

#### "Execute" Button Is Disabled

**Causes and Solutions:**

1. **Workflow Not Deployed**:
   - Check status shows "Draft"
   - Click **Build Workflow** first
   - Wait for deployment to complete
   - Status should change to "Active"

2. **Worker Not Running**:
   - Check worker status (should be green dot)
   - Restart worker if needed
   - See "Worker Won't Start" section above

3. **Invalid Workflow**:
   - Even if deployed, workflow may have issues
   - Check for validation warnings
   - Try redeploying

#### Execution Starts but Immediately Fails

**Symptoms:**
- Execution shows as "Failed" within seconds
- First activity never starts

**Common Causes:**

1. **Worker Can't Find Workflow**:
   - Redeploy the workflow
   - Restart worker
   - Check Temporal registration

2. **Invalid Input Data**:
   - Check execution input is valid JSON
   - Verify required fields are present
   - Try with minimal/empty input first

3. **Component Not Found**:
   - Activity references non-existent component
   - Check all activities have valid components
   - Redeploy after fixing

**Debugging Steps:**
1. Click on the failed execution
2. Look for error message in execution details
3. Check which component failed
4. Fix the issue and retry

#### Execution Hangs / Stuck in "Running" State

**Symptoms:**
- Execution status stays "Running"
- No progress for many minutes
- Components show as "Running" but don't complete

**Possible Causes:**

1. **Timeout Too Short**:
   - Activity needs more time
   - Edit workflow
   - Increase timeout for slow activities
   - Redeploy

2. **Activity is Actually Running**:
   - Some activities take time (API calls, processing)
   - Check if duration is within expected range
   - Be patient for long-running activities

3. **Temporal Worker Issue**:
   - Worker might have crashed
   - Check worker status
   - Restart worker
   - Execution should resume or fail

4. **Infinite Loop** (rare):
   - Activity code has infinite loop
   - Will eventually timeout
   - Fix activity code

**Solutions:**
1. **Wait for timeout** - execution will fail eventually
2. **Cancel execution** (coming soon)
3. **Restart worker** - might unstick execution
4. **Check Temporal Web UI** for detailed status:
   - http://localhost:8233
   - Find execution
   - See current activity

#### Execution Fails with Timeout Error

**Symptoms:**
Error message:
```
Operation 'FetchData' timed out after 30000ms
```

**Solutions:**

1. **Increase Timeout**:
   - Edit workflow in canvas
   - Click on activity that timed out
   - Increase timeout value
   - Example: Change "30s" to "2m"
   - Redeploy workflow
   - Run new execution

2. **Optimize Activity**:
   - If timeout is already reasonable
   - Activity itself might be slow
   - Optimize the component code
   - Or break into smaller steps

3. **Check External Service**:
   - If calling external API
   - API might be slow or down
   - Check service status
   - Try again later

#### Execution Fails: "Activity not found"

**Error message:**
```
Activity 'FetchUserData' not found
```

**Causes and Solutions:**

1. **Component Name Changed**:
   - Activity node references old component name
   - Edit workflow
   - Update component reference
   - Redeploy

2. **Component Deleted**:
   - Component was deleted after workflow deployed
   - Restore component
   - Or select different component
   - Redeploy

3. **Worker Not Up to Date**:
   - Worker hasn't loaded latest components
   - Restart worker
   - Redeploy workflow

### Component and Activity Issues

#### Can't Create New Component

**Symptoms:**
- "New Component" button doesn't work
- Component creation form won't submit
- Error message appears

**Solutions:**
1. **Check required fields**:
   - Name is required
   - Type must be selected
   - Fix validation errors

2. **Name already exists**:
   - Component names must be unique
   - Try different name
   - Or edit existing component

3. **Permission issue**:
   - May not have permission to create
   - Check with project owner

#### Component Test Fails

**When testing a component individually:**

**Solutions:**
1. **Check test input** is valid JSON
2. **Verify component code** has no errors
3. **Check dependencies** are available
4. **Review error message** for specific issue
5. **Test with minimal input** first

### Performance Issues

#### App Is Slow / Laggy

**Symptoms:**
- Page takes long to load
- Canvas is sluggish
- Clicks delayed

**Solutions:**

1. **Too Many Browser Tabs**:
   - Close unused tabs
   - Restart browser

2. **Large Workflow**:
   - Workflow with 30+ nodes can be slow
   - Break into smaller workflows
   - Use child workflows

3. **Weak Internet**:
   - Check connection speed
   - Try different network
   - Use wired connection if possible

4. **Old Browser**:
   - Update to latest version
   - Chrome recommended

5. **Computer Resources**:
   - Close other applications
   - Restart computer
   - Check RAM usage

#### Canvas Zoom/Pan Is Jerky

**Solutions:**
1. **Disable browser zoom**: Set to 100%
2. **Reduce workflow size**: Fewer nodes
3. **Disable minimap**: Click minimap button to hide
4. **Try different browser**: Chrome has best performance
5. **Update graphics drivers** (if desktop)

## Environment Issues

### Temporal Not Running

**Symptoms:**
- Can't deploy workflows
- Worker won't start
- Temporal Web UI not accessible

**Check if Temporal is running:**
```bash
# Check Docker containers
docker ps | grep temporal

# Should see: temporal, temporal-ui, postgres
```

**Start Temporal:**
```bash
# Using Docker Compose
cd packages/workflow-builder
docker-compose up -d temporal

# Check it started successfully
docker logs temporal

# Open Web UI to verify
open http://localhost:8233
```

**Still not working:**
```bash
# Stop all
docker-compose down

# Remove volumes (caution: deletes data)
docker-compose down -v

# Start fresh
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Database Connection Issues

**Symptoms:**
- "Database error occurred" messages
- Can't load workflows
- Can't save changes

**Solutions:**

1. **Check Supabase is running**:
   - Verify connection URL
   - Check environment variables
   - Test connection

2. **Network issue**:
   - Check internet connection
   - Verify firewall settings
   - Try VPN if available

3. **Database is down**:
   - Check Supabase status page
   - Wait for service restoration
   - Contact support if persistent

4. **Quota exceeded**:
   - Check your plan limits
   - Upgrade if needed
   - Clean up old data

### Port Already in Use

**Error when starting app:**
```
Error: Port 3010 already in use
```

**Solutions:**

1. **Find what's using the port**:
   ```bash
   # On Mac/Linux
   lsof -i :3010

   # On Windows
   netstat -ano | findstr :3010
   ```

2. **Kill the process**:
   ```bash
   # On Mac/Linux (replace PID with actual process ID)
   kill -9 PID

   # On Windows
   taskkill /PID PID /F
   ```

3. **Use different port**:
   ```bash
   # In .env file
   PORT=3011
   ```

4. **Restart computer** (if unsure which process)

## Getting Help

If you can't resolve an issue:

### 1. Check Documentation

- [Common Errors Reference](../troubleshooting/common-errors.md) - Detailed error messages
- [Architecture Docs](../architecture/README.md) - System design
- [API Reference](../api/README.md) - API details

### 2. Check Browser Console

Critical for debugging:
1. Press `F12` to open Developer Tools
2. Click **Console** tab
3. Look for red error messages
4. Copy error text for support

### 3. Check Server Logs

For backend issues:
```bash
# Docker logs
docker-compose logs -f

# Specific service
docker logs workflow-builder-worker
docker logs temporal
```

### 4. Gather Information

Before contacting support, collect:
- What you were trying to do
- Exact error message
- Browser and OS version
- Steps to reproduce
- Screenshots if helpful
- Console errors
- Timestamp when issue occurred

### 5. Contact Support

With gathered information:
- Email: support@example.com
- Include all collected information
- Attach screenshots
- Mention any troubleshooting steps tried

## Preventive Measures

Avoid issues before they happen:

### Best Practices

1. **Save Frequently**:
   - Don't rely only on auto-save
   - Manual save after major changes
   - Workflow Builder has good auto-save but it's good practice

2. **Test Incrementally**:
   - Don't build huge workflows at once
   - Test after adding each section
   - Deploy and test frequently

3. **Use Descriptive Names**:
   - Clear workflow names
   - Descriptive node labels
   - Easier to debug issues

4. **Document Complex Logic**:
   - Add descriptions to nodes
   - Keep notes in separate file
   - Document unusual configurations

5. **Monitor Regularly**:
   - Check execution history daily
   - Review error rates weekly
   - Act on patterns quickly

6. **Keep System Updated**:
   - Update Docker images regularly
   - Update browser
   - Follow upgrade guides

7. **Backup Important Workflows**:
   - Export workflow definitions
   - Store in version control
   - Keep production backups

### Health Checks

Regular checks to prevent issues:

**Daily:**
- [ ] Check worker status is "Running"
- [ ] Review recent execution failures
- [ ] Verify no unusual error rates

**Weekly:**
- [ ] Review workflow statistics
- [ ] Check system logs for warnings
- [ ] Update components if needed
- [ ] Clean up old test workflows

**Monthly:**
- [ ] Review and archive old executions
- [ ] Update documentation
- [ ] Check for system updates
- [ ] Review retry policies and timeouts

## Common Error Messages Quick Reference

| Error Message | Quick Fix |
|---------------|-----------|
| "Workflow must have a trigger node" | Add a Trigger node |
| "Activity must reference a component" | Select component in Property Panel |
| "Operation timed out" | Increase timeout value |
| "Network request failed" | Check internet, retry |
| "Database error occurred" | Refresh page, check connection |
| "Worker is not running" | Restart worker |
| "Activity not found" | Redeploy workflow, restart worker |
| "Validation failed" | Fix errors shown in Property Panel |
| "Circular dependency detected" | Restructure workflow, remove cycle |
| "Duplicate node ID" | Delete and recreate node |

## Still Stuck?

If this guide didn't help:

1. **Search documentation** for specific error message
2. **Check example workflows** to see working patterns
3. **Try in demo environment** to isolate issue
4. **Ask a colleague** who has used the system
5. **Contact support** with detailed information

Remember: Most issues have simple solutions. Start with basics (refresh, check internet) before assuming complex problems.

## Related Resources

- **[Common Errors Reference](../troubleshooting/common-errors.md)** - Comprehensive error catalog
- **[Getting Started](getting-started.md)** - Basics if you're new
- **[Deployment Guide](deployment.md)** - Deployment-specific help
- **[Execution Monitoring](execution-monitoring.md)** - Execution troubleshooting
- **[Temporal Setup](../temporal-setup.md)** - Temporal configuration

Happy troubleshooting!
