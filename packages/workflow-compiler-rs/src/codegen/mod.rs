//! Code generation module.
//!
//! This module generates type-safe TypeScript code from validated workflow definitions.

pub mod components;
mod typescript;

pub use components::*;
pub use typescript::*;

use handlebars::Handlebars;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

use crate::schema::WorkflowDefinition;

/// Generated code output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedCode {
    /// The main workflow TypeScript file
    pub workflow: String,
    /// Activities TypeScript file
    pub activities: String,
    /// Worker TypeScript file
    pub worker: String,
    /// package.json content
    pub package_json: String,
    /// tsconfig.json content
    pub tsconfig: String,
}

/// Code generation options
#[derive(Debug, Clone, Serialize, Default)]
pub struct CodeGenOptions {
    /// Include comments in generated code
    pub include_comments: bool,
    /// TypeScript strict mode
    pub strict_mode: bool,
    /// Workflow name (used for function naming)
    pub workflow_name: Option<String>,
    /// Default timeout for activities
    pub default_timeout: String,
}

impl CodeGenOptions {
    pub fn new() -> Self {
        Self {
            include_comments: true,
            strict_mode: true,
            workflow_name: None,
            default_timeout: "1m".to_string(),
        }
    }
}

/// Global Handlebars instance
static HANDLEBARS: OnceLock<Handlebars<'static>> = OnceLock::new();

/// Get or initialize the Handlebars instance
pub fn get_handlebars() -> &'static Handlebars<'static> {
    HANDLEBARS.get_or_init(|| {
        let mut hbs = Handlebars::new();
        hbs.set_strict_mode(true);

        // Register templates
        hbs.register_template_string("workflow", include_str!("templates/workflow.ts.hbs"))
            .expect("Failed to register workflow template");
        hbs.register_template_string("activities", include_str!("templates/activities.ts.hbs"))
            .expect("Failed to register activities template");
        hbs.register_template_string("worker", include_str!("templates/worker.ts.hbs"))
            .expect("Failed to register worker template");
        hbs.register_template_string("package_json", include_str!("templates/package.json.hbs"))
            .expect("Failed to register package.json template");
        hbs.register_template_string("tsconfig", include_str!("templates/tsconfig.json.hbs"))
            .expect("Failed to register tsconfig template");

        hbs
    })
}

/// Generate TypeScript code from a workflow definition
pub fn generate(
    workflow: &WorkflowDefinition,
    options: &CodeGenOptions,
) -> anyhow::Result<GeneratedCode> {
    let generator = TypeScriptGenerator::new(workflow, options);
    generator.generate()
}
