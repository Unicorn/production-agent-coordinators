/**
 * Temporal Worker Service
 * 
 * Standalone Express server that manages Temporal workers.
 * Isolates @temporalio/worker from Next.js webpack bundling.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { projectWorkerManager } from './worker-manager';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.WORKER_SERVICE_PORT || 3011;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'temporal-worker-service' });
});

// Start worker for a project
app.post('/workers/start', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    
    console.log(`🚀 Starting worker for project: ${projectId}`);
    await projectWorkerManager.startWorkerForProject(projectId);
    
    return res.json({
      success: true,
      message: `Worker started for project ${projectId}`,
    });
  } catch (error) {
    console.error('Error starting worker:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Stop worker for a project
app.post('/workers/stop', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    
    console.log(`🛑 Stopping worker for project: ${projectId}`);
    await projectWorkerManager.stopWorkerForProject(projectId);
    
    return res.json({
      success: true,
      message: `Worker stopped for project ${projectId}`,
    });
  } catch (error) {
    console.error('Error stopping worker:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Restart worker for a project
app.post('/workers/restart', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    
    console.log(`🔄 Restarting worker for project: ${projectId}`);
    await projectWorkerManager.restartWorkerForProject(projectId);
    
    return res.json({
      success: true,
      message: `Worker restarted for project ${projectId}`,
    });
  } catch (error) {
    console.error('Error restarting worker:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get worker status
app.get('/workers/status/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const status = projectWorkerManager.getWorkerStatus(projectId);
    
    res.json({
      projectId,
      status,
      isRunning: status === 'running',
    });
  } catch (error) {
    console.error('Error getting worker status:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// List all running workers
app.get('/workers', (_req, res) => {
  try {
    const runningWorkers = projectWorkerManager.getRunningWorkers();
    
    res.json({
      workers: runningWorkers,
      count: runningWorkers.length,
    });
  } catch (error) {
    console.error('Error listing workers:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📡 SIGTERM received, shutting down gracefully...');
  await projectWorkerManager.shutdownAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📡 SIGINT received, shutting down gracefully...');
  await projectWorkerManager.shutdownAll();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Temporal Worker Service running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Temporal: ${process.env.TEMPORAL_ADDRESS || 'localhost:7233'}`);
});

export default app;

