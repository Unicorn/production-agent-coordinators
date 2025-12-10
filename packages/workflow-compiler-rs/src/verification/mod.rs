//! Code verification module.
//!
//! This module verifies generated TypeScript code using tsc and ESLint.

mod eslint;
mod tsc;

pub use eslint::*;
pub use tsc::*;

use serde::Serialize;
use std::path::Path;

use crate::codegen::GeneratedCode;

/// Result of code verification
#[derive(Debug, Clone, Serialize)]
pub struct VerificationResult {
    /// Whether verification passed
    pub success: bool,
    /// TypeScript compilation result
    pub typescript: TypeScriptResult,
    /// ESLint result
    pub eslint: EslintResult,
}

/// Verify generated code with tsc and ESLint
pub async fn verify(
    code: &GeneratedCode,
    output_dir: &Path,
) -> anyhow::Result<VerificationResult> {
    // Write generated files to output directory
    write_generated_files(code, output_dir).await?;

    // Install dependencies
    install_dependencies(output_dir).await?;

    // Run TypeScript compilation
    let typescript = tsc::verify_typescript(output_dir).await?;

    // Run ESLint
    let eslint = eslint::verify_eslint(output_dir).await?;

    Ok(VerificationResult {
        success: typescript.success && eslint.success,
        typescript,
        eslint,
    })
}

/// Write generated files to the output directory
async fn write_generated_files(code: &GeneratedCode, output_dir: &Path) -> anyhow::Result<()> {
    use tokio::fs;

    // Create directories
    fs::create_dir_all(output_dir.join("src")).await?;

    // Write files
    fs::write(output_dir.join("src/workflow.ts"), &code.workflow).await?;
    fs::write(output_dir.join("src/activities.ts"), &code.activities).await?;
    fs::write(output_dir.join("src/worker.ts"), &code.worker).await?;
    fs::write(output_dir.join("package.json"), &code.package_json).await?;
    fs::write(output_dir.join("tsconfig.json"), &code.tsconfig).await?;

    // Write ESLint config
    let eslint_config = r#"{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  },
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "env": {
    "node": true,
    "es2022": true
  }
}"#;
    fs::write(output_dir.join(".eslintrc.json"), eslint_config).await?;

    Ok(())
}

/// Install npm dependencies
async fn install_dependencies(output_dir: &Path) -> anyhow::Result<()> {
    use tokio::process::Command;

    let output = Command::new("npm")
        .args(["install", "--legacy-peer-deps"])
        .current_dir(output_dir)
        .output()
        .await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("npm install failed: {}", stderr);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_write_generated_files() {
        let temp_dir = tempdir().unwrap();
        let code = GeneratedCode {
            workflow: "export function test() {}".to_string(),
            activities: "export function activity() {}".to_string(),
            worker: "console.log('worker')".to_string(),
            package_json: "{}".to_string(),
            tsconfig: "{}".to_string(),
        };

        write_generated_files(&code, temp_dir.path()).await.unwrap();

        assert!(temp_dir.path().join("src/workflow.ts").exists());
        assert!(temp_dir.path().join("src/activities.ts").exists());
        assert!(temp_dir.path().join("src/worker.ts").exists());
        assert!(temp_dir.path().join("package.json").exists());
        assert!(temp_dir.path().join("tsconfig.json").exists());
    }
}
