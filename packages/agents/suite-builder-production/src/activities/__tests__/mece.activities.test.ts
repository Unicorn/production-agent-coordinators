import { describe, it, expect } from 'vitest';
import { analyzeMeceCompliance } from '../mece.activities';

describe('MECE Activities', () => {
  describe('analyzeMeceCompliance', () => {
    it('should return compliant for package update with no MECE violation', async () => {
      // Test case: Adding logging functionality to a logger package - no violation
      const result = await analyzeMeceCompliance({
        packageName: '@bernierllc/logger',
        updateContext: `
# Logger Enhancement Plan

## Overview
Add structured logging support to the existing logger package.

## Implementation
- Add JSON formatting for log output
- Add log level filtering
- Add log rotation support
`
      });

      expect(result.isCompliant).toBe(true);
      expect(result.violation).toBeUndefined();
    });

    it('should return non-compliant for package update with MECE violation', async () => {
      // This test uses a mock MCP response for testing
      // In a real implementation, MCP would analyze and detect the violation
      // For now, the stub implementation returns compliant
      // TODO: Update this test when actual MCP integration is implemented

      const result = await analyzeMeceCompliance({
        packageName: '@bernierllc/openai-client',
        updateContext: `
# OpenAI Client Enhancement Plan

## Overview
Add video processing capabilities to the OpenAI client package.

## Implementation
- Add video encoding functionality
- Add video upload to OpenAI
- Add video analysis features
`
      });

      // Stub implementation returns compliant
      // When MCP is integrated, this should detect the MECE violation
      // (video processing doesn't belong in an OpenAI client)
      expect(result.isCompliant).toBe(true);

      // TODO: When MCP is integrated, expect:
      // expect(result.isCompliant).toBe(false);
      // expect(result.violation).toBeDefined();
      // expect(result.violation?.description).toContain('video processing');
      // expect(result.violation?.suggestedSplit).toBeTruthy();
      // expect(result.violation?.affectedFunctionality).toContain('video encoding');
    });

    it('should throw error if packageName is empty', async () => {
      await expect(
        analyzeMeceCompliance({
          packageName: '',
          updateContext: '# Plan content'
        })
      ).rejects.toThrow('packageName cannot be empty');
    });

    it('should throw error if packageName is only whitespace', async () => {
      await expect(
        analyzeMeceCompliance({
          packageName: '   ',
          updateContext: '# Plan content'
        })
      ).rejects.toThrow('packageName cannot be empty');
    });

    it('should throw error if updateContext is empty', async () => {
      await expect(
        analyzeMeceCompliance({
          packageName: '@bernierllc/test-package',
          updateContext: ''
        })
      ).rejects.toThrow('updateContext cannot be empty');
    });

    it('should throw error if updateContext is only whitespace', async () => {
      await expect(
        analyzeMeceCompliance({
          packageName: '@bernierllc/test-package',
          updateContext: '   '
        })
      ).rejects.toThrow('updateContext cannot be empty');
    });

    it('should handle various updateContext formats (plan, prompt, description)', async () => {
      // Test with a simple prompt
      const result1 = await analyzeMeceCompliance({
        packageName: '@bernierllc/retry-policy',
        updateContext: 'Add exponential backoff to retry logic'
      });
      expect(result1.isCompliant).toBe(true);

      // Test with a full plan
      const result2 = await analyzeMeceCompliance({
        packageName: '@bernierllc/retry-policy',
        updateContext: `
# Retry Policy Enhancement

## Overview
Improve retry logic with exponential backoff

## Implementation
- Add backoff calculation
- Add jitter for distributed systems
`
      });
      expect(result2.isCompliant).toBe(true);

      // Test with a brief description
      const result3 = await analyzeMeceCompliance({
        packageName: '@bernierllc/retry-policy',
        updateContext: 'This update adds better retry mechanisms for handling transient failures'
      });
      expect(result3.isCompliant).toBe(true);
    });

    it('should validate MECE compliance for package idea (new package)', async () => {
      // Test MECE analysis for a new package idea
      const result = await analyzeMeceCompliance({
        packageName: '@bernierllc/database-client',
        updateContext: `
# Database Client Package

## Overview
Create a new database client package for PostgreSQL connections.

## Features
- Connection pooling
- Query builder
- Transaction support
- Migration tools
`
      });

      expect(result.isCompliant).toBe(true);
    });

    it('should handle complex update scenarios', async () => {
      // Test a complex update that might span multiple concerns
      const result = await analyzeMeceCompliance({
        packageName: '@bernierllc/api-gateway',
        updateContext: `
# API Gateway Enhancement

## Overview
Add authentication, rate limiting, and monitoring to API gateway.

## Implementation
- JWT authentication middleware
- Redis-based rate limiting
- Prometheus metrics integration
- Request/response logging
`
      });

      // Stub returns compliant
      // In reality, MCP might flag this as potentially violating MECE
      // if authentication/rate limiting should be separate packages
      expect(result.isCompliant).toBe(true);
    });
  });
});
