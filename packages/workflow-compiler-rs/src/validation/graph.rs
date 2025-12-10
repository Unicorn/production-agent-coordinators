//! Graph structure validation.

use std::collections::{HashMap, HashSet};

use crate::schema::{NodeType, WorkflowDefinition};

use super::{ValidationError, ValidationWarning};

/// Validate the overall graph structure
pub fn validate_graph_structure(
    workflow: &WorkflowDefinition,
    errors: &mut Vec<ValidationError>,
    _warnings: &mut Vec<ValidationWarning>,
) {
    // Check for empty workflow
    if workflow.nodes.is_empty() {
        errors.push(ValidationError::EmptyWorkflow);
        return;
    }

    // Check for duplicate node IDs
    let mut seen_node_ids = HashSet::new();
    for node in &workflow.nodes {
        if !seen_node_ids.insert(&node.id) {
            errors.push(ValidationError::DuplicateNodeId(node.id.clone()));
        }
    }

    // Check for duplicate edge IDs
    let mut seen_edge_ids = HashSet::new();
    for edge in &workflow.edges {
        if !seen_edge_ids.insert(&edge.id) {
            errors.push(ValidationError::DuplicateEdgeId(edge.id.clone()));
        }
    }

    // Find trigger nodes (start nodes)
    let trigger_nodes: Vec<_> = workflow
        .nodes
        .iter()
        .filter(|n| n.node_type == NodeType::Trigger)
        .collect();

    if trigger_nodes.is_empty() {
        errors.push(ValidationError::NoStartNode);
    } else if trigger_nodes.len() > 1 {
        let ids: Vec<_> = trigger_nodes.iter().map(|n| n.id.clone()).collect();
        errors.push(ValidationError::MultipleStartNodes(ids));
    }

    // Find end nodes
    let end_nodes: Vec<_> = workflow
        .nodes
        .iter()
        .filter(|n| n.node_type == NodeType::End)
        .collect();

    if end_nodes.is_empty() {
        errors.push(ValidationError::NoEndNode);
    }

    // Check for unreachable nodes
    if !trigger_nodes.is_empty() && errors.is_empty() {
        check_reachability(workflow, &trigger_nodes[0].id, errors);
    }

    // Check for cycles
    check_cycles(workflow, errors);
}

/// Validate individual nodes
pub fn validate_nodes(
    workflow: &WorkflowDefinition,
    errors: &mut Vec<ValidationError>,
    warnings: &mut Vec<ValidationWarning>,
) {
    let node_ids: HashSet<_> = workflow.nodes.iter().map(|n| &n.id).collect();
    let outgoing: HashMap<_, Vec<_>> = workflow.nodes.iter().map(|n| {
        let edges: Vec<_> = workflow.edges.iter().filter(|e| e.source == n.id).collect();
        (&n.id, edges)
    }).collect();

    for node in &workflow.nodes {
        // Check required fields based on node type
        match node.node_type {
            NodeType::Activity => {
                if node.data.component_id.is_none() && node.data.activity_name.is_none() {
                    warnings.push(ValidationWarning::MissingOptionalField {
                        node_id: node.id.clone(),
                        field: "componentId or activityName".to_string(),
                    });
                }
            }
            NodeType::Signal => {
                if node.data.signal_name.is_none() {
                    errors.push(ValidationError::MissingRequiredField {
                        node_id: node.id.clone(),
                        field: "signalName".to_string(),
                    });
                }
            }
            NodeType::ChildWorkflow => {
                if node.data.workflow_id.is_none() {
                    errors.push(ValidationError::MissingRequiredField {
                        node_id: node.id.clone(),
                        field: "workflowId".to_string(),
                    });
                }
            }
            NodeType::Conditional | NodeType::Condition => {
                if node.data.condition.is_none() {
                    warnings.push(ValidationWarning::MissingOptionalField {
                        node_id: node.id.clone(),
                        field: "condition".to_string(),
                    });
                }
            }
            _ => {}
        }

        // Check for dead ends (non-end nodes with no outgoing edges)
        if node.node_type != NodeType::End {
            if let Some(edges) = outgoing.get(&node.id) {
                if edges.is_empty() {
                    warnings.push(ValidationWarning::DeadEnd {
                        node_id: node.id.clone(),
                    });
                }
            }
        }

        // Check variable references in config
        if let Some(config) = &node.data.config {
            for (key, value) in config {
                if let Some(var_ref) = extract_variable_reference(value) {
                    // Check if variable exists
                    let var_exists = workflow.variables.iter().any(|v| v.name == var_ref);
                    if !var_exists && !node_ids.contains(&var_ref) {
                        // Could be referencing a node output, not just a variable
                        // Only warn, don't error
                        warnings.push(ValidationWarning::ConfigSuggestion {
                            node_id: node.id.clone(),
                            message: format!(
                                "Config key '{}' references '{}' which may not exist",
                                key, var_ref
                            ),
                        });
                    }
                }
            }
        }
    }
}

