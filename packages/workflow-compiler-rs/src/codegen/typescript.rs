//! TypeScript code generator.

use serde::Serialize;

use crate::schema::{
    GetVariableConfig, LogConfig, LogLevel, NodeType, ServiceVariableConfig, SetVariableConfig,
    StartConfig, StopConfig, VariableScope, WorkflowDefinition, WorkflowNode,
};

use super::components::{
    generate_get_variable_code, generate_log_code, generate_service_variable_code,
    generate_set_variable_code, generate_start_code, generate_stop_code,
};
use super::{get_handlebars, CodeGenOptions, GeneratedCode};

/// Template data for workflow generation
#[derive(Debug, Serialize)]
pub struct WorkflowTemplateData {
    pub version: String,
    pub generated_at: String,
    pub workflow_id: String,
    pub workflow_name: String,
    pub function_name: String,
    pub default_timeout: String,
    pub has_signals: bool,
    pub has_queries: bool,
    pub is_long_running: bool,
    pub has_retry_policy: bool,
    pub has_variables: bool,
    pub input_type: String,
    pub output_type: String,
    pub activities: Vec<ActivityInfo>,
    pub signals: Vec<SignalInfo>,
    pub variables: Vec<VariableInfo>,
    pub code_blocks: Vec<String>,
    pub retry_policy: Option<RetryPolicyInfo>,
}

#[derive(Debug, Serialize)]
pub struct ActivityInfo {
    pub name: String,
    pub component_id: Option<String>,
    pub component_name: Option<String>,
    pub timeout: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SignalInfo {
    pub name: String,
    pub param_types: String,
}

#[derive(Debug, Serialize)]
pub struct VariableInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub var_type: String,
    pub default_value: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RetryPolicyInfo {
    pub max_attempts: u32,
    pub initial_interval: String,
    pub max_interval: String,
    pub backoff_coefficient: f64,
}

/// TypeScript code generator
pub struct TypeScriptGenerator<'a> {
    workflow: &'a WorkflowDefinition,
    options: &'a CodeGenOptions,
}

impl<'a> TypeScriptGenerator<'a> {
    pub fn new(workflow: &'a WorkflowDefinition, options: &'a CodeGenOptions) -> Self {
        Self { workflow, options }
    }

    pub fn generate(&self) -> anyhow::Result<GeneratedCode> {
        let hbs = get_handlebars();

        // Prepare template data
        let data = self.prepare_template_data();

        // Generate workflow.ts
        let workflow = hbs.render("workflow", &data)?;

        // Generate activities.ts
        let activities = hbs.render("activities", &data)?;

        // Generate worker.ts
        let worker = hbs.render("worker", &data)?;

        // Generate package.json
        let package_json = hbs.render("package_json", &data)?;

        // Generate tsconfig.json
        let tsconfig = hbs.render("tsconfig", &data)?;

        Ok(GeneratedCode {
            workflow,
            activities,
            worker,
            package_json,
            tsconfig,
        })
    }

