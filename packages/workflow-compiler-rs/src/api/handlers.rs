//! API request handlers.

use axum::{response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tempfile::tempdir;

use super::{ApiError, ApiErrorResponse, ApiResponse};
use crate::{
    codegen::{self, CodeGenOptions, GeneratedCode},
    schema::WorkflowDefinition,
    validation::{self, ValidationResult},
    verification::{self, VerificationResult},
};

/// Health check response
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
}

/// Version response
#[derive(Debug, Serialize)]
pub struct VersionResponse {
    pub version: String,
    pub rust_version: String,
    pub build_time: String,
}

/// Compile request body
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileRequest {
    pub workflow: WorkflowDefinition,
    #[serde(default)]
    pub options: CompileOptions,
}

/// Compile options
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileOptions {
    pub workflow_name: Option<String>,
    pub default_timeout: Option<String>,
    pub include_comments: Option<bool>,
    pub strict_mode: Option<bool>,
    pub verify: Option<bool>,
    pub output_dir: Option<String>,
}

/// Compile response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileResponse {
    pub validation: ValidationResult,
    pub code: Option<GeneratedCode>,
    pub verification: Option<VerificationResult>,
}

/// Full compile response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FullCompileResponse {
    pub validation: ValidationResult,
    pub code: GeneratedCode,
    pub verification: VerificationResult,
}

/// Health check endpoint
pub async fn health_check() -> impl IntoResponse {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "workflow-compiler".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Version endpoint
pub async fn version() -> impl IntoResponse {
    Json(VersionResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        rust_version: env!("CARGO_PKG_RUST_VERSION").to_string(),
        build_time: chrono::Utc::now().to_rfc3339(),
    })
}

/// Get JSON schema for workflow definitions
pub async fn get_schema() -> impl IntoResponse {
    // Return a simplified schema description
    let schema = serde_json::json!({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "WorkflowDefinition",
        "description": "A workflow definition for Temporal workflows",
        "type": "object",
        "properties": {
            "id": { "type": "string" },
            "name": { "type": "string" },
            "nodes": {
                "type": "array",
                "items": { "$ref": "#/definitions/WorkflowNode" }
            },
            "edges": {
                "type": "array",
                "items": { "$ref": "#/definitions/WorkflowEdge" }
            },
            "variables": {
                "type": "array",
                "items": { "$ref": "#/definitions/WorkflowVariable" }
            },
            "metadata": { "$ref": "#/definitions/WorkflowMetadata" }
        },
        "required": ["nodes", "edges"],
        "definitions": {
            "WorkflowNode": {
                "type": "object",
                "properties": {
                    "id": { "type": "string" },
                    "type": { "type": "string" },
                    "data": { "type": "object" },
                    "position": { "type": "object" }
                },
                "required": ["id", "type", "data", "position"]
            },
            "WorkflowEdge": {
                "type": "object",
                "properties": {
                    "id": { "type": "string" },
                    "source": { "type": "string" },
                    "target": { "type": "string" }
                },
                "required": ["id", "source", "target"]
            },
            "WorkflowVariable": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "type": { "type": "string" },
                    "defaultValue": { "type": ["string", "number", "boolean", "null"] }
                },
                "required": ["name", "type"]
            },
            "WorkflowMetadata": {
                "type": "object",
                "properties": {
                    "description": { "type": "string" },
                    "version": { "type": "string" },
                    "author": { "type": "string" }
                }
            }
        }
    });

    Json(schema)
}

/// Validate workflow endpoint
pub async fn validate_workflow(
    Json(request): Json<CompileRequest>,
) -> Result<impl IntoResponse, ApiErrorResponse> {
    let result = validation::validate(&request.workflow);
    Ok(Json(ApiResponse::success(result)))
}

/// Generate TypeScript code endpoint (without verification)
pub async fn generate_typescript(
    Json(request): Json<CompileRequest>,
) -> Result<impl IntoResponse, ApiErrorResponse> {
    // First validate
    let validation = validation::validate(&request.workflow);
    if !validation.valid {
        return Err(ApiErrorResponse::bad_request(
            ApiError::validation("Workflow validation failed")
                .with_details(serde_json::to_value(&validation).unwrap()),
        ));
    }

    // Generate code
    let options = to_codegen_options(&request.options);
    let code = codegen::generate(&request.workflow, &options).map_err(|e| {
        ApiErrorResponse::internal_error(ApiError::internal(format!(
            "Code generation failed: {}",
            e
        )))
    })?;

    Ok(Json(ApiResponse::success(code)))
}

