# Workflow Builder POC - Testing Checklist

**Date:** 2025-11-14  
**Status:** Ready for Testing  
**URL:** http://localhost:3010

---

## 🧪 Test Cases

### ✅ Authentication & Authorization

- [ ] Sign up with new account
- [ ] Sign out
- [ ] Sign in with existing account
- [ ] Redirected to login when accessing protected routes while signed out
- [ ] Can access dashboard when signed in

### ✅ Dashboard

- [ ] Dashboard loads successfully
- [ ] Welcome message displays user's name
- [ ] Count cards show correct numbers
- [ ] Navigation sidebar displays all links
- [ ] Header shows user info

### ✅ Component Management

- [ ] Navigate to Components page
- [ ] View empty state (if first time)
- [ ] Click "New Component"
- [ ] Fill out component form with all fields
- [ ] Create a component
- [ ] Component appears in list
- [ ] View component details
- [ ] Edit component (if implemented)
- [ ] Filter/search components (if implemented)

**Test Data:**
```yaml
Name: testActivity
Display Name: Test Activity
Type: activity
Version: 1.0.0
Capabilities: test-capability
Visibility: public
Description: A test activity for POC validation
```

### ✅ Agent Prompt Management

- [ ] Navigate to Agents page
- [ ] View empty state (if first time)
- [ ] Click "New Agent Prompt"
- [ ] Fill out agent prompt form
- [ ] Write multi-line markdown prompt
- [ ] Preview markdown rendering
- [ ] Create agent prompt
- [ ] Agent prompt appears in list
- [ ] View agent prompt details
- [ ] Edit agent prompt (if implemented)

**Test Data:**
```yaml
Name: testAgent
Display Name: Test Agent
Version: 1.0.0
Capabilities: reasoning
Visibility: public
Prompt: |
  You are a helpful test agent.
  
  ## Task
  Analyze the input and provide a response.
  
  ## Output Format
  Provide a JSON response with your analysis.
```

### ✅ Workflow Management

- [ ] Navigate to Workflows page
- [ ] View empty state (if first time)
- [ ] Click "New Workflow"
- [ ] Fill out workflow form
- [ ] Select task queue from dropdown
- [ ] Create workflow
- [ ] Redirected to workflow editor

**Test Data:**
```yaml
Name: test-workflow
Display Name: Test Workflow
Description: My first workflow for testing
Task Queue: default-queue
```

### ✅ Visual Workflow Editor

- [ ] Canvas loads successfully
- [ ] Component palette visible on left
- [ ] Property panel visible on right
- [ ] Toolbar visible at top
- [ ] Zoom controls work
- [ ] Pan/drag canvas works

#### Drag & Drop
- [ ] Drag component from palette onto canvas
- [ ] Component node appears on canvas
- [ ] Multiple components can be added
- [ ] Components can be repositioned

#### Node Connections
- [ ] Click and drag from node handle
- [ ] Connection line follows mouse
- [ ] Drop on another node handle
- [ ] Edge created between nodes
- [ ] Edge appears in workflow definition

#### Node Configuration
- [ ] Click on a node to select it
- [ ] Property panel shows node details
- [ ] Edit node label
- [ ] Edit node configuration
- [ ] Changes reflect in node immediately

#### Workflow Actions
- [ ] Click "Save" button
- [ ] Success message appears
- [ ] Auto-save triggers after 2 seconds
- [ ] Click "Deploy" button
- [ ] Deploy confirmation/message

### ✅ Data Persistence

- [ ] Refresh page - workflow still loads
- [ ] Sign out and sign in - data persists
- [ ] Create workflow, navigate away, come back - workflow exists
- [ ] Edit workflow, save, reload - changes persist

### ✅ Task Queue Management

- [ ] Task queues load in dropdowns
- [ ] Default queue appears
- [ ] Can select different queues (if multiple exist)
- [ ] Queue selection saves with workflow

### ✅ User Roles & Permissions (if implemented)

- [ ] Public components visible to all users
- [ ] Private components only visible to creator
- [ ] Can create public components
- [ ] Can create private components
- [ ] Permission checks work correctly

### ✅ Error Handling

- [ ] Invalid form submission shows errors
- [ ] Network errors display user-friendly messages
- [ ] 404 pages work for invalid routes
- [ ] Validation errors highlight fields
- [ ] Server errors don't crash app

### ✅ UI/UX

- [ ] Tamagui components render correctly
- [ ] Responsive layout works (resize browser)
- [ ] Loading states show for async operations
- [ ] Buttons have hover states
- [ ] Forms have clear labels
- [ ] Success/error messages are clear

---

## 🐛 Known Issues

Document any issues found during testing:

1. **Issue**: 
   - **Severity**: High/Medium/Low
   - **Description**: 
   - **Steps to Reproduce**: 
   - **Expected**: 
   - **Actual**: 

---

## 🎯 Test Results

### Overall Status: ⏳ In Progress / ✅ Passed / ❌ Failed

**Tested By:**  
**Test Date:**  
**Test Environment:** Local Development

### Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X

### Critical Issues
- None / List issues

### Notes
Add any additional observations or notes here.

---

## 📸 Screenshots

Consider taking screenshots of:
- [ ] Dashboard view
- [ ] Component list
- [ ] Component creation form
- [ ] Agent prompt editor
- [ ] Workflow editor canvas
- [ ] Workflow with multiple nodes
- [ ] Property panel configuration

---

## 🚀 Next Steps After POC Validation

Once POC is validated:

1. **Phase 4**: Worker Generation & Temporal Integration
   - Implement workflow compiler (JSON → Temporal TypeScript)
   - Create dynamic worker that loads from database
   - Integrate Temporal client for workflow execution
   - Add deployment pipeline

2. **Phase 5**: Execution Monitoring
   - Real-time execution status
   - Activity logs and traces
   - Error reporting and debugging
   - Performance metrics

3. **Polish & Improvements**
   - Enhanced UI components
   - Better error messages
   - Keyboard shortcuts
   - Undo/redo functionality
   - Component search and filtering

4. **Deployment**
   - Deploy to Vercel
   - Configure production Supabase
   - Set up CI/CD pipeline
   - Add monitoring and analytics

---

## 📚 Resources

- **Setup Guide**: SETUP.md
- **Quick Start**: QUICK_START.md
- **Project Summary**: PROJECT_SUMMARY.md
- **Design Doc**: ../../docs/plans/2025-11-14-workflow-builder-system-design.md
- **Agent Info**: AGENTINFO.md

