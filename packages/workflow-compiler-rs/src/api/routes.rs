//! API route definitions.

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use super::handlers;
use crate::config::Config;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            config: Arc::new(config),
        }
    }
}

/// Create the API router
pub fn create_router(state: AppState) -> Router {
    Router::new()
        // Health check
        .route("/health", get(handlers::health_check))
        .route("/healthz", get(handlers::health_check))
        // Compile endpoints
        .route("/api/v1/compile", post(handlers::compile_workflow))
        .route("/api/v1/compile/validate", post(handlers::validate_workflow))
        .route(
            "/api/v1/compile/generate",
            post(handlers::generate_typescript),
        )
        .route("/api/v1/compile/verify", post(handlers::verify_code))
        // Full compilation pipeline
        .route("/api/v1/compile/full", post(handlers::full_compile))
        // Schema endpoint
        .route("/api/v1/schema", get(handlers::get_schema))
        // Version info
        .route("/api/v1/version", get(handlers::version))
        .with_state(state)
}
