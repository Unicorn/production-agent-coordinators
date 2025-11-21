/**
 * GitHub API Helper Functions
 *
 * Provides functions to fetch files from GitHub repositories for enhanced context.
 * Uses GitHub REST API with OAuth token authentication.
 */

import type { GitHubContext } from '../types/index.js';

/**
 * Fetch file content from GitHub repository
 *
 * @param context - GitHub authentication context
 * @param filePath - Path to file in repository (relative to repo root)
 * @returns File content as string
 * @throws Error if file not found or authentication fails
 */
export async function fetchGitHubFile(
  context: GitHubContext,
  filePath: string
): Promise<string> {
  const { token, repo, branch } = context;

  // GitHub API endpoint for file contents
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Package-Builder-Agent'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`File not found: ${filePath}`);
    } else if (response.status === 401) {
      throw new Error('GitHub authentication failed - check token');
    } else {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json() as { content: string; encoding: string };

  // GitHub returns base64 encoded content
  if (data.encoding === 'base64') {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  return data.content;
}

/**
 * Fetch multiple files from GitHub repository
 *
 * @param context - GitHub authentication context
 * @param filePaths - Array of file paths to fetch
 * @returns Map of file path to content
 */
export async function fetchGitHubFiles(
  context: GitHubContext,
  filePaths: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Fetch files in parallel for performance
  const promises = filePaths.map(async (filePath) => {
    try {
      const content = await fetchGitHubFile(context, filePath);
      results.set(filePath, content);
    } catch (error) {
      // Log error but don't fail the entire batch
      console.warn(`Failed to fetch ${filePath}:`, error);
    }
  });

  await Promise.all(promises);

  return results;
}

/**
 * Fetch directory listing from GitHub repository
 *
 * @param context - GitHub authentication context
 * @param dirPath - Path to directory in repository
 * @returns Array of file/directory names
 */
export async function fetchGitHubDirectory(
  context: GitHubContext,
  dirPath: string
): Promise<string[]> {
  const { token, repo, branch } = context;

  const url = `https://api.github.com/repos/${repo}/contents/${dirPath}?ref=${branch}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Package-Builder-Agent'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch directory: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as Array<{ name: string; type: string }>;

  return data.map(item => item.name);
}

/**
 * Check if GitHub context is valid
 *
 * @param context - GitHub context to validate
 * @returns True if context has all required fields
 */
export function isValidGitHubContext(context: GitHubContext | undefined): context is GitHubContext {
  if (!context) return false;
  return !!(context.token && context.repo && context.branch);
}

/**
 * Build GitHub context section for prompts
 *
 * @param githubFiles - Map of file paths to content
 * @returns Formatted string for inclusion in prompts
 */
export function buildGitHubContextSection(githubFiles: Map<string, string>): string {
  if (githubFiles.size === 0) {
    return '';
  }

  const sections = Array.from(githubFiles.entries()).map(([path, content]) => {
    return `### ${path}\n\n\`\`\`\n${content}\n\`\`\``;
  });

  return `
## Repository Context

The following files from the repository provide additional context:

${sections.join('\n\n')}
`;
}
