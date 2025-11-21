-- ============================================================================
-- SEED INITIAL ACTIVITIES
-- Created: 2025-01-19
-- Description: Seed the activity registry with common sample activities
-- ============================================================================

-- Get system user ID for activity ownership
DO $$
DECLARE
  v_system_user_id UUID;
BEGIN
  -- Get system user ID
  SELECT id INTO v_system_user_id
  FROM users
  WHERE email = 'system@workflow-builder.local'
  LIMIT 1;

  -- If system user doesn't exist, create it
  IF v_system_user_id IS NULL THEN
    RAISE NOTICE 'System user not found. Please run migration 20251118000000_create_system_user.sql first';
    RETURN;
  END IF;

  -- Sample Activity: sampleActivity
  INSERT INTO activities (
    id,
    name,
    description,
    input_schema,
    output_schema,
    package_name,
    module_path,
    function_name,
    category,
    tags,
    examples,
    created_by,
    is_active,
    usage_count
  ) VALUES (
    '11111111-1111-0000-0000-000000000001',
    'sampleActivity',
    'A sample activity that processes a message and returns a result',
    '{
      "type": "object",
      "properties": {
        "message": {
          "type": "string",
          "description": "The message to process"
        }
      },
      "required": ["message"]
    }'::jsonb,
    '{
      "type": "string",
      "description": "Processed message result"
    }'::jsonb,
    'workflow-worker-service',
    './activities/sample.activities',
    'sampleActivity',
    'Sample',
    ARRAY['demo', 'testing', 'example'],
    '{
      "basic": {
        "input": { "message": "Hello World" },
        "output": "Processed: Hello World"
      },
      "complex": {
        "input": { "message": "Test message with special chars: !@#$%" },
        "output": "Processed: Test message with special chars: !@#$%"
      }
    }'::jsonb,
    v_system_user_id,
    true,
    0
  )
  ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    examples = EXCLUDED.examples,
    updated_at = NOW();

  -- Build Activity: buildPackage
  INSERT INTO activities (
    id,
    name,
    description,
    input_schema,
    output_schema,
    package_name,
    module_path,
    function_name,
    category,
    tags,
    examples,
    created_by,
    is_active,
    usage_count
  ) VALUES (
    '11111111-1111-0000-0000-000000000002',
    'buildPackage',
    'Build a package with configurable build options and return build artifacts',
    '{
      "type": "object",
      "properties": {
        "packageName": {
          "type": "string",
          "description": "Name of the package to build"
        },
        "version": {
          "type": "string",
          "description": "Version to build",
          "default": "latest"
        },
        "buildOptions": {
          "type": "object",
          "description": "Build configuration options",
          "properties": {
            "minify": { "type": "boolean", "default": true },
            "sourceMaps": { "type": "boolean", "default": true },
            "target": { "type": "string", "enum": ["es2015", "es2020", "esnext"], "default": "es2020" }
          }
        }
      },
      "required": ["packageName"]
    }'::jsonb,
    '{
      "type": "object",
      "properties": {
        "success": { "type": "boolean" },
        "buildPath": { "type": "string" },
        "artifacts": { "type": "array", "items": { "type": "string" } },
        "duration": { "type": "number" }
      }
    }'::jsonb,
    'workflow-worker-service',
    './activities/sample.activities',
    'buildPackage',
    'Build',
    ARRAY['package', 'build', 'deployment', 'npm'],
    '{
      "basic": {
        "input": { "packageName": "my-package", "version": "1.0.0" },
        "output": { "success": true, "buildPath": "/dist", "artifacts": ["bundle.js"], "duration": 5000 }
      },
      "withOptions": {
        "input": {
          "packageName": "my-package",
          "version": "2.0.0",
          "buildOptions": { "minify": true, "sourceMaps": true, "target": "es2020" }
        },
        "output": { "success": true, "buildPath": "/dist", "artifacts": ["bundle.js", "bundle.js.map"], "duration": 7500 }
      }
    }'::jsonb,
    v_system_user_id,
    true,
    0
  )
  ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    examples = EXCLUDED.examples,
    updated_at = NOW();

  -- HTTP Activity: httpRequest
  INSERT INTO activities (
    id,
    name,
    description,
    input_schema,
    output_schema,
    package_name,
    module_path,
    function_name,
    category,
    tags,
    examples,
    created_by,
    is_active,
    usage_count
  ) VALUES (
    '11111111-1111-0000-0000-000000000003',
    'httpRequest',
    'Make HTTP requests with timeout and retry support, perfect for API integration',
    '{
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "format": "uri",
          "description": "Target URL for the HTTP request"
        },
        "method": {
          "type": "string",
          "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"],
          "default": "GET",
          "description": "HTTP method"
        },
        "body": {
          "type": "object",
          "description": "Request body for POST/PUT/PATCH requests"
        },
        "headers": {
          "type": "object",
          "description": "HTTP headers",
          "additionalProperties": { "type": "string" }
        },
        "timeout": {
          "type": "number",
          "default": 30000,
          "description": "Request timeout in milliseconds"
        }
      },
      "required": ["url"]
    }'::jsonb,
    '{
      "type": "object",
      "properties": {
        "status": { "type": "number", "description": "HTTP status code" },
        "data": { "description": "Response data" },
        "headers": { "type": "object", "description": "Response headers" }
      }
    }'::jsonb,
    'workflow-worker-service',
    './activities/sample.activities',
    'httpRequest',
    'HTTP',
    ARRAY['http', 'api', 'request', 'network', 'rest'],
    '{
      "get": {
        "input": { "url": "https://api.example.com/data", "method": "GET" },
        "output": { "status": 200, "data": { "result": "success" }, "headers": {} }
      },
      "post": {
        "input": {
          "url": "https://api.example.com/create",
          "method": "POST",
          "body": { "name": "test" },
          "headers": { "Content-Type": "application/json" }
        },
        "output": { "status": 201, "data": { "id": "123", "name": "test" }, "headers": {} }
      }
    }'::jsonb,
    v_system_user_id,
    true,
    0
  )
  ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    examples = EXCLUDED.examples,
    updated_at = NOW();

  -- Database Activity: executeQuery
  INSERT INTO activities (
    id,
    name,
    description,
    input_schema,
    output_schema,
    package_name,
    module_path,
    function_name,
    category,
    tags,
    examples,
    created_by,
    is_active,
    usage_count
  ) VALUES (
    '11111111-1111-0000-0000-000000000004',
    'executeQuery',
    'Execute a database query with connection pooling and parameter binding',
    '{
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "SQL query to execute (use $1, $2 for parameters)"
        },
        "params": {
          "type": "array",
          "description": "Query parameters",
          "items": { "description": "Parameter value" }
        },
        "timeout": {
          "type": "number",
          "default": 10000,
          "description": "Query timeout in milliseconds"
        }
      },
      "required": ["query"]
    }'::jsonb,
    '{
      "type": "object",
      "properties": {
        "rows": { "type": "array", "description": "Query results" },
        "rowCount": { "type": "number", "description": "Number of rows affected" },
        "fields": { "type": "array", "description": "Column metadata" }
      }
    }'::jsonb,
    'workflow-worker-service',
    './activities/database.activities',
    'executeQuery',
    'Database',
    ARRAY['database', 'sql', 'query', 'postgres'],
    '{
      "select": {
        "input": { "query": "SELECT * FROM users WHERE id = $1", "params": ["user-123"] },
        "output": { "rows": [{"id": "user-123", "name": "Test User"}], "rowCount": 1, "fields": [] }
      },
      "insert": {
        "input": { "query": "INSERT INTO logs (message) VALUES ($1)", "params": ["Log entry"] },
        "output": { "rows": [], "rowCount": 1, "fields": [] }
      }
    }'::jsonb,
    v_system_user_id,
    true,
    0
  )
  ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    examples = EXCLUDED.examples,
    updated_at = NOW();

  -- Transform Activity: transformData
  INSERT INTO activities (
    id,
    name,
    description,
    input_schema,
    output_schema,
    package_name,
    module_path,
    function_name,
    category,
    tags,
    examples,
    created_by,
    is_active,
    usage_count
  ) VALUES (
    '11111111-1111-0000-0000-000000000005',
    'transformData',
    'Transform data using JSONata expressions for complex data manipulation',
    '{
      "type": "object",
      "properties": {
        "data": {
          "description": "Input data to transform (any JSON structure)"
        },
        "expression": {
          "type": "string",
          "description": "JSONata expression for transformation"
        }
      },
      "required": ["data", "expression"]
    }'::jsonb,
    '{
      "description": "Transformed data result"
    }'::jsonb,
    'workflow-worker-service',
    './activities/transform.activities',
    'transformData',
    'Transform',
    ARRAY['transform', 'data', 'jsonata', 'mapping'],
    '{
      "simple": {
        "input": {
          "data": { "firstName": "John", "lastName": "Doe" },
          "expression": "firstName & '' '' & lastName"
        },
        "output": "John Doe"
      },
      "complex": {
        "input": {
          "data": { "users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}] },
          "expression": "users[age > 25].name"
        },
        "output": ["Alice"]
      }
    }'::jsonb,
    v_system_user_id,
    true,
    0
  )
  ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    examples = EXCLUDED.examples,
    updated_at = NOW();

  RAISE NOTICE 'Successfully seeded % activities', 5;
END $$;

-- Create RPC function for incrementing activity usage
-- This allows atomic increment without race conditions
CREATE OR REPLACE FUNCTION increment_activity_usage(activity_name TEXT)
RETURNS void AS $$
BEGIN
  UPDATE activities
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE name = activity_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_activity_usage IS 'Atomically increment activity usage count and update last used timestamp';
