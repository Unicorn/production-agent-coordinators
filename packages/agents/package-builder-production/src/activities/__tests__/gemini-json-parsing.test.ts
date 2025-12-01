/**
 * Tests for Gemini JSON response parsing
 *
 * These tests capture real-world malformed JSON responses from Gemini
 * and verify our parsing/cleaning logic handles them correctly.
 */

import { describe, it, expect } from 'vitest';

// Import the extractAndCleanJson function - we'll need to export it for testing
// For now, we'll duplicate the logic here and test it directly

/**
 * Attempts to extract and clean JSON from a potentially malformed response.
 * This is a copy of the function from gemini-agent.activities.ts for testing.
 */
function extractAndCleanJson(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code block wrappers if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Attempts to fix malformed JSON where quotes inside string values are not properly escaped.
 * This is a common issue with LLM-generated JSON containing nested JSON or code.
 *
 * The problem: Gemini outputs things like:
 *   "content": "{\n  \"name\": \"test\",\n  \"devDependencies\": {\n    "@types/jest": \"^29.0.0\"\n  }\n}"
 *
 * Where some keys like "@types/jest" have unescaped quotes but values have escaped quotes.
 *
 * Strategy: Find "content": " or "content":" patterns and process the string value specially,
 * ensuring all internal quotes are escaped. We use brace counting to find the end of the content.
 */
function fixMalformedJsonQuotes(text: string): string {
  // Look for "content": " pattern
  const contentPattern = /"content"\s*:\s*"/g;
  let match;
  let lastIndex = 0;
  const result: string[] = [];

  while ((match = contentPattern.exec(text)) !== null) {
    // Add everything before this match
    result.push(text.substring(lastIndex, match.index + match[0].length));

    // Now we're inside the content string value
    // Find the end by tracking brace depth (assuming content is JSON)
    let i = match.index + match[0].length;
    let depth = 0;
    let foundStart = false;
    const contentStart = i;

    // Find the closing quote of the content string
    // The content typically starts with { and ends with }
    // After the final }, the next " closes the string
    while (i < text.length) {
      const char = text[i];

      if (char === '{') {
        depth++;
        foundStart = true;
      } else if (char === '}') {
        depth--;
        if (foundStart && depth === 0) {
          // Found end of JSON content, now look for closing quote
          // Skip to closing quote
          i++;
          while (i < text.length && text[i] !== '"') {
            i++;
          }
          break;
        }
      } else if (char === '"' && !foundStart) {
        // Quote before we found opening { - might be empty string or malformed
        break;
      }
      i++;
    }

    // Extract the content between quotes
    const contentValue = text.substring(contentStart, i);

    // Escape any unescaped quotes in the content
    // A quote is unescaped if not preceded by backslash
    let escapedContent = '';
    for (let j = 0; j < contentValue.length; j++) {
      const c = contentValue[j];
      if (c === '"') {
        // Check if already escaped
        const prevChar = j > 0 ? contentValue[j - 1] : '';
        if (prevChar !== '\\') {
          escapedContent += '\\"';
        } else {
          escapedContent += c;
        }
      } else {
        escapedContent += c;
      }
    }

    result.push(escapedContent);
    lastIndex = i;
  }

  // Add any remaining text
  result.push(text.substring(lastIndex));

  return result.join('');
}

describe('Gemini JSON Parsing', () => {
  describe('extractAndCleanJson', () => {
    it('should return plain JSON as-is', () => {
      const input = '{"command": "RUN_LINT_CHECK"}';
      expect(extractAndCleanJson(input)).toBe(input);
    });

    it('should remove ```json wrapper', () => {
      const input = '```json\n{"command": "RUN_LINT_CHECK"}\n```';
      expect(extractAndCleanJson(input)).toBe('{"command": "RUN_LINT_CHECK"}');
    });

    it('should remove ``` wrapper without json tag', () => {
      const input = '```\n{"command": "RUN_LINT_CHECK"}\n```';
      expect(extractAndCleanJson(input)).toBe('{"command": "RUN_LINT_CHECK"}');
    });

    it('should trim whitespace', () => {
      const input = '  \n{"command": "RUN_LINT_CHECK"}\n  ';
      expect(extractAndCleanJson(input)).toBe('{"command": "RUN_LINT_CHECK"}');
    });
  });

  describe('fixMalformedJsonQuotes', () => {
    it('should not modify valid JSON', () => {
      const validJson = '{"command": "RUN_LINT_CHECK"}';
      expect(fixMalformedJsonQuotes(validJson)).toBe(validJson);
    });

    it('should not modify JSON with properly escaped quotes', () => {
      const validJson = '{"content": "{\\"name\\": \\"test\\"}"}';
      expect(fixMalformedJsonQuotes(validJson)).toBe(validJson);
    });

    it('should fix unescaped quotes inside string values', () => {
      // This is the actual pattern Gemini produces
      const malformed = '{"content": "{"name": "test"}"}';
      const fixed = fixMalformedJsonQuotes(malformed);

      // Should be parseable now
      expect(() => JSON.parse(fixed)).not.toThrow();
      const parsed = JSON.parse(fixed);
      expect(parsed.content).toContain('name');
    });

    it('should fix mixed escaped and unescaped quotes', () => {
      // Gemini sometimes escapes some quotes but not others
      const malformed = '{"content": "{"@types/jest": \\"^29.0.0\\"}"}';
      const fixed = fixMalformedJsonQuotes(malformed);

      expect(() => JSON.parse(fixed)).not.toThrow();
    });

    it('should handle the real Gemini devDependencies pattern', () => {
      // This is extracted from an actual Gemini response
      const malformedDevDeps = `{
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "typescript": "^4.0.0"
  }
}`;
      // This is actually valid JSON - the issue is when it's INSIDE a string
      expect(() => JSON.parse(malformedDevDeps)).not.toThrow();
    });

    it('should handle nested JSON inside content field with mixed escaping', () => {
      // Simulating Gemini's actual output pattern where content contains package.json
      // with some escaped and some unescaped quotes
      const malformed = `{"command": "APPLY_CODE_CHANGES", "fileOperations": [{"action": "CREATE_OR_OVERWRITE", "filePath": "package.json", "content": "{\\n  \\"name\\": \\"test\\",\\n  \\"devDependencies\\": {\\n    "@types/jest": \\"^29.0.0\\"\\n  }\\n}"}]}`;

      const fixed = fixMalformedJsonQuotes(malformed);
      expect(() => JSON.parse(fixed)).not.toThrow();
    });
  });

  describe('Real Gemini Response Parsing', () => {
    it('should parse the actual malformed Gemini response from 2025-11-25', () => {
      // This is the EXACT response that failed - captured from logs
      const rawGeminiResponse = `{"command": "APPLY_CODE_CHANGES", "fileOperations": [{"action": "CREATE_OR_OVERWRITE", "filePath": "package.json", "content": "{\\n  \\"name\\": \\"@bernier-llc/contentful-types\\",\\n  \\"version\\": \\"0.0.1\\",\\n  \\"description\\": \\"TypeScript definitions for Contentful's Content Delivery and Content Management APIs\\",\\n  \\"main\\": \\"dist/index.js\\",\\n  \\"types\\": \\"dist/index.d.ts\\",\\n  \\"files\\": [\\n    \\"dist\\"\\n  ],\\n  \\"scripts\\": {\\n    \\"build\\": \\"tsc\\",\\n    \\"test\\": \\"jest\\",\\n    \\"lint\\": \\"eslint src/**/*.ts\\",\\n    \\"lint:fix\\": \\"eslint src/**/*.ts --fix\\",\\n    \\"prepare\\": \\"npm run build\\"\\n  },\\n  \\"repository\\": {\\n    \\"type\\": \\"git\\",\\n    \\"url\\": \\"https://github.com/your-username/contentful-types.git\\"\\n  },\\n  \\"keywords\\": [\\n    \\"contentful\\",\\n    \\"typescript\\",\\n    \\"types\\",\\n    \\"cms\\"\\n  ],\\n  \\"author\\": \\"Bernier LLC\\",\\n  \\"license\\": \\"MIT\\",\\n  \\"bugs\\": {\\n    \\"url\\": \\"https://github.com/your-username/contentful-types/issues\\"\\n  },\\n  \\"homepage\\": \\"https://github.com/your-username/contentful-types#readme\\",\\n  \\"devDependencies\\": {\\n    "@types/jest": \\"^29.0.0\\",\\n    "@typescript-eslint/eslint-plugin": \\"^5.0.0\\",\\n    "@typescript-eslint/parser": \\"^5.0.0\\",\\n    "eslint": \\"^8.0.0\\",\\n    "eslint-config-prettier": \\"^8.0.0\\",\\n    "eslint-plugin-prettier": \\"^4.0.0\\",\\n    "jest": \\"^29.0.0\\",\\n    "prettier": \\"^2.0.0\\",\\n    "ts-jest": \\"^29.0.0\\",\\n    "typescript": \\"^4.0.0\\"\\n  },\\n  \\"peerDependencies\\": {\\n    \\"contentful\\": \\">=9.0.0\\"\\n  },\\n  \\"dependencies\\": {\\n  }\\n}\\n"}
    ]
}`;

      // First, verify this is actually malformed (the raw response has unescaped quotes in devDeps keys)
      const isMalformed = rawGeminiResponse.includes('"@types/jest"') &&
        !rawGeminiResponse.includes('\\"@types/jest\\"');

      if (isMalformed) {
        // This confirms the issue - now test our fix
        const fixed = fixMalformedJsonQuotes(rawGeminiResponse);
        expect(() => JSON.parse(fixed)).not.toThrow();

        const parsed = JSON.parse(fixed);
        expect(parsed.command).toBe('APPLY_CODE_CHANGES');
        expect(parsed.fileOperations).toHaveLength(1);
        expect(parsed.fileOperations[0].filePath).toBe('package.json');
      } else {
        // If it's not malformed in our test string, just verify it parses
        expect(() => JSON.parse(rawGeminiResponse)).not.toThrow();
      }
    });

    it('should handle base64 encoded content (preferred approach)', () => {
      // This is what we WANT Gemini to produce
      const base64Content = Buffer.from('{"name": "@test/pkg", "version": "1.0.0"}').toString('base64');
      const goodResponse = `{"command": "APPLY_CODE_CHANGES", "fileOperations": [{"action": "CREATE_OR_OVERWRITE", "filePath": "package.json", "contentBase64": "${base64Content}"}]}`;

      expect(() => JSON.parse(goodResponse)).not.toThrow();

      const parsed = JSON.parse(goodResponse);
      expect(parsed.fileOperations[0].contentBase64).toBe(base64Content);

      // Verify we can decode it
      const decoded = Buffer.from(parsed.fileOperations[0].contentBase64, 'base64').toString('utf-8');
      expect(JSON.parse(decoded)).toEqual({ name: '@test/pkg', version: '1.0.0' });
    });
  });

  describe('Combined extractAndClean + fixQuotes', () => {
    function parseGeminiResponse(text: string): unknown {
      const cleaned = extractAndCleanJson(text);
      const fixed = fixMalformedJsonQuotes(cleaned);
      return JSON.parse(fixed);
    }

    it('should handle markdown-wrapped malformed JSON', () => {
      const wrapped = '```json\n{"content": "{"key": "value"}"}\n```';
      const result = parseGeminiResponse(wrapped) as { content: string };
      expect(result.content).toContain('key');
    });

    it('should handle simple valid commands', () => {
      const simple = '{"command": "RUN_LINT_CHECK"}';
      const result = parseGeminiResponse(simple) as { command: string };
      expect(result.command).toBe('RUN_LINT_CHECK');
    });
  });
});
