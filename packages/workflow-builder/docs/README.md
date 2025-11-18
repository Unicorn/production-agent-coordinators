# Workflow Builder Documentation

Welcome to the comprehensive documentation for the Workflow Builder system. This documentation is organized to help users, developers, and AI agents understand, use, and extend the system.

## Documentation Structure

### For Users

- **[Getting Started](getting-started/README.md)** - Installation, setup, and quick tutorials
- **[User Guide](user-guide/README.md)** - Complete guide to using the workflow builder
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

### For Developers

- **[Architecture](architecture/README.md)** - System design and technical architecture
- **[Developer Guide](development/README.md)** - Contributing, testing, and extending the system
- **[API Reference](api/README.md)** - Complete API documentation
- **[Reference](reference/README.md)** - Environment variables, CLI commands, file structure

### For AI Agents

- **[AI Agent Guide](ai-agents/README.md)** - Architecture principles, common tasks, and patterns

## Quick Links

### Essential Reading

1. **[Installation](getting-started/installation.md)** - Get the system running
2. **[System Design](architecture/system-design.md)** - Understand the architecture
3. **[Building Workflows](user-guide/building-workflows.md)** - Create your first workflow
4. **[Agent Prompts](user-guide/agent-prompts.md)** - Create and test agent prompts
5. **[System Workflows Setup](system-workflows-setup.md)** - Set up system workflows
6. **[tRPC API](api/trpc-routers.md)** - API endpoints reference

### Key Concepts

- **[Glossary](GLOSSARY.md)** - Terminology and definitions
- **[Database Schema](architecture/database-schema.md)** - Complete database structure
- **[Temporal Integration](architecture/temporal-integration.md)** - How workflows execute
- **[Workflow Definition Format](api/workflow-definition-format.md)** - JSON structure

## System Overview

The Workflow Builder is a visual tool for composing Temporal workflows from reusable components. It provides:

- **Visual Workflow Editor** - Drag-and-drop interface for building workflows
- **Component Library** - Reusable activities, agents, signals, and triggers
- **Agent Creation Tools** - Manual and AI-assisted agent prompt creation
- **Agent Testing** - Interactive testing of agent prompts with human-in-the-loop workflows
- **Temporal Integration** - Direct execution of workflows via Temporal workers
- **Project Management** - Organize workflows into projects with isolated task queues
- **Code Compilation** - Automatic generation of executable workflow code
- **System Workflows** - Built-in workflows for agent testing and system operations

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tamagui UI
- **Backend**: tRPC, Next.js API Routes
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Workflow Engine**: Temporal
- **Language**: TypeScript (strict mode)

## Getting Help

- **Troubleshooting**: See [troubleshooting.md](troubleshooting.md)
- **Architecture Questions**: See [architecture/README.md](architecture/README.md)
- **API Questions**: See [api/README.md](api/README.md)
- **Development Questions**: See [development/README.md](development/README.md)

## Documentation Standards

This documentation follows these principles:

- **Concise**: Links to code rather than duplicating it
- **Accurate**: References actual file paths and line numbers
- **Navigable**: Clear cross-references between related topics
- **Practical**: Includes code examples and real-world scenarios

## Contributing to Documentation

When adding or updating documentation:

1. Follow the existing structure and organization
2. Include code examples where helpful
3. Cross-reference related documentation
4. Keep content concise and focused
5. Update the table of contents if adding new sections

---

**Last Updated**: 2025-11-18  
**Version**: 0.2.0

