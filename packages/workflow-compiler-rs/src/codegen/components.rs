//! Component-specific code generation patterns.
//!
//! This module provides code generation patterns for specific workflow components
//! like Start, Stop, and Log activities.

use crate::schema::{
    GetVariableConfig, LogConfig, LogLevel, ServiceVariableConfig, SetVariableConfig, StartConfig,
    StopConfig, VariableScope,
};
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

// =============================================================================
// Variable Component Code Generation
// =============================================================================

/// Generate code for ServiceVariable component
pub fn generate_service_variable_code(
    config: &ServiceVariableConfig,
    node_id: &str,
) -> ComponentPattern {
    let var_name = sanitize_id(&config.name);
    let ts_type = config.variable_type.to_typescript();

    let default_init = config
        .default_value
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "undefined".to_string()))
        .unwrap_or_else(|| "undefined".to_string());

    let code = format!(
        r#"// ServiceVariable: {node_id} - {var_name}
  // Scope: service, Type: {ts_type}
  if (state.{var_name} === undefined) {{
    state.{var_name} = {default_init};
    console.log('[VAR:SERVICE:INIT]', {{ name: '{var_name}', value: state.{var_name}, workflowId: workflowInfo().workflowId }});
  }}"#,
        node_id = node_id,
        var_name = var_name,
        ts_type = ts_type,
        default_init = default_init
    );

    ComponentPattern {
        component_type: "service-variable".to_string(),
        code,
        is_activity: false,
        required_imports: vec!["workflowInfo".to_string()],
    }
}

/// Generate code for GetVariable activity
pub fn generate_get_variable_code(config: &GetVariableConfig, node_id: &str) -> ComponentPattern {
    let var_name = sanitize_id(&config.name);
    let scope = &config.scope;
    let scope_str = scope.to_string();

    let default_code = config
        .default_value
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "undefined".to_string()))
        .unwrap_or_else(|| "undefined".to_string());

    let throw_code = if config.throw_if_missing {
        format!(
            r#"
  if (result_{id}.value === undefined) {{
    throw new Error('[VAR:GET:ERROR] Variable {var_name} not found in {scope} scope');
  }}"#,
            id = sanitize_id(node_id),
            var_name = var_name,
            scope = scope_str
        )
    } else {
        String::new()
    };

    let code = match scope {
        VariableScope::Workflow => format!(
            r#"// GetVariable: {node_id} - {var_name} (workflow scope)
  const result_{id} = {{
    value: state.{var_name} ?? {default_code},
    exists: state.{var_name} !== undefined,
  }};{throw_code}
  console.log('[VAR:GET:WORKFLOW]', {{ name: '{var_name}', exists: result_{id}.exists, workflowId: workflowInfo().workflowId }});"#,
            node_id = node_id,
            id = sanitize_id(node_id),
            var_name = var_name,
            default_code = default_code,
            throw_code = throw_code
        ),
        VariableScope::Service => format!(
            r#"// GetVariable: {node_id} - {var_name} (service scope)
  const result_{id} = await acts.getServiceVariable({{
    name: '{var_name}',
    defaultValue: {default_code},
  }});{throw_code}
  console.log('[VAR:GET:SERVICE]', {{ name: '{var_name}', exists: result_{id}.exists, workflowId: workflowInfo().workflowId }});"#,
            node_id = node_id,
            id = sanitize_id(node_id),
            var_name = var_name,
            default_code = default_code,
            throw_code = throw_code
        ),
        VariableScope::Project => format!(
            r#"// GetVariable: {node_id} - {var_name} (project scope)
  const result_{id} = await acts.getProjectVariable({{
    name: '{var_name}',
    defaultValue: {default_code},
  }});{throw_code}
  console.log('[VAR:GET:PROJECT]', {{ name: '{var_name}', exists: result_{id}.exists, workflowId: workflowInfo().workflowId }});"#,
            node_id = node_id,
            id = sanitize_id(node_id),
            var_name = var_name,
            default_code = default_code,
            throw_code = throw_code
        ),
    };

    ComponentPattern {
        component_type: "get-variable".to_string(),
        code,
        is_activity: matches!(scope, VariableScope::Service | VariableScope::Project),
        required_imports: vec!["workflowInfo".to_string()],
    }
}

