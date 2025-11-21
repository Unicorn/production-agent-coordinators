/**
 * Sample Activities for Workflow Builder
 *
 * These activities demonstrate basic activity patterns and are used for testing.
 * Custom activities are loaded dynamically from the database per project.
 */

/**
 * Sample activity that processes a message
 * Demonstrates basic activity with simple input/output
 */
export async function sampleActivity(input: { message: string }): Promise<string> {
  console.log('[Sample Activity] Executing with message:', input.message);

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 1000));

  const result = `Processed: ${input.message}`;
  console.log('[Sample Activity] Result:', result);

  return result;
}

/**
 * Build package activity placeholder
 * This will be replaced by actual implementation from package-builder agent
 */
export async function buildPackage(input: {
  packageName: string;
  version?: string;
  options?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  packageName: string;
  buildTime: number;
  artifacts?: string[];
}> {
  console.log('[Build Package] Building:', input.packageName);

  const startTime = Date.now();

  // Simulate package building
  await new Promise(resolve => setTimeout(resolve, 2000));

  const buildTime = Date.now() - startTime;

  console.log('[Build Package] Completed in', buildTime, 'ms');

  return {
    success: true,
    packageName: input.packageName,
    buildTime,
    artifacts: [
      `${input.packageName}-${input.version || '1.0.0'}.tar.gz`,
      `${input.packageName}-${input.version || '1.0.0'}.zip`,
    ],
  };
}

/**
 * HTTP request activity
 * Makes HTTP requests from workflows
 */
export async function httpRequest(input: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}): Promise<{
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
}> {
  console.log('[HTTP Request]', input.method || 'GET', input.url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeout || 30000);

  try {
    const response = await fetch(input.url, {
      method: input.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...input.headers,
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => response.text());
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    console.log('[HTTP Request] Response:', response.status, response.statusText);

    return {
      status: response.status,
      statusText: response.statusText,
      data,
      headers,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[HTTP Request] Error:', error);
    throw error;
  }
}

/**
 * Data transformation activity
 * Transforms data using provided transformation function
 */
export async function transformData(input: {
  data: unknown;
  transformation: 'uppercase' | 'lowercase' | 'reverse' | 'json-parse' | 'json-stringify';
}): Promise<unknown> {
  console.log('[Transform Data] Applying:', input.transformation);

  switch (input.transformation) {
    case 'uppercase':
      return typeof input.data === 'string' ? input.data.toUpperCase() : input.data;

    case 'lowercase':
      return typeof input.data === 'string' ? input.data.toLowerCase() : input.data;

    case 'reverse':
      return typeof input.data === 'string'
        ? input.data.split('').reverse().join('')
        : input.data;

    case 'json-parse':
      return typeof input.data === 'string' ? JSON.parse(input.data) : input.data;

    case 'json-stringify':
      return JSON.stringify(input.data, null, 2);

    default:
      return input.data;
  }
}

/**
 * Wait/delay activity
 * Introduces a delay in workflow execution
 */
export async function waitFor(input: {
  milliseconds: number;
  reason?: string;
}): Promise<{ waited: number; reason?: string }> {
  console.log('[Wait] Waiting for', input.milliseconds, 'ms', input.reason ? `(${input.reason})` : '');

  const startTime = Date.now();
  await new Promise(resolve => setTimeout(resolve, input.milliseconds));
  const actualWait = Date.now() - startTime;

  console.log('[Wait] Completed after', actualWait, 'ms');

  return {
    waited: actualWait,
    reason: input.reason,
  };
}

/**
 * Log activity
 * Logs messages at different levels
 */
export async function logMessage(input: {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${input.level.toUpperCase()}] ${input.message}`;

  switch (input.level) {
    case 'debug':
      console.debug(logEntry, input.data || '');
      break;
    case 'info':
      console.info(logEntry, input.data || '');
      break;
    case 'warn':
      console.warn(logEntry, input.data || '');
      break;
    case 'error':
      console.error(logEntry, input.data || '');
      break;
  }
}

/**
 * Validate data activity
 * Performs basic data validation
 */
export async function validateData(input: {
  data: unknown;
  rules: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}): Promise<{
  valid: boolean;
  errors: string[];
}> {
  console.log('[Validate Data] Validating with rules:', input.rules);

  const errors: string[] = [];

  // Required check
  if (input.rules.required && (input.data === null || input.data === undefined)) {
    errors.push('Data is required but not provided');
  }

  // Type check
  if (input.rules.type && input.data !== null && input.data !== undefined) {
    const actualType = Array.isArray(input.data) ? 'array' : typeof input.data;
    if (actualType !== input.rules.type) {
      errors.push(`Expected type ${input.rules.type} but got ${actualType}`);
    }
  }

  // Length checks for strings and arrays
  if (typeof input.data === 'string' || Array.isArray(input.data)) {
    const length = input.data.length;

    if (input.rules.minLength !== undefined && length < input.rules.minLength) {
      errors.push(`Length ${length} is less than minimum ${input.rules.minLength}`);
    }

    if (input.rules.maxLength !== undefined && length > input.rules.maxLength) {
      errors.push(`Length ${length} exceeds maximum ${input.rules.maxLength}`);
    }
  }

  // Pattern check for strings
  if (input.rules.pattern && typeof input.data === 'string') {
    const regex = new RegExp(input.rules.pattern);
    if (!regex.test(input.data)) {
      errors.push(`Data does not match pattern: ${input.rules.pattern}`);
    }
  }

  const valid = errors.length === 0;
  console.log('[Validate Data] Result:', valid ? 'VALID' : 'INVALID', errors);

  return { valid, errors };
}
