//! Variable component schemas for workflow nodes.
//!
//! Defines ServiceVariable and ProjectVariable components for state management
//! across workflow executions.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Variable scope determines where the variable is accessible
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum VariableScope {
    /// Service-scoped: accessible within a single service's workflows
    #[default]
    Service,
    /// Project-scoped: accessible across all services in a project
    Project,
    /// Workflow-scoped: accessible only within the current workflow execution
    Workflow,
}

impl std::fmt::Display for VariableScope {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VariableScope::Service => write!(f, "service"),
            VariableScope::Project => write!(f, "project"),
            VariableScope::Workflow => write!(f, "workflow"),
        }
    }
}

/// Persistence strategy for variables
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "kebab-case")]
pub enum PersistenceStrategy {
    /// In-memory only (workflow state)
    #[default]
    InMemory,
    /// Persisted to Temporal workflow state
    WorkflowState,
    /// Persisted to external store (database, Redis, etc.)
    ExternalStore,
}

/// Variable type for runtime validation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeVariableType {
    String,
    Number,
    Boolean,
    Object,
    Array,
    #[default]
    Any,
}

impl RuntimeVariableType {
    /// Convert to TypeScript type string
    pub fn to_typescript(&self) -> &'static str {
        match self {
            RuntimeVariableType::String => "string",
            RuntimeVariableType::Number => "number",
            RuntimeVariableType::Boolean => "boolean",
            RuntimeVariableType::Object => "Record<string, unknown>",
            RuntimeVariableType::Array => "unknown[]",
            RuntimeVariableType::Any => "unknown",
        }
    }
}

// =============================================================================
// Service Variable Component
// =============================================================================

