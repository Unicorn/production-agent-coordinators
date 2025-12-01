/**
 * Credential Checking Activities
 *
 * These activities check for required credentials and tools early in workflows
 * to fail fast and provide clear error messages about what's missing.
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
const execPromise = promisify(exec);
// ─────────────────────────────────────────────────────────────────────────────
// Individual Checks
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Check if GitHub CLI (gh) is installed and authenticated
 */
export async function checkGitHubCLI() {
    try {
        // Check if gh is installed
        await execPromise('which gh');
        // Check if authenticated
        const { stdout } = await execPromise('gh auth status', {
            env: { ...process.env }
        });
        // Check if stdout indicates authentication
        if (stdout.includes('Logged in') || stdout.includes('authenticated')) {
            return {
                available: true,
                tool: 'gh',
                details: 'GitHub CLI is installed and authenticated'
            };
        }
        return {
            available: false,
            tool: 'gh',
            error: 'GitHub CLI is installed but not authenticated',
            details: 'Run: gh auth login'
        };
    }
    catch (error) {
        if (error.message?.includes('which: no gh')) {
            return {
                available: false,
                tool: 'gh',
                error: 'GitHub CLI (gh) is not installed',
                details: 'Install with: brew install gh (macOS) or see https://cli.github.com/'
            };
        }
        if (error.message?.includes('authentication')) {
            return {
                available: false,
                tool: 'gh',
                error: 'GitHub CLI authentication failed',
                details: 'Run: gh auth login'
            };
        }
        return {
            available: false,
            tool: 'gh',
            error: error.message || 'Unknown error checking GitHub CLI',
            details: 'Check gh installation and authentication'
        };
    }
}
/**
 * Check if npm is installed and configured
 */
export async function checkNPM() {
    try {
        const { stdout } = await execPromise('npm --version');
        const version = stdout.trim();
        // Check if npm is configured (has registry access)
        try {
            await execPromise('npm whoami', {
                env: { ...process.env }
            });
            return {
                available: true,
                tool: 'npm',
                details: `npm ${version} is installed and configured`
            };
        }
        catch {
            // npm is installed but may not be logged in (this is OK for public packages)
            return {
                available: true,
                tool: 'npm',
                details: `npm ${version} is installed (authentication not required for public packages)`
            };
        }
    }
    catch (error) {
        return {
            available: false,
            tool: 'npm',
            error: 'npm is not installed',
            details: 'Install Node.js and npm from https://nodejs.org/'
        };
    }
}
/**
 * Check if packages-api credentials are available
 * This checks for environment variables or config files
 */
export async function checkPackagesAPI() {
    // Check for common environment variable names
    const envVars = [
        'PACKAGES_API_KEY',
        'PACKAGES_API_TOKEN',
        'BERNIERLLC_API_KEY',
        'NPM_TOKEN' // Sometimes used for private registry
    ];
    const found = envVars.find(varName => process.env[varName]);
    if (found) {
        return {
            available: true,
            tool: 'packages-api',
            details: `Found credentials in ${found} environment variable`
        };
    }
    // Check for .npmrc file (might contain auth token)
    try {
        const npmrcPath = require('os').homedir() + '/.npmrc';
        await fs.access(npmrcPath);
        const npmrcContent = await fs.readFile(npmrcPath, 'utf-8');
        if (npmrcContent.includes('_authToken') || npmrcContent.includes('//registry')) {
            return {
                available: true,
                tool: 'packages-api',
                details: 'Found npm authentication in ~/.npmrc'
            };
        }
    }
    catch {
        // .npmrc doesn't exist or isn't readable
    }
    return {
        available: false,
        tool: 'packages-api',
        error: 'Packages API credentials not found',
        details: 'Set PACKAGES_API_KEY or PACKAGES_API_TOKEN environment variable, or configure ~/.npmrc'
    };
}
/**
 * Check if git is installed and configured
 */
