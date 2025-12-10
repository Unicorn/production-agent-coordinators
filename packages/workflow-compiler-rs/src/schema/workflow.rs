//! Main workflow definition type.

use serde::{Deserialize, Serialize};

use super::{WorkflowEdge, WorkflowMetadata, WorkflowNode, WorkflowVariable};

/// Complete workflow definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDefinition {
    /// Unique workflow identifier
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Workflow name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// List of nodes in the workflow
    pub nodes: Vec<WorkflowNode>,
    /// List of edges connecting nodes
    pub edges: Vec<WorkflowEdge>,
    /// Workflow variables
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variables: Vec<WorkflowVariable>,
    /// Workflow metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<WorkflowMetadata>,
}

impl WorkflowDefinition {
    /// Create a new empty workflow definition
    pub fn new() -> Self {
        Self {
            id: None,
            name: None,
            nodes: Vec::new(),
            edges: Vec::new(),
            variables: Vec::new(),
            metadata: None,
        }
    }

    /// Add a node to the workflow
    pub fn add_node(&mut self, node: WorkflowNode) {
        self.nodes.push(node);
    }

    /// Add an edge to the workflow
    pub fn add_edge(&mut self, edge: WorkflowEdge) {
        self.edges.push(edge);
    }

    /// Get a node by ID
    pub fn get_node(&self, id: &str) -> Option<&WorkflowNode> {
        self.nodes.iter().find(|n| n.id == id)
    }

    /// Get all edges originating from a node
    pub fn get_outgoing_edges(&self, node_id: &str) -> Vec<&WorkflowEdge> {
        self.edges.iter().filter(|e| e.source == node_id).collect()
    }

    /// Get all edges targeting a node
    pub fn get_incoming_edges(&self, node_id: &str) -> Vec<&WorkflowEdge> {
        self.edges.iter().filter(|e| e.target == node_id).collect()
    }

    /// Check if the workflow has any nodes
    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    /// Get the number of nodes
    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    /// Get the number of edges
    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }
}

impl Default for WorkflowDefinition {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{NodeData, NodeType, Position};

    fn create_test_workflow() -> WorkflowDefinition {
        let trigger = WorkflowNode {
            id: "trigger-1".to_string(),
            node_type: NodeType::Trigger,
            data: NodeData {
                label: "Start".to_string(),
                ..Default::default()
            },
            position: Position { x: 0.0, y: 0.0 },
        };

        let activity = WorkflowNode {
            id: "activity-1".to_string(),
            node_type: NodeType::Activity,
            data: NodeData {
                label: "Process".to_string(),
                ..Default::default()
            },
            position: Position { x: 100.0, y: 0.0 },
        };

        let end = WorkflowNode {
            id: "end-1".to_string(),
            node_type: NodeType::End,
            data: NodeData {
                label: "End".to_string(),
                ..Default::default()
            },
            position: Position { x: 200.0, y: 0.0 },
        };

        WorkflowDefinition {
            id: Some("test-workflow".to_string()),
            name: Some("Test Workflow".to_string()),
            nodes: vec![trigger, activity, end],
            edges: vec![
                WorkflowEdge::new("edge-1", "trigger-1", "activity-1"),
                WorkflowEdge::new("edge-2", "activity-1", "end-1"),
            ],
            variables: Vec::new(),
            metadata: None,
        }
    }

    #[test]
    fn test_workflow_creation() {
        let workflow = create_test_workflow();
        assert_eq!(workflow.node_count(), 3);
        assert_eq!(workflow.edge_count(), 2);
    }

    #[test]
    fn test_workflow_serialization() {
        let workflow = create_test_workflow();
        let json = serde_json::to_string_pretty(&workflow).unwrap();

        // Should serialize without errors
        assert!(json.contains("trigger-1"));
        assert!(json.contains("activity-1"));
        assert!(json.contains("end-1"));
    }

    #[test]
    fn test_workflow_deserialization() {
        let json = r#"{
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "data": { "label": "Start" },
                    "position": { "x": 0, "y": 0 }
                },
                {
                    "id": "end-1",
                    "type": "end",
                    "data": { "label": "End" },
                    "position": { "x": 100, "y": 0 }
                }
            ],
            "edges": [
                {
                    "id": "edge-1",
                    "source": "trigger-1",
                    "target": "end-1"
                }
            ]
        }"#;

        let workflow: WorkflowDefinition = serde_json::from_str(json).unwrap();
        assert_eq!(workflow.node_count(), 2);
        assert_eq!(workflow.edge_count(), 1);
    }

    #[test]
    fn test_get_node() {
        let workflow = create_test_workflow();
        let node = workflow.get_node("activity-1");
        assert!(node.is_some());
        assert_eq!(node.unwrap().data.label, "Process");
    }

    #[test]
    fn test_get_edges() {
        let workflow = create_test_workflow();

        let outgoing = workflow.get_outgoing_edges("trigger-1");
        assert_eq!(outgoing.len(), 1);
        assert_eq!(outgoing[0].target, "activity-1");

        let incoming = workflow.get_incoming_edges("end-1");
        assert_eq!(incoming.len(), 1);
        assert_eq!(incoming[0].source, "activity-1");
    }
}
