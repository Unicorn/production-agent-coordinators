#!/bin/bash

# ============================================================================
# Workflow Builder POC Setup Script
# ============================================================================
# This script helps you set up the Workflow Builder POC locally
#
# Usage: bash scripts/setup-poc.sh
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "supabase" ]; then
    print_error "Please run this script from the workflow-builder directory"
    echo "  cd packages/workflow-builder"
    exit 1
fi

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================
print_header "Step 1: Checking Prerequisites"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js >= 18"
    exit 1
fi

# Check Yarn
if command -v yarn &> /dev/null; then
    YARN_VERSION=$(yarn --version)
    print_success "Yarn installed: $YARN_VERSION"
else
    print_error "Yarn not found. Please install Yarn >= 1.22"
    exit 1
fi

# Check Supabase CLI
if command -v supabase &> /dev/null; then
    SUPABASE_VERSION=$(supabase --version)
    print_success "Supabase CLI installed: $SUPABASE_VERSION"
    HAS_SUPABASE=true
else
    print_warning "Supabase CLI not found (optional for cloud setup)"
    HAS_SUPABASE=false
fi

# ============================================================================
# Step 2: Choose Supabase Setup Method
# ============================================================================
print_header "Step 2: Supabase Setup"

echo "How would you like to set up Supabase?"
echo ""
echo "  1) Supabase Cloud (Recommended for POC)"
echo "     - Quick setup"
echo "     - No local resources needed"
echo "     - Free tier available"
echo ""
echo "  2) Local Supabase"
echo "     - Runs on your machine"
echo "     - Requires Docker"
echo "     - Requires Supabase CLI"
echo ""
read -p "Enter your choice (1 or 2): " SUPABASE_CHOICE

# ============================================================================
# Step 3: Supabase Cloud Setup
# ============================================================================
if [ "$SUPABASE_CHOICE" = "1" ]; then
    print_header "Step 3: Supabase Cloud Setup"
    
    echo "Please follow these steps:"
    echo ""
    echo "  1. Go to: https://supabase.com"
    echo "  2. Sign in or create an account"
    echo "  3. Click 'New Project'"
    echo "  4. Fill in:"
    echo "     - Project Name: workflow-builder-poc"
    echo "     - Database Password: (save this!)"
    echo "     - Region: (choose closest to you)"
    echo "  5. Click 'Create new project'"
    echo "  6. Wait ~2 minutes for setup to complete"
    echo ""
    read -p "Press Enter when your project is ready..."
    
    echo ""
    echo "Now get your API credentials:"
    echo ""
    echo "  1. Go to Project Settings → API"
    echo "  2. Copy your Project URL"
    echo "  3. Copy your 'anon public' key"
    echo "  4. Copy your 'service_role' key (⚠️  Keep this secret!)"
    echo ""
    
    read -p "Enter your Project URL: " SUPABASE_URL
    read -p "Enter your anon key: " SUPABASE_ANON_KEY
    read -sp "Enter your service_role key: " SUPABASE_SERVICE_KEY
    echo ""
    
    # Extract project ID from URL
    SUPABASE_PROJECT_ID=$(echo $SUPABASE_URL | sed -n 's/.*\/\/\([^.]*\).*/\1/p')
    
    print_success "Credentials captured"
    
    # Ask if they want to link project
    if [ "$HAS_SUPABASE" = true ]; then
        read -p "Link this project to Supabase for migrations? (y/n): " LINK_PROJECT
        if [ "$LINK_PROJECT" = "y" ]; then
            print_info "Linking project..."
            supabase link --project-ref "$SUPABASE_PROJECT_ID" || print_warning "Link failed, continuing..."
        fi
    fi
fi

