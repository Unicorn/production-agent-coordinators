#!/bin/bash
# Run all migrations using psql

set -e

# Try Supabase pooler format: postgres.[project-ref]:[password]@pooler
# For migrations, we need transaction mode on pooler (port 6543)
CONNECTION_STRING="postgres://postgres.jeaudyvxapooyfddfptr:65TzRzrtEJ2DNrdG@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
MIGRATIONS_DIR="supabase/migrations"

echo "🚀 Running All Migrations via psql"
echo "=================================="
echo ""

# Get all migration files sorted
MIGRATIONS=$(ls -1 "$MIGRATIONS_DIR"/*.sql | grep -v OPTIMIZATION | grep -v SUMMARY | sort)

TOTAL=$(echo "$MIGRATIONS" | wc -l | tr -d ' ')
echo "📋 Found $TOTAL migration files"
echo ""

SUCCESS=0
FAILED=0

for migration in $MIGRATIONS; do
  filename=$(basename "$migration")
  echo "📄 $filename"
  echo "────────────────────────────────────────────────────────────"
  
  if psql "$CONNECTION_STRING" -f "$migration" > /dev/null 2>&1; then
    echo "✅ Success"
    ((SUCCESS++))
  else
    # Check if it's an idempotent error
    ERROR_OUTPUT=$(psql "$CONNECTION_STRING" -f "$migration" 2>&1 || true)
    if echo "$ERROR_OUTPUT" | grep -qiE "already exists|duplicate|relation.*already"; then
      echo "⚠️  Already applied (idempotent, continuing)"
      ((SUCCESS++))
    else
      echo "❌ Error:"
      echo "$ERROR_OUTPUT" | head -5
      ((FAILED++))
      echo ""
      echo "❌ Stopping after failure"
      break
    fi
  fi
  echo ""
done

echo "=================================="
echo "📊 Summary"
echo "=================================="
echo "✅ Applied: $SUCCESS"
echo "❌ Failed: $FAILED"
echo "📋 Total: $TOTAL"
echo ""

if [ $FAILED -gt 0 ]; then
  exit 1
fi

