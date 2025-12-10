//! HTTP API module.
//!
//! Provides Axum REST endpoints for the workflow compiler.

mod handlers;
mod routes;

pub use handlers::*;
pub use routes::*;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

/// API error response
#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl ApiError {
    pub fn new(error: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            code: code.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new(message, "VALIDATION_ERROR")
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(message, "INTERNAL_ERROR")
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(message, "NOT_FOUND")
    }
}

/// API error with status code
pub struct ApiErrorResponse {
    pub status: StatusCode,
    pub error: ApiError,
}

impl ApiErrorResponse {
    pub fn bad_request(error: ApiError) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            error,
        }
    }

    pub fn internal_error(error: ApiError) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            error,
        }
    }

    pub fn not_found(error: ApiError) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            error,
        }
    }
}

impl IntoResponse for ApiErrorResponse {
    fn into_response(self) -> Response {
        (self.status, Json(self.error)).into_response()
    }
}

/// API success response wrapper
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: T,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data,
        }
    }
}
