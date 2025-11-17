/**
 * Root tRPC router
 */

import { createTRPCRouter } from './trpc';
import { usersRouter } from './routers/users';
import { componentsRouter } from './routers/components';
import { agentPromptsRouter } from './routers/agent-prompts';
import { taskQueuesRouter } from './routers/task-queues';
import { workflowsRouter } from './routers/workflows';
import { workQueuesRouter } from './routers/work-queues';
import { signalsRouter, queriesRouter } from './routers/signals-queries';
import { compilerRouter } from './routers/compiler';
import { executionRouter } from './routers/execution';

export const appRouter = createTRPCRouter({
  users: usersRouter,
  components: componentsRouter,
  agentPrompts: agentPromptsRouter,
  taskQueues: taskQueuesRouter,
  workflows: workflowsRouter,
  workQueues: workQueuesRouter,
  signals: signalsRouter,
  queries: queriesRouter,
  compiler: compilerRouter,
  execution: executionRouter,
});

export type AppRouter = typeof appRouter;

