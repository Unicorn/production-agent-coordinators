#!/bin/bash
# Copy this output to your .env.local file

cat << 'EOF'
# Local Supabase (generated from supabase start)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54332
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz

# Local Database
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54333/postgres

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# App
NEXT_PUBLIC_APP_URL=http://localhost:3010
NODE_ENV=development
EOF