/// Generate code for SetVariable activity
pub fn generate_set_variable_code(config: &SetVariableConfig, node_id: &str) -> ComponentPattern {
    let var_name = sanitize_id(&config.name);
    let scope = &config.scope;
    let scope_str = scope.to_string();

    // Determine value source
    let value_expr = if let Some(expr) = &config.value_expression {
        expr.clone()
    } else if let Some(val) = &config.static_value {
        serde_json::to_string(val).unwrap_or_else(|_| "undefined".to_string())
    } else {
        "input.value".to_string()
    };

    let merge_comment = if config.merge {
        " (merge mode)"
    } else {
        ""
    };

    let code = match scope {
        VariableScope::Workflow => {
            let assign_code = if config.merge {
                format!(
                    "state.{var_name} = {{ ...state.{var_name}, ...({value_expr}) }};",
                    var_name = var_name,
                    value_expr = value_expr
                )
            } else {
                format!(
                    "state.{var_name} = {value_expr};",
                    var_name = var_name,
                    value_expr = value_expr
                )
            };
            format!(
                r#"// SetVariable: {node_id} - {var_name} (workflow scope){merge_comment}
  const prevValue_{id} = state.{var_name};
  {assign_code}
  console.log('[VAR:SET:WORKFLOW]', {{ name: '{var_name}', previousValue: prevValue_{id}, newValue: state.{var_name}, workflowId: workflowInfo().workflowId }});"#,
                node_id = node_id,
                id = sanitize_id(node_id),
                var_name = var_name,
                assign_code = assign_code,
                merge_comment = merge_comment
            )
        }
        VariableScope::Service => format!(
            r#"// SetVariable: {node_id} - {var_name} (service scope){merge_comment}
  const setResult_{id} = await acts.setServiceVariable({{
    name: '{var_name}',
    value: {value_expr},
    merge: {merge},
    createIfMissing: {create_if_missing},
  }});
  console.log('[VAR:SET:SERVICE]', {{ name: '{var_name}', created: setResult_{id}.created, workflowId: workflowInfo().workflowId }});"#,
            node_id = node_id,
            id = sanitize_id(node_id),
            var_name = var_name,
            value_expr = value_expr,
            merge = config.merge,
            create_if_missing = config.create_if_missing,
            merge_comment = merge_comment
        ),
        VariableScope::Project => format!(
            r#"// SetVariable: {node_id} - {var_name} (project scope){merge_comment}
  const setResult_{id} = await acts.setProjectVariable({{
    name: '{var_name}',
    value: {value_expr},
    merge: {merge},
    createIfMissing: {create_if_missing},
  }});
  console.log('[VAR:SET:PROJECT]', {{ name: '{var_name}', created: setResult_{id}.created, workflowId: workflowInfo().workflowId }});"#,
            node_id = node_id,
            id = sanitize_id(node_id),
            var_name = var_name,
            value_expr = value_expr,
            merge = config.merge,
            create_if_missing = config.create_if_missing,
            merge_comment = merge_comment
        ),
    };

    ComponentPattern {
        component_type: "set-variable".to_string(),
        code,
        is_activity: matches!(scope, VariableScope::Service | VariableScope::Project),
        required_imports: vec!["workflowInfo".to_string()],
    }
}