    fn prepare_template_data(&self) -> WorkflowTemplateData {
        let workflow_name = self
            .options
            .workflow_name
            .clone()
            .or(self.workflow.name.clone())
            .unwrap_or_else(|| "workflow".to_string());

        let function_name = to_camel_case(&workflow_name) + "Workflow";

        // Extract activities from nodes
        let activities: Vec<ActivityInfo> = self
            .workflow
            .nodes
            .iter()
            .filter(|n| n.node_type == NodeType::Activity)
            .map(|n| ActivityInfo {
                name: n.data.activity_name.clone().unwrap_or_else(|| n.data.label.clone()),
                component_id: n.data.component_id.clone(),
                component_name: n.data.component_name.clone(),
                timeout: n.data.timeout.clone(),
            })
            .collect();

        // Extract signals from nodes
        let signals: Vec<SignalInfo> = self
            .workflow
            .nodes
            .iter()
            .filter(|n| n.node_type == NodeType::Signal)
            .filter_map(|n| {
                n.data.signal_name.clone().map(|name| SignalInfo {
                    name,
                    param_types: "unknown".to_string(), // Default to unknown
                })
            })
            .collect();

        // Extract variables
        let variables: Vec<VariableInfo> = self
            .workflow
            .variables
            .iter()
            .map(|v| VariableInfo {
                name: v.name.clone(),
                var_type: v.to_typescript_type().to_string(),
                default_value: v.default_value.as_ref().map(|v| v.to_string()),
            })
            .collect();

        // Check for long-running indicators
        let is_long_running = self.workflow.nodes.iter().any(|n| {
            matches!(
                n.node_type,
                NodeType::Signal | NodeType::Loop | NodeType::Phase
            )
        });

        // Generate code blocks
        let code_blocks = self.generate_code_blocks();

        WorkflowTemplateData {
            version: env!("CARGO_PKG_VERSION").to_string(),
            generated_at: chrono::Utc::now().to_rfc3339(),
            workflow_id: self.workflow.id.clone().unwrap_or_default(),
            workflow_name: workflow_name.clone(),
            function_name,
            default_timeout: self.options.default_timeout.clone(),
            has_signals: !signals.is_empty(),
            has_queries: false, // TODO: Add query support
            is_long_running,
            has_retry_policy: self.workflow.metadata.as_ref().and_then(|m| m.retry_policy.as_ref()).is_some(),
            has_variables: !variables.is_empty(),
            input_type: "Record<string, unknown>".to_string(),
            output_type: "unknown".to_string(),
            activities,
            signals,
            variables,
            code_blocks,
            retry_policy: None,
        }
    }

    fn generate_code_blocks(&self) -> Vec<String> {
        let mut blocks = Vec::new();

        // Sort nodes topologically (simple approach for now)
        let ordered_nodes = self.topological_sort();

        for node in ordered_nodes {
            if let Some(block) = self.generate_node_code(node) {
                blocks.push(block);
            }
        }

        if blocks.is_empty() {
            blocks.push("return input;".to_string());
        }

        blocks
    }

    fn topological_sort(&self) -> Vec<&WorkflowNode> {
        // Simple implementation: put trigger first, end last, others in between
        let mut trigger: Option<&WorkflowNode> = None;
        let mut end: Option<&WorkflowNode> = None;
        let mut others: Vec<&WorkflowNode> = Vec::new();

        for node in &self.workflow.nodes {
            match node.node_type {
                NodeType::Trigger => trigger = Some(node),
                NodeType::End => end = Some(node),
                _ => others.push(node),
            }
        }

        let mut result = Vec::new();
        if let Some(t) = trigger {
            result.push(t);
        }
        result.extend(others);
        if let Some(e) = end {
            result.push(e);
        }
        result
    }

