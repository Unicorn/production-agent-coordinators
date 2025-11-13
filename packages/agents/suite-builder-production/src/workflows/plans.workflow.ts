import { proxyActivities, setHandler, sleep } from '@temporalio/workflow';
import { requestPlanSignal, type PlanRequest } from '../signals/plan-signals';
import type * as activities from '../activities/planning.activities';

const { generatePlanForPackage, discoverPackagesNeedingPlans } = proxyActivities<typeof activities>({
  startToCloseTimeout: '15 minutes',
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export async function PlansWorkflow(): Promise<void> {
  const queue: PlanRequest[] = [];

  // Handle signals from build workflows
  setHandler(requestPlanSignal, (request: PlanRequest) => {
    console.log(`📨 Received plan request for ${request.packageName} from ${request.requestedBy}`);

    // Add with HIGH priority (prepend to queue)
    queue.unshift({ ...request, priority: 'high', source: 'workflow-request' });

    console.log(`   Queue position: 1 (priority)`);
    console.log(`   Queue length: ${queue.length}`);
  });

  console.log('🚀 Plans Workflow started - listening for requests...');

  // Continuous processing loop
  while (true) {
    if (queue.length > 0) {
      const request = queue.shift()!;
      console.log(`\n📋 Processing: ${request.packageName}`);
      console.log(`   Source: ${request.source}`);
      console.log(`   Priority: ${request.priority}`);
      console.log(`   Remaining in queue: ${queue.length}`);

      try {
        // Generate plan for the package
        await generatePlanForPackage({
          packageName: request.packageName,
          requestedBy: request.requestedBy
        });

        console.log(`✅ Plan generated for ${request.packageName}`);
      } catch (error) {
        console.error(`❌ Failed to generate plan for ${request.packageName}:`, error);
        // TODO: Add to dead letter queue or retry with backoff
      }
    } else {
      // Queue empty - discover packages needing plans
      console.log('\n🔍 Queue empty, discovering packages needing plans...');

      try {
        const discovered = await discoverPackagesNeedingPlans();

        if (discovered && discovered.length > 0) {
          console.log(`   Found ${discovered.length} packages needing plans`);

          // Add to queue with LOW priority (append)
          for (const pkg of discovered) {
            queue.push({
              packageName: pkg,
              requestedBy: 'auto-discovery',
              timestamp: Date.now(),
              priority: 'low',
              source: 'discovery'
            });
          }
        } else {
          console.log('   No packages need plans');
        }
      } catch (error) {
        console.error('   Discovery failed:', error);
      }
    }

    // Breathe between iterations
    await sleep('10s');
  }
}
