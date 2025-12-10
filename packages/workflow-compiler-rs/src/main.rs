//! Workflow Compiler Service
//!
//! A Rust-based workflow compiler that validates workflow definitions
//! and generates type-safe TypeScript code for Temporal.

use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use workflow_compiler::{
    api::{self, AppState},
    config::Config,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "workflow_compiler=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env();

    tracing::info!(
        "Starting Workflow Compiler v{} on port {}",
        env!("CARGO_PKG_VERSION"),
        config.port
    );

    // Create app state
    let state = AppState::new(config.clone());

    // Build the API router
    let app = api::create_router(state);

    // Run the server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    tracing::info!("Listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
