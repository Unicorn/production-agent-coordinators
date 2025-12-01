import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

// --- Mocks ---
// 1. Define mock functions (so you can assert on them later)
const execMock = vi.fn();
const promisifyMock = vi.fn((fn: any) => fn); // A basic mock promisify

// This will be the result of promisifyMock(execMock) inside activities.ts
let mockExecPromise: ReturnType<typeof vi.fn>; 

// Mock all external modules first
vi.mock('fs/promises');
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid'),
}));
vi.mock('@coordinator/engine', () => ({
  Engine: vi.fn(() => ({
    processDecision: vi.fn((state) => ({ ...state, status: 'MOCKED_DECISION' })),
    processAgentResponse: vi.fn((state) => ({ ...state, status: 'MOCKED_RESPONSE' })),
  })),
}));

// 2. Mock Node built-ins by module specifier
vi.mock('node:child_process', () => ({
  exec: execMock,
}));

vi.mock('node:util', () => ({
  promisify: promisifyMock,
}));

// 3. Import the module under test *after* mocks are defined
// This ensures that activities.ts evaluates using the mocked built-ins
const activities = await import('../activities');


describe('Temporal Coordinator Activities', () => {
  const MOCK_BASE_PATH = '/tmp/test-builds';
  const MOCK_WORKING_DIR = path.join(MOCK_BASE_PATH, 'build-mock-uuid');

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Re-initialize mockExecPromise for each test as promisifyMock will be called again
    mockExecPromise = promisifyMock(execMock);
    
    // Mock fs operations
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.appendFile as any).mockResolvedValue(undefined);

    // Mock randomUUID
    (randomUUID as any).mockReturnValue('mock-uuid');

    // Default mock implementation for mockExecPromise (for passing cases)
    mockExecPromise.mockResolvedValue({ stdout: 'mocked output', stderr: '' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- setupWorkspace tests ---
  describe('setupWorkspace', () => {
    it('should create a unique workspace directory and return its path', async () => {
      const result = await activities.setupWorkspace(MOCK_BASE_PATH);

      expect(randomUUID).toHaveBeenCalledOnce();
      expect(fs.mkdir).toHaveBeenCalledWith(MOCK_WORKING_DIR, { recursive: true });
      expect(result).toBe(MOCK_WORKING_DIR);
    });

    it('should throw an error if directory creation fails', async () => {
      const mockError = new Error('Permission denied');
      (fs.mkdir as any).mockRejectedValue(mockError);

      await expect(activities.setupWorkspace(MOCK_BASE_PATH)).rejects.toThrow(mockError);
    });
  });

  // --- logAuditEntry tests ---
  describe('logAuditEntry', () => {
    const MOCK_ENTRY = {
      workflow_run_id: 'test-run-id',
      step_name: 'test_step',
      validation_status: 'pass',
    };
    const MOCK_AUDIT_PATH = path.join(MOCK_WORKING_DIR, 'audit_trace.jsonl');

    it('should append a JSON stringified entry to audit_trace.jsonl', async () => {
      await activities.logAuditEntry(MOCK_WORKING_DIR, MOCK_ENTRY);

      const [callPath, callContent] = (fs.appendFile as Vi.Mock).mock.calls[0];
      expect(callPath).toBe(MOCK_AUDIT_PATH);
      
      const parsedContent = JSON.parse(callContent);
      expect(parsedContent).toMatchObject(MOCK_ENTRY);
      expect(typeof parsedContent.timestamp).toBe('string');
      expect(callContent).toContain('\n'); // Ensure it ends with a newline
    });

    it('should include a timestamp in the logged entry', async () => {
      const now = new Date();
      vi.setSystemTime(now); // Set system time for deterministic timestamp

      await activities.logAuditEntry(MOCK_WORKING_DIR, MOCK_ENTRY);

      const expectedLoggedContent = JSON.stringify({ ...MOCK_ENTRY, timestamp: now.toISOString() }) + '\n';
      expect(fs.appendFile).toHaveBeenCalledWith(MOCK_AUDIT_PATH, expectedLoggedContent);

      vi.useRealTimers(); // Restore real timers
    });

    it('should throw an error if appending to file fails', async () => {
      const mockError = new Error('Disk full');
      (fs.appendFile as any).mockRejectedValue(mockError);

      await expect(activities.logAuditEntry(MOCK_WORKING_DIR, MOCK_ENTRY)).rejects.toThrow(mockError);
    });
  });

  // --- executeGeminiAgent tests ---
  describe('executeGeminiAgent', () => {
    const MOCK_INSTRUCTION = 'Write a simple hello world function';
    const MOCK_CONTEXT = '# SPEC\nHello world';
    const MOCK_GEMINI_MD_PATH = path.join(MOCK_WORKING_DIR, 'GEMINI.md');

    it('should write context to GEMINI.md if provided', async () => {
      await activities.executeGeminiAgent({
        instruction: MOCK_INSTRUCTION,
        workingDir: MOCK_WORKING_DIR,
        contextContent: MOCK_CONTEXT,
      });

      expect(fs.writeFile).toHaveBeenCalledWith(MOCK_GEMINI_MD_PATH, MOCK_CONTEXT);
    });

    it('should not write GEMINI.md if contextContent is not provided', async () => {
      await activities.executeGeminiAgent({
        instruction: MOCK_INSTRUCTION,
        workingDir: MOCK_WORKING_DIR,
      });

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should execute the gemini CLI command correctly', async () => {
      // New Gemini CLI format: positional prompt with instruction to read GEMINI.md
      const expectedCommand = `gemini 'First, read the GEMINI.md file in the current directory for project requirements and context. Then: Write a simple hello world function' --yolo -o json`;

      await activities.executeGeminiAgent({
        instruction: MOCK_INSTRUCTION,
        workingDir: MOCK_WORKING_DIR,
        contextContent: MOCK_CONTEXT,
      });

      expect(mockExecPromise).toHaveBeenCalledWith(expectedCommand, { cwd: MOCK_WORKING_DIR });
    });

    it('should return parsed JSON output on success', async () => {
      const mockGeminiResponse = { status: 'OK', content: 'console.log("Hello World");' };
      mockExecPromise.mockResolvedValue({ stdout: JSON.stringify(mockGeminiResponse), stderr: '' });

      const result = await activities.executeGeminiAgent({
        instruction: MOCK_INSTRUCTION,
        workingDir: MOCK_WORKING_DIR,
        contextContent: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      expect(result.agentResponse).toEqual(mockGeminiResponse);
      expect(result.rawOutput).toBeUndefined();
    });

    it('should return raw output if JSON parsing fails', async () => {
      const rawOutput = 'Agent thinking... (not JSON)';
      mockExecPromise.mockResolvedValue({ stdout: rawOutput, stderr: '' });

      const result = await activities.executeGeminiAgent({
        instruction: MOCK_INSTRUCTION,
        workingDir: MOCK_WORKING_DIR,
        contextContent: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      expect(result.agentResponse).toBeUndefined();
      expect(result.rawOutput).toBe(rawOutput);
    });

    it('should throw an error if the CLI command fails', async () => {
      const mockError = { stderr: 'Gemini CLI error', message: 'Command failed' };
      mockExecPromise.mockRejectedValue(mockError);

      await expect(
        activities.executeGeminiAgent({
          instruction: MOCK_INSTRUCTION,
          workingDir: MOCK_WORKING_DIR,
          contextContent: MOCK_CONTEXT,
        })
      ).rejects.toThrow('Gemini CLI failed: Gemini CLI error');
    });
  });

  // --- runComplianceChecks tests ---
  describe('runComplianceChecks', () => {
    it('should return success if all commands pass', async () => {
      mockExecPromise.mockResolvedValue({ stdout: 'ok', stderr: '' });

      const result = await activities.runComplianceChecks(MOCK_WORKING_DIR);

      expect(result.success).toBe(true);
      expect(result.output).toContain('SUCCESS: npm install');
      expect(result.output).toContain('SUCCESS: npm run build');
      expect(result.output).toContain('SUCCESS: npm run lint');
      expect(mockExecPromise).toHaveBeenCalledTimes(4);
    });

    it('should return failure if npm install fails', async () => {
      mockExecPromise.mockRejectedValueOnce({ stdout: '', stderr: 'Install failed', message: 'Command failed' });

      const result = await activities.runComplianceChecks(MOCK_WORKING_DIR);

      expect(result.success).toBe(false);
      expect(result.output).toContain('FAILURE DETECTED at command: npm install');
      expect(result.errors?.[0].type).toBe('npm install failure');
      expect(mockExecPromise).toHaveBeenCalledTimes(1);
    });

    it('should return failure if npm run build fails', async () => {
      mockExecPromise
        .mockResolvedValueOnce({ stdout: 'install ok', stderr: '' }) // npm install passes
        .mockRejectedValueOnce({ stdout: '', stderr: 'Build error', message: 'Command failed' }); // npm run build fails

      const result = await activities.runComplianceChecks(MOCK_WORKING_DIR);

      expect(result.success).toBe(false);
      expect(result.output).toContain('FAILURE DETECTED at command: npm run build');
      expect(result.errors?.[0].type).toBe('build error');
      expect(mockExecPromise).toHaveBeenCalledTimes(2);
    });

    it('should return failure if npm run lint fails', async () => {
      mockExecPromise
        .mockResolvedValueOnce({ stdout: 'install ok', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'build ok', stderr: '' })
        .mockRejectedValueOnce({ stdout: 'lint output', stderr: 'Lint errors', message: 'Command failed' });

      const result = await activities.runComplianceChecks(MOCK_WORKING_DIR);

      expect(result.success).toBe(false);
      expect(result.output).toContain('FAILURE DETECTED at command: npm run lint');
      expect(result.errors?.[0].type).toBe('lint error');
      expect(mockExecPromise).toHaveBeenCalledTimes(3);
    });

    it('should return failure if npm test fails', async () => {
      mockExecPromise
        .mockResolvedValueOnce({ stdout: 'install ok', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'build ok', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'lint ok', stderr: '' })
        .mockRejectedValueOnce({ stdout: 'test output', stderr: 'Test failed', message: 'Command failed' });

      const result = await activities.runComplianceChecks(MOCK_WORKING_DIR);

      expect(result.success).toBe(false);
      expect(result.output).toContain('FAILURE DETECTED at command: npm test');
      expect(result.errors?.[0].type).toBe('test failure');
      expect(mockExecPromise).toHaveBeenCalledTimes(4);
    });
  });
});
