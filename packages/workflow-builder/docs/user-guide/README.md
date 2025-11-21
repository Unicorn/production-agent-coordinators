# User Guide

Complete guide to using the Workflow Builder system.

## New to Workflow Builder?

Start here to get up and running in minutes:

- **[Getting Started Guide](getting-started.md)** - Your first workflow in 5-10 minutes
- **[Video Walkthrough](video-walkthrough-script.md)** - Watch a guided demo (5-7 minutes)

## Core Workflow Documentation

Master the complete workflow lifecycle:

### 1. Design
- **[Workflow Canvas Guide](workflow-canvas.md)** - Visual editor, drag-and-drop, node configuration
- **[Building Workflows](building-workflows.md)** - Workflow composition basics

### 2. Deploy
- **[Deployment Guide](deployment.md)** - Complete deployment process with troubleshooting

### 3. Execute and Monitor
- **[Executing Workflows](executing-workflows.md)** - Running workflows
- **[Execution Monitoring Guide](execution-monitoring.md)** - Monitor executions, understand status, debug failures

### 4. Troubleshoot
- **[Troubleshooting Guide](troubleshooting.md)** - Common issues and quick solutions
- **[Common Errors Reference](../troubleshooting/common-errors.md)** - Detailed error catalog

## Building Blocks

Understand the components that make up workflows:

- **[Projects](projects.md)** - Creating and managing projects
- **[Components](components.md)** - Understanding and creating components
- **[Custom Activities](custom-activities.md)** - Build domain-specific activities

## AI Agents

Create and test AI-powered workflow components:

- **[Agent Prompts](agent-prompts.md)** - Creating AI agent prompts (manual and AI-assisted)
- **[Agent Testing](agent-testing.md)** - Testing agent prompts interactively

## Advanced Topics

Take your workflows to the next level:

- **[Advanced Workflows](advanced-workflows.md)** - Complex patterns (conditionals, loops, signals)
- **[Workflow APIs](workflow-apis.md)** - Trigger workflows via HTTP/API
- **[Demo Workflows](demo-workflows.md)** - Pre-built example workflows

## Quick Start

New to the platform? Follow this path:

1. **[Create a Project](getting-started.md#step-1-create-a-project-2-minutes)** - Organize your workflows
2. **[Create Your First Workflow](getting-started.md#step-2-create-your-first-workflow-3-minutes)** - Set up a new workflow
3. **[Design on the Canvas](getting-started.md#step-3-design-your-workflow-3-minutes)** - Drag and drop components
4. **[Deploy](getting-started.md#step-4-deploy-your-workflow-2-minutes)** - Make it executable
5. **[Execute and Monitor](getting-started.md#step-5-execute-your-workflow-1-minute)** - Run and watch results

Total time: **10 minutes to your first successful workflow execution!**

## Core Concepts

### Projects
Projects group related workflows and provide organizational isolation. Each project has its own Temporal task queue and worker, allowing you to manage different applications or teams separately.

**Learn more:** [Projects Guide](projects.md)

### Components
Reusable building blocks for workflows. Components can be:
- **Activities** - Units of work that execute business logic
- **Agents** - AI-powered components that use LLMs
- **Signals** - Communication mechanisms
- **Triggers** - Workflow entry points

**Learn more:** [Components Guide](components.md)

### Workflows
Visual compositions of components that execute on Temporal. Workflows define the orchestration logic that coordinates components to accomplish business processes.

**Learn more:** [Building Workflows Guide](building-workflows.md)

### Execution Monitoring
Track workflow runs in real-time, view component-level details, and debug failures without needing to understand Temporal internals.

**Learn more:** [Execution Monitoring Guide](execution-monitoring.md)

## Documentation by User Role

### For Business Users
If you're designing workflows without coding:
1. [Getting Started Guide](getting-started.md) - Learn the basics
2. [Workflow Canvas Guide](workflow-canvas.md) - Master the visual editor
3. [Demo Workflows](demo-workflows.md) - See working examples
4. [Troubleshooting Guide](troubleshooting.md) - Solve common issues

### For Developers
If you're building custom components or integrating:
1. [Custom Activities](custom-activities.md) - Create domain-specific components
2. [Workflow APIs](workflow-apis.md) - API integration
3. [Advanced Workflows](advanced-workflows.md) - Complex patterns
4. [API Reference](../api/README.md) - Technical API docs

### For Administrators
If you're managing the platform:
1. [Deployment Guide](deployment.md) - Understand deployment process
2. [Execution Monitoring](execution-monitoring.md) - Monitor system health
3. [Architecture Documentation](../architecture/README.md) - System design
4. [Development Setup](../getting-started/local-development.md) - Local environment

## Learning Path

Recommended learning path for new users:

**Week 1: Fundamentals**
- Day 1: [Getting Started Guide](getting-started.md)
- Day 2: [Workflow Canvas Guide](workflow-canvas.md)
- Day 3: Practice with [Demo Workflows](demo-workflows.md)
- Day 4: [Deployment Guide](deployment.md)
- Day 5: [Execution Monitoring Guide](execution-monitoring.md)

**Week 2: Building Real Workflows**
- Day 1-2: [Building Workflows](building-workflows.md) in detail
- Day 3-4: [Custom Activities](custom-activities.md)
- Day 5: [Advanced Workflows](advanced-workflows.md)

**Week 3: Production Readiness**
- Day 1: [Troubleshooting Guide](troubleshooting.md)
- Day 2: [Common Errors](../troubleshooting/common-errors.md)
- Day 3-5: Build production workflows

## Quick Reference Cards

### Workflow Creation Checklist
- [ ] Create project
- [ ] Create workflow
- [ ] Add trigger node
- [ ] Add activity nodes
- [ ] Connect nodes
- [ ] Configure timeouts and retries
- [ ] Save workflow
- [ ] Deploy (build)
- [ ] Test execution
- [ ] Monitor results

### Common Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save workflow |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Y` | Redo |
| `Delete` | Delete selected node |
| `Ctrl/Cmd + D` | Duplicate node |

See [Workflow Canvas Guide](workflow-canvas.md#keyboard-shortcuts-reference) for complete list.

## Related Documentation

- **[Getting Started](../getting-started/README.md)** - Installation and development setup
- **[Architecture](../architecture/README.md)** - System design and technical architecture
- **[API Reference](../api/README.md)** - API endpoints and integration
- **[Development](../development/README.md)** - Contributing and extending the platform

## Video Resources

- **[Video Walkthrough Script](video-walkthrough-script.md)** - Script for creating screencast tutorials
- Coming soon: Embedded video tutorials

## Getting Help

### Documentation
- Browse guides in this user guide section
- Search the [troubleshooting section](../troubleshooting/common-errors.md)
- Check [FAQ](../getting-started/README.md#faq) (if available)

### Support
- GitHub Issues: Report bugs and request features
- Documentation feedback: Suggest improvements
- Community: Join discussions (link when available)

### Example Workflows
- [Demo Workflows](demo-workflows.md) - Pre-built examples
- [Milestone 1 Demos](../examples/milestone-1-demos.md) - Comprehensive examples

## Stay Updated

Check these resources for updates:
- Release notes (coming soon)
- Changelog (coming soon)
- What's new section (coming soon)

---

**Ready to get started?** Begin with the [Getting Started Guide](getting-started.md) and build your first workflow in 10 minutes!

