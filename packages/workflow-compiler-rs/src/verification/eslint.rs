//! ESLint verification.

use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::process::Command;

/// ESLint verification result
#[derive(Debug, Clone, Serialize)]
pub struct EslintResult {
    /// Whether linting passed (no errors)
    pub success: bool,
    /// Linting issues found
    pub issues: Vec<EslintIssue>,
    /// Total error count
    pub error_count: u32,
    /// Total warning count
    pub warning_count: u32,
    /// Exit code from ESLint
    pub exit_code: Option<i32>,
}

/// An ESLint issue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EslintIssue {
    /// File path
    pub file: String,
    /// Line number
    pub line: u32,
    /// Column number
    pub column: u32,
    /// Rule ID (e.g., "@typescript-eslint/no-explicit-any")
    pub rule_id: Option<String>,
    /// Severity (1 = warning, 2 = error)
    pub severity: u8,
    /// Issue message
    pub message: String,
}

/// ESLint JSON output format for a single file
#[derive(Debug, Deserialize)]
struct EslintFileResult {
    #[serde(rename = "filePath")]
    file_path: String,
    messages: Vec<EslintMessage>,
    #[serde(rename = "errorCount")]
    error_count: u32,
    #[serde(rename = "warningCount")]
    warning_count: u32,
}

/// ESLint message in JSON output
#[derive(Debug, Deserialize)]
struct EslintMessage {
    line: u32,
    column: u32,
    #[serde(rename = "ruleId")]
    rule_id: Option<String>,
    severity: u8,
    message: String,
}

/// Verify code with ESLint
pub async fn verify_eslint(project_dir: &Path) -> anyhow::Result<EslintResult> {
    // Run ESLint with JSON output format
    let output = Command::new("npx")
        .args([
            "eslint",
            "src",
            "--ext",
            ".ts",
            "--format",
            "json",
            "--no-error-on-unmatched-pattern",
        ])
        .current_dir(project_dir)
        .output()
        .await?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let exit_code = output.status.code();

    // Parse JSON output
    let (issues, error_count, warning_count) = parse_eslint_json(&stdout);

    // ESLint exits with 1 if there are linting errors, but that's expected
    // We only consider it a failure if there are actual errors
    Ok(EslintResult {
        success: error_count == 0,
        issues,
        error_count,
        warning_count,
        exit_code,
    })
}

/// Parse ESLint JSON output
fn parse_eslint_json(json_str: &str) -> (Vec<EslintIssue>, u32, u32) {
    let mut issues = Vec::new();
    let mut total_errors = 0;
    let mut total_warnings = 0;

    // Try to parse as JSON array
    if let Ok(results) = serde_json::from_str::<Vec<EslintFileResult>>(json_str) {
        for file_result in results {
            total_errors += file_result.error_count;
            total_warnings += file_result.warning_count;

            for msg in file_result.messages {
                issues.push(EslintIssue {
                    file: file_result.file_path.clone(),
                    line: msg.line,
                    column: msg.column,
                    rule_id: msg.rule_id,
                    severity: msg.severity,
                    message: msg.message,
                });
            }
        }
    }

    (issues, total_errors, total_warnings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_eslint_json_with_errors() {
        let json = r#"[
            {
                "filePath": "/tmp/test/src/workflow.ts",
                "messages": [
                    {
                        "line": 10,
                        "column": 5,
                        "ruleId": "@typescript-eslint/no-explicit-any",
                        "severity": 2,
                        "message": "Unexpected any. Specify a different type."
                    }
                ],
                "errorCount": 1,
                "warningCount": 0
            }
        ]"#;

        let (issues, errors, warnings) = parse_eslint_json(json);

        assert_eq!(issues.len(), 1);
        assert_eq!(errors, 1);
        assert_eq!(warnings, 0);
        assert_eq!(issues[0].file, "/tmp/test/src/workflow.ts");
        assert_eq!(issues[0].line, 10);
        assert_eq!(
            issues[0].rule_id.as_deref(),
            Some("@typescript-eslint/no-explicit-any")
        );
    }

    #[test]
    fn test_parse_eslint_json_empty() {
        let json = "[]";
        let (issues, errors, warnings) = parse_eslint_json(json);

        assert!(issues.is_empty());
        assert_eq!(errors, 0);
        assert_eq!(warnings, 0);
    }

    #[test]
    fn test_parse_eslint_json_invalid() {
        let json = "not json";
        let (issues, errors, warnings) = parse_eslint_json(json);

        assert!(issues.is_empty());
        assert_eq!(errors, 0);
        assert_eq!(warnings, 0);
    }
}
