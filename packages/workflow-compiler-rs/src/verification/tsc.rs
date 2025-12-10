//! TypeScript compilation verification.

use serde::Serialize;
use std::path::Path;
use tokio::process::Command;

/// TypeScript verification result
#[derive(Debug, Clone, Serialize)]
pub struct TypeScriptResult {
    /// Whether compilation succeeded
    pub success: bool,
    /// Compilation errors
    pub errors: Vec<TypeScriptError>,
    /// Exit code from tsc
    pub exit_code: Option<i32>,
    /// Raw output from tsc
    pub output: String,
}

/// A TypeScript compilation error
#[derive(Debug, Clone, Serialize)]
pub struct TypeScriptError {
    /// File path
    pub file: String,
    /// Line number
    pub line: u32,
    /// Column number
    pub column: u32,
    /// Error code (e.g., TS2345)
    pub code: String,
    /// Error message
    pub message: String,
}

/// Verify TypeScript code compiles without errors
pub async fn verify_typescript(project_dir: &Path) -> anyhow::Result<TypeScriptResult> {
    // Run tsc --noEmit to check for type errors without generating output
    let output = Command::new("npx")
        .args(["tsc", "--noEmit"])
        .current_dir(project_dir)
        .output()
        .await?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}{}", stdout, stderr);

    let errors = parse_tsc_errors(&combined);
    let exit_code = output.status.code();

    Ok(TypeScriptResult {
        success: output.status.success() && errors.is_empty(),
        errors,
        exit_code,
        output: combined,
    })
}

/// Parse TypeScript compiler errors from output
fn parse_tsc_errors(output: &str) -> Vec<TypeScriptError> {
    let mut errors = Vec::new();

    // TypeScript error format: file(line,column): error TSxxxx: message
    let error_regex =
        regex::Regex::new(r"(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)").unwrap();

    for line in output.lines() {
        if let Some(caps) = error_regex.captures(line) {
            errors.push(TypeScriptError {
                file: caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
                line: caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0),
                column: caps.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(0),
                code: caps.get(4).map(|m| m.as_str().to_string()).unwrap_or_default(),
                message: caps.get(5).map(|m| m.as_str().to_string()).unwrap_or_default(),
            });
        }
    }

    errors
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tsc_errors() {
        let output = r#"
src/workflow.ts(10,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/activities.ts(25,10): error TS2304: Cannot find name 'unknownVar'.
"#;

        let errors = parse_tsc_errors(output);
        assert_eq!(errors.len(), 2);

        assert_eq!(errors[0].file, "src/workflow.ts");
        assert_eq!(errors[0].line, 10);
        assert_eq!(errors[0].column, 5);
        assert_eq!(errors[0].code, "TS2345");
        assert!(errors[0].message.contains("Argument of type"));

        assert_eq!(errors[1].file, "src/activities.ts");
        assert_eq!(errors[1].line, 25);
        assert_eq!(errors[1].code, "TS2304");
    }

    #[test]
    fn test_parse_no_errors() {
        let output = "Compilation successful";
        let errors = parse_tsc_errors(output);
        assert!(errors.is_empty());
    }
}
