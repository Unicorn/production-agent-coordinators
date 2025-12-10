//! Workflow edge types and structures.

use serde::{Deserialize, Serialize};

/// Workflow edge connecting two nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_handle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "type")]
    pub edge_type: Option<String>,
}

impl WorkflowEdge {
    /// Create a new edge with minimal required fields
    pub fn new(id: impl Into<String>, source: impl Into<String>, target: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            source: source.into(),
            target: target.into(),
            source_handle: None,
            target_handle: None,
            label: None,
            edge_type: None,
        }
    }

    /// Set the label for this edge
    pub fn with_label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_edge_serialization() {
        let edge = WorkflowEdge::new("edge-1", "node-1", "node-2");
        let json = serde_json::to_string(&edge).unwrap();

        assert!(json.contains("\"id\":\"edge-1\""));
        assert!(json.contains("\"source\":\"node-1\""));
        assert!(json.contains("\"target\":\"node-2\""));
    }

    #[test]
    fn test_edge_with_label() {
        let edge = WorkflowEdge::new("edge-1", "node-1", "node-2").with_label("on success");
        let json = serde_json::to_string(&edge).unwrap();

        assert!(json.contains("\"label\":\"on success\""));
    }

    #[test]
    fn test_edge_deserialization() {
        let json = r#"{
            "id": "edge-1",
            "source": "node-1",
            "target": "node-2",
            "sourceHandle": "output-0",
            "targetHandle": "input-0"
        }"#;

        let edge: WorkflowEdge = serde_json::from_str(json).unwrap();
        assert_eq!(edge.id, "edge-1");
        assert_eq!(edge.source_handle, Some("output-0".to_string()));
        assert_eq!(edge.target_handle, Some("input-0".to_string()));
    }
}
