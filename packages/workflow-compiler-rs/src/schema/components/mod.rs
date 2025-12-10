//! Component schemas for workflow nodes.
//!
//! This module defines the input/output schemas for all workflow components.

mod log;
mod start;
mod stop;
mod variable;

pub use log::*;
pub use start::*;
pub use stop::*;
pub use variable::*;
