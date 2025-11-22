#!/bin/bash
# Update .env.local with local Supabase credentials

# Backup existing .env.local
if [ -f .env.local ]; then
  echo "📦 Backing up existing .env.local to .env.local.backup"
  cp .env.local .env.local.backup
fi

# Create new .env.local with local Supabase
cat > .env.local << 'EOF'
# Local Supabase (Docker)
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

echo "✅ Updated .env.local with local Supabase credentials"
echo ""
echo "🔄 Please restart your dev server (Ctrl+C and run 'yarn dev' again)"
echo ""
echo "📝 Login credentials:"
echo "   Email: test@example.com"
echo "   Password: testpassword123"

