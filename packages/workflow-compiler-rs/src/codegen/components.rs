//! Component-specific code generation patterns.
//!
//! This module provides code generation patterns for specific workflow components
//! like Start, Stop, and Log activities.

use crate::schema::{LogConfig, LogLevel, StartConfig, StopConfig};
use serde::Serialize;

/// Component code generation pattern
#[derive(Debug, Clone, Serialize)]
pub struct ComponentPattern {
    /// The component type identifier
    pub component_type: String,
    /// Generated TypeScript code for the component
    pub code: String,
    /// Whether this is an activity (vs a workflow construct)
    pub is_activity: bool,
    /// Required imports for this component
    pub required_imports: Vec<String>,
}

/// Generate code for Start component
pub fn generate_start_code(config: &StartConfig, node_id: &str) -> ComponentPattern {
    let trigger_info = config
        .trigger_type
        .as_ref()
        .map(|t| format!("// Trigger type: {}", t))
        .unwrap_or_default();

    let schedule_info = config
        .schedule
        .as_ref()
        .map(|s| format!("\n  // Schedule: {}", s))
        .unwrap_or_default();

    let webhook_info = config
        .webhook_config
        .as_ref()
        .map(|w| {
            format!(
                "\n  // Webhook: {} {}",
                w.method,
                w.content_type.as_deref().unwrap_or("application/json")
            )
        })
        .unwrap_or_default();

    let code = format!(
        r#"// Start: {node_id}
  {trigger_info}{schedule_info}{webhook_info}
  const startedAt = new Date().toISOString();
  console.log('[WORKFLOW_START]', {{ workflowId: workflowInfo().workflowId, startedAt }});"#,
        node_id = node_id,
        trigger_info = trigger_info,
        schedule_info = schedule_info,
        webhook_info = webhook_info
    );

    ComponentPattern {
        component_type: "start".to_string(),
        code,
        is_activity: false,
        required_imports: vec!["workflowInfo".to_string()],
    }
}

/// Generate code for Stop component
pub fn generate_stop_code(config: &StopConfig, node_id: &str) -> ComponentPattern {
    let result_mapping = config
        .result_mapping
        .as_ref()
        .map(|expr| format!("const finalResult = {};", expr))
        .unwrap_or_else(|| "const finalResult = input;".to_string());

    let metadata_code = if config.include_metadata {
        r#"
  const completedAt = new Date().toISOString();
  const executionMetadata = {
    startedAt,
    completedAt,
    workflowId: workflowInfo().workflowId,
    runId: workflowInfo().runId,
  };"#
            .to_string()
    } else {
        String::new()
    };

    let return_code = if config.include_metadata {
        r#"return {
    success: true,
    result: finalResult,
    completedAt: new Date().toISOString(),
    metadata: executionMetadata,
  };"#
    } else {
        r#"return {
    success: true,
    result: finalResult,
    completedAt: new Date().toISOString(),
  };"#
    };

    let code = format!(
        r#"// Stop: {node_id}
  {result_mapping}{metadata_code}
  console.log('[WORKFLOW_STOP]', {{ workflowId: workflowInfo().workflowId, success: true }});
  {return_code}"#,
        node_id = node_id,
        result_mapping = result_mapping,
        metadata_code = metadata_code,
        return_code = return_code
    );

    ComponentPattern {
        component_type: "stop".to_string(),
        code,
        is_activity: false,
        required_imports: vec!["workflowInfo".to_string()],
    }
}

/// Generate code for Log component (activity)
pub fn generate_log_code(config: &LogConfig, node_id: &str) -> ComponentPattern {
    let level = config.level.as_str();

    // Build metadata object if present
    let metadata_code = config
        .metadata
        .as_ref()
        .map(|m| {
            let entries: Vec<String> = m
                .iter()
                .map(|(k, v)| format!("    {}: {},", k, serde_json::to_string(v).unwrap_or_default()))
                .collect();
            format!(
                "const logMetadata_{} = {{\n{}\n  }};",
                sanitize_id(node_id),
                entries.join("\n")
            )
        })
        .unwrap_or_default();

    let context_code = if config.include_workflow_context {
        format!(
            r#"const logContext_{id} = {{
    workflowId: workflowInfo().workflowId,
    runId: workflowInfo().runId,
    componentId: '{node_id}',
  }};"#,
            id = sanitize_id(node_id),
            node_id = node_id
        )
    } else {
        String::new()
    };

    // Build the log call
    let message_expr = if config.message.contains("${") {
        // Template expression - evaluate at runtime
        format!("`{}`", config.message)
    } else {
        format!("'{}'", config.message.replace('\'', "\\'"))
    };

    let log_call = match config.level {
        LogLevel::Debug => "console.debug",
        LogLevel::Info => "console.info",
        LogLevel::Warn => "console.warn",
        LogLevel::Error => "console.error",
    };

    let log_data = if config.include_workflow_context {
        if config.metadata.is_some() {
            format!(
                "{{ ...logContext_{id}, ...logMetadata_{id} }}",
                id = sanitize_id(node_id)
            )
        } else {
            format!("logContext_{}", sanitize_id(node_id))
        }
    } else if config.metadata.is_some() {
        format!("logMetadata_{}", sanitize_id(node_id))
    } else {
        "{}".to_string()
    };

    let code = format!(
        r#"// Log: {node_id} [{level}]
  {metadata_code}
  {context_code}
  {log_call}('[LOG:{level}]', {message}, {log_data});"#,
        node_id = node_id,
        level = level.to_uppercase(),
        metadata_code = metadata_code,
        context_code = context_code,
        log_call = log_call,
        message = message_expr,
        log_data = log_data
    );

    ComponentPattern {
        component_type: "log".to_string(),
        code,
        is_activity: true,
        required_imports: vec!["workflowInfo".to_string()],
    }
}

