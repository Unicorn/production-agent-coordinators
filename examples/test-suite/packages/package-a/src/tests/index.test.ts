/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { readPlanFile } from '../index';
import { PackageResult } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('readPlanFile', () => {
  const TEST_DIR = path.join(__dirname, 'test-data');
  const TEST_FILE_PATH = path.join(TEST_DIR, 'plan.md');
  const NON_EXISTENT_FILE_PATH = path.join(TEST_DIR, 'non-existent.md');
  const INVALID_PATH = '';

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.writeFile(TEST_FILE_PATH, 'This is a test plan file content.', 'utf-8');
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should successfully read a valid plan file', async () => {
    const result: PackageResult<{ content: string; filePath: string }> = await readPlanFile(TEST_FILE_PATH);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.content).toBe('This is a test plan file content.');
    expect(result.data?.filePath).toBe(path.resolve(TEST_FILE_PATH));
    expect(result.error).toBeUndefined();
  });

  it('should return an error for a non-existent file', async () => {
    const result = await readPlanFile(NON_EXISTENT_FILE_PATH);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toContain('no such file or directory');
  });

  it('should return an error for an invalid file path (empty string)', async () => {
    const result = await readPlanFile(INVALID_PATH);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toBe('File path must be a non-empty string.');
  });

  it('should return an error for an invalid file path (non-string)', async () => {
    // @ts-expect-error - Testing invalid input type
    const result = await readPlanFile(null);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toBe('File path must be a non-empty string.');
  });
});