/// Verify generated code endpoint
pub async fn verify_code(
    Json(code): Json<GeneratedCode>,
) -> Result<impl IntoResponse, ApiErrorResponse> {
    let temp_dir = tempdir().map_err(|e| {
        ApiErrorResponse::internal_error(ApiError::internal(format!(
            "Failed to create temp directory: {}",
            e
        )))
    })?;

    let result = verification::verify(&code, temp_dir.path())
        .await
        .map_err(|e| {
            ApiErrorResponse::internal_error(ApiError::internal(format!(
                "Verification failed: {}",
                e
            )))
        })?;

    Ok(Json(ApiResponse::success(result)))
}

/// Compile workflow endpoint (validate + generate)
pub async fn compile_workflow(
    Json(request): Json<CompileRequest>,
) -> Result<impl IntoResponse, ApiErrorResponse> {
    // Validate
    let validation = validation::validate(&request.workflow);
    if !validation.valid {
        return Ok(Json(CompileResponse {
            validation,
            code: None,
            verification: None,
        }));
    }

    // Generate code
    let options = to_codegen_options(&request.options);
    let code = match codegen::generate(&request.workflow, &options) {
        Ok(code) => code,
        Err(e) => {
            return Err(ApiErrorResponse::internal_error(ApiError::internal(
                format!("Code generation failed: {}", e),
            )));
        }
    };

    // Optionally verify
    let verification = if request.options.verify.unwrap_or(false) {
        let temp_dir = tempdir().map_err(|e| {
            ApiErrorResponse::internal_error(ApiError::internal(format!(
                "Failed to create temp directory: {}",
                e
            )))
        })?;

        Some(
            verification::verify(&code, temp_dir.path())
                .await
                .map_err(|e| {
                    ApiErrorResponse::internal_error(ApiError::internal(format!(
                        "Verification failed: {}",
                        e
                    )))
                })?,
        )
    } else {
        None
    };

    Ok(Json(CompileResponse {
        validation,
        code: Some(code),
        verification,
    }))
}

/// Full compile endpoint (validate + generate + verify)
pub async fn full_compile(
    Json(request): Json<CompileRequest>,
) -> Result<impl IntoResponse, ApiErrorResponse> {
    // Validate
    let validation = validation::validate(&request.workflow);
    if !validation.valid {
        return Err(ApiErrorResponse::bad_request(
            ApiError::validation("Workflow validation failed")
                .with_details(serde_json::to_value(&validation).unwrap()),
        ));
    }

    // Generate code
    let options = to_codegen_options(&request.options);
    let code = codegen::generate(&request.workflow, &options).map_err(|e| {
        ApiErrorResponse::internal_error(ApiError::internal(format!(
            "Code generation failed: {}",
            e
        )))
    })?;

    // Verify
    let output_dir = request.options.output_dir.map(PathBuf::from);
    let temp_dir = if output_dir.is_none() {
        Some(tempdir().map_err(|e| {
            ApiErrorResponse::internal_error(ApiError::internal(format!(
                "Failed to create temp directory: {}",
                e
            )))
        })?)
    } else {
        None
    };
    let output_path = output_dir.unwrap_or_else(|| temp_dir.as_ref().unwrap().path().to_path_buf());

    let verification = verification::verify(&code, &output_path).await.map_err(|e| {
        ApiErrorResponse::internal_error(ApiError::internal(format!(
            "Verification failed: {}",
            e
        )))
    })?;

    Ok(Json(FullCompileResponse {
        validation,
        code,
        verification,
    }))
}

/// Convert API options to codegen options
fn to_codegen_options(options: &CompileOptions) -> CodeGenOptions {
    CodeGenOptions {
        workflow_name: options.workflow_name.clone(),
        default_timeout: options
            .default_timeout
            .clone()
            .unwrap_or_else(|| "1m".to_string()),
        include_comments: options.include_comments.unwrap_or(true),
        strict_mode: options.strict_mode.unwrap_or(true),
    }
}
