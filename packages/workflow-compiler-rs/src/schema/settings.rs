//! Workflow settings and metadata.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::RetryPolicy;

/// Workflow metadata
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_policy: Option<RetryPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_queue: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Compiler settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CompilerSettings {
    /// Enable strict TypeScript mode
    #[serde(default = "default_strict_mode")]
    pub strict_mode: bool,
    /// Include comments in generated code
    #[serde(default = "default_include_comments")]
    pub include_comments: bool,
    /// Generate source maps
    #[serde(default)]
    pub source_maps: bool,
    /// Target TypeScript version
    #[serde(default = "default_typescript_target")]
    pub typescript_target: String,
}

fn default_strict_mode() -> bool {
    true
}

fn default_include_comments() -> bool {
    true
}

fn default_typescript_target() -> String {
    "ES2022".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metadata_serialization() {
        let metadata = WorkflowMetadata {
            timeout: Some("1h".to_string()),
            description: Some("Test workflow".to_string()),
            ..Default::default()
        };

        let json = serde_json::to_string(&metadata).unwrap();
        assert!(json.contains("\"timeout\":\"1h\""));
        assert!(json.contains("\"description\":\"Test workflow\""));
    }

    #[test]
    fn test_compiler_settings_defaults() {
        let settings: CompilerSettings = serde_json::from_str("{}").unwrap();
        assert!(settings.strict_mode);
        assert!(settings.include_comments);
        assert!(!settings.source_maps);
        assert_eq!(settings.typescript_target, "ES2022");
    }
}