export async function checkGit() {
    try {
        const { stdout } = await execPromise('git --version');
        const version = stdout.trim();
        // Check if git user is configured
        try {
            await execPromise('git config user.name');
            await execPromise('git config user.email');
            return {
                available: true,
                tool: 'git',
                details: `${version} is installed and configured`
            };
        }
        catch {
            return {
                available: true,
                tool: 'git',
                details: `${version} is installed (user config can be set per-repo)`
            };
        }
    }
    catch (error) {
        return {
            available: false,
            tool: 'git',
            error: 'git is not installed',
            details: 'Install git from https://git-scm.com/'
        };
    }
}
/**
 * Check if Claude CLI is installed and authenticated
 */
export async function checkClaudeCLI() {
    try {
        await execPromise('which claude');
        // Try to check auth status (claude may have different auth commands)
        try {
            await execPromise('claude --version', {
                env: { ...process.env }
            });
            return {
                available: true,
                tool: 'claude-cli',
                details: 'Claude CLI is installed'
            };
        }
        catch {
            return {
                available: true,
                tool: 'claude-cli',
                details: 'Claude CLI is installed (authentication checked during execution)'
            };
        }
    }
    catch (error) {
        return {
            available: false,
            tool: 'claude-cli',
            error: 'Claude CLI is not installed',
            details: 'Install with: npm install -g @anthropic-ai/claude-code'
        };
    }
}
/**
 * Check if Gemini CLI is installed and authenticated
 */
export async function checkGeminiCLI() {
    try {
        await execPromise('which gemini');
        // Try to check version
        try {
            await execPromise('gemini --version', {
                env: { ...process.env }
            });
            return {
                available: true,
                tool: 'gemini-cli',
                details: 'Gemini CLI is installed'
            };
        }
        catch {
            return {
                available: true,
                tool: 'gemini-cli',
                details: 'Gemini CLI is installed (authentication checked during execution)'
            };
        }
    }
    catch (error) {
        return {
            available: false,
            tool: 'gemini-cli',
            error: 'Gemini CLI is not installed',
            details: 'Install with: npm install -g @google/generative-ai-cli'
        };
    }
}
/**
 * Check all required credentials and tools
 *
 * This is the main activity to call early in workflows to fail fast
 * if credentials are missing.
 */
export async function checkCredentials(input = {}) {
    const { checkGitHub: shouldCheckGitHub = true, checkNPM: shouldCheckNPM = true, checkPackagesAPI: shouldCheckPackagesAPI = true, checkGit: shouldCheckGit = true, checkClaude: shouldCheckClaude = false, checkGemini: shouldCheckGemini = false } = input;
    const checks = [];
    // Run all checks in parallel
    const checkPromises = [];
    if (shouldCheckGitHub) {
        checkPromises.push(checkGitHubCLI());
    }
    if (shouldCheckNPM) {
        checkPromises.push(checkNPM());
    }
    if (shouldCheckPackagesAPI) {
        checkPromises.push(checkPackagesAPI());
    }
    if (shouldCheckGit) {
        checkPromises.push(checkGit());
    }
    if (shouldCheckClaude) {
        checkPromises.push(checkClaudeCLI());
    }
    if (shouldCheckGemini) {
        checkPromises.push(checkGeminiCLI());
    }
    const results = await Promise.all(checkPromises);
    checks.push(...results);
    const missing = checks
        .filter(check => !check.available)
        .map(check => check.tool);
    const allAvailable = missing.length === 0;
    // Convert array to object for easier access
    const checksObj = {};
    checks.forEach(check => {
        checksObj[check.tool] = check;
    });
    return {
        allAvailable,
        checks: checksObj,
        missing
    };
}
/**
 * Format credentials status as a user-friendly error message
 */
export function formatCredentialsError(status) {
    if (status.allAvailable) {
        return 'All credentials are available.';
    }
    const lines = [
        'Missing or misconfigured credentials:',
        ''
    ];
    // Handle both array and object formats
    const checksArray = Array.isArray(status.checks)
        ? status.checks
        : Object.values(status.checks);
    checksArray.forEach(check => {
        if (!check.available) {
            lines.push(`❌ ${check.tool.toUpperCase()}`);
            if (check.error) {
                lines.push(`   Error: ${check.error}`);
            }
            if (check.details) {
                lines.push(`   Fix: ${check.details}`);
            }
            lines.push('');
        }
    });
    lines.push('Please configure the missing credentials and try again.');
    return lines.join('\n');
}
//# sourceMappingURL=credentials.activities.js.map