//! Workflow Compiler Library
//!
//! This library provides workflow validation, TypeScript code generation,
//! and verification functionality.

pub mod api;
pub mod codegen;
pub mod config;
pub mod schema;
pub mod validation;
pub mod verification;

pub use schema::WorkflowDefinition;
