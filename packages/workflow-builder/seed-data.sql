-- Seed data for Workflow Builder
-- Run this after user signup with: psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < seed-data.sql

DO $$
DECLARE
  system_user_id UUID;
  public_visibility_id UUID;
  activity_type_id UUID;
BEGIN
  -- Get first user
  SELECT id INTO system_user_id FROM public.users ORDER BY created_at ASC LIMIT 1;
  IF system_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Create a user first via signup.';
  END IF;

  -- Get reference IDs
  SELECT id INTO public_visibility_id FROM public.component_visibility WHERE name = 'public' LIMIT 1;
  SELECT id INTO activity_type_id FROM public.component_types WHERE name = 'activity' LIMIT 1;

  RAISE NOTICE 'Seeding data for user: %', system_user_id;

  -- Create System Project
  INSERT INTO public.projects (
    id, name, description, created_by, task_queue_name
  ) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'System Workflows',
    'System-level workflows and components',
    system_user_id,
    'system-workflows-queue'
  ) ON CONFLICT (id) DO NOTHING;

  -- Seed 5 example activity components
  INSERT INTO public.components (id, name, display_name, description, component_type_id, visibility_id, created_by, implementation_path, version, tags) VALUES
  ('11111111-0000-0000-0000-000000000001', 'compileWorkflow', 'Compile Workflow', 'Compiles workflow definitions into executable code', activity_type_id, public_visibility_id, system_user_id, 'src/lib/workflow-compiler/compiler.ts', '1.0.0', ARRAY['system','compiler']),
  ('11111111-0000-0000-0000-000000000002', 'validateCode', 'Validate Code', 'Validates generated TypeScript code', activity_type_id, public_visibility_id, system_user_id, 'src/lib/workflow-compiler/validator.ts', '1.0.0', ARRAY['system','validation']),
  ('11111111-0000-0000-0000-000000000003', 'sendEmail', 'Send Email', 'Sends an email notification', activity_type_id, public_visibility_id, system_user_id, 'activities/sendEmail.ts', '1.0.0', ARRAY['communication','email']),
  ('11111111-0000-0000-0000-000000000004', 'callWebhook', 'Call Webhook', 'Makes an HTTP webhook call', activity_type_id, public_visibility_id, system_user_id, 'activities/callWebhook.ts', '1.0.0', ARRAY['integration','webhook']),
  ('11111111-0000-0000-0000-000000000005', 'processData', 'Process Data', 'Transforms and processes data', activity_type_id, public_visibility_id, system_user_id, 'activities/processData.ts', '1.0.0', ARRAY['data','processing'])
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Seed data created successfully!';
END $$;

-- Show what was created
SELECT COUNT(*) as components FROM components;
SELECT COUNT(*) as projects FROM projects;
SELECT name, display_name, string_to_array(array_to_string(tags, ','), ',') as tags FROM components ORDER BY name;

