//! Schema definitions for workflow compilation.
//!
//! This module contains all the types needed to represent workflow definitions,
//! mirroring the TypeScript types in the workflow-builder package.

pub mod components;
mod edge;
mod node;
mod settings;
mod variable;
mod workflow;

pub use components::*;
pub use edge::*;
pub use node::*;
pub use settings::*;
pub use variable::*;
pub use workflow::*;
