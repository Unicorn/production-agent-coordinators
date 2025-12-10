//! Validation error types.

use serde::Serialize;
use thiserror::Error;

/// Validation error types
#[derive(Debug, Error, Clone, Serialize)]
#[serde(tag = "type", content = "details")]
pub enum ValidationError {
    #[error("No start node found. Workflow must have exactly one trigger node.")]
    NoStartNode,

    #[error("Multiple start nodes found: {0:?}. Workflow must have exactly one trigger.")]
    MultipleStartNodes(Vec<String>),

    #[error("No end node found. Workflow must have at least one end node.")]
    NoEndNode,

    #[error("Orphan node '{0}' has no connections.")]
    OrphanNode(String),

    #[error("Cycle detected involving nodes: {0:?}")]
    CycleDetected(Vec<String>),

    #[error("Invalid edge: source node '{0}' not found.")]
    InvalidEdgeSource(String),

    #[error("Invalid edge: target node '{0}' not found.")]
    InvalidEdgeTarget(String),

    #[error("Node '{node_id}' references unknown variable '{var_name}'.")]
    UnknownVariable { node_id: String, var_name: String },

    #[error("Node '{node_id}' has invalid configuration: {message}")]
    InvalidConfig { node_id: String, message: String },

    #[error("Node '{node_id}' is missing required field: {field}")]
    MissingRequiredField { node_id: String, field: String },

    #[error("Empty workflow: no nodes defined.")]
    EmptyWorkflow,

    #[error("Duplicate node ID: '{0}'")]
    DuplicateNodeId(String),

    #[error("Duplicate edge ID: '{0}'")]
    DuplicateEdgeId(String),

    #[error("Unreachable nodes from start: {0:?}")]
    UnreachableNodes(Vec<String>),
}

/// Validation warning types (non-fatal issues)
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "details")]
pub enum ValidationWarning {
    /// Node has no outgoing edges (but is not an end node)
    DeadEnd { node_id: String },

    /// Node configuration could be improved
    ConfigSuggestion { node_id: String, message: String },

    /// Deprecated node type or configuration
    Deprecated { node_id: String, message: String },

    /// Missing optional but recommended field
    MissingOptionalField { node_id: String, field: String },
}

/// Result of validation
#[derive(Debug, Clone, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

impl ValidationResult {
    /// Create a successful validation result
    pub fn success() -> Self {
        Self {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    /// Create a failed validation result with a single error
    pub fn failure(error: ValidationError) -> Self {
        Self {
            valid: false,
            errors: vec![error],
            warnings: Vec::new(),
        }
    }

    /// Add an error to this result
    pub fn add_error(&mut self, error: ValidationError) {
        self.errors.push(error);
        self.valid = false;
    }

    /// Add a warning to this result
    pub fn add_warning(&mut self, warning: ValidationWarning) {
        self.warnings.push(warning);
    }

    /// Get the number of errors
    pub fn error_count(&self) -> usize {
        self.errors.len()
    }

    /// Get the number of warnings
    pub fn warning_count(&self) -> usize {
        self.warnings.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = ValidationError::NoStartNode;
        assert_eq!(
            error.to_string(),
            "No start node found. Workflow must have exactly one trigger node."
        );
    }

    #[test]
    fn test_validation_result() {
        let mut result = ValidationResult::success();
        assert!(result.valid);
        assert_eq!(result.error_count(), 0);

        result.add_error(ValidationError::NoStartNode);
        assert!(!result.valid);
        assert_eq!(result.error_count(), 1);
    }
}
