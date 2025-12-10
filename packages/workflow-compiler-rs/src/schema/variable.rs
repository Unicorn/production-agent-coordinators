//! Workflow variable types and structures.

use serde::{Deserialize, Serialize};

/// Variable types supported in workflows
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum VariableType {
    String,
    Number,
    Boolean,
    Object,
    Array,
    #[default]
    Any,
}


impl std::fmt::Display for VariableType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VariableType::String => write!(f, "string"),
            VariableType::Number => write!(f, "number"),
            VariableType::Boolean => write!(f, "boolean"),
            VariableType::Object => write!(f, "object"),
            VariableType::Array => write!(f, "array"),
            VariableType::Any => write!(f, "any"),
        }
    }
}

/// Workflow variable definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowVariable {
    pub name: String,
    #[serde(rename = "type")]
    pub variable_type: VariableType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub required: bool,
}

impl WorkflowVariable {
    /// Create a new variable with the given name and type
    pub fn new(name: impl Into<String>, variable_type: VariableType) -> Self {
        Self {
            name: name.into(),
            variable_type,
            default_value: None,
            description: None,
            required: false,
        }
    }

    /// Mark this variable as required
    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }

    /// Set a default value for this variable
    pub fn with_default(mut self, value: serde_json::Value) -> Self {
        self.default_value = Some(value);
        self
    }

    /// Convert variable type to TypeScript type string
    pub fn to_typescript_type(&self) -> &'static str {
        match self.variable_type {
            VariableType::String => "string",
            VariableType::Number => "number",
            VariableType::Boolean => "boolean",
            VariableType::Object => "Record<string, unknown>",
            VariableType::Array => "unknown[]",
            VariableType::Any => "unknown",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_variable_type_serialization() {
        let var_type = VariableType::String;
        let json = serde_json::to_string(&var_type).unwrap();
        assert_eq!(json, "\"string\"");
    }

    #[test]
    fn test_variable_creation() {
        let var = WorkflowVariable::new("userId", VariableType::String)
            .required()
            .with_default(serde_json::json!("default-user"));

        assert_eq!(var.name, "userId");
        assert_eq!(var.variable_type, VariableType::String);
        assert!(var.required);
        assert_eq!(var.default_value, Some(serde_json::json!("default-user")));
    }

    #[test]
    fn test_typescript_type_conversion() {
        assert_eq!(
            WorkflowVariable::new("x", VariableType::String).to_typescript_type(),
            "string"
        );
        assert_eq!(
            WorkflowVariable::new("x", VariableType::Number).to_typescript_type(),
            "number"
        );
        assert_eq!(
            WorkflowVariable::new("x", VariableType::Object).to_typescript_type(),
            "Record<string, unknown>"
        );
    }
}
