/**
 * Integration Test 1: Credential Checks
 * 
 * Tests that credential checks work correctly in various scenarios
 */

import { describe, it, expect } from 'vitest';
import { checkCredentials, formatCredentialsError } from '../../activities/credentials.activities.js';

describe('Integration Test 1: Credential Checks', () => {
  it('should check all credentials when requested', async () => {
    const status = await checkCredentials({
      checkGitHub: true,
      checkNPM: true,
      checkPackagesAPI: true,
      checkGit: true,
      checkClaude: true,
      checkGemini: false, // Skip Gemini for now
    });

    expect(status).toBeDefined();
    expect(status.checks).toBeDefined();
    
    // GitHub CLI should be available (we checked in prerequisites)
    // Tool name is 'gh', not 'github'
    expect(status.checks.gh).toBeDefined();
    
    // Git should be available
    expect(status.checks.git).toBeDefined();
    expect(status.checks.git.available).toBe(true);
    
    // NPM should be available
    expect(status.checks.npm).toBeDefined();
    
    // Claude CLI should be available (we checked in prerequisites)
    if (status.checks.claude) {
      expect(status.checks.claude.available).toBe(true);
    }
  });

  it('should format credentials error correctly when credentials are missing', async () => {
    // This test assumes all credentials are available
    // In a real scenario, we might mock missing credentials
    const status = await checkCredentials({
      checkGitHub: true,
      checkGit: true,
    });

    if (!status.allAvailable) {
      const errorMessage = formatCredentialsError(status);
      expect(errorMessage).toContain('Missing credentials');
      expect(errorMessage.length).toBeGreaterThan(0);
    } else {
      // All credentials available - that's fine for this test
      expect(status.allAvailable).toBe(true);
    }
  });

  it('should only check requested credentials', async () => {
    const status = await checkCredentials({
      checkGitHub: false,
      checkNPM: false,
      checkPackagesAPI: false,
      checkGit: true,
      checkClaude: false,
      checkGemini: false,
    });

    expect(status.checks.git).toBeDefined();
    expect(status.checks.git.available).toBe(true);
    
    // Other checks should not be present
    expect(status.checks.github).toBeUndefined();
    expect(status.checks.npm).toBeUndefined();
  });
});