    fn generate_node_code(&self, node: &WorkflowNode) -> Option<String> {
        match node.node_type {
            NodeType::Trigger => {
                // Start component - generate start code
                let config = self.extract_start_config(node);
                let pattern = generate_start_code(&config, &node.id);
                Some(pattern.code)
            }
            NodeType::End => {
                // Stop component - generate stop code
                let config = self.extract_stop_config(node);
                let pattern = generate_stop_code(&config, &node.id);
                Some(pattern.code)
            }
            NodeType::Activity => {
                // Check if this is a Log activity
                if node.data.component_name.as_deref() == Some("Log")
                    || node.data.activity_name.as_deref() == Some("log")
                {
                    let config = self.extract_log_config(node);
                    let pattern = generate_log_code(&config, &node.id);
                    Some(pattern.code)
                } else {
                    // Generic activity
                    let activity_name = node
                        .data
                        .activity_name
                        .clone()
                        .unwrap_or_else(|| to_camel_case(&node.data.label));
                    Some(format!(
                        "const {}_result = await acts.{}(input);",
                        to_snake_case(&node.data.label),
                        activity_name
                    ))
                }
            }
            NodeType::KongLogging => {
                // Kong logging is similar to Log activity
                let config = self.extract_log_config(node);
                let pattern = generate_log_code(&config, &node.id);
                Some(pattern.code)
            }
            NodeType::Signal => {
                node.data.signal_name.as_ref().map(|signal_name| {
                    format!(
                        "setHandler({}Signal, (payload) => {{ /* Handle {} signal */ }});",
                        to_camel_case(signal_name),
                        signal_name
                    )
                })
            }
            NodeType::Conditional | NodeType::Condition => {
                let condition = node
                    .data
                    .condition
                    .clone()
                    .unwrap_or_else(|| "true".to_string());
                Some(format!("if ({}) {{\n  // TODO: condition body\n}}", condition))
            }
            NodeType::Loop => Some("// TODO: loop implementation".to_string()),
            NodeType::ChildWorkflow => {
                node.data.workflow_id.as_ref().map(|wf_id| {
                    format!(
                        "const child_result = await executeChild('{}', {{ args: [input] }});",
                        wf_id
                    )
                })
            }
            NodeType::StateVariable => {
                // Handle variable operations based on component name
                let component_name = node.data.component_name.as_deref().unwrap_or("ServiceVariable");

                match component_name {
                    "ServiceVariable" | "service-variable" => {
                        let config = self.extract_service_variable_config(node);
                        let pattern = generate_service_variable_code(&config, &node.id);
                        Some(pattern.code)
                    }
                    "GetVariable" | "get-variable" => {
                        let config = self.extract_get_variable_config(node);
                        let pattern = generate_get_variable_code(&config, &node.id);
                        Some(pattern.code)
                    }
                    "SetVariable" | "set-variable" => {
                        let config = self.extract_set_variable_config(node);
                        let pattern = generate_set_variable_code(&config, &node.id);
                        Some(pattern.code)
                    }
                    _ => {
                        // Default to service variable
                        let config = self.extract_service_variable_config(node);
                        let pattern = generate_service_variable_code(&config, &node.id);
                        Some(pattern.code)
                    }
                }
            }
            _ => None,
        }
    }

    /// Extract StartConfig from node data
    fn extract_start_config(&self, node: &WorkflowNode) -> StartConfig {
        StartConfig {
            trigger_type: node.data.trigger_type.clone(),
            schedule: node.data.schedule.clone(),
            webhook_config: None, // TODO: extract from node.data.config if present
        }
    }

    /// Extract StopConfig from node data
    fn extract_stop_config(&self, node: &WorkflowNode) -> StopConfig {
        StopConfig {
            result_mapping: node.data.result_mapping.clone(),
            include_metadata: node.data.include_metadata.unwrap_or(false),
        }
    }

    /// Extract LogConfig from node data
    fn extract_log_config(&self, node: &WorkflowNode) -> LogConfig {
        LogConfig {
            message: node
                .data
                .log_message
                .clone()
                .or_else(|| node.data.label.clone().into())
                .unwrap_or_else(|| "Log entry".to_string()),
            level: node
                .data
                .log_level
                .as_ref()
                .map(|l| match l.to_lowercase().as_str() {
                    "debug" => LogLevel::Debug,
                    "warn" | "warning" => LogLevel::Warn,
                    "error" => LogLevel::Error,
                    _ => LogLevel::Info,
                })
                .unwrap_or_default(),
            metadata: None, // TODO: extract from node.data.metadata if present
            include_workflow_context: node.data.include_workflow_context.unwrap_or(true),
        }
    }

