//! Workflow validation module.
//!
//! This module provides comprehensive validation of workflow definitions,
//! including graph structure, node configuration, and variable references.

mod errors;
mod graph;

pub use errors::*;
pub use graph::*;

use crate::schema::WorkflowDefinition;

/// Validate a workflow definition
pub fn validate(workflow: &WorkflowDefinition) -> ValidationResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Validate graph structure
    graph::validate_graph_structure(workflow, &mut errors, &mut warnings);

    // Validate nodes
    graph::validate_nodes(workflow, &mut errors, &mut warnings);

    // Validate edges
    graph::validate_edges(workflow, &mut errors, &mut warnings);

    ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    }
}
