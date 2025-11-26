/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Re-exports core functionality and types for the Bernier LLC package.
 *
 * This entry point provides access to file operation utilities and shared type definitions,
 * enabling consumers to easily interact with the package's features.
 */
export { readPlanFile } from './utils/fileOperations';
export { PackageResult, PlanFileContent } from './types';