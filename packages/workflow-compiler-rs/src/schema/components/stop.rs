//! Stop component schema.
//!
//! The Stop component is the workflow termination point (end).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Stop component input - receives final workflow result
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StopInput {
    /// The result to return from the workflow
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
}

/// Stop component output - workflow completion result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopOutput {
    /// Whether the workflow completed successfully
    pub success: bool,

    /// The workflow result
    pub result: serde_json::Value,

    /// When the workflow completed
    pub completed_at: DateTime<Utc>,
}

impl StopOutput {
    /// Create a successful stop output
    pub fn success(result: serde_json::Value) -> Self {
        Self {
            success: true,
            result,
            completed_at: Utc::now(),
        }
    }

    /// Create a failed stop output
    pub fn failure(error: impl Into<String>) -> Self {
        Self {
            success: false,
            result: serde_json::json!({ "error": error.into() }),
            completed_at: Utc::now(),
        }
    }
}

/// Stop component configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StopConfig {
    /// Optional result mapping expression
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result_mapping: Option<String>,

    /// Whether to include execution metadata in result
    #[serde(default)]
    pub include_metadata: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stop_output_success() {
        let output = StopOutput::success(serde_json::json!({"data": "test"}));
        assert!(output.success);
        assert_eq!(output.result["data"], "test");
    }

    #[test]
    fn test_stop_output_failure() {
        let output = StopOutput::failure("Something went wrong");
        assert!(!output.success);
        assert_eq!(output.result["error"], "Something went wrong");
    }

    #[test]
    fn test_stop_input_serialization() {
        let input = StopInput {
            result: Some(serde_json::json!({"key": "value"})),
        };
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("result"));
        assert!(json.contains("key"));
    }

    #[test]
    fn test_stop_config_defaults() {
        let config = StopConfig::default();
        assert!(config.result_mapping.is_none());
        assert!(!config.include_metadata);
    }
}
