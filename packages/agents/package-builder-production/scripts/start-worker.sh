#!/bin/bash
# Start Temporal worker for package builder

set -e

cd "$(dirname "$0")/.."

echo "🔨 Starting Package Builder Worker..."
echo "   Temporal Address: ${TEMPORAL_ADDRESS:-localhost:7233}"
echo "   Namespace: ${TEMPORAL_NAMESPACE:-default}"
echo ""

# Build first
echo "📦 Building worker..."
yarn build > /dev/null 2>&1 || {
  echo "❌ Build failed"
  exit 1
}

# Start worker
echo "🚀 Starting worker..."
TEMPORAL_ADDRESS=${TEMPORAL_ADDRESS:-localhost:7233} \
TEMPORAL_NAMESPACE=${TEMPORAL_NAMESPACE:-default} \
node dist/worker.js

