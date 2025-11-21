/**
 * Seed Demo Workflows
 *
 * Creates demo workflows for showcase:
 * 1. Hello World - Simple greeting workflow
 * 2. Agent Conversation - Two agents chatting
 * 3. Milestone 1 Examples - Production-ready workflow patterns
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedDemoWorkflows() {
  console.log('🌱 Seeding Demo Workflows\n');

  // Step 1: Get or create user
  console.log('1️⃣ Finding user...');
  
  const { data: users } = await supabase.from('users').select('*').limit(1);
  
  if (!users || users.length === 0) {
    console.error('❌ No users found!');
    console.log('\nPlease create a user first:');
    console.log('  1. Start the app: yarn dev');
    console.log('  2. Visit http://localhost:3010');
    console.log('  3. Sign up with any email/password');
    console.log('  4. Then run this script again\n');
    process.exit(1);
  }

  const user = users[0];
  console.log(`   ✅ Found user: ${user.email}`);

  // Step 2: Get reference IDs
  console.log('\n2️⃣ Getting reference data...');
  
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

  console.log('   ✅ Got reference IDs');

  // Step 3: Create Demo Project
  console.log('\n3️⃣ Creating Demo Workflows project...');
  
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .upsert({
      id: 'dddddddd-0000-0000-0000-000000000001',
      name: 'Demo Workflows',
      description: 'Showcase workflows demonstrating agent coordination patterns',
      created_by: user.id,
      task_queue_name: 'default-queue',
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (projectError) {
    console.error('❌ Failed to create project:', projectError.message);
    process.exit(1);
  }

  console.log(`   ✅ Project created: ${project.name}`);

  // Step 4: Create Hello World Workflow
  console.log('\n4️⃣ Creating Hello World workflow...');
  
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
      id: 'hello001-0000-0000-0000-000000000001',
      kebab_name: 'hello-world-demo',
      display_name: 'Hello World Demo',
      description: 'A simple greeting workflow demonstrating the basic agent coordinator system. The agent says hello and the workflow completes.',
      version: '1.0.0',
      status_id: activeStatus.id,
      visibility_id: publicVisibility.id,
      created_by: user.id,
      task_queue_id: defaultQueue.id,
      project_id: project.id,
      definition: helloDefinition,
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (helloError) {
    console.error('❌ Failed to create Hello World workflow:', helloError.message);
    process.exit(1);
  }

  console.log(`   ✅ Created: ${helloWorkflow.display_name}`);

  // Step 5: Create Conversation Workflow
  console.log('\n5️⃣ Creating Agent Conversation workflow...');
  
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
      id: 'convo001-0000-0000-0000-000000000001',
      kebab_name: 'agent-conversation-demo',
      display_name: 'Agent Conversation Demo',
      description: 'Two agents (Alice and Bob) having a conversation about their favorite programming languages. Demonstrates multi-step coordination.',
      version: '1.0.0',
      status_id: activeStatus.id,
      visibility_id: publicVisibility.id,
      created_by: user.id,
      task_queue_id: defaultQueue.id,
      project_id: project.id,
      definition: conversationDefinition,
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (conversationError) {
    console.error('❌ Failed to create Conversation workflow:', conversationError.message);
    process.exit(1);
  }

  console.log(`   ✅ Created: ${conversationWorkflow.display_name}`);

  // Step 6: Load and create Milestone 1 example workflows
  console.log('\n6️⃣ Creating Milestone 1 example workflows...');

  const milestone1Examples = [
    'api-orchestration.json',
    'data-pipeline.json',
    'notification-chain.json',
    'order-fulfillment.json'
  ];

  const createdExamples = [];

  for (const exampleFile of milestone1Examples) {
    try {
      const examplePath = resolve(__dirname, '../examples/milestone-1', exampleFile);
      const exampleContent = readFileSync(examplePath, 'utf-8');
      const example = JSON.parse(exampleContent);

      const workflowData = {
        id: `m1-${example.name.substring(0, 8)}-${Date.now().toString(36)}`,
        name: example.name,
        display_name: example.displayName,
        description: example.description,
        version: example.version,
        status_id: activeStatus.id,
        visibility_id: publicVisibility.id,
        created_by: user.id,
        task_queue_id: defaultQueue.id,
        project_id: project.id,
        definition: example.definition,
        execution_timeout_seconds: example.executionSettings?.timeout || 300,
      };

      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .upsert(workflowData, {
          onConflict: 'name'
        })
        .select()
        .single();

      if (workflowError) {
        console.error(`   ❌ Failed to create ${example.displayName}:`, workflowError.message);
      } else {
        console.log(`   ✅ Created: ${workflow.display_name}`);
        createdExamples.push(workflow);
      }
    } catch (error: any) {
      console.error(`   ❌ Error loading ${exampleFile}:`, error.message);
    }
  }

  // Summary
  console.log('\n✅ Demo workflows seeded successfully!\n');
  console.log('📋 Created:');
  console.log('\n   Basic Demos:');
  console.log(`   • ${helloWorkflow.display_name} (${helloWorkflow.name})`);
  console.log(`   • ${conversationWorkflow.display_name} (${conversationWorkflow.name})`);

  if (createdExamples.length > 0) {
    console.log('\n   Milestone 1 Examples:');
    createdExamples.forEach(workflow => {
      console.log(`   • ${workflow.display_name} (${workflow.name})`);
    });
  }

  console.log('\n🌐 View them at: http://localhost:3010');
  console.log('📚 Documentation: docs/examples/milestone-1-demos.md\n');
}

seedDemoWorkflows().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});

