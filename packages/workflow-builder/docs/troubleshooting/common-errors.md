# Common Errors and Troubleshooting Guide

This guide helps you understand and resolve common errors in the Workflow Builder system.

## Table of Contents

1. [Validation Errors](#validation-errors)
2. [Compilation Errors](#compilation-errors)
3. [Execution Errors](#execution-errors)
4. [Timeout Errors](#timeout-errors)
5. [Network Errors](#network-errors)
6. [Database Errors](#database-errors)
7. [Authorization Errors](#authorization-errors)

---

## Validation Errors

### Error: "Invalid value for [field]"

**Cause:** The input provided for a specific field doesn't meet the validation requirements.

**Common Examples:**
- Workflow name contains invalid characters
- Required field is empty
- Value exceeds maximum length

**Solutions:**
1. Check that all required fields are filled
2. Ensure values match the expected format
3. Review field-specific requirements in the error message
4. For workflow names, use only letters, numbers, and hyphens

**Example:**
```
Error: Invalid value for kebabName: must contain only lowercase letters,
numbers, and hyphens

Solution: Change "My Workflow!" to "my-workflow"
```

---

### Error: "Duplicate node ID: [id]"

**Cause:** Two or more nodes in the workflow have the same ID.

**Solutions:**
1. Remove duplicate nodes from the workflow
2. Ensure each node has a unique identifier
3. If copying nodes, the system should auto-generate new IDs

**Prevention:**
- Use the workflow builder UI to add nodes (automatically generates unique IDs)
- Avoid manually editing workflow JSON unless necessary

---

### Error: "Workflow must have a trigger/start node"

**Cause:** The workflow has no entry point (trigger or API endpoint node).

**Solutions:**
1. Add a Trigger node to start the workflow
2. Add an API Endpoint node if workflow should be triggered by HTTP requests
3. Ensure the start node has no incoming connections

**Example Workflow Structure:**
```
[Trigger Node] → [Activity Node] → [End Node]
```

---

### Error: "[node] must reference a component"

**Cause:** Activity or Agent node doesn't have a component assigned.

**Solutions:**
1. Open the node configuration panel
2. Select a component from the component library
3. Ensure the component is published and available
4. Create a new component if needed

**Steps:**
1. Click on the node
2. In the properties panel, click "Select Component"
3. Choose from available components
4. Save the workflow

---

## Compilation Errors

### Error: "Compilation failed in node [nodeId]"

**Cause:** The compiler cannot generate valid code from the workflow definition.

**Common Causes:**
- Missing required node configuration
- Invalid node connections
- Referenced component doesn't exist
- Circular dependencies without loop nodes

**Solutions:**
1. Check the specific node mentioned in the error
2. Verify all required fields are configured
3. Ensure connections are valid
4. Review the compilation phase in error details

**Debugging Steps:**
1. Open workflow in builder
2. Locate the problematic node (highlighted in red)
3. Check node configuration
4. Verify incoming and outgoing connections
5. Test with a simpler workflow first

---

### Error: "Signal node must have a signal name"

**Cause:** Signal node is missing the required signal name configuration.

**Solutions:**
1. Open signal node properties
2. Enter a descriptive signal name (e.g., "userApproval", "dataReady")
3. Use camelCase for signal names
4. Ensure signal name is unique within the workflow

---

### Error: "Detected circular dependency: [path]"

**Cause:** Workflow has nodes that reference each other in a loop without using a Loop node.

**This is a WARNING, not an error** - workflow may still work but review the logic.

**Solutions:**
1. If loop is intentional, use a Loop node
2. If unintentional, restructure the workflow
3. Break the cycle by removing one connection
4. Use conditional nodes to control flow

**Example Fix:**
```
❌ Bad: Activity A → Activity B → Activity A (circular)
✅ Good: Activity A → Condition → Activity B
                              ↓
                            [End]
```

---

## Execution Errors

### Error: "Workflow execution failed at step [stepName]"

**Cause:** Workflow started successfully but failed during execution of a specific step.

**Solutions:**
1. Check the execution logs for detailed error message
2. Verify the activity/component at that step is working
3. Check input data matches expected format
4. Ensure external services are available
5. Verify Temporal worker is running

**Debugging:**
```bash
# Check execution details
View execution in UI → Click on failed execution → Review step details

# Check worker logs
docker logs temporal-worker

# Test component individually
Run component test in component builder
```

---

### Error: "Temporal worker is not running"

**Cause:** The Temporal worker service for your project is not active.

**Solutions:**
1. Start the worker service:
   ```bash
   docker-compose up temporal-worker
   ```
2. Check worker service logs for errors
3. Verify project task queue is correctly configured
4. Ensure Temporal server is running

**Health Check:**
```bash
# Check if Temporal server is running
curl http://localhost:7233/health

# Check if worker is registered
temporal workflow list --namespace default
```

---

### Error: "Activity [name] not found"

**Cause:** Workflow references an activity that doesn't exist or isn't deployed.

**Solutions:**
1. Verify the activity component is published
2. Check the component name matches exactly
3. Redeploy the workflow
4. Restart the Temporal worker to load new activities

**Steps:**
1. Go to Components page
2. Find the activity component
3. Ensure status is "Published"
4. Note the exact component name
5. Update workflow node to use correct name

---

## Timeout Errors

### Error: "Operation [name] timed out after [ms]ms"

**Cause:** An operation exceeded its configured timeout limit.

**Common Causes:**
- External API is slow to respond
- Large data processing taking too long
- Network connectivity issues
- Database query too slow

**Solutions:**
1. **Increase timeout configuration:**
   ```typescript
   // In workflow settings or node config
   timeout: "5m"  // Change from "30s" to "5m"
   ```

2. **Optimize the operation:**
   - Reduce data volume being processed
   - Add pagination for large datasets
   - Optimize database queries
   - Use caching where appropriate

3. **Break into smaller steps:**
   - Split long-running operations
   - Use child workflows for complex tasks
   - Process items in batches

**Recommended Timeouts:**
- API calls: 30s - 2m
- Data processing: 5m - 30m
- File operations: 1m - 10m
- Database queries: 10s - 1m

---

### Error: "Workflow execution timed out"

**Cause:** The entire workflow execution exceeded the workflow-level timeout.

**Solutions:**
1. Increase workflow timeout in settings
2. Optimize slow activities
3. Consider using child workflows for long tasks
4. Review workflow complexity

**Configuration:**
```typescript
// In workflow settings
settings: {
  timeout: "1h",  // Increase as needed
  retryPolicy: {
    strategy: "exponential-backoff"
  }
}
```

---

## Network Errors

### Error: "Network request to [url] failed"

**Cause:** HTTP request to external service failed.

**Common Causes:**
- Internet connectivity issues
- External service is down
- Invalid URL or endpoint
- Firewall blocking request
- SSL/TLS certificate errors

**Solutions:**
1. **Check internet connection:**
   ```bash
   ping google.com
   curl https://api.example.com/health
   ```

2. **Verify service availability:**
   - Check service status page
   - Try accessing URL in browser
   - Verify API credentials

3. **Review request configuration:**
   - Check URL is correct
   - Verify authentication headers
   - Ensure content-type is set
   - Check for CORS issues

4. **Retry the operation:**
   - Click "Retry" button in UI
   - Configure retry policy for automatic retries

**Example Retry Configuration:**
```typescript
retryPolicy: {
  strategy: "exponential-backoff",
  maxAttempts: 5,
  initialInterval: "1s",
  maxInterval: "30s",
  backoffCoefficient: 2.0
}
```

---

### Error: "Failed to connect to service"

**Cause:** Cannot establish connection to remote service.

**Solutions:**
1. Check network connectivity
2. Verify service URL is correct
3. Check firewall/security group settings
4. Ensure service is running and accessible
5. Try from different network (VPN issues)

**Diagnostic Commands:**
```bash
# Test DNS resolution
nslookup api.example.com

# Test connectivity
curl -v https://api.example.com

# Check if port is open
telnet api.example.com 443
```

---

## Database Errors

### Error: "A database error occurred"

**Cause:** Database operation failed. Specific details are logged server-side for security.

**What You See:**
- Generic error message (doesn't expose database details)
- Suggestion to try again or contact support

**Solutions:**
1. **Immediate Actions:**
   - Wait a moment and try again
   - Refresh the page
   - Check internet connection

2. **If persists:**
   - Contact support with error timestamp
   - Check system status page
   - Try different browser/device

**For Administrators:**
- Check server logs for actual database error
- Common causes:
  - Connection pool exhausted
  - Deadlock or lock timeout
  - Constraint violation
  - Out of storage space
  - Network partition

---

### Error: "[Resource] not found"

**Cause:** Requested database record doesn't exist.

**Common Scenarios:**
- Resource was deleted
- Invalid ID provided
- No permission to view resource
- Database sync issue

**Solutions:**
1. Verify the resource ID is correct
2. Check if resource was deleted
3. Ensure you have permission to access it
4. Try refreshing the list page
5. Check filters aren't hiding the resource

---

## Authorization Errors

### Error: "You don't have permission to access this [resource]"

**Cause:** Attempting to access a resource you don't have permission for.

**Common Causes:**
- Not the owner of the resource
- Resource is private
- Sharing permissions not granted
- Session expired

**Solutions:**
1. **Verify ownership:**
   - Check if you created this resource
   - Review resource details

2. **Request access:**
   - Contact the resource owner
   - Ask for sharing permissions

3. **Check visibility:**
   - Ensure resource visibility allows your access level
   - Private resources only accessible to owner

4. **Session issues:**
   - Log out and log back in
   - Clear browser cache/cookies
   - Check if account is still active

---

### Error: "Not authorized to [action] this [resource]"

**Cause:** Attempting an action you don't have permission for.

**Common Examples:**
- Editing someone else's workflow
- Deleting a public component
- Deploying a shared project

**Solutions:**
1. Verify you're the resource owner
2. Check resource permissions
3. Request appropriate access level
4. Create your own copy if allowed

**Permission Levels:**
- **Owner:** Full access (edit, delete, share)
- **Editor:** Can modify but not delete
- **Viewer:** Read-only access
- **None:** No access

---

## General Troubleshooting Tips

### When You Get an Error:

1. **Read the error message carefully**
   - Note the specific field or node mentioned
   - Look for suggested solutions
   - Copy error code for reference

2. **Check the suggestions**
   - Most errors include recovery suggestions
   - Follow the steps in order
   - Don't skip verification steps

3. **Use the retry button**
   - Many errors are transient
   - Network issues often resolve on retry
   - Rate limits reset after waiting

4. **Review recent changes**
   - What did you change before the error?
   - Try reverting the last change
   - Test in smaller increments

5. **Check system status**
   - Is the system under maintenance?
   - Are other users reporting issues?
   - Check status page or announcements

6. **Collect information**
   - Error message and code
   - Timestamp when it occurred
   - Steps to reproduce
   - Browser and OS version

### Getting Help:

1. **Search this documentation**
   - Use the table of contents
   - Search for error code
   - Check related sections

2. **Check the FAQ**
   - Common questions answered
   - Known issues listed

3. **Contact Support**
   - Include error code and timestamp
   - Describe what you were doing
   - Attach screenshots if helpful
   - Mention steps you've tried

---

## Error Code Reference

| Code | Meaning | Typical Solution |
|------|---------|------------------|
| `VALIDATION_ERROR` | Input validation failed | Fix input according to validation rules |
| `COMPILATION_ERROR` | Workflow cannot be compiled | Check node configuration and connections |
| `EXECUTION_ERROR` | Workflow execution failed | Review execution logs and fix failing step |
| `TIMEOUT_ERROR` | Operation exceeded timeout | Increase timeout or optimize operation |
| `NETWORK_ERROR` | Network request failed | Check connectivity and retry |
| `DATABASE_ERROR` | Database operation failed | Wait and retry, contact support if persists |
| `AUTHORIZATION_ERROR` | Permission denied | Verify permissions or request access |
| `NOT_FOUND` | Resource doesn't exist | Check ID and permissions |
| `CONFLICT` | Resource conflict | Resolve conflict or use different name |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry later |

---

## Best Practices to Avoid Errors

### Workflow Design:
- ✅ Always include a start node (trigger or API endpoint)
- ✅ Add end nodes to mark completion
- ✅ Use descriptive labels for all nodes
- ✅ Configure retry policies for external calls
- ✅ Set appropriate timeouts
- ❌ Avoid circular dependencies without loop nodes
- ❌ Don't leave nodes disconnected
- ❌ Don't skip required configurations

### Testing:
- ✅ Test workflows before deploying
- ✅ Test with sample data first
- ✅ Verify all components individually
- ✅ Check execution logs for warnings
- ❌ Don't deploy untested workflows to production
- ❌ Don't ignore validation warnings

### Operations:
- ✅ Monitor execution statistics
- ✅ Review failed executions regularly
- ✅ Keep components up to date
- ✅ Use semantic versioning
- ❌ Don't ignore repeated failures
- ❌ Don't disable retries without reason

---

## Additional Resources

- [Workflow Builder Guide](../user-guide/workflow-builder.md)
- [Component Development](../developer-guide/components.md)
- [API Reference](../api-reference/README.md)
- [Temporal Documentation](https://docs.temporal.io)

---

**Last Updated:** 2025-01-19

For additional help, contact support at support@example.com or visit our help center.
