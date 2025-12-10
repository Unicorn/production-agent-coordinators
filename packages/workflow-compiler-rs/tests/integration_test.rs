//! Integration tests for the workflow compiler

use serde_json::json;
use workflow_compiler::{
    codegen::{self, CodeGenOptions},
    schema::{NodeData, NodeType, Position, WorkflowDefinition, WorkflowEdge, WorkflowNode},
    validation,
};

fn create_simple_workflow() -> WorkflowDefinition {
    WorkflowDefinition {
        id: Some("test-workflow".to_string()),
        name: Some("Test Workflow".to_string()),
        nodes: vec![
            WorkflowNode {
                id: "trigger-1".to_string(),
                node_type: NodeType::Trigger,
                data: NodeData {
                    label: "Start".to_string(),
                    ..Default::default()
                },
                position: Position { x: 0.0, y: 0.0 },
            },
            WorkflowNode {
                id: "activity-1".to_string(),
                node_type: NodeType::Activity,
                data: NodeData {
                    label: "Process Data".to_string(),
                    activity_name: Some("processData".to_string()),
                    component_id: Some("comp-123".to_string()),
                    ..Default::default()
                },
                position: Position { x: 100.0, y: 0.0 },
            },
            WorkflowNode {
                id: "end-1".to_string(),
                node_type: NodeType::End,
                data: NodeData {
                    label: "End".to_string(),
                    ..Default::default()
                },
                position: Position { x: 200.0, y: 0.0 },
            },
        ],
        edges: vec![
            WorkflowEdge::new("edge-1", "trigger-1", "activity-1"),
            WorkflowEdge::new("edge-2", "activity-1", "end-1"),
        ],
        variables: vec![],
        metadata: None,
    }
}

fn create_workflow_with_signal() -> WorkflowDefinition {
    let mut workflow = create_simple_workflow();

    // Add a signal node
    workflow.nodes.insert(
        2,
        WorkflowNode {
            id: "signal-1".to_string(),
            node_type: NodeType::Signal,
            data: NodeData {
                label: "Wait for Approval".to_string(),
                signal_name: Some("approval".to_string()),
                ..Default::default()
            },
            position: Position { x: 150.0, y: 0.0 },
        },
    );

    // Update edges
    workflow.edges = vec![
        WorkflowEdge::new("edge-1", "trigger-1", "activity-1"),
        WorkflowEdge::new("edge-2", "activity-1", "signal-1"),
        WorkflowEdge::new("edge-3", "signal-1", "end-1"),
    ];

    workflow
}

fn create_workflow_with_conditional() -> WorkflowDefinition {
    WorkflowDefinition {
        id: Some("conditional-workflow".to_string()),
        name: Some("Conditional Workflow".to_string()),
        nodes: vec![
            WorkflowNode {
                id: "trigger-1".to_string(),
                node_type: NodeType::Trigger,
                data: NodeData {
                    label: "Start".to_string(),
                    ..Default::default()
                },
                position: Position { x: 0.0, y: 0.0 },
            },
            WorkflowNode {
                id: "condition-1".to_string(),
                node_type: NodeType::Conditional,
                data: NodeData {
                    label: "Check Status".to_string(),
                    condition: Some("input.status === 'approved'".to_string()),
                    ..Default::default()
                },
                position: Position { x: 100.0, y: 0.0 },
            },
            WorkflowNode {
                id: "activity-approved".to_string(),
                node_type: NodeType::Activity,
                data: NodeData {
                    label: "Process Approved".to_string(),
                    activity_name: Some("processApproved".to_string()),
                    ..Default::default()
                },
                position: Position { x: 200.0, y: -50.0 },
            },
            WorkflowNode {
                id: "activity-rejected".to_string(),
                node_type: NodeType::Activity,
                data: NodeData {
                    label: "Process Rejected".to_string(),
                    activity_name: Some("processRejected".to_string()),
                    ..Default::default()
                },
                position: Position { x: 200.0, y: 50.0 },
            },
            WorkflowNode {
                id: "end-1".to_string(),
                node_type: NodeType::End,
                data: NodeData {
                    label: "End".to_string(),
                    ..Default::default()
                },
                position: Position { x: 300.0, y: 0.0 },
            },
        ],
        edges: vec![
            WorkflowEdge::new("edge-1", "trigger-1", "condition-1"),
            WorkflowEdge::new("edge-2", "condition-1", "activity-approved"),
            WorkflowEdge::new("edge-3", "condition-1", "activity-rejected"),
            WorkflowEdge::new("edge-4", "activity-approved", "end-1"),
            WorkflowEdge::new("edge-5", "activity-rejected", "end-1"),
        ],
        variables: vec![],
        metadata: None,
    }
}

#[test]
fn test_validate_simple_workflow() {
    let workflow = create_simple_workflow();
    let result = validation::validate(&workflow);

    assert!(result.valid, "Workflow should be valid: {:?}", result.errors);
    assert!(result.errors.is_empty());
}

#[test]
fn test_validate_workflow_with_signal() {
    let workflow = create_workflow_with_signal();
    let result = validation::validate(&workflow);

    assert!(result.valid, "Workflow should be valid: {:?}", result.errors);
}

#[test]
fn test_validate_workflow_with_conditional() {
    let workflow = create_workflow_with_conditional();
    let result = validation::validate(&workflow);

    assert!(result.valid, "Workflow should be valid: {:?}", result.errors);
}

