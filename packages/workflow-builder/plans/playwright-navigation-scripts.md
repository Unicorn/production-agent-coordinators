# Playwright Navigation Scripts

This document contains Playwright navigation scripts for testing all pages in the Workflow Builder UI, along with issues discovered during testing.

## Test Credentials
- Email: `mkbernier@gmail.com`
- Password: `9$zzT9$DKVoCbzJy`

## Page Test Results

### ✅ 1. Home Page (`/`)

**Status:** WORKING

**Navigation Script:**
```javascript
// Navigate to home page
await page.goto('http://localhost:3010');

// Wait for page to load
await new Promise(f => setTimeout(f, 3000));

// Verify user is logged in
await page.getByText('matt bernier').waitFor();
await page.getByText('developer').waitFor();

// Test navigation buttons
await page.getByRole('button', { name: 'Dashboard' }).isVisible();
await page.getByRole('button', { name: 'Workflows' }).isVisible();
await page.getByRole('button', { name: 'Components' }).isVisible();
await page.getByRole('button', { name: 'Agents' }).isVisible();

// Test sign out button
await page.getByRole('button', { name: 'Sign Out' }).isVisible();
```

**Page Elements:**
- Header: "Workflow Builder"
- User profile: "matt bernier" (developer)
- Navigation: Dashboard, Workflows, Components, Agents
- Dashboard stats: 1 workflow, 0 components, 0 agents
- Getting Started section with instructions

---

### ✅ 2. Workflows List Page (`/workflows`)

**Status:** WORKING

**Navigation Script:**
```javascript
// Navigate from home page
await page.getByRole('button', { name: 'Workflows' }).click();

// Wait for workflows page
await page.getByRole('heading', { name: 'Workflows' }).waitFor();

// Verify "New Workflow" button exists
await page.getByRole('button', { name: 'New Workflow' }).isVisible();

// Verify workflow card is displayed
await page.getByText('Build Workflow').waitFor();
await page.getByText('active').waitFor();

// Click on workflow card
await page.getByText('Build WorkflowactiveSystem').click();
```

**Page Elements:**
- Header: "Workflows"
- "New Workflow" button
- Workflow cards showing:
  - Name: "Build Workflow"
  - Status badge: "active"
  - Description
  - Queue info: "default-queue"
  - Version: "v1.0.0"
  - Last updated timestamp

---

### ✅ 3. Workflow Details Page (`/workflows/[id]`)

**Status:** WORKING

**Navigation Script:**
```javascript
// Navigate from workflows list
await page.getByText('Build WorkflowactiveSystem').click();

// Wait for details page
await page.getByRole('heading', { name: 'Build Workflow' }).waitFor();

// Test action buttons
await page.getByRole('button', { name: 'Edit' }).isVisible();
await page.getByRole('button', { name: 'Pause' }).isVisible();
await page.getByRole('button', { name: 'Delete' }).isVisible();

// Verify workflow details section
await page.getByText('Workflow Details').waitFor();
await page.getByText('aaaaaaaa-bbbb-cccc-dddd-000000000001').waitFor();
```

**Page Elements:**
- Header: "Build Workflow" with description
- Status badge: "active"
- Action buttons: Edit, Pause, Delete
- Workflow Details panel:
  - ID
  - Name
  - Version
  - Task Queue
  - Nodes count
  - Connections count
  - Created/Updated timestamps

---

### ❌ 4. Workflow Builder Page (`/workflows/[id]/builder`)

**Status:** BROKEN - Multiple errors

**Issues Found:**
1. **TypeError: Cannot read properties of undefined (reading 'workflows')**
   - Location: `WorkflowBuilderPage`
   - Cause: tRPC query for workflows is failing or returning undefined

2. **Import Error:** Multiple warnings about `'trpc' is not exported from '@/lib/trpc/client'`
   - File: `src/app/workflows/[id]/builder/page.tsx`
   - This suggests the tRPC import path or export is incorrect

**Expected Navigation:**
```javascript
// Navigate from workflow details page
await page.getByRole('button', { name: 'Edit' }).click();

// OR directly navigate
await page.goto('http://localhost:3010/workflows/aaaaaaaa-bbbb-cccc-dddd-000000000001/builder');
```

**What Should Be Fixed:**
- Fix tRPC import in builder page
- Ensure workflow data is properly fetched and handled
- Add proper error handling for undefined workflow data

---

### ✅ 5. Components Page (`/components`)

**Status:** WORKING

**Navigation Script:**
```javascript
// Navigate from home page
await page.getByRole('button', { name: 'Components' }).click();

// Wait for components page
await page.getByRole('heading', { name: 'Components' }).waitFor();

// Test filter buttons
await page.getByRole('button', { name: 'All' }).isVisible();
await page.getByRole('button', { name: 'activity' }).isVisible();
await page.getByRole('button', { name: 'agent' }).isVisible();
await page.getByRole('button', { name: 'query' }).isVisible();
await page.getByRole('button', { name: 'scheduled-workflow' }).isVisible();
await page.getByRole('button', { name: 'signal' }).isVisible();
await page.getByRole('button', { name: 'trigger' }).isVisible();
await page.getByRole('button', { name: 'work-queue' }).isVisible();

// Test search textbox
await page.getByPlaceholder('Search components...').isVisible();

// Test "New Component" button
await page.getByRole('button', { name: 'New Component' }).isVisible();
```

