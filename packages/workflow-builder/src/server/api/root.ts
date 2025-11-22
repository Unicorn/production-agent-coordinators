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
import { deploymentRouter } from './routers/deployment';
import { executionRouter } from './routers/execution';
import { projectsRouter } from './routers/projects';
import { agentBuilderRouter } from './routers/agent-builder';
import { agentTesterRouter } from './routers/agent-tester';
import { workflowEndpointsRouter } from './routers/workflow-endpoints';
import { connectionsRouter } from './routers/connections';
import { activitiesRouter } from './routers/activities';
import { serviceInterfacesRouter } from './routers/service-interfaces';
import { publicInterfacesRouter } from './routers/public-interfaces';
import { connectorsRouter } from './routers/connectors';
import { projectConnectorsRouter } from './routers/project-connectors';

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
  deployment: deploymentRouter,
  execution: executionRouter,
  projects: projectsRouter,
  agentBuilder: agentBuilderRouter,
  agentTester: agentTesterRouter,
  workflowEndpoints: workflowEndpointsRouter,
  connections: connectionsRouter,
  activities: activitiesRouter,
  serviceInterfaces: serviceInterfacesRouter,
  publicInterfaces: publicInterfacesRouter,
  connectors: connectorsRouter,
  projectConnectors: projectConnectorsRouter,
});

export type AppRouter = typeof appRouter;

