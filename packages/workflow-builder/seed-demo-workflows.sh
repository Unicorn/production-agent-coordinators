#!/bin/bash

# Seed Demo Workflows
# Run this after at least one user has signed up

set -e

DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

echo "🌱 Seeding Demo Workflows..."
echo ""

# Check if any users exist
USER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM public.users;" | tr -d ' ')

if [ "$USER_COUNT" -eq "0" ]; then
  echo "❌ No users found. Please sign up at least one user first."
  echo ""
  echo "To create a test user:"
  echo "  1. Start the app: yarn dev"
  echo "  2. Go to http://localhost:3010"
  echo "  3. Sign up with: test@example.com / testpassword123"
  echo ""
  exit 1
fi

echo "✓ Found $USER_COUNT user(s)"
echo ""

# Run the demo workflows seed
psql "$DATABASE_URL" << 'EOF'
DO $$
DECLARE
  v_user_id UUID;
  v_public_visibility_id UUID;
  v_draft_status_id UUID;
  v_active_status_id UUID;
  v_default_queue_id UUID;
  v_demo_project_id UUID;
  v_hello_workflow_id UUID;
  v_conversation_workflow_id UUID;
BEGIN
  -- Get first user
  SELECT id INTO v_user_id FROM users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found';
  END IF;

  -- Get required reference IDs
  SELECT id INTO v_public_visibility_id 
  FROM component_visibility 
  WHERE name = 'public' 
  LIMIT 1;

  SELECT id INTO v_draft_status_id 
  FROM workflow_statuses 
  WHERE name = 'draft' 
  LIMIT 1;
  
  SELECT id INTO v_active_status_id 
  FROM workflow_statuses 
  WHERE name = 'active' 
  LIMIT 1;

  SELECT id INTO v_default_queue_id 
  FROM task_queues 
  WHERE name = 'default-queue' 
  LIMIT 1;

  -- Create Demo Project
  INSERT INTO projects (
    id,
    name,
    description,
    created_by,
    task_queue_name,
    created_at,
    updated_at
  ) VALUES (
    'dddddddd-0000-0000-0000-000000000001',
    'Demo Workflows',
    'Showcase workflows demonstrating agent coordination patterns',
    v_user_id,
    'default-queue',
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW()
  RETURNING id INTO v_demo_project_id;

  RAISE NOTICE 'Demo project: %', v_demo_project_id;

  -- Create Hello World Workflow
  INSERT INTO workflows (
    id,
    kebab_name,
    display_name,
    description,
    version,
    status_id,
    visibility_id,
    created_by,
    task_queue_id,
    project_id,
    definition,
    created_at,
    updated_at
  ) VALUES (
    'hello001-0000-0000-0000-000000000001',
    'hello-world-demo',
    'Hello World Demo',
    'A simple greeting workflow demonstrating the basic agent coordinator system.',
    '1.0.0',
    v_active_status_id,
    v_public_visibility_id,
    v_user_id,
    v_default_queue_id,
    v_demo_project_id,
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object(
          'id', 'start-1',
          'type', 'trigger',
          'position', jsonb_build_object('x', 100, 'y', 100),
          'data', jsonb_build_object(
            'label', 'Start',
            'config', jsonb_build_object()
          )
        ),
        jsonb_build_object(
          'id', 'agent-1',
          'type', 'agent',
          'position', jsonb_build_object('x', 300, 'y', 100),
          'data', jsonb_build_object(
            'label', 'Greet',
            'componentName', 'MockAgent',
            'config', jsonb_build_object(
              'workKind', 'greet',
              'payload', jsonb_build_object('message', 'Say hello')
            )
          )
        ),
        jsonb_build_object(
          'id', 'end-1',
          'type', 'end',
          'position', jsonb_build_object('x', 500, 'y', 100),
          'data', jsonb_build_object('label', 'Complete')
        )
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('id', 'e1', 'source', 'start-1', 'target', 'agent-1'),
        jsonb_build_object('id', 'e2', 'source', 'agent-1', 'target', 'end-1')
      )
    ),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    definition = EXCLUDED.definition,
    updated_at = NOW()
  RETURNING id INTO v_hello_workflow_id;

  -- Create Conversation Workflow
  INSERT INTO workflows (
    id,
    kebab_name,
    display_name,
    description,
    version,
    status_id,
    visibility_id,
    created_by,
    task_queue_id,
    project_id,
    definition,
    created_at,
    updated_at
  ) VALUES (
    'convo001-0000-0000-0000-000000000001',
    'agent-conversation-demo',
    'Agent Conversation Demo',
    'Two agents (Alice and Bob) chatting about programming languages.',
    '1.0.0',
    v_active_status_id,
    v_public_visibility_id,
    v_user_id,
    v_default_queue_id,
    v_demo_project_id,
    jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object(
          'id', 'start-1',
          'type', 'trigger',
          'position', jsonb_build_object('x', 50, 'y', 200),
          'data', jsonb_build_object('label', 'Start')
        ),
        jsonb_build_object(
          'id', 'alice-1',
          'type', 'agent',
          'position', jsonb_build_object('x', 250, 'y', 100),
          'data', jsonb_build_object(
            'label', 'Alice Initiates',
            'componentName', 'MockAgent',
            'config', jsonb_build_object(
              'workKind', 'agent_a_initiate',
              'payload', jsonb_build_object(
                'speaker', 'Alice',
                'message', 'Hi Bob! What''s your favorite programming language?'
              )
            )
          )
        ),
        jsonb_build_object(
          'id', 'bob-1',
          'type', 'agent',
          'position', jsonb_build_object('x', 450, 'y', 100),
          'data', jsonb_build_object(
            'label', 'Bob Responds',
            'componentName', 'MockAgent',
            'config', jsonb_build_object(
              'workKind', 'agent_b_respond',
              'payload', jsonb_build_object(
                'speaker', 'Bob',
                'message', 'I love TypeScript! What about you?'
              )
            )
          )
        ),
        jsonb_build_object(
          'id', 'alice-2',
          'type', 'agent',
          'position', jsonb_build_object('x', 250, 'y', 300),
          'data', jsonb_build_object(
            'label', 'Alice Replies',
            'componentName', 'MockAgent',
            'config', jsonb_build_object(
              'workKind', 'agent_a_reply',
              'payload', jsonb_build_object(
                'speaker', 'Alice',
                'message', 'Python for me! Great for data science.'
              )
            )
          )
        ),
        jsonb_build_object(
          'id', 'bob-2',
          'type', 'agent',
          'position', jsonb_build_object('x', 450, 'y', 300),
          'data', jsonb_build_object(
            'label', 'Bob Concludes',
            'componentName', 'MockAgent',
            'config', jsonb_build_object(
              'workKind', 'agent_b_conclude',
              'payload', jsonb_build_object(
                'speaker', 'Bob',
                'message', 'Nice! Both are great languages.'
              )
            )
          )
        ),
        jsonb_build_object(
          'id', 'end-1',
          'type', 'end',
          'position', jsonb_build_object('x', 650, 'y', 200),
          'data', jsonb_build_object('label', 'Complete')
        )
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('id', 'e1', 'source', 'start-1', 'target', 'alice-1'),
        jsonb_build_object('id', 'e2', 'source', 'alice-1', 'target', 'bob-1'),
        jsonb_build_object('id', 'e3', 'source', 'bob-1', 'target', 'alice-2'),
        jsonb_build_object('id', 'e4', 'source', 'alice-2', 'target', 'bob-2'),
        jsonb_build_object('id', 'e5', 'source', 'bob-2', 'target', 'end-1')
      )
    ),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    definition = EXCLUDED.definition,
    updated_at = NOW()
  RETURNING id INTO v_conversation_workflow_id;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Demo workflows created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Workflows:';
  RAISE NOTICE '  1. Hello World Demo';
  RAISE NOTICE '     ID: %', v_hello_workflow_id;
  RAISE NOTICE '';
  RAISE NOTICE '  2. Agent Conversation Demo';
  RAISE NOTICE '     ID: %', v_conversation_workflow_id;
  RAISE NOTICE '';

END $$;
EOF

echo ""
echo "✅ Demo workflows seeded successfully!"
echo ""
echo "You can now view them in the workflow builder at:"
echo "  http://localhost:3010"
echo ""

