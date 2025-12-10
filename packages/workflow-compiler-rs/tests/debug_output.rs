//! Debug test to view generated code output

use workflow_compiler::{
    codegen::{generate, CodeGenOptions},
    schema::WorkflowDefinition,
};

fn load_fixture(name: &str) -> WorkflowDefinition {
    let path = format!("tests/fixtures/{}.json", name);
    let content = std::fs::read_to_string(&path).expect("Failed to read fixture");
    serde_json::from_str(&content).expect("Failed to parse fixture")
}

#[test]
#[ignore] // Run with: cargo test debug_base_workflow_output -- --ignored --nocapture
fn debug_base_workflow_output() {
    let workflow = load_fixture("base_workflow");
    let options = CodeGenOptions::new();
    let code = generate(&workflow, &options).expect("Code generation failed");

    println!("\n=== WORKFLOW.TS ===\n");
    println!("{}", code.workflow);
    println!("\n=== END WORKFLOW.TS ===\n");
}

#[test]
#[ignore]
fn debug_simple_workflow_output() {
    let workflow = load_fixture("simple_workflow");
    let options = CodeGenOptions::new();
    let code = generate(&workflow, &options).expect("Code generation failed");

    println!("\n=== WORKFLOW.TS ===\n");
    println!("{}", code.workflow);
    println!("\n=== END WORKFLOW.TS ===\n");
}
