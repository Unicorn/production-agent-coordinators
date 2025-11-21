# Quick Start Guide

## Getting Started in the Next Hour

You've just reviewed the comprehensive migration plan. Here's what to do RIGHT NOW to make progress.

## Step 1: Understand the Gap (15 minutes)

Read these in order:

1. **EXECUTIVE-SUMMARY.md** (this directory) - 5 minutes
   - Understand the problem
   - See the 4-phase plan
   - Review success criteria

2. **docs/BACKEND_EXECUTION_GAP_ANALYSIS.md** - 10 minutes
   - Skim the executive summary
   - Focus on "Top 3 Critical" section
   - Understand what's missing from backend

## Step 2: Review Current State (15 minutes)

Compare the actual code vs UI representation:

```bash
# Terminal 1: Open production workflow
code packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts

# Terminal 2: Open UI seed script
code packages/workflow-builder/scripts/create-package-management-workflows.ts

# Terminal 3: Open current UI components
code packages/workflow-builder/src/components/workflow/nodes/
```

**Notice:**
- Lines 110-177 in package-builder.workflow.ts: This is the critical `while` loop with `Promise.race()` that cannot be represented in UI
- The seed script has a `loop` node type (line 351) that doesn't exist in the UI
- Current UI only has TriggerNode, AgentNode, ActivityNode

## Step 3: Run the Demo (15 minutes)

See what the UI can actually do today:

```bash
# Start the UI
cd packages/workflow-builder
yarn dev

# Open browser
open http://localhost:3010

# Navigate to workflows
# Click on any workflow to see the current editor
```

**Try this:**
1. Drag an "Activity" from the palette
2. Try to create a loop or conditional - YOU CAN'T
3. Look at the property panel - limited configuration
4. Try to "Deploy" - it saves to DB but doesn't execute

## Step 4: Prototype the Compiler (15 minutes)

Let's prove the concept works with a minimal example.

Create `packages/workflow-builder/src/lib/compiler/prototype.ts`:

```typescript
/**
 * PROTOTYPE: Minimal workflow compiler
 * Converts simple UI JSON to Temporal TypeScript
 */

import * as ts from 'typescript';

interface WorkflowDefinition {
  nodes: Array<{
    id: string;
    type: 'trigger' | 'activity';
    data: {
      label: string;
      componentName?: string;
    };
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
}

export function compileWorkflow(definition: WorkflowDefinition): string {
  // Find the activity nodes
  const activities = definition.nodes.filter(n => n.type === 'activity');

  // Generate imports
  const imports = `
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const { ${activities.map(a => a.data.componentName).join(', ')} } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes'
});
`;

  // Generate workflow function
  const workflowBody = activities.map(a => `
  const result_${a.id} = await ${a.data.componentName}({});
`).join('\n');

  const workflowFunction = `
export async function GeneratedWorkflow(input: any): Promise<void> {
  ${workflowBody}
}
`;

  return imports + workflowFunction;
}

// Test it
const testDefinition: WorkflowDefinition = {
  nodes: [
    { id: 'start', type: 'trigger', data: { label: 'Start' } },
    { id: 'build', type: 'activity', data: { label: 'Build', componentName: 'runBuild' } }
  ],
  edges: [
    { source: 'start', target: 'build' }
  ]
};

console.log(compileWorkflow(testDefinition));
```

Run it:
```bash
cd packages/workflow-builder
npx ts-node src/lib/compiler/prototype.ts
```

**You should see:**
```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const { runBuild } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes'
});

export async function GeneratedWorkflow(input: any): Promise<void> {
  const result_build = await runBuild({});
}
```

**You just compiled a UI workflow to TypeScript!** 🎉

## Next: First Week Checklist

### Backend Team

**Day 1-2: Set up infrastructure**
- [ ] Create `packages/workflow-builder/src/lib/compiler/` directory
- [ ] Install dependencies: `typescript`, `@types/node`
- [ ] Create basic compiler class structure
- [ ] Set up test framework (Jest)

**Day 3-5: Build basic compiler**
- [ ] Implement node-to-code mapping
- [ ] Handle trigger → activity → end flow
- [ ] Generate imports and activity proxies
- [ ] Write 10+ unit tests

### Frontend Team

**Day 1-2: Research & design**
- [ ] Review ReactFlow documentation
- [ ] Study container node patterns
- [ ] Sketch loop container wireframes
- [ ] Review `docs/visual-pattern-library.md`

**Day 3-5: Build loop container**
- [ ] Create LoopNode component
- [ ] Add to node types registry
- [ ] Implement drag-to-container logic
- [ ] Style with concurrency indicators

### Week 1 Goal

By end of week 1, you should have:
- ✅ Basic compiler that handles trigger → activity → end
- ✅ Compiled code visible in UI (code preview panel)
- ✅ Loop container node visible in palette (no execution yet)
- ✅ Team aligned on architecture

## Common Pitfalls to Avoid

### ❌ Don't Do This
1. **Build everything at once** - Start minimal, iterate
2. **Skip validation** - Validate workflow structure early
3. **Ignore TypeScript types** - Use TypeScript everywhere
4. **Forget about testing** - TDD from day 1
5. **Over-engineer** - YAGNI principle

### ✅ Do This Instead
1. **MVP first** - Get ONE workflow running end-to-end
2. **Validate early** - Check structure before compilation
3. **Strong typing** - Define interfaces for everything
4. **Test-driven** - Write test first, then implementation
5. **Simple code** - Clear > clever

## Questions? Stuck?

### Resources

**Temporal Docs:**
- https://docs.temporal.io/typescript
- TypeScript SDK Reference: https://typescript.temporal.io

**ReactFlow Docs:**
- https://reactflow.dev/
- Custom Nodes: https://reactflow.dev/learn/customization/custom-nodes

**TypeScript Compiler API:**
- Handbook: https://www.typescriptlang.org/docs/handbook/compiler-options.html
- AST Viewer: https://ts-ast-viewer.com/

### Debugging Tips

**Compiler not working?**
```bash
# Debug the generated code
console.log(compiler.compile(definition));

# Validate TypeScript
npx tsc --noEmit generated-workflow.ts

# Check AST
import * as ts from 'typescript';
const sourceFile = ts.createSourceFile(/* ... */);
console.log(JSON.stringify(sourceFile, null, 2));
```

**UI node not rendering?**
```bash
# Check node type registration
console.log(nodeTypes); // Should include your new type

# Verify data structure
console.log(JSON.stringify(node, null, 2));

# ReactFlow debugging
<ReactFlow onNodeClick={(e, node) => console.log(node)} />
```

## End of Hour 1

At this point you should:
- ✅ Understand the gap
- ✅ Seen the code comparison
- ✅ Run the UI demo
- ✅ Prototyped the compiler concept

**Next step:** Review ARCHITECTURE.md for detailed technical design, then start Week 1 checklist.

## Help & Support

If you're blocked:
1. Check analysis docs in `/docs`
2. Review examples in production workflows
3. Look at existing UI components
4. Ask in team chat with specific error message

**Remember:** This is a 10-12 month project. Don't try to solve everything today. Focus on proving the concept works, then iterate.

Good luck! 🚀