/// Input for ServiceVariable component
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ServiceVariableInput {
    /// Variable name
    pub name: String,
    /// Optional initial value
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_value: Option<serde_json::Value>,
    /// Metadata for logging/tracking
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Output from ServiceVariable component
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ServiceVariableOutput {
    /// Current variable value
    pub value: serde_json::Value,
    /// Whether the variable was newly created
    pub created: bool,
    /// Timestamp of last update
    pub last_updated: String,
}

/// Configuration for ServiceVariable component
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ServiceVariableConfig {
    /// Variable name (required)
    pub name: String,
    /// Variable type for validation
    #[serde(default)]
    pub variable_type: RuntimeVariableType,
    /// Default value if not set
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    /// Description for documentation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Whether the variable is required
    #[serde(default)]
    pub required: bool,
    /// Persistence strategy
    #[serde(default)]
    pub persistence: PersistenceStrategy,
    /// TTL for the variable (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ttl: Option<String>,
}

// =============================================================================
// Project Variable Component
// =============================================================================

/// Input for ProjectVariable component
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectVariableInput {
    /// Variable name
    pub name: String,
    /// Service ID requesting access (for cross-service access)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requesting_service_id: Option<String>,
    /// Optional initial value
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_value: Option<serde_json::Value>,
    /// Metadata for logging/tracking
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Output from ProjectVariable component
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectVariableOutput {
    /// Current variable value
    pub value: serde_json::Value,
    /// Whether the variable was newly created
    pub created: bool,
    /// Timestamp of last update
    pub last_updated: String,
    /// Service ID that last updated the variable
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated_by: Option<String>,
}

/// Configuration for ProjectVariable component
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectVariableConfig {
    /// Variable name (required)
    pub name: String,
    /// Variable type for validation
    #[serde(default)]
    pub variable_type: RuntimeVariableType,
    /// Default value if not set
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    /// Description for documentation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Whether the variable is required
    #[serde(default)]
    pub required: bool,
    /// Access control list (service IDs that can access)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_services: Vec<String>,
    /// Whether the variable is read-only for non-owner services
    #[serde(default)]
    pub read_only: bool,
}

// =============================================================================
// GetVariable Activity
// =============================================================================

/// Input for GetVariable activity
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GetVariableInput {
    /// Variable name to retrieve
    pub name: String,
    /// Scope to look in
    #[serde(default)]
    pub scope: VariableScope,
    /// Service ID (for project-scoped variables)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_id: Option<String>,
}

/// Output from GetVariable activity
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GetVariableOutput {
    /// Variable value (null if not found)
    pub value: Option<serde_json::Value>,
    /// Whether the variable exists
    pub exists: bool,
    /// Variable metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<VariableMetadata>,
}

/// Metadata about a variable
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VariableMetadata {
    /// Variable type
    pub variable_type: RuntimeVariableType,
    /// When the variable was created
    pub created_at: String,
    /// When the variable was last updated
    pub updated_at: String,
    /// Scope of the variable
    pub scope: VariableScope,
    /// Service that owns/created the variable
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owner_service_id: Option<String>,
}

/// Configuration for GetVariable activity
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GetVariableConfig {
    /// Variable name to get
    pub name: String,
    /// Scope to look in
    #[serde(default)]
    pub scope: VariableScope,
    /// Default value if variable doesn't exist
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    /// Whether to throw if variable doesn't exist
    #[serde(default)]
    pub throw_if_missing: bool,
}

// =============================================================================
// SetVariable Activity
// =============================================================================

/// Input for SetVariable activity
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SetVariableInput {
    /// Variable name to set
    pub name: String,
    /// Value to set
    pub value: serde_json::Value,
    /// Scope to set in
    #[serde(default)]
    pub scope: VariableScope,
    /// Service ID (for project-scoped variables)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_id: Option<String>,
}

/// Output from SetVariable activity
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SetVariableOutput {
    /// Whether the operation succeeded
    pub success: bool,
    /// Previous value (if existed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_value: Option<serde_json::Value>,
    /// Whether this was a create (vs update)
    pub created: bool,
    /// Timestamp of the update
    pub updated_at: String,
}

/// Configuration for SetVariable activity
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SetVariableConfig {
    /// Variable name to set
    pub name: String,
    /// Scope to set in
    #[serde(default)]
    pub scope: VariableScope,
    /// Expression to compute the value
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_expression: Option<String>,
    /// Static value to set
    #[serde(skip_serializing_if = "Option::is_none")]
    pub static_value: Option<serde_json::Value>,
    /// Whether to create if doesn't exist
    #[serde(default = "default_true")]
    pub create_if_missing: bool,
    /// Whether to merge objects (vs replace)
    #[serde(default)]
    pub merge: bool,
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_variable_scope_serialization() {
        let scope = VariableScope::Service;
        let json = serde_json::to_string(&scope).unwrap();
        assert_eq!(json, "\"service\"");

        let scope = VariableScope::Project;
        let json = serde_json::to_string(&scope).unwrap();
        assert_eq!(json, "\"project\"");
    }

    #[test]
    fn test_service_variable_config() {
        let config = ServiceVariableConfig {
            name: "counter".to_string(),
            variable_type: RuntimeVariableType::Number,
            default_value: Some(serde_json::json!(0)),
            description: Some("A counter variable".to_string()),
            required: false,
            persistence: PersistenceStrategy::WorkflowState,
            ttl: None,
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"name\":\"counter\""));
        assert!(json.contains("\"variableType\":\"number\""));
        assert!(json.contains("\"persistence\":\"workflow-state\""));
    }

    #[test]
    fn test_project_variable_config() {
        let config = ProjectVariableConfig {
            name: "shared_config".to_string(),
            variable_type: RuntimeVariableType::Object,
            default_value: Some(serde_json::json!({})),
            description: Some("Shared configuration".to_string()),
            required: true,
            allowed_services: vec!["service-1".to_string(), "service-2".to_string()],
            read_only: false,
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"name\":\"shared_config\""));
        assert!(json.contains("\"allowedServices\""));
    }

    #[test]
    fn test_get_variable_config() {
        let config = GetVariableConfig {
            name: "myVar".to_string(),
            scope: VariableScope::Service,
            default_value: Some(serde_json::json!("default")),
            throw_if_missing: false,
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"name\":\"myVar\""));
        assert!(json.contains("\"scope\":\"service\""));
    }

    #[test]
    fn test_set_variable_config() {
        let config = SetVariableConfig {
            name: "myVar".to_string(),
            scope: VariableScope::Workflow,
            value_expression: Some("input.value * 2".to_string()),
            static_value: None,
            create_if_missing: true,
            merge: false,
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"name\":\"myVar\""));
        assert!(json.contains("\"scope\":\"workflow\""));
        assert!(json.contains("\"valueExpression\""));
    }

    #[test]
    fn test_runtime_variable_type_to_typescript() {
        assert_eq!(RuntimeVariableType::String.to_typescript(), "string");
        assert_eq!(RuntimeVariableType::Number.to_typescript(), "number");
        assert_eq!(RuntimeVariableType::Boolean.to_typescript(), "boolean");
        assert_eq!(
            RuntimeVariableType::Object.to_typescript(),
            "Record<string, unknown>"
        );
        assert_eq!(RuntimeVariableType::Array.to_typescript(), "unknown[]");
        assert_eq!(RuntimeVariableType::Any.to_typescript(), "unknown");
    }
}
