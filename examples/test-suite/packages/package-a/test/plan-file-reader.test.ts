/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { readPlanFile } from '../src/plan-file-reader';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('readPlanFile', () => {
  const testPlansDir = path.join(__dirname, 'test-plans');
  const validPlanFilePath = path.join(testPlansDir, 'valid-plan.json');
  const invalidJsonFilePath = path.join(testPlansDir, 'invalid-json.json');
  const missingTopLevelFieldsFilePath = path.join(testPlansDir, 'missing-top-level-fields-plan.json');
  const missingActivityDescriptionPath = path.join(testPlansDir, 'missing-activity-description.json');
  const nonExistentFilePath = path.join(testPlansDir, 'non-existent-plan.json');
  const invalidActivityStatusPath = path.join(testPlansDir, 'invalid-activity-status.json');

  beforeAll(async () => {
    await fs.mkdir(testPlansDir, { recursive: true });

    await fs.writeFile(validPlanFilePath, JSON.stringify({
      name: 'Test Plan A',
      description: 'A valid plan for testing.',
      version: '1.0.0',
      activities: [
        { id: 'act1', description: 'Activity 1', status: 'pending' },
        { id: 'act2', description: 'Activity 2', status: 'in-progress', dependsOn: ['act1'] }
      ]
    }), 'utf-8');

    await fs.writeFile(invalidJsonFilePath, '{ "name": "Invalid JSON", "activities": [ }', 'utf-8');

    // This file is missing the top-level 'version' field
    await fs.writeFile(missingTopLevelFieldsFilePath, JSON.stringify({
      name: 'Missing Top-Level Fields',
      description: 'Missing version field',
      activities: [
        { id: 'act1', description: 'Activity 1', status: 'pending' }
      ]
    }), 'utf-8');

    // This file has a valid top-level structure, but an activity is missing 'description'
    await fs.writeFile(missingActivityDescriptionPath, JSON.stringify({
      name: 'Missing Activity Fields',
      description: 'A plan with an activity missing description.',
      version: '1.0.0',
      activities: [
        { id: 'act1', status: 'pending' } // Missing description
      ]
    }), 'utf-8');

    await fs.writeFile(invalidActivityStatusPath, JSON.stringify({
      name: 'Invalid Status Plan',
      version: '1.0.0',
      activities: [
        { id: 'act1', description: 'Activity 1', status: 'unknown_status' } // Invalid status
      ]
    }), 'utf-8');
  });

  afterAll(async () => {
    await fs.rm(testPlansDir, { recursive: true, force: true });
  });

  it('should successfully read and parse a valid plan file', async () => {
    const result = await readPlanFile(validPlanFilePath);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.name).toBe('Test Plan A');
    expect(result.data?.version).toBe('1.0.0');
    expect(result.data?.activities.length).toBe(2);
    expect(result.data?.activities[0].id).toBe('act1');
    expect(result.data?.activities[1].status).toBe('in-progress');
  });

  it('should return an error for a non-existent file', async () => {
    const result = await readPlanFile(nonExistentFilePath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read or parse plan file');
  });

  it('should return an error for invalid JSON content', async () => {
    const result = await readPlanFile(invalidJsonFilePath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read or parse plan file');
  });

  it('should return an error for a plan file with missing top-level required fields (e.g., version)', async () => {
    const result = await readPlanFile(missingTopLevelFieldsFilePath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid plan file structure: Missing name, version, or activities array.');
  });

  it('should return an error for an activity with missing required fields (e.g., description)', async () => {
    const result = await readPlanFile(missingActivityDescriptionPath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid activity structure: Activity missing id, description, or status.');
  });

  it('should return an error for an activity with an invalid status', async () => {
    const result = await readPlanFile(invalidActivityStatusPath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid activity status');
  });

  it('should return an error for an empty file path', async () => {
    const result = await readPlanFile('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('File path cannot be empty.');
  });
});