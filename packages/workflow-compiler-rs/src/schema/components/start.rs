//! Start component schema.
//!
//! The Start component is the workflow entry point (trigger).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Start component input - workflow entry point
/// Takes no input as it's the workflow trigger
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StartInput {
    // Empty - start receives input from workflow caller
}

/// Start component output
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartOutput {
    /// When the workflow started
    pub started_at: DateTime<Utc>,
}

impl StartOutput {
    /// Create a new StartOutput with current timestamp
    pub fn now() -> Self {
        Self {
            started_at: Utc::now(),
        }
    }
}

/// Start component configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StartConfig {
    /// Optional trigger type (manual, scheduled, webhook, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trigger_type: Option<String>,

    /// Optional schedule for scheduled triggers (cron format)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schedule: Option<String>,

    /// Optional webhook configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_config: Option<WebhookConfig>,
}

/// Webhook trigger configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookConfig {
    /// HTTP method (GET, POST, etc.)
    pub method: String,
    /// Expected content type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_start_output_now() {
        let output = StartOutput::now();
        // Should be a recent timestamp
        let now = Utc::now();
        let diff = now.signed_duration_since(output.started_at);
        assert!(diff.num_seconds() < 1);
    }

    #[test]
    fn test_start_input_serialization() {
        let input = StartInput::default();
        let json = serde_json::to_string(&input).unwrap();
        assert_eq!(json, "{}");
    }

    #[test]
    fn test_start_config_serialization() {
        let config = StartConfig {
            trigger_type: Some("manual".to_string()),
            schedule: None,
            webhook_config: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("triggerType"));
        assert!(json.contains("manual"));
    }
}
