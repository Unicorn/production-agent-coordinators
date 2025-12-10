//! Workflow node types and structures.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Node types - exhaustive enum prevents invalid types at compile time
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum NodeType {
    Trigger,
    Activity,
    Agent,
    Conditional,
    Loop,
    ChildWorkflow,
    Signal,
    Phase,
    Retry,
    StateVariable,
    ApiEndpoint,
    Condition,
    End,
    DataIn,
    DataOut,
    KongLogging,
    KongCache,
    KongCors,
    GraphqlGateway,
    McpServer,
}

impl std::fmt::Display for NodeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NodeType::Trigger => write!(f, "trigger"),
            NodeType::Activity => write!(f, "activity"),
            NodeType::Agent => write!(f, "agent"),
            NodeType::Conditional => write!(f, "conditional"),
            NodeType::Loop => write!(f, "loop"),
            NodeType::ChildWorkflow => write!(f, "child-workflow"),
            NodeType::Signal => write!(f, "signal"),
            NodeType::Phase => write!(f, "phase"),
            NodeType::Retry => write!(f, "retry"),
            NodeType::StateVariable => write!(f, "state-variable"),
            NodeType::ApiEndpoint => write!(f, "api-endpoint"),
            NodeType::Condition => write!(f, "condition"),
            NodeType::End => write!(f, "end"),
            NodeType::DataIn => write!(f, "data-in"),
            NodeType::DataOut => write!(f, "data-out"),
            NodeType::KongLogging => write!(f, "kong-logging"),
            NodeType::KongCache => write!(f, "kong-cache"),
            NodeType::KongCors => write!(f, "kong-cors"),
            NodeType::GraphqlGateway => write!(f, "graphql-gateway"),
            NodeType::McpServer => write!(f, "mcp-server"),
        }
    }
}

/// Position on canvas
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

impl Default for Position {
    fn default() -> Self {
        Self { x: 0.0, y: 0.0 }
    }
}

/// Retry strategy options
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
#[derive(Default)]
pub enum RetryStrategy {
    KeepTrying,
    FailAfterX,
    ExponentialBackoff,
    #[default]
    None,
}


/// Retry policy configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct RetryPolicy {
    pub strategy: RetryStrategy,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_attempts: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_interval: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_interval: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backoff_coefficient: Option<f64>,
}

/// Node data - all possible configuration fields
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NodeData {
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub activity_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signal_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_policy: Option<RetryPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variable_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variable_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,

    // Start component fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trigger_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schedule: Option<String>,

    // Stop component fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result_mapping: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_metadata: Option<bool>,

    // Log component fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_workflow_context: Option<bool>,

    // Variable component fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variable_scope: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persistence: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ttl: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed_services: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub read_only: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub throw_if_missing: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub create_if_missing: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_expression: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub static_value: Option<serde_json::Value>,
}

/// Workflow node with strict typing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub data: NodeData,
    pub position: Position,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_type_serialization() {
        let node_type = NodeType::Activity;
        let json = serde_json::to_string(&node_type).unwrap();
        assert_eq!(json, "\"activity\"");

        let node_type = NodeType::ChildWorkflow;
        let json = serde_json::to_string(&node_type).unwrap();
        assert_eq!(json, "\"child-workflow\"");
    }

    #[test]
    fn test_node_type_deserialization() {
        let node_type: NodeType = serde_json::from_str("\"activity\"").unwrap();
        assert_eq!(node_type, NodeType::Activity);

        let node_type: NodeType = serde_json::from_str("\"child-workflow\"").unwrap();
        assert_eq!(node_type, NodeType::ChildWorkflow);
    }

    #[test]
    fn test_workflow_node_roundtrip() {
        let node = WorkflowNode {
            id: "node-1".to_string(),
            node_type: NodeType::Activity,
            data: NodeData {
                label: "Test Activity".to_string(),
                component_id: Some("comp-123".to_string()),
                ..Default::default()
            },
            position: Position { x: 100.0, y: 200.0 },
        };

        let json = serde_json::to_string(&node).unwrap();
        let parsed: WorkflowNode = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.id, node.id);
        assert_eq!(parsed.node_type, node.node_type);
        assert_eq!(parsed.data.label, node.data.label);
    }

    #[test]
    fn test_retry_policy_serialization() {
        let policy = RetryPolicy {
            strategy: RetryStrategy::ExponentialBackoff,
            max_attempts: Some(5),
            initial_interval: Some("1s".to_string()),
            max_interval: Some("60s".to_string()),
            backoff_coefficient: Some(2.0),
        };

        let json = serde_json::to_string(&policy).unwrap();
        assert!(json.contains("\"strategy\":\"exponential-backoff\""));
        assert!(json.contains("\"maxAttempts\":5"));
    }
}