# ============================================================================
# Step 4: Local Supabase Setup
# ============================================================================
if [ "$SUPABASE_CHOICE" = "2" ]; then
    print_header "Step 3: Local Supabase Setup"
    
    if [ "$HAS_SUPABASE" = false ]; then
        print_error "Supabase CLI required for local setup"
        echo ""
        echo "Install with: brew install supabase/tap/supabase"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker required for local Supabase"
        echo ""
        echo "Install from: https://www.docker.com/products/docker-desktop"
        exit 1
    fi
    
    print_info "Starting local Supabase..."
    supabase start
    
    # Get credentials from Supabase CLI
    SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $3}')
    SUPABASE_ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')
    SUPABASE_SERVICE_KEY=$(supabase status | grep "service_role key" | awk '{print $3}')
    SUPABASE_PROJECT_ID="local"
    
    print_success "Local Supabase started"
fi

# ============================================================================
# Step 5: Create .env.local
# ============================================================================
print_header "Step 4: Creating Environment File"

ENV_FILE=".env.local"

cat > "$ENV_FILE" << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID

# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3010
EOF

print_success "Created $ENV_FILE"

# ============================================================================
# Step 6: Run Database Migrations
# ============================================================================
print_header "Step 5: Running Database Migrations"

if [ "$SUPABASE_CHOICE" = "1" ]; then
    if [ "$HAS_SUPABASE" = true ]; then
        print_info "Pushing migrations to Supabase Cloud..."
        supabase db push || {
            print_warning "Migration push failed, trying SQL upload..."
            echo ""
            echo "Please manually run migrations:"
            echo "  1. Go to Supabase Dashboard → SQL Editor"
            echo "  2. Paste contents of: supabase/migrations/20251114000001_initial_schema.sql"
            echo "  3. Click 'Run'"
            echo "  4. Paste contents of: supabase/migrations/20251114000002_seed_default_task_queue.sql"
            echo "  5. Click 'Run'"
            read -p "Press Enter when done..."
        }
    else
        print_warning "No Supabase CLI - migrations must be run manually"
        echo ""
        echo "To run migrations:"
        echo "  1. Go to: $SUPABASE_URL/project/default/sql"
        echo "  2. Paste contents of: supabase/migrations/20251114000001_initial_schema.sql"
        echo "  3. Click 'Run'"
        echo "  4. Paste contents of: supabase/migrations/20251114000002_seed_default_task_queue.sql"
        echo "  5. Click 'Run'"
        read -p "Press Enter when done..."
    fi
else
    print_info "Pushing migrations to local Supabase..."
    supabase db push
fi

print_success "Migrations completed"

# ============================================================================
# Step 7: Install Dependencies (if needed)
# ============================================================================
print_header "Step 6: Checking Dependencies"

if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies..."
    yarn install
    print_success "Dependencies installed"
else
    print_success "Dependencies already installed"
fi

# ============================================================================
# Step 8: Summary & Next Steps
# ============================================================================
print_header "🎉 Setup Complete!"

echo ""
echo -e "${GREEN}Your Workflow Builder POC is ready to run!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "  1. Start the dev server:"
echo -e "     ${YELLOW}yarn dev${NC}"
echo ""
echo "  2. Open your browser:"
echo -e "     ${YELLOW}http://localhost:3010${NC}"
echo ""
echo "  3. Create an account (Sign Up)"
echo ""
echo "  4. Start building workflows!"
echo ""
echo -e "${BLUE}Optional - Start Temporal:${NC}"
echo ""
echo "  In a separate terminal:"
echo -e "     ${YELLOW}cd ../../docker${NC}"
echo -e "     ${YELLOW}docker-compose up${NC}"
echo ""
echo "  Or:"
echo -e "     ${YELLOW}temporal server start-dev${NC}"
echo ""
echo -e "${BLUE}Resources:${NC}"
echo "  - Setup Guide: SETUP.md"
echo "  - Quick Start: QUICK_START.md"
echo "  - Project Summary: PROJECT_SUMMARY.md"
echo "  - Design Doc: ../../docs/plans/2025-11-14-workflow-builder-system-design.md"
echo ""
echo -e "${GREEN}Happy Building! 🚀${NC}"
echo ""

