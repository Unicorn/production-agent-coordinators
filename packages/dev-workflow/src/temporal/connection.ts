/**
 * Temporal Connection Manager
 *
 * Manages connection to Temporal server and provides client instance.
 * Singleton pattern ensures only one connection is established and prevents resource leaks.
 *
 * CRITICAL: This prevents resource exhaustion by reusing connections instead of
 * creating a new connection for each operation.
 */

import { Connection, Client } from '@temporalio/client';

let clientInstance: Client | null = null;
let connectionInstance: Connection | null = null;

/**
 * Get Temporal client (creates connection if needed)
 *
 * Returns singleton client instance, creating new connection only if needed.
 * Safe to call multiple times - will return the same instance.
 */
export async function getTemporalClient(): Promise<Client> {
  if (clientInstance) {
    return clientInstance;
  }

  try {
    const connection = await getTemporalConnection();

    clientInstance = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    });

    console.log('✅ Temporal client initialized');
    return clientInstance;
  } catch (error) {
    console.error('❌ Failed to create Temporal client:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to connect to Temporal server: ${errorMessage}. Check TEMPORAL_ADDRESS environment variable.`);
  }
}

/**
 * Get Temporal connection (creates if needed)
 *
 * Returns singleton connection instance, creating new connection only if needed.
 * Safe to call multiple times - will return the same instance.
 */
export async function getTemporalConnection(): Promise<Connection> {
  if (connectionInstance) {
    return connectionInstance;
  }

  const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';

  try {
    connectionInstance = await Connection.connect({
      address,
    });

    console.log(`✅ Connected to Temporal at ${address}`);
    return connectionInstance;
  } catch (error) {
    console.error(`❌ Failed to connect to Temporal at ${address}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Cannot connect to Temporal server at ${address}: ${errorMessage}. Ensure Temporal is running and accessible.`);
  }
}

/**
 * Close Temporal connection
 *
 * Should be called when shutting down the application to ensure clean shutdown.
 * This is critical for preventing resource leaks.
 */
export async function closeTemporalConnection(): Promise<void> {
  if (connectionInstance) {
    try {
      await connectionInstance.close();
      clientInstance = null;
      connectionInstance = null;
      console.log('✅ Temporal connection closed');
    } catch (error) {
      console.error('❌ Error closing Temporal connection:', error);
      throw error;
    }
  }
}

/**
 * Check if Temporal connection is healthy
 *
 * Useful for health checks and monitoring.
 */
export async function checkTemporalHealth(): Promise<boolean> {
  try {
    const client = await getTemporalClient();
    // Try to list workflows as a health check
    await client.workflow.list();
    return true;
  } catch (error) {
    console.error('❌ Temporal health check failed:', error);
    return false;
  }
}

/**
 * Reset connection (for testing purposes)
 *
 * WARNING: Only use in tests! This will close the connection and clear the singleton.
 */
export async function resetConnection(): Promise<void> {
  await closeTemporalConnection();
}
