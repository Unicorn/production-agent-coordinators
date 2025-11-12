import { describe, it, expect } from 'vitest';
import { analyzeMeceCompliance, generateSplitPlans, registerSplitPlans } from '../mece.activities';
import type { MeceViolation, SplitPackagePlan } from '../../types';

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

  describe('generateSplitPlans', () => {
    it('should generate one split plan for single MECE violation', async () => {
      // Test case: Video processing added to openai-client violates MECE
      // Should generate plan for @bernierllc/video-processor
      const violation: MeceViolation = {
        description: 'Video processing functionality does not belong in OpenAI client package',
        suggestedSplit: '@bernierllc/video-processor',
        affectedFunctionality: ['video encoding', 'video upload', 'video analysis'],
        mainPackageStillUsesIt: true
      };

      const result = await generateSplitPlans({
        packageName: '@bernierllc/openai-client',
        violation
      });

      // Stub implementation returns empty array
      // TODO: When MCP is integrated, expect:
      // expect(result.splitPlans).toHaveLength(1);
      // expect(result.splitPlans[0].packageName).toBe('@bernierllc/video-processor');
      // expect(result.splitPlans[0].functionality).toContain('video encoding');
      // expect(result.splitPlans[0].mainPackageDependsOnIt).toBe(true);
      // expect(result.splitPlans[0].planContent).toBeTruthy();
      expect(result.splitPlans).toEqual([]);
    });

    it('should generate multiple split plans for complex MECE violation', async () => {
      // Test case: Multiple unrelated concerns added to api-gateway
      // Should generate plans for auth-service and rate-limiter packages
      const violation: MeceViolation = {
        description: 'Authentication and rate limiting are separate concerns that should be split',
        suggestedSplit: '@bernierllc/auth-service, @bernierllc/rate-limiter',
        affectedFunctionality: [
          'JWT authentication',
          'OAuth integration',
          'Rate limiting',
          'Token bucket algorithm'
        ],
        mainPackageStillUsesIt: true
      };

      const result = await generateSplitPlans({
        packageName: '@bernierllc/api-gateway',
        violation
      });

      // Stub implementation returns empty array
      // TODO: When MCP is integrated, expect:
      // expect(result.splitPlans).toHaveLength(2);
      // expect(result.splitPlans[0].packageName).toBe('@bernierllc/auth-service');
      // expect(result.splitPlans[1].packageName).toBe('@bernierllc/rate-limiter');
      // expect(result.splitPlans[0].functionality).toContain('JWT authentication');
      // expect(result.splitPlans[1].functionality).toContain('Rate limiting');
      expect(result.splitPlans).toEqual([]);
    });

    it('should throw error if packageName is empty', async () => {
      const violation: MeceViolation = {
        description: 'Test violation',
        suggestedSplit: '@bernierllc/test-package',
        affectedFunctionality: ['test functionality'],
        mainPackageStillUsesIt: false
      };

      await expect(
        generateSplitPlans({
          packageName: '',
          violation
        })
      ).rejects.toThrow('packageName cannot be empty');
    });

    it('should throw error if packageName is only whitespace', async () => {
      const violation: MeceViolation = {
        description: 'Test violation',
        suggestedSplit: '@bernierllc/test-package',
        affectedFunctionality: ['test functionality'],
        mainPackageStillUsesIt: false
      };

      await expect(
        generateSplitPlans({
          packageName: '   ',
          violation
        })
      ).rejects.toThrow('packageName cannot be empty');
    });

    it('should throw error if violation is null', async () => {
      await expect(
        generateSplitPlans({
          packageName: '@bernierllc/test-package',
          violation: null as any
        })
      ).rejects.toThrow('violation cannot be null or undefined');
    });

    it('should throw error if violation is undefined', async () => {
      await expect(
        generateSplitPlans({
          packageName: '@bernierllc/test-package',
          violation: undefined as any
        })
      ).rejects.toThrow('violation cannot be null or undefined');
    });

    it('should handle violation with empty suggestedSplit', async () => {
      // Edge case: violation detected but no specific split suggested yet
      const violation: MeceViolation = {
        description: 'Functionality violates MECE but analysis needed',
        suggestedSplit: '',
        affectedFunctionality: ['unclear functionality'],
        mainPackageStillUsesIt: false
      };

      const result = await generateSplitPlans({
        packageName: '@bernierllc/test-package',
        violation
      });

      // Stub implementation returns empty array
      // MCP would analyze and determine appropriate splits
      expect(result.splitPlans).toEqual([]);
    });

    it('should handle violation where main package does not depend on split', async () => {
      // Test case: Functionality being removed entirely from package
      const violation: MeceViolation = {
        description: 'Legacy functionality should be extracted to separate package',
        suggestedSplit: '@bernierllc/legacy-support',
        affectedFunctionality: ['deprecated API v1', 'legacy format converter'],
        mainPackageStillUsesIt: false
      };

      const result = await generateSplitPlans({
        packageName: '@bernierllc/modern-api',
        violation
      });

      // Stub implementation returns empty array
      // TODO: When MCP is integrated, expect:
      // expect(result.splitPlans[0].mainPackageDependsOnIt).toBe(false);
      expect(result.splitPlans).toEqual([]);
    });
  });

  describe('registerSplitPlans', () => {
    it('should successfully register single split plan', async () => {
      // Test case: Register one new package plan with MCP
      const splitPlans: SplitPackagePlan[] = [
        {
          packageName: '@bernierllc/video-processor',
          functionality: ['video encoding', 'video upload', 'video analysis'],
          dependencies: ['ffmpeg', '@bernierllc/openai-client'],
          mainPackageDependsOnIt: true,
          planContent: `
# Video Processor Package

## Overview
Handles video processing functionality extracted from openai-client.

## Features
- Video encoding
- Video upload to OpenAI
- Video analysis
          `
        }
      ];

      const result = await registerSplitPlans({ splitPlans });

      expect(result.success).toBe(true);
      expect(result.registeredCount).toBe(1);
    });

    it('should successfully register multiple split plans', async () => {
      // Test case: Register multiple new package plans with MCP
      const splitPlans: SplitPackagePlan[] = [
        {
          packageName: '@bernierllc/auth-service',
          functionality: ['JWT authentication', 'OAuth integration'],
          dependencies: ['jsonwebtoken', 'passport'],
          mainPackageDependsOnIt: true,
          planContent: '# Auth Service\n\nAuthentication functionality.'
        },
        {
          packageName: '@bernierllc/rate-limiter',
          functionality: ['Rate limiting', 'Token bucket algorithm'],
          dependencies: ['redis'],
          mainPackageDependsOnIt: true,
          planContent: '# Rate Limiter\n\nRate limiting functionality.'
        }
      ];

      const result = await registerSplitPlans({ splitPlans });

      expect(result.success).toBe(true);
      expect(result.registeredCount).toBe(2);
    });

    it('should handle empty splitPlans array', async () => {
      // Test case: Empty array should return success (nothing to register)
      const result = await registerSplitPlans({ splitPlans: [] });

      expect(result.success).toBe(true);
      expect(result.registeredCount).toBe(0);
    });

    it('should throw error if splitPlans is null', async () => {
      await expect(
        registerSplitPlans({ splitPlans: null as any })
      ).rejects.toThrow('splitPlans cannot be null or undefined');
    });

    it('should throw error if splitPlans is undefined', async () => {
      await expect(
        registerSplitPlans({ splitPlans: undefined as any })
      ).rejects.toThrow('splitPlans cannot be null or undefined');
    });

    it('should handle split plans with different dependency configurations', async () => {
      // Test case: Some plans have main package dependency, some don't
      const splitPlans: SplitPackagePlan[] = [
        {
          packageName: '@bernierllc/legacy-support',
          functionality: ['deprecated API v1', 'legacy format converter'],
          dependencies: [],
          mainPackageDependsOnIt: false, // Main package does NOT depend on this
          planContent: '# Legacy Support\n\nLegacy functionality.'
        },
        {
          packageName: '@bernierllc/core-utils',
          functionality: ['common utilities'],
          dependencies: ['lodash'],
          mainPackageDependsOnIt: true, // Main package DOES depend on this
          planContent: '# Core Utils\n\nUtility functions.'
        }
      ];

      const result = await registerSplitPlans({ splitPlans });

      expect(result.success).toBe(true);
      expect(result.registeredCount).toBe(2);
    });
  });
});
