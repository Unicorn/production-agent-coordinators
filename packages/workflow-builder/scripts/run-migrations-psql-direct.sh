#!/bin/bash
# Run all migrations using psql with the correct connection string

set -e

CONNECTION_STRING="postgresql://postgres.jeaudyvxapooyfddfptr:65TzRzrtEJ2DNrdG@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
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
  
  if PGPASSWORD='65TzRzrtEJ2DNrdG' psql "$CONNECTION_STRING" -f "$migration" 2>&1 | tee /tmp/migration-output.log | grep -q "ERROR"; then
    # Check if it's an idempotent error
    if grep -qiE "already exists|duplicate|relation.*already" /tmp/migration-output.log; then
      echo "⚠️  Already applied (idempotent, continuing)"
      ((SUCCESS++))
    else
      echo "❌ Error occurred:"
      cat /tmp/migration-output.log | grep -A 5 "ERROR" | head -10
      ((FAILED++))
      echo ""
      echo "❌ Stopping after failure"
      break
    fi
  else
    echo "✅ Success"
    ((SUCCESS++))
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

