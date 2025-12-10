//! Configuration module for the workflow compiler service.

use std::env;

/// Service configuration
#[derive(Debug, Clone)]
pub struct Config {
    /// Port to listen on
    pub port: u16,
    /// TypeScript compiler path
    pub tsc_path: String,
    /// ESLint path
    pub eslint_path: String,
    /// Verification timeout in seconds
    pub verification_timeout: u64,
    /// Enable strict TypeScript checking
    pub strict_mode: bool,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Self {
        Self {
            port: env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3020),
            tsc_path: env::var("TSC_PATH").unwrap_or_else(|_| "npx tsc".to_string()),
            eslint_path: env::var("ESLINT_PATH").unwrap_or_else(|_| "npx eslint".to_string()),
            verification_timeout: env::var("VERIFICATION_TIMEOUT")
                .ok()
                .and_then(|t| t.parse().ok())
                .unwrap_or(30),
            strict_mode: env::var("STRICT_MODE")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(true),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            port: 3020,
            tsc_path: "npx tsc".to_string(),
            eslint_path: "npx eslint".to_string(),
            verification_timeout: 30,
            strict_mode: true,
        }
    }
}