    /// Extract ServiceVariableConfig from node data
    fn extract_service_variable_config(&self, node: &WorkflowNode) -> ServiceVariableConfig {
        use crate::schema::{PersistenceStrategy, RuntimeVariableType};

        ServiceVariableConfig {
            name: node
                .data
                .variable_name
                .clone()
                .unwrap_or_else(|| node.data.label.clone()),
            variable_type: node
                .data
                .variable_type
                .as_ref()
                .map(|t| match t.to_lowercase().as_str() {
                    "string" => RuntimeVariableType::String,
                    "number" => RuntimeVariableType::Number,
                    "boolean" => RuntimeVariableType::Boolean,
                    "object" => RuntimeVariableType::Object,
                    "array" => RuntimeVariableType::Array,
                    _ => RuntimeVariableType::Any,
                })
                .unwrap_or_default(),
            default_value: node.data.default_value.clone(),
            description: None,
            required: false,
            persistence: node
                .data
                .persistence
                .as_ref()
                .map(|p| match p.to_lowercase().as_str() {
                    "in-memory" | "inmemory" => PersistenceStrategy::InMemory,
                    "workflow-state" | "workflowstate" => PersistenceStrategy::WorkflowState,
                    "external-store" | "externalstore" => PersistenceStrategy::ExternalStore,
                    _ => PersistenceStrategy::WorkflowState,
                })
                .unwrap_or_default(),
            ttl: node.data.ttl.clone(),
        }
    }

    /// Extract GetVariableConfig from node data
    fn extract_get_variable_config(&self, node: &WorkflowNode) -> GetVariableConfig {
        GetVariableConfig {
            name: node
                .data
                .variable_name
                .clone()
                .unwrap_or_else(|| node.data.label.clone()),
            scope: node
                .data
                .variable_scope
                .as_ref()
                .map(|s| match s.to_lowercase().as_str() {
                    "service" => VariableScope::Service,
                    "project" => VariableScope::Project,
                    _ => VariableScope::Workflow,
                })
                .unwrap_or_default(),
            default_value: node.data.default_value.clone(),
            throw_if_missing: node.data.throw_if_missing.unwrap_or(false),
        }
    }

    /// Extract SetVariableConfig from node data
    fn extract_set_variable_config(&self, node: &WorkflowNode) -> SetVariableConfig {
        SetVariableConfig {
            name: node
                .data
                .variable_name
                .clone()
                .unwrap_or_else(|| node.data.label.clone()),
            scope: node
                .data
                .variable_scope
                .as_ref()
                .map(|s| match s.to_lowercase().as_str() {
                    "service" => VariableScope::Service,
                    "project" => VariableScope::Project,
                    _ => VariableScope::Workflow,
                })
                .unwrap_or_default(),
            value_expression: node.data.value_expression.clone(),
            static_value: node.data.static_value.clone(),
            create_if_missing: node.data.create_if_missing.unwrap_or(true),
            merge: node.data.merge.unwrap_or(false),
        }
    }
}

/// Convert string to camelCase
fn to_camel_case(s: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = false;

    for (i, c) in s.chars().enumerate() {
        if c == '_' || c == '-' || c == ' ' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(c.to_uppercase().next().unwrap_or(c));
            capitalize_next = false;
        } else if i == 0 {
            result.push(c.to_lowercase().next().unwrap_or(c));
        } else {
            result.push(c);
        }
    }

    result
}

/// Convert string to snake_case
fn to_snake_case(s: &str) -> String {
    let mut result = String::new();

    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            result.push('_');
            result.push(c.to_lowercase().next().unwrap_or(c));
        } else if c == ' ' || c == '-' {
            result.push('_');
        } else {
            result.push(c.to_lowercase().next().unwrap_or(c));
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_camel_case() {
        assert_eq!(to_camel_case("hello_world"), "helloWorld");
        assert_eq!(to_camel_case("hello-world"), "helloWorld");
        assert_eq!(to_camel_case("hello world"), "helloWorld");
        assert_eq!(to_camel_case("HelloWorld"), "helloWorld");
    }

    #[test]
    fn test_to_snake_case() {
        assert_eq!(to_snake_case("helloWorld"), "hello_world");
        assert_eq!(to_snake_case("HelloWorld"), "hello_world");
        assert_eq!(to_snake_case("hello-world"), "hello_world");
        assert_eq!(to_snake_case("hello world"), "hello_world");
    }
}