/// Generate activity implementation for Log component
pub fn generate_log_activity(node_id: &str) -> String {
    format!(
        r#"/**
 * Log Activity: {node_id}
 * Records a log entry with workflow context
 */
export async function log_{sanitized_id}(
  input: LogActivityInput
): Promise<LogActivityOutput> {{
  const context = Context.current();

  const logEntry = {{
    timestamp: new Date().toISOString(),
    level: input.level || 'info',
    message: input.message,
    workflowContext: input.workflowContext,
    metadata: input.metadata,
  }};

  // Log based on level
  switch (logEntry.level) {{
    case 'debug':
      console.debug('[LOG:DEBUG]', logEntry.message, logEntry);
      break;
    case 'warn':
      console.warn('[LOG:WARN]', logEntry.message, logEntry);
      break;
    case 'error':
      console.error('[LOG:ERROR]', logEntry.message, logEntry);
      break;
    default:
      console.info('[LOG:INFO]', logEntry.message, logEntry);
  }}

  return {{
    logged: true,
    timestamp: logEntry.timestamp,
    logId: crypto.randomUUID(),
  }};
}}"#,
        node_id = node_id,
        sanitized_id = sanitize_id(node_id)
    )
}

/// Sanitize node ID for use in variable names
fn sanitize_id(id: &str) -> String {
    id.chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_generate_start_code_basic() {
        let config = StartConfig::default();
        let pattern = generate_start_code(&config, "start-1");

        assert_eq!(pattern.component_type, "start");
        assert!(!pattern.is_activity);
        assert!(pattern.code.contains("// Start: start-1"));
        assert!(pattern.code.contains("[WORKFLOW_START]"));
    }

    #[test]
    fn test_generate_start_code_with_trigger() {
        let config = StartConfig {
            trigger_type: Some("webhook".to_string()),
            schedule: None,
            webhook_config: None,
        };
        let pattern = generate_start_code(&config, "start-webhook");

        assert!(pattern.code.contains("Trigger type: webhook"));
    }

    #[test]
    fn test_generate_stop_code_basic() {
        let config = StopConfig::default();
        let pattern = generate_stop_code(&config, "stop-1");

        assert_eq!(pattern.component_type, "stop");
        assert!(!pattern.is_activity);
        assert!(pattern.code.contains("// Stop: stop-1"));
        assert!(pattern.code.contains("[WORKFLOW_STOP]"));
        assert!(pattern.code.contains("success: true"));
    }

    #[test]
    fn test_generate_stop_code_with_metadata() {
        let config = StopConfig {
            result_mapping: Some("{ processed: true }".to_string()),
            include_metadata: true,
        };
        let pattern = generate_stop_code(&config, "stop-meta");

        assert!(pattern.code.contains("{ processed: true }"));
        assert!(pattern.code.contains("executionMetadata"));
    }

    #[test]
    fn test_generate_log_code_info() {
        let config = LogConfig {
            message: "Processing started".to_string(),
            level: LogLevel::Info,
            metadata: None,
            include_workflow_context: true,
        };
        let pattern = generate_log_code(&config, "log-1");

        assert_eq!(pattern.component_type, "log");
        assert!(pattern.is_activity);
        assert!(pattern.code.contains("[LOG:INFO]"));
        assert!(pattern.code.contains("console.info"));
    }

    #[test]
    fn test_generate_log_code_with_metadata() {
        let mut metadata = HashMap::new();
        metadata.insert("key".to_string(), serde_json::json!("value"));

        let config = LogConfig {
            message: "Test message".to_string(),
            level: LogLevel::Debug,
            metadata: Some(metadata),
            include_workflow_context: false,
        };
        let pattern = generate_log_code(&config, "log-meta");

        assert!(pattern.code.contains("logMetadata_"));
        assert!(pattern.code.contains("console.debug"));
    }

    #[test]
    fn test_generate_log_code_template_message() {
        let config = LogConfig {
            message: "Processing ${input.id}".to_string(),
            level: LogLevel::Info,
            metadata: None,
            include_workflow_context: true,
        };
        let pattern = generate_log_code(&config, "log-template");

        // Should use template literal
        assert!(pattern.code.contains("`Processing ${input.id}`"));
    }

    #[test]
    fn test_sanitize_id() {
        assert_eq!(sanitize_id("log-1"), "log_1");
        assert_eq!(sanitize_id("node.123"), "node_123");
        assert_eq!(sanitize_id("simple"), "simple");
    }
}
