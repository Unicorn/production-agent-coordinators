/**
 * Credential Checking Activities
 *
 * These activities check for required credentials and tools early in workflows
 * to fail fast and provide clear error messages about what's missing.
 */
export interface CredentialCheckResult {
    available: boolean;
    tool: string;
    error?: string;
    details?: string;
}
export interface CredentialsStatus {
    allAvailable: boolean;
    checks: Record<string, CredentialCheckResult> | CredentialCheckResult[];
    missing: string[];
}
/**
 * Check if GitHub CLI (gh) is installed and authenticated
 */
export declare function checkGitHubCLI(): Promise<CredentialCheckResult>;
/**
 * Check if npm is installed and configured
 */
export declare function checkNPM(): Promise<CredentialCheckResult>;
/**
 * Check if packages-api credentials are available
 * This checks for environment variables or config files
 */
export declare function checkPackagesAPI(): Promise<CredentialCheckResult>;
/**
 * Check if git is installed and configured
 */
export declare function checkGit(): Promise<CredentialCheckResult>;
/**
 * Check if Claude CLI is installed and authenticated
 */
export declare function checkClaudeCLI(): Promise<CredentialCheckResult>;
/**
 * Check if Gemini CLI is installed and authenticated
 */
export declare function checkGeminiCLI(): Promise<CredentialCheckResult>;
export interface CheckCredentialsInput {
    /** Check GitHub CLI (gh) */
    checkGitHub?: boolean;
    /** Check npm */
    checkNPM?: boolean;
    /** Check packages-api credentials */
    checkPackagesAPI?: boolean;
    /** Check git */
    checkGit?: boolean;
    /** Check Claude CLI */
    checkClaude?: boolean;
    /** Check Gemini CLI */
    checkGemini?: boolean;
}
/**
 * Check all required credentials and tools
 *
 * This is the main activity to call early in workflows to fail fast
 * if credentials are missing.
 */
export declare function checkCredentials(input?: CheckCredentialsInput): Promise<CredentialsStatus>;
/**
 * Format credentials status as a user-friendly error message
 */
export declare function formatCredentialsError(status: CredentialsStatus): string;
//# sourceMappingURL=credentials.activities.d.ts.map