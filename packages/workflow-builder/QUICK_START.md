# Workflow Builder - Quick Start

## ✅ Server is Running!

Your Workflow Builder is now live at: **http://localhost:3010**

---

## What You Can Do Right Now

### 1. Create an Account
- Visit http://localhost:3010
- You'll see "Sign In" page
- Click "Sign Up" 
- Enter email, password, display name
- You'll be automatically logged in

### 2. Explore the Dashboard
- See counts for workflows, components, and agents
- Navigate using the sidebar

### 3. Create Your First Component
- Go to **Components** → **New Component**
- Fill in:
  - **Name**: `testActivity` (camelCase, no spaces)
  - **Display Name**: `Test Activity`
  - **Description**: `My first test activity`
  - **Component Type**: Select `activity`
  - **Version**: `1.0.0`
  - **Capabilities**: `test-capability` (optional)
- Click **Create Component**

### 4. Create an Agent Prompt (Optional)
- Go to **Agents** → **New Agent Prompt**
- Fill in:
  - **Name**: `test-agent`
  - **Display Name**: `Test Agent`
  - **Prompt Content**: Write your agent prompt in markdown
  - **Capabilities**: `analyze, fix`
- Click **Create Agent Prompt**

### 5. Build Your First Workflow
- Go to **Workflows** → **New Workflow**
- Fill in:
  - **Name**: `my-first-workflow`
  - **Display Name**: `My First Workflow`
  - **Task Queue**: Select `default-queue`
  - **Visibility**: `private`
- Click **Create & Edit**

### 6. Design in Visual Editor
- Drag your `testActivity` component from the left palette onto the canvas
- Click the node to see the property panel on the right
- Add more components and connect them
- Changes auto-save every 2 seconds
- Click **Save** to manually save
- Click **Deploy** to activate the workflow

---

## Current Status

✅ **Phase 1-3 Complete** - Full POC working
- Authentication system
- Component library management
- Agent prompt creation
- Visual workflow designer
- Drag-and-drop canvas
- Auto-save functionality

⏳ **Phase 4-5 Pending** - Execution capabilities
- Worker generation (not yet implemented)
- Temporal integration (not yet implemented)  
- Workflow execution (not yet implemented)
- Monitoring dashboard (not yet implemented)

**Note**: You can design and save workflows, but they won't execute until Phase 4 is implemented.

---

## Important Notes

### Supabase Setup Required

Before you can sign up, you need real Supabase credentials:

1. **Create Supabase Project**: https://supabase.com
2. **Get Credentials**: Project Settings → API
3. **Update .env.local**:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_KEY=your_service_key_here
   SUPABASE_PROJECT_ID=your_project_id
   ```
4. **Run Migrations**:
   ```bash
   bash scripts/init-supabase.sh
   ```

### If You See Errors

**"Invalid API key" or "401 Unauthorized"**
- Update .env.local with your Supabase credentials
- Restart dev server

**"Table does not exist"**
- Run migrations: `bash scripts/init-supabase.sh`

**"Task queue not found"**
- Sign in once to trigger default queue creation
- Or manually insert via Supabase dashboard

---

## Folder Structure

```
http://localhost:3010/                # Dashboard
http://localhost:3010/auth/signin     # Sign In
http://localhost:3010/auth/signup     # Sign Up
http://localhost:3010/workflows       # Workflow List
http://localhost:3010/workflows/new   # Create Workflow
http://localhost:3010/components      # Component Library
http://localhost:3010/components/new  # Create Component
http://localhost:3010/agents          # Agent Prompts
http://localhost:3010/agents/new      # Create Agent
```

---

## Next Steps

1. **Test the POC** - Create components and workflows
2. **Review the design** - Check `PROJECT_SUMMARY.md`
3. **Implement Phase 4** - Worker generation & Temporal integration
4. **Implement Phase 5** - Monitoring and execution tracking

---

## Support

- **Setup Guide**: `SETUP.md`
- **AI Agent Guide**: `AGENTINFO.md`
- **Project Summary**: `PROJECT_SUMMARY.md`
- **Design Doc**: `../../docs/plans/2025-11-14-workflow-builder-system-design.md`

---

**Happy Building! 🚀**

