//! Log component schema.
//!
//! The Log component is an activity that logs messages to the workflow execution log.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use validator::Validate;

/// Log level enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    /// Debug level - detailed diagnostic information
    Debug,
    /// Info level - general informational messages
    #[default]
    Info,
    /// Warn level - warning conditions
    Warn,
    /// Error level - error conditions
    Error,
}

impl LogLevel {
    /// Convert to string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
    }
}

/// Log activity input
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct LogInput {
    /// The message to log
    #[validate(length(
        min = 1,
        max = 10000,
        message = "Message must be 1-10000 characters"
    ))]
    pub message: String,

    /// Log level
    #[serde(default)]
    pub level: LogLevel,

    /// Optional metadata to include in log
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

impl LogInput {
    /// Create a new log input with info level
    pub fn info(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            level: LogLevel::Info,
            metadata: None,
        }
    }

    /// Create a new log input with debug level
    pub fn debug(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            level: LogLevel::Debug,
            metadata: None,
        }
    }

    /// Create a new log input with warn level
    pub fn warn(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            level: LogLevel::Warn,
            metadata: None,
        }
    }

    /// Create a new log input with error level
    pub fn error(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            level: LogLevel::Error,
            metadata: None,
        }
    }

    /// Add metadata to the log input
    pub fn with_metadata(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.metadata
            .get_or_insert_with(HashMap::new)
            .insert(key.into(), value);
        self
    }
}

/// Log activity output
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogOutput {
    /// Whether the log was successfully recorded
    pub logged: bool,

    /// Timestamp when the log was recorded
    pub timestamp: DateTime<Utc>,

    /// Log ID for reference
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_id: Option<String>,
}

impl LogOutput {
    /// Create a successful log output
    pub fn success() -> Self {
        Self {
            logged: true,
            timestamp: Utc::now(),
            log_id: Some(uuid::Uuid::new_v4().to_string()),
        }
    }

    /// Create a failed log output
    pub fn failure() -> Self {
        Self {
            logged: false,
            timestamp: Utc::now(),
            log_id: None,
        }
    }
}

/// Log component configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LogConfig {
    /// The message to log (can use template expressions)
    pub message: String,

    /// Log level
    #[serde(default)]
    pub level: LogLevel,

    /// Static metadata to include
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Whether to include workflow context in metadata
    #[serde(default = "default_true")]
    pub include_workflow_context: bool,
}

fn default_true() -> bool {
    true
}

/// Full log entry structure (for Kong logging)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    /// Timestamp
    pub timestamp: DateTime<Utc>,

    /// Log level
    pub level: String,

    /// Log message
    pub message: String,

    /// Project context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<LogContext>,

    /// Service context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service: Option<LogContext>,

    /// Workflow context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow: Option<WorkflowLogContext>,

    /// Component context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component: Option<ComponentLogContext>,

    /// Additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Generic log context (for project/service)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogContext {
    pub id: String,
    pub name: String,
}

/// Workflow-specific log context
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogContext {
    pub id: String,
    pub name: String,
    pub run_id: String,
}

/// Component-specific log context
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentLogContext {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub component_type: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_level_serialization() {
        assert_eq!(
            serde_json::to_string(&LogLevel::Info).unwrap(),
            "\"info\""
        );
        assert_eq!(
            serde_json::to_string(&LogLevel::Error).unwrap(),
            "\"error\""
        );
    }

    #[test]
    fn test_log_input_builders() {
        let info = LogInput::info("test message");
        assert_eq!(info.level, LogLevel::Info);
        assert_eq!(info.message, "test message");

        let error = LogInput::error("error message");
        assert_eq!(error.level, LogLevel::Error);
    }

    #[test]
    fn test_log_input_with_metadata() {
        let input = LogInput::info("test")
            .with_metadata("key1", serde_json::json!("value1"))
            .with_metadata("key2", serde_json::json!(42));

        let metadata = input.metadata.unwrap();
        assert_eq!(metadata.len(), 2);
        assert_eq!(metadata["key1"], "value1");
        assert_eq!(metadata["key2"], 42);
    }

    #[test]
    fn test_log_input_validation() {
        use validator::Validate;

        // Valid input
        let valid = LogInput::info("Valid message");
        assert!(valid.validate().is_ok());

        // Empty message should fail
        let empty = LogInput {
            message: "".to_string(),
            level: LogLevel::Info,
            metadata: None,
        };
        assert!(empty.validate().is_err());
    }

    #[test]
    fn test_log_output_success() {
        let output = LogOutput::success();
        assert!(output.logged);
        assert!(output.log_id.is_some());
    }

    #[test]
    fn test_log_output_failure() {
        let output = LogOutput::failure();
        assert!(!output.logged);
        assert!(output.log_id.is_none());
    }

    #[test]
    fn test_log_entry_serialization() {
        let entry = LogEntry {
            timestamp: Utc::now(),
            level: "info".to_string(),
            message: "Test log".to_string(),
            project: Some(LogContext {
                id: "proj-1".to_string(),
                name: "Test Project".to_string(),
            }),
            service: None,
            workflow: Some(WorkflowLogContext {
                id: "wf-1".to_string(),
                name: "Test Workflow".to_string(),
                run_id: "run-1".to_string(),
            }),
            component: None,
            metadata: None,
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("Test log"));
        assert!(json.contains("Test Project"));
        assert!(json.contains("Test Workflow"));
    }
}
