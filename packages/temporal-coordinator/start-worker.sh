#!/bin/bash
# Start Temporal Worker
# This script uses tsx to run TypeScript directly without build issues

cd "$(dirname "$0")"
exec npx tsx src/worker.ts
