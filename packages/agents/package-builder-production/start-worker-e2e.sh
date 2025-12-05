#!/bin/bash
# Start worker for E2E tests

cd "$(dirname "$0")"

echo "🔨 Starting Worker for E2E Tests..."
echo "   Task Queue: engine-cli-e2e"
echo "   Temporal Address: ${TEMPORAL_ADDRESS:-localhost:7233}"
echo "   Namespace: ${TEMPORAL_NAMESPACE:-default}"
echo ""

# Build first
echo "📦 Building..."
npm run build > /dev/null 2>&1 || {
  echo "❌ Build failed"
  exit 1
}

# Start worker
echo "🚀 Starting worker..."
TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker
