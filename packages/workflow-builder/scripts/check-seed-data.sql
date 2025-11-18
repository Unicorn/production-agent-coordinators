-- Diagnostic Script: Check Seed Data
-- Run this to see if components and agent prompts exist

-- Check component counts
SELECT 
  'Components' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE v.name = 'public') as public_count,
  COUNT(*) FILTER (WHERE v.name = 'private') as private_count
FROM components c
LEFT JOIN component_visibility v ON c.visibility_id = v.id;

-- Check agent prompt counts
SELECT 
  'Agent Prompts' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE v.name = 'public') as public_count,
  COUNT(*) FILTER (WHERE v.name = 'private') as private_count
FROM agent_prompts ap
LEFT JOIN component_visibility v ON ap.visibility_id = v.id;

-- List all public components
SELECT 
  c.display_name,
  ct.name as component_type,
  c.version,
  c.description
FROM components c
JOIN component_types ct ON c.component_type_id = ct.id
JOIN component_visibility v ON c.visibility_id = v.id
WHERE v.name = 'public'
ORDER BY ct.name, c.display_name;

-- List all public agent prompts
SELECT 
  ap.display_name,
  ap.version,
  ap.description,
  array_length(ap.capabilities, 1) as capability_count
FROM agent_prompts ap
JOIN component_visibility v ON ap.visibility_id = v.id
WHERE v.name = 'public'
ORDER BY ap.display_name;

