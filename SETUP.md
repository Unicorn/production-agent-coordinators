# Production Agent Coordinators - Setup Instructions

The production repository has been initialized with the following structure:

```
production-agent-coordinators/
├── README.md                              # Main documentation
├── SETUP.md                               # This file
├── .gitignore                             # Protects sensitive files
│
├── production/
│   ├── README.md                          # Production directory docs
│   ├── configs/
│   │   ├── .gitkeep
│   │   └── example-build-env.json        # Example config (copy and customize)
│   ├── scripts/
│   │   └── .gitkeep
│   └── master-plans/
│       ├── .gitkeep
│       └── example-suite.md              # Example master plan
│
└── packages/
    ├── agents/
    │   └── package-builder-production/
    │       └── README.md                  # Production agent implementation docs
    ├── specs/
    │   └── .gitkeep
    └── workflows/
        └── .gitkeep
```

## Next Steps

### 1. Set Up Git Remote

Add `agent-coordinators` as the upstream remote:

```bash
cd /Users/mattbernier/projects/production-agent-coordinators
git remote add upstream /Users/mattbernier/projects/agent-coordinators

# Verify remotes
git remote -v
```

You should see:
```
origin    https://github.com/bernierllc/production-agent-coordinators.git (fetch)
origin    https://github.com/bernierllc/production-agent-coordinators.git (push)
upstream  /Users/mattbernier/projects/agent-coordinators (fetch)
upstream  /Users/mattbernier/projects/agent-coordinators (push)
```

### 2. Review Created Files

Before committing, review the created structure:

```bash
# View the structure
tree -L 3 -a

# Check what will be committed
git status

# Review the README
cat README.md

# Review the .gitignore
cat .gitignore
```

### 3. Commit the Initial Structure

```bash
git add .
git commit -m "Initial production repository structure

- Added directory structure for production code
- Created README with upstream/downstream workflow
- Added .gitignore to protect sensitive files
- Created example configs and master plans
- Added production agent implementation docs"

git push origin main
```

### 4. Pull Framework Code from Upstream

```bash
# Fetch the upstream framework
git fetch upstream

# Merge the framework code
git merge upstream/main

# Resolve any conflicts if they occur
# Then commit the merge
git push origin main
```

### 5. Create Your First Production Config

```bash
cd production/configs

# Copy the example config
cp example-build-env.json build-env.json

# Edit with your real credentials (this file is gitignored)
# Update:
# - npmToken
# - workspaceRoot
# - Any other settings
```

### 6. Create Your First Master Plan

```bash
cd ../master-plans

# Copy the example
cp example-suite.md your-suite.md

# Edit with your real package list (this file is gitignored)
```

### 7. Test the Setup

Create a test script to verify everything works:

```bash
cd ../../production/scripts
```

Create `test-setup.ts`:
```typescript
#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import path from 'path';

const configPath = path.join(__dirname, '../configs/build-env.json');
const masterPlanPath = path.join(__dirname, '../master-plans/your-suite.md');

console.log('Testing production setup...\n');

try {
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  console.log('✓ Config loaded successfully');
  console.log(`  Workspace root: ${config.workspaceRoot}`);
} catch (error) {
  console.error('✗ Failed to load config:', error);
}

try {
  const masterPlan = readFileSync(masterPlanPath, 'utf-8');
  console.log('✓ Master plan loaded successfully');
  console.log(`  Size: ${masterPlan.length} bytes`);
} catch (error) {
  console.error('✗ Failed to load master plan:', error);
}
```

Run it:
```bash
chmod +x test-setup.ts
tsx test-setup.ts
```

## Git Workflow

### Pulling Updates from Upstream

Regularly sync with the framework:

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

### Contributing Back to Upstream

When you create something generalizable:

1. Develop it here in production first
2. Test thoroughly with real data
3. Extract the generalizable parts
4. Switch to `agent-coordinators` repo
5. Implement the generalized version
6. Push to upstream

```bash
cd ../agent-coordinators
# Make changes
git add .
git commit -m "Add generalizable feature"
git push origin main
```

Then pull it back to production:

```bash
cd ../production-agent-coordinators
git fetch upstream
git merge upstream/main
```

## Security Notes

Files protected by .gitignore:
- `production/configs/*` (except examples)
- `production/master-plans/*` (except examples)
- All credential files (*.pem, *.key, etc.)

Always verify before committing:
```bash
git status
git diff --cached
```

Never force-add ignored files:
```bash
# DON'T DO THIS:
# git add -f production/configs/build-env.json
```

## Troubleshooting

### Upstream Remote Issues

If you get an error about upstream not being a git repository, ensure the path is correct:

```bash
ls -la /Users/mattbernier/projects/agent-coordinators/.git
```

### Merge Conflicts

If you get conflicts when merging from upstream:

```bash
# View conflicts
git status

# Edit conflicted files
# Then:
git add .
git commit -m "Resolve merge conflicts from upstream"
```

## Ready to Use

Your production repository is now set up! Next steps:

1. Set up the git remote (command above)
2. Review and commit the structure
3. Pull framework code from upstream
4. Create your production configs and master plans
5. Start building!

Refer to the main README.md for ongoing usage instructions.