#[test]
fn test_generate_simple_workflow() {
    let workflow = create_simple_workflow();
    let options = CodeGenOptions::new();

    let result = codegen::generate(&workflow, &options);
    assert!(result.is_ok(), "Code generation should succeed");

    let code = result.unwrap();

    // Check workflow file contains expected content
    assert!(code.workflow.contains("testWorkflowWorkflow"));
    assert!(code.workflow.contains("@temporalio/workflow"));
    assert!(code.workflow.contains("proxyActivities"));

    // Check activities file
    assert!(code.activities.contains("processData"));
    assert!(code.activities.contains("createActivities"));

    // Check worker file
    assert!(code.worker.contains("Worker"));
    assert!(code.worker.contains("task-queue"));

    // Check package.json
    assert!(code.package_json.contains("@temporalio/workflow"));
    assert!(code.package_json.contains("@temporalio/worker"));

    // Check tsconfig.json
    assert!(code.tsconfig.contains("strict"));
    assert!(code.tsconfig.contains("noImplicitAny"));
}

#[test]
fn test_generate_workflow_with_signal() {
    let workflow = create_workflow_with_signal();
    let options = CodeGenOptions::new();

    let result = codegen::generate(&workflow, &options);
    assert!(result.is_ok());

    let code = result.unwrap();

    // Check for signal definition
    assert!(code.workflow.contains("defineSignal"));
    assert!(code.workflow.contains("approvalSignal"));
    assert!(code.workflow.contains("setHandler"));
}

#[test]
fn test_validation_no_trigger() {
    let workflow = WorkflowDefinition {
        id: Some("no-trigger".to_string()),
        name: None,
        nodes: vec![WorkflowNode {
            id: "end-1".to_string(),
            node_type: NodeType::End,
            data: NodeData {
                label: "End".to_string(),
                ..Default::default()
            },
            position: Position::default(),
        }],
        edges: vec![],
        variables: vec![],
        metadata: None,
    };

    let result = validation::validate(&workflow);
    assert!(!result.valid);
    assert!(result
        .errors
        .iter()
        .any(|e| format!("{:?}", e).contains("NoStartNode")));
}

#[test]
fn test_validation_no_end() {
    let workflow = WorkflowDefinition {
        id: Some("no-end".to_string()),
        name: None,
        nodes: vec![WorkflowNode {
            id: "trigger-1".to_string(),
            node_type: NodeType::Trigger,
            data: NodeData {
                label: "Start".to_string(),
                ..Default::default()
            },
            position: Position::default(),
        }],
        edges: vec![],
        variables: vec![],
        metadata: None,
    };

    let result = validation::validate(&workflow);
    assert!(!result.valid);
    assert!(result
        .errors
        .iter()
        .any(|e| format!("{:?}", e).contains("NoEndNode")));
}

#[test]
fn test_validation_duplicate_node_id() {
    let workflow = WorkflowDefinition {
        id: Some("duplicate".to_string()),
        name: None,
        nodes: vec![
            WorkflowNode {
                id: "same-id".to_string(),
                node_type: NodeType::Trigger,
                data: NodeData::default(),
                position: Position::default(),
            },
            WorkflowNode {
                id: "same-id".to_string(),
                node_type: NodeType::End,
                data: NodeData::default(),
                position: Position::default(),
            },
        ],
        edges: vec![WorkflowEdge::new("edge-1", "same-id", "same-id")],
        variables: vec![],
        metadata: None,
    };

    let result = validation::validate(&workflow);
    assert!(!result.valid);
    assert!(result
        .errors
        .iter()
        .any(|e| format!("{:?}", e).contains("DuplicateNodeId")));
}

#[test]
fn test_workflow_json_roundtrip() {
    let workflow = create_simple_workflow();

    // Serialize to JSON
    let json = serde_json::to_string_pretty(&workflow).unwrap();

    // Parse back
    let parsed: WorkflowDefinition = serde_json::from_str(&json).unwrap();

    assert_eq!(parsed.id, workflow.id);
    assert_eq!(parsed.name, workflow.name);
    assert_eq!(parsed.nodes.len(), workflow.nodes.len());
    assert_eq!(parsed.edges.len(), workflow.edges.len());
}

#[test]
fn test_workflow_from_json() {
    let json = json!({
        "id": "test-123",
        "name": "JSON Test Workflow",
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
            { "id": "edge-1", "source": "trigger-1", "target": "end-1" }
        ],
        "variables": [],
        "metadata": null
    });

    let workflow: WorkflowDefinition = serde_json::from_value(json).unwrap();

    assert_eq!(workflow.id, Some("test-123".to_string()));
    assert_eq!(workflow.nodes.len(), 2);
    assert_eq!(workflow.edges.len(), 1);

    // Validate the parsed workflow
    let result = validation::validate(&workflow);
    assert!(result.valid, "Parsed workflow should be valid: {:?}", result.errors);
}

#[test]
fn test_codegen_options() {
    let options = CodeGenOptions {
        workflow_name: Some("CustomName".to_string()),
        default_timeout: "5m".to_string(),
        include_comments: true,
        strict_mode: true,
    };

    let workflow = create_simple_workflow();
    let result = codegen::generate(&workflow, &options);
    assert!(result.is_ok());

    let code = result.unwrap();

    // Check custom workflow name is used
    assert!(code.workflow.contains("customNameWorkflow"));
    assert!(code.workflow.contains("5m"));
}