/// Generate activity implementations for variable operations
pub fn generate_variable_activities() -> String {
    r#"/**
 * Get a service-scoped variable
 */
export async function getServiceVariable(
  input: { name: string; defaultValue?: unknown }
): Promise<{ value: unknown; exists: boolean; metadata?: VariableMetadata }> {
  const context = Context.current();
  // Implementation would connect to service variable store
  // For now, return from activity context or default
  const value = input.defaultValue;
  return {
    value,
    exists: false,
  };
}

/**
 * Set a service-scoped variable
 */
export async function setServiceVariable(
  input: { name: string; value: unknown; merge?: boolean; createIfMissing?: boolean }
): Promise<{ success: boolean; previousValue?: unknown; created: boolean; updatedAt: string }> {
  const context = Context.current();
  // Implementation would connect to service variable store
  return {
    success: true,
    created: true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get a project-scoped variable
 */
export async function getProjectVariable(
  input: { name: string; defaultValue?: unknown }
): Promise<{ value: unknown; exists: boolean; metadata?: VariableMetadata }> {
  const context = Context.current();
  // Implementation would connect to project variable store
  const value = input.defaultValue;
  return {
    value,
    exists: false,
  };
}

/**
 * Set a project-scoped variable
 */
export async function setProjectVariable(
  input: { name: string; value: unknown; merge?: boolean; createIfMissing?: boolean }
): Promise<{ success: boolean; previousValue?: unknown; created: boolean; updatedAt: string }> {
  const context = Context.current();
  // Implementation would connect to project variable store
  return {
    success: true,
    created: true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Metadata about a variable
 */
interface VariableMetadata {
  variableType: string;
  createdAt: string;
  updatedAt: string;
  scope: 'workflow' | 'service' | 'project';
  ownerServiceId?: string;
}"#
        .to_string()
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

    // Variable component tests

    #[test]
    fn test_generate_service_variable_code() {
        use crate::schema::RuntimeVariableType;

        let config = ServiceVariableConfig {
            name: "counter".to_string(),
            variable_type: RuntimeVariableType::Number,
            default_value: Some(serde_json::json!(0)),
            description: None,
            required: false,
            persistence: crate::schema::PersistenceStrategy::WorkflowState,
            ttl: None,
        };
        let pattern = generate_service_variable_code(&config, "var-1");

        assert_eq!(pattern.component_type, "service-variable");
        assert!(!pattern.is_activity);
        assert!(pattern.code.contains("// ServiceVariable: var-1 - counter"));
        assert!(pattern.code.contains("[VAR:SERVICE:INIT]"));
        assert!(pattern.code.contains("state.counter"));
    }

    #[test]
    fn test_generate_get_variable_workflow_scope() {
        let config = GetVariableConfig {
            name: "myVar".to_string(),
            scope: VariableScope::Workflow,
            default_value: Some(serde_json::json!("default")),
            throw_if_missing: false,
        };
        let pattern = generate_get_variable_code(&config, "get-1");

        assert_eq!(pattern.component_type, "get-variable");
        assert!(!pattern.is_activity); // Workflow scope is not an activity
        assert!(pattern.code.contains("// GetVariable: get-1 - myVar (workflow scope)"));
        assert!(pattern.code.contains("[VAR:GET:WORKFLOW]"));
        assert!(pattern.code.contains("state.myVar"));
    }

    #[test]
    fn test_generate_get_variable_service_scope() {
        let config = GetVariableConfig {
            name: "serviceVar".to_string(),
            scope: VariableScope::Service,
            default_value: None,
            throw_if_missing: true,
        };
        let pattern = generate_get_variable_code(&config, "get-2");

        assert_eq!(pattern.component_type, "get-variable");
        assert!(pattern.is_activity); // Service scope is an activity
        assert!(pattern.code.contains("[VAR:GET:SERVICE]"));
        assert!(pattern.code.contains("acts.getServiceVariable"));
        assert!(pattern.code.contains("[VAR:GET:ERROR]")); // throw_if_missing
    }

    #[test]
    fn test_generate_get_variable_project_scope() {
        let config = GetVariableConfig {
            name: "projectVar".to_string(),
            scope: VariableScope::Project,
            default_value: Some(serde_json::json!({})),
            throw_if_missing: false,
        };
        let pattern = generate_get_variable_code(&config, "get-3");

        assert_eq!(pattern.component_type, "get-variable");
        assert!(pattern.is_activity); // Project scope is an activity
        assert!(pattern.code.contains("[VAR:GET:PROJECT]"));
        assert!(pattern.code.contains("acts.getProjectVariable"));
    }

    #[test]
    fn test_generate_set_variable_workflow_scope() {
        let config = SetVariableConfig {
            name: "counter".to_string(),
            scope: VariableScope::Workflow,
            value_expression: Some("state.counter + 1".to_string()),
            static_value: None,
            create_if_missing: true,
            merge: false,
        };
        let pattern = generate_set_variable_code(&config, "set-1");

        assert_eq!(pattern.component_type, "set-variable");
        assert!(!pattern.is_activity);
        assert!(pattern.code.contains("// SetVariable: set-1 - counter (workflow scope)"));
        assert!(pattern.code.contains("[VAR:SET:WORKFLOW]"));
        assert!(pattern.code.contains("state.counter = state.counter + 1"));
    }

    #[test]
    fn test_generate_set_variable_with_merge() {
        let config = SetVariableConfig {
            name: "config".to_string(),
            scope: VariableScope::Workflow,
            value_expression: None,
            static_value: Some(serde_json::json!({"key": "value"})),
            create_if_missing: true,
            merge: true,
        };
        let pattern = generate_set_variable_code(&config, "set-2");

        assert!(pattern.code.contains("(merge mode)"));
        assert!(pattern.code.contains("...state.config"));
    }

    #[test]
    fn test_generate_set_variable_service_scope() {
        let config = SetVariableConfig {
            name: "serviceState".to_string(),
            scope: VariableScope::Service,
            value_expression: None,
            static_value: Some(serde_json::json!("new value")),
            create_if_missing: true,
            merge: false,
        };
        let pattern = generate_set_variable_code(&config, "set-3");

        assert!(pattern.is_activity);
        assert!(pattern.code.contains("[VAR:SET:SERVICE]"));
        assert!(pattern.code.contains("acts.setServiceVariable"));
    }

    #[test]
    fn test_generate_variable_activities() {
        let code = generate_variable_activities();

        assert!(code.contains("getServiceVariable"));
        assert!(code.contains("setServiceVariable"));
        assert!(code.contains("getProjectVariable"));
        assert!(code.contains("setProjectVariable"));
        assert!(code.contains("VariableMetadata"));
    }
}
