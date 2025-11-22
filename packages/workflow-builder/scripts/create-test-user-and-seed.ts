/**
 * Create Test User and Seed Demo Workflows
 * 
 * This script:
 * 1. Creates a user in auth.users
 * 2. Manually creates the corresponding record in public.users
 * 3. Seeds the demo workflows
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Use service role client to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('🚀 Creating test user and seeding demo workflows\n');

  // Step 1: Get or create auth user
  console.log('1️⃣ Checking for test user in auth...');
  
  let authUserId: string;
  
  const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingAuthUsers?.users?.find(u => u.email === 'test@example.com');
  
  if (existingUser) {
    console.log(`   ✅ Found existing auth user: ${existingUser.email}`);
    authUserId = existingUser.id;
  } else {
    console.log('   Creating new auth user...');
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'testpassword123',
      email_confirm: true,
      user_metadata: {
        display_name: 'Test User'
      }
    });
    
    if (error || !newUser.user) {
      console.error('   ❌ Failed to create auth user:', error?.message);
      process.exit(1);
    }
    
    console.log(`   ✅ Created auth user: ${newUser.user.email}`);
    authUserId = newUser.user.id;
  }

  // Step 2: Get developer role
  console.log('\n2️⃣ Getting developer role...');
  
  const { data: role } = await supabase
    .from('user_roles')
    .select('id')
    .eq('name', 'developer')
    .single();
  
  if (!role) {
    console.error('   ❌ Developer role not found');
    process.exit(1);
  }
  
  console.log('   ✅ Found developer role');

  // Step 3: Create public user record (bypassing RLS with service role)
  console.log('\n3️⃣ Creating public user record...');
  
  const { data: publicUser, error: userError } = await supabase
    .from('users')
    .upsert({
      auth_user_id: authUserId,
      email: 'test@example.com',
      display_name: 'Test User',
      role_id: role.id,
    }, {
      onConflict: 'auth_user_id',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (userError) {
    console.error('   ❌ Failed to create public user:', userError.message);
    console.error('   Full error:', userError);
    process.exit(1);
  }

  console.log(`   ✅ Created public user: ${publicUser.email}`);

  // Step 4: Get reference IDs
  console.log('\n4️⃣ Getting reference data...');
  
  const { data: publicVisibility } = await supabase
    .from('component_visibility')
    .select('id')
    .eq('name', 'public')
    .single();

  const { data: activeStatus } = await supabase
    .from('workflow_statuses')
    .select('id')
    .eq('name', 'active')
    .single();

  const { data: defaultQueue } = await supabase
    .from('task_queues')
    .select('id')
    .eq('name', 'default-queue')
    .single();

  if (!publicVisibility || !activeStatus || !defaultQueue) {
    console.error('❌ Missing required reference data');
    process.exit(1);
  }

  console.log('   ✅ Got all reference IDs');

  // Step 5: Create Demo Project
  console.log('\n5️⃣ Creating Demo Workflows project...');
  
  // Check if project already exists
  const { data: existingProject } = await supabase
    .from('projects')
    .select('*')
    .eq('name', 'Demo Workflows')
    .eq('created_by', publicUser.id)
    .single();
  
  let project;
  if (existingProject) {
    console.log('   ✓ Project already exists');
    project = existingProject;
  } else {
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: 'Demo Workflows',
        description: 'Showcase workflows demonstrating agent coordination patterns',
        created_by: publicUser.id,
        task_queue_name: `demo-workflows-${publicUser.id.substring(0, 8)}`,
      })
      .select()
      .single();

    if (projectError) {
      console.error('❌ Failed to create project:', projectError.message);
      process.exit(1);
    }
    
    project = newProject;
    console.log(`   ✅ Project created: ${project.name}`);
  }


  // Step 6: Create Hello World Workflow
  console.log('\n6️⃣ Creating Hello World workflow...');
  
  const helloDefinition = {
    nodes: [
      {
        id: 'start-1',
        type: 'trigger',
        position: { x: 100, y: 100 },
        data: {
          label: 'Start',
          config: {}
        }
      },
      {
        id: 'agent-1',
        type: 'agent',
        position: { x: 300, y: 100 },
        data: {
          label: 'Greet',
          componentName: 'MockAgent',
          config: {
            workKind: 'greet',
            payload: { message: 'Say hello' }
          }
        }
      },
      {
        id: 'end-1',
        type: 'end',
        position: { x: 500, y: 100 },
        data: {
          label: 'Complete',
          config: {}
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'agent-1' },
      { id: 'e2', source: 'agent-1', target: 'end-1' }
    ]
  };

  const { data: helloWorkflow, error: helloError } = await supabase
    .from('workflows')
    .upsert({
      name: 'hello-world-demo',
      kebab_name: 'hello-world-demo',
      display_name: 'Hello World Demo',
      description: 'A simple greeting workflow demonstrating the basic agent coordinator system. The agent says hello and the workflow completes.',
      version: '1.0.0',
      status_id: activeStatus.id,
      visibility_id: publicVisibility.id,
      created_by: publicUser.id,
      task_queue_id: defaultQueue.id,
      project_id: project.id,
      definition: helloDefinition,
    })
    .select()
    .single();

  if (helloError) {
    console.error('❌ Failed to create Hello World workflow:', helloError.message);
    process.exit(1);
  }

  console.log(`   ✅ Created: ${helloWorkflow.display_name}`);

  // Step 7: Create Conversation Workflow
  console.log('\n7️⃣ Creating Agent Conversation workflow...');
  
  const conversationDefinition = {
    nodes: [
      {
        id: 'start-1',
        type: 'trigger',
        position: { x: 50, y: 200 },
        data: {
          label: 'Start Conversation',
          config: {}
        }
      },
      {
        id: 'alice-1',
        type: 'agent',
        position: { x: 250, y: 100 },
        data: {
          label: 'Alice Initiates',
          componentName: 'MockAgent',
          config: {
            workKind: 'agent_a_initiate',
            agentRole: 'Alice',
            payload: {
              speaker: 'Alice',
              message: "Hi Bob! I'm curious - what's your favorite programming language and why?"
            }
          }
        }
      },
      {
        id: 'bob-1',
        type: 'agent',
        position: { x: 450, y: 100 },
        data: {
          label: 'Bob Responds',
          componentName: 'MockAgent',
          config: {
            workKind: 'agent_b_respond',
            agentRole: 'Bob',
            payload: {
              speaker: 'Bob',
              message: 'Hey Alice! I love TypeScript because of its type safety and excellent tooling. What about you?'
            }
          }
        }
      },
      {
        id: 'alice-2',
        type: 'agent',
        position: { x: 250, y: 300 },
        data: {
          label: 'Alice Replies',
          componentName: 'MockAgent',
          config: {
            workKind: 'agent_a_reply',
            agentRole: 'Alice',
            payload: {
              speaker: 'Alice',
              message: "Great choice! I'm a fan of Python for its simplicity and amazing data science ecosystem."
            }
          }
        }
      },
      {
        id: 'bob-2',
        type: 'agent',
        position: { x: 450, y: 300 },
        data: {
          label: 'Bob Concludes',
          componentName: 'MockAgent',
          config: {
            workKind: 'agent_b_conclude',
            agentRole: 'Bob',
            payload: {
              speaker: 'Bob',
              message: 'I have! Python is fantastic for data science and scripting. Nice chatting with you!'
            }
          }
        }
      },
      {
        id: 'end-1',
        type: 'end',
        position: { x: 650, y: 200 },
        data: {
          label: 'Conversation Complete',
          config: {}
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'alice-1' },
      { id: 'e2', source: 'alice-1', target: 'bob-1' },
      { id: 'e3', source: 'bob-1', target: 'alice-2' },
      { id: 'e4', source: 'alice-2', target: 'bob-2' },
      { id: 'e5', source: 'bob-2', target: 'end-1' }
    ]
  };

  const { data: conversationWorkflow, error: conversationError } = await supabase
    .from('workflows')
    .upsert({
      name: 'agent-conversation-demo',
      kebab_name: 'agent-conversation-demo',
      display_name: 'Agent Conversation Demo',
      description: 'Two agents (Alice and Bob) having a conversation about their favorite programming languages. Demonstrates multi-step coordination.',
      version: '1.0.0',
      status_id: activeStatus.id,
      visibility_id: publicVisibility.id,
      created_by: publicUser.id,
      task_queue_id: defaultQueue.id,
      project_id: project.id,
      definition: conversationDefinition,
    })
    .select()
    .single();

  if (conversationError) {
    console.error('❌ Failed to create Conversation workflow:', conversationError.message);
    process.exit(1);
  }

  console.log(`   ✅ Created: ${conversationWorkflow.display_name}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Setup complete!\n');
  console.log('👤 Test User:');
  console.log(`   Email: test@example.com`);
  console.log(`   Password: testpassword123\n`);
  console.log('📋 Demo Workflows Created:');
  console.log(`   1. ${helloWorkflow.display_name}`);
  console.log(`      - ${helloWorkflow.kebab_name}`);
  console.log(`      - Simple greeting workflow`);
  console.log();
  console.log(`   2. ${conversationWorkflow.display_name}`);
  console.log(`      - ${conversationWorkflow.kebab_name}`);
  console.log(`      - Two agents chatting about programming`);
  console.log();
  console.log('🌐 View workflows at: http://localhost:3010');
  console.log('   Login with: test@example.com / testpassword123');
  console.log('='.repeat(60) + '\n');
}

main().catch((error) => {
  console.error('\n❌ Setup failed:', error);
  process.exit(1);
});

