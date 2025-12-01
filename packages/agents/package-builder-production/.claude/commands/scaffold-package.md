# Scaffold Package Command

Create the package structure based on CLAUDE.md requirements.

## Steps

1. **Generate package.json** with:
   - All required scripts (build, lint, test)
   - Appropriate dependencies
   - Correct metadata (name, version, description, author, license)
   - Main entry point and types field
   - Repository and keywords if applicable

2. **Generate tsconfig.json** with:
   - Strict mode enabled (`strict: true`)
   - ES2020 target
   - Module resolution settings
   - Output directory (dist/)
   - Declaration file generation (.d.ts)

3. **Generate jest.config.js** with:
   - Coverage thresholds (80% minimum, 90% for core packages)
   - Test file patterns (`__tests__/**/*.test.ts`)
   - TypeScript preset
   - Coverage collection settings

4. **Generate .eslintrc.js** with:
   - BernierLLC rules
   - TypeScript parser
   - Strict rules (no-explicit-any, explicit-return-type warnings)
   - Extends recommended configs

5. **Create directory structure**:
   - `src/` - Source code directory
   - `__tests__/` - Test files directory
   - `dist/` - Build output directory (empty, will be generated)

6. **Generate initial README.md** with:
   - Package title and description
   - Installation instructions
   - Quick start example
   - API documentation structure
   - License section

## Requirements

All files must:
- Follow BernierLLC package requirements from CLAUDE.md
- Use strict TypeScript configuration
- Include proper license headers where applicable
- Be ready for immediate use (no manual configuration needed)

## Arguments

$ARGUMENTS

If provided, use these as additional context or overrides for the scaffolding process.