/// Validate edges
pub fn validate_edges(
    workflow: &WorkflowDefinition,
    errors: &mut Vec<ValidationError>,
    _warnings: &mut Vec<ValidationWarning>,
) {
    let node_ids: HashSet<_> = workflow.nodes.iter().map(|n| n.id.as_str()).collect();

    for edge in &workflow.edges {
        // Check source node exists
        if !node_ids.contains(edge.source.as_str()) {
            errors.push(ValidationError::InvalidEdgeSource(edge.source.clone()));
        }

        // Check target node exists
        if !node_ids.contains(edge.target.as_str()) {
            errors.push(ValidationError::InvalidEdgeTarget(edge.target.clone()));
        }
    }
}

/// Check reachability from start node
fn check_reachability(
    workflow: &WorkflowDefinition,
    start_id: &str,
    errors: &mut Vec<ValidationError>,
) {
    let mut reachable = HashSet::new();
    let mut stack = vec![start_id.to_string()];

    // Build adjacency list
    let mut adj: HashMap<&str, Vec<&str>> = HashMap::new();
    for edge in &workflow.edges {
        adj.entry(&edge.source).or_default().push(&edge.target);
    }

    // DFS to find all reachable nodes
    while let Some(node_id) = stack.pop() {
        if reachable.insert(node_id.clone()) {
            if let Some(neighbors) = adj.get(node_id.as_str()) {
                for neighbor in neighbors {
                    if !reachable.contains(*neighbor) {
                        stack.push((*neighbor).to_string());
                    }
                }
            }
        }
    }

    // Find unreachable nodes
    let unreachable: Vec<_> = workflow
        .nodes
        .iter()
        .filter(|n| !reachable.contains(&n.id))
        .map(|n| n.id.clone())
        .collect();

    if !unreachable.is_empty() {
        errors.push(ValidationError::UnreachableNodes(unreachable));
    }
}

/// Check for cycles in the graph using DFS
fn check_cycles(workflow: &WorkflowDefinition, errors: &mut Vec<ValidationError>) {
    let mut visited = HashSet::new();
    let mut rec_stack = HashSet::new();
    let mut cycle_nodes = Vec::new();

    // Build adjacency list using owned strings
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    for edge in &workflow.edges {
        adj.entry(edge.source.clone())
            .or_default()
            .push(edge.target.clone());
    }

    fn dfs(
        node: &str,
        adj: &HashMap<String, Vec<String>>,
        visited: &mut HashSet<String>,
        rec_stack: &mut HashSet<String>,
        cycle_nodes: &mut Vec<String>,
    ) -> bool {
        visited.insert(node.to_string());
        rec_stack.insert(node.to_string());

        if let Some(neighbors) = adj.get(node) {
            for neighbor in neighbors {
                if !visited.contains(neighbor) {
                    if dfs(neighbor, adj, visited, rec_stack, cycle_nodes) {
                        cycle_nodes.push(node.to_string());
                        return true;
                    }
                } else if rec_stack.contains(neighbor) {
                    cycle_nodes.push(neighbor.to_string());
                    cycle_nodes.push(node.to_string());
                    return true;
                }
            }
        }

        rec_stack.remove(node);
        false
    }

    for node in &workflow.nodes {
        if !visited.contains(&node.id)
            && dfs(
                &node.id,
                &adj,
                &mut visited,
                &mut rec_stack,
                &mut cycle_nodes,
            ) {
                errors.push(ValidationError::CycleDetected(cycle_nodes));
                return;
            }
    }
}

