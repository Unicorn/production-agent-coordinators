/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Bernier LLC Production Agent Coordinators Package
 *
 * This package provides a client for managing production agents and their
 * coordinators. It includes functionalities for creating, retrieving,
 * updating, and deleting agents and coordinators.
 *
 * All operations return a `PackageResult` to indicate success or failure
 * and provide data or an error message accordingly.
 */
export { BernierCoordinatorsClient } from './client';
export * from './types';
export * from './errors';
export * from './schemas';