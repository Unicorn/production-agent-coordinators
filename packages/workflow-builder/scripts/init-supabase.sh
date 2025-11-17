#!/bin/bash
# Initialize Supabase project and run migrations

set -e

echo "🚀 Initializing Supabase for Workflow Builder"
echo "=============================================="
echo ""

# Check if SUPABASE_PROJECT_ID is set
if [ -z "$SUPABASE_PROJECT_ID" ]; then
  echo "❌ Error: SUPABASE_PROJECT_ID not set"
  echo ""
  echo "Please set it in .env.local:"
  echo "  SUPABASE_PROJECT_ID=your-project-id"
  echo ""
  exit 1
fi

echo "📡 Linking to Supabase project: $SUPABASE_PROJECT_ID"
npx supabase link --project-ref "$SUPABASE_PROJECT_ID"

echo ""
echo "📊 Pushing database migrations..."
npx supabase db push

echo ""
echo "✅ Supabase initialization complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env.local with your Supabase credentials"
echo "  2. Run: yarn dev"
echo "  3. Visit: http://localhost:3010"
echo ""