/// Extract variable reference from a JSON value (looks for {{varName}} pattern)
fn extract_variable_reference(value: &serde_json::Value) -> Option<String> {
    if let Some(s) = value.as_str() {
        if s.starts_with("{{") && s.ends_with("}}") {
            return Some(s[2..s.len() - 2].trim().to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{NodeData, Position, WorkflowEdge, WorkflowNode};

    fn create_simple_workflow() -> WorkflowDefinition {
        WorkflowDefinition {
            id: Some("test".to_string()),
            name: Some("Test".to_string()),
            nodes: vec![
                WorkflowNode {
                    id: "trigger-1".to_string(),
                    node_type: NodeType::Trigger,
                    data: NodeData { label: "Start".to_string(), ..Default::default() },
                    position: Position::default(),
                },
                WorkflowNode {
                    id: "end-1".to_string(),
                    node_type: NodeType::End,
                    data: NodeData { label: "End".to_string(), ..Default::default() },
                    position: Position::default(),
                },
            ],
            edges: vec![WorkflowEdge::new("edge-1", "trigger-1", "end-1")],
            variables: Vec::new(),
            metadata: None,
        }
    }

    #[test]
    fn test_valid_simple_workflow() {
        let workflow = create_simple_workflow();
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        validate_graph_structure(&workflow, &mut errors, &mut warnings);

        assert!(errors.is_empty(), "Expected no errors: {:?}", errors);
    }

    #[test]
    fn test_no_trigger() {
        let workflow = WorkflowDefinition {
            id: Some("test".to_string()),
            name: None,
            nodes: vec![WorkflowNode {
                id: "end-1".to_string(),
                node_type: NodeType::End,
                data: NodeData { label: "End".to_string(), ..Default::default() },
                position: Position::default(),
            }],
            edges: Vec::new(),
            variables: Vec::new(),
            metadata: None,
        };

        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        validate_graph_structure(&workflow, &mut errors, &mut warnings);

        assert!(errors.iter().any(|e| matches!(e, ValidationError::NoStartNode)));
    }

    #[test]
    fn test_no_end_node() {
        let workflow = WorkflowDefinition {
            id: Some("test".to_string()),
            name: None,
            nodes: vec![WorkflowNode {
                id: "trigger-1".to_string(),
                node_type: NodeType::Trigger,
                data: NodeData { label: "Start".to_string(), ..Default::default() },
                position: Position::default(),
            }],
            edges: Vec::new(),
            variables: Vec::new(),
            metadata: None,
        };

        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        validate_graph_structure(&workflow, &mut errors, &mut warnings);

        assert!(errors.iter().any(|e| matches!(e, ValidationError::NoEndNode)));
    }

    #[test]
    fn test_invalid_edge_source() {
        let mut workflow = create_simple_workflow();
        workflow.edges.push(WorkflowEdge::new("edge-2", "nonexistent", "end-1"));

        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        validate_edges(&workflow, &mut errors, &mut warnings);

        assert!(errors.iter().any(|e| matches!(e, ValidationError::InvalidEdgeSource(_))));
    }

    #[test]
    fn test_extract_variable_reference() {
        assert_eq!(
            extract_variable_reference(&serde_json::json!("{{myVar}}")),
            Some("myVar".to_string())
        );
        assert_eq!(
            extract_variable_reference(&serde_json::json!("not a var")),
            None
        );
        assert_eq!(
            extract_variable_reference(&serde_json::json!(123)),
            None
        );
    }
}