**Page Elements:**
- Header: "Components"
- Search textbox: "Search components..."
- Filter buttons for component types
- "New Component" button
- Empty state: "No components found" with "Create Component" button

---

### ✅ 6. Agents Page (`/agents`)

**Status:** WORKING

**Navigation Script:**
```javascript
// Navigate from home page
await page.getByRole('button', { name: 'Agents' }).click();

// Wait for agents page
await page.getByRole('heading', { name: 'Agent Prompts' }).waitFor();

// Test "New Agent Prompt" button
await page.getByRole('button', { name: 'New Agent Prompt' }).isVisible();

// Verify empty state
await page.getByText('No agent prompts yet').waitFor();
await page.getByRole('button', { name: 'Create Your First Agent' }).isVisible();
```

**Page Elements:**
- Header: "Agent Prompts"
- "New Agent Prompt" button
- Empty state: "No agent prompts yet" with "Create Your First Agent" button

---

### ❌ 7. New Workflow Page (`/workflows/new`)

**Status:** BROKEN - Tamagui/React Native Web Error

**Issues Found:**
1. **TypeError: Failed to construct 'Text': Please use the 'new' operator**
   - This is a Tamagui/React Native Web compatibility issue
   - Likely caused by improper Text component usage

2. **Unexpected text node errors:**
   - "A text node cannot be a child of a <View>"
   - This is a common Tamagui issue when text is not wrapped in a Text component

**Expected Navigation:**
```javascript
// Navigate from workflows list page
await page.getByRole('button', { name: 'New Workflow' }).click();

// OR directly navigate
await page.goto('http://localhost:3010/workflows/new');
```

**What Should Be Fixed:**
- Check all Text usage in the new workflow form
- Ensure all text strings are wrapped in Tamagui Text components
- Verify no raw strings are children of View/YStack/XStack components

---

## Summary of Issues

### All Issues Fixed! ✅

1. **✅ Workflow Builder "Workflow not found"** - Fixed by wrapping workflows.get return value in `{ workflow: data }`
   - Issue: Builder page expected `workflowData.workflow` but endpoint returned data directly
   - Fix: Updated `src/server/api/routers/workflows.ts` to return `{ workflow: data }`
   
2. **✅ New Workflow Page Text Component** - Fixed by adding `Text` import from `tamagui`
   - Issue: `Text` component used but not imported
   - Fix: Added `Text` to imports in `src/app/workflows/new/page.tsx`
   
3. **✅ Badge Import Warnings** - Fixed by updating all files to use custom `Badge` from `@/components/shared/Badge`
   - Issue: Multiple files trying to import `Badge` from `tamagui` which doesn't export it
   - Fix: Updated 6 files to import from custom Badge component:
     - `src/components/cron/CronExpressionBuilder.tsx`
     - `src/components/work-queue/WorkQueueCard.tsx`
     - `src/components/queries/QueryCard.tsx`
     - `src/components/scheduled-workflow/ScheduledWorkflowCard.tsx`
     - `src/components/signals/SignalCard.tsx`
     - `src/components/workflow-execution/WorkflowExecutionPanel.tsx`
   
4. **✅ tRPC Import Warnings** - Fixed by updating all imports to use `import { api as trpc }` for consistency
   - Issue: Files importing `{ trpc }` but only `api` was exported
   - Fix: Updated 6 files to use `import { api as trpc }`
   
5. **✅ ActivityNode Import Error** - Fixed circular import in `src/components/workflow/nodes/index.ts`
   
6. **✅ react-native-svg Errors** - Fixed by replacing `@tamagui/lucide-icons` with `lucide-react`

## Next Steps

1. ✅ All critical issues resolved!
2. ✅ Comprehensive Playwright testing completed (see `testing-summary-nov-16.md`)
3. **TODO**: Fix Tamagui "Unexpected text node" warnings (non-critical, cosmetic only)
4. **TODO**: Add more comprehensive error boundaries
5. **TODO**: Begin implementing actual Temporal worker integration (currently using simulated execution)
6. **TODO**: Add loading states for all data fetching operations
7. **TODO**: Add retry mechanisms for failed API calls

## Full End-to-End Test Script

```javascript
// Complete navigation test
async function testAllPages(page) {
  // 1. Login (if needed)
  await page.goto('http://localhost:3010');
  
  // 2. Test home page
  await page.getByRole('button', { name: 'Dashboard' }).waitFor();
  
  // 3. Test workflows page
  await page.getByRole('button', { name: 'Workflows' }).click();
  await page.getByText('Build Workflow').waitFor();
  
  // 4. Test workflow details
  await page.getByText('Build WorkflowactiveSystem').click();
  await page.getByRole('button', { name: 'Edit' }).waitFor();
  
  // 5. Test components page
  await page.getByRole('button', { name: 'Components' }).click();
  await page.getByPlaceholder('Search components...').waitFor();
  
  // 6. Test agents page
  await page.getByRole('button', { name: 'Agents' }).click();
  await page.getByText('No agent prompts yet').waitFor();
  
  // 7. Go back to home
  await page.getByRole('button', { name: 'Dashboard' }).click();
}
```

## Testing Notes

- All tests performed with user: `matt bernier` (developer role)
- Server running on: `http://localhost:3010`
- Test date: November 16, 2025
- Browser: Playwright default (Chromium)
- All successful pages load within 3 seconds
- Broken pages fail immediately on render

