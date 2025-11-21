/**
 * Complete Workflow Deployment Example
 *
 * Demonstrates the full workflow lifecycle:
 * 1. Define workflow (nodes/edges)
 * 2. Compile to TypeScript
 * 3. Deploy to worker
 * 4. Monitor deployment status
 */

import { api } from '@/lib/trpc/server';

async function deployEmailProcessorWorkflow() {
  console.log('🚀 Starting workflow deployment example...\n');

  // Step 1: Define workflow structure
  console.log('Step 1: Creating workflow definition...');
  const workflowDefinition = {
    id: 'email-processor-workflow',
    name: 'Email Processor',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger' as const,
        data: {
          label: 'Email Received',
          componentName: 'emailTrigger',
        },
        position: { x: 100, y: 100 },
      },
      {
        id: 'activity-1',
        type: 'activity' as const,
        data: {
          label: 'Parse Email',
          componentName: 'parseEmail',
          activityName: 'parseEmailActivity',
        },
        position: { x: 100, y: 200 },
      },
      {
        id: 'agent-1',
        type: 'agent' as const,
        data: {
          label: 'Classify Email',
          componentName: 'classifyEmail',
          activityName: 'classifyEmailActivity',
        },
        position: { x: 100, y: 300 },
      },
      {
        id: 'activity-2',
        type: 'activity' as const,
        data: {
          label: 'Send Response',
          componentName: 'sendResponse',
          activityName: 'sendResponseActivity',
        },
        position: { x: 100, y: 400 },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'trigger-1',
        target: 'activity-1',
      },
      {
        id: 'e2',
        source: 'activity-1',
        target: 'agent-1',
      },
      {
        id: 'e3',
        source: 'agent-1',
        target: 'activity-2',
      },
    ],
    settings: {
      timeout: '3600s',
      taskQueue: 'email-processing',
      description: 'Processes incoming emails using AI classification',
    },
  };

  // Save workflow to database (simplified - would use tRPC in real app)
  console.log('✅ Workflow definition created\n');

  // Step 2: Compile workflow to TypeScript
  console.log('Step 2: Compiling workflow to TypeScript...');
  const compileResult = await api.compiler.compile.mutate({
    workflowId: 'email-processor-workflow',
    includeComments: true,
    strictMode: true,
    optimizationLevel: 'basic',
    saveToDatabase: true,
  });

  if (!compileResult.success) {
    console.error('❌ Compilation failed:', compileResult.errors);
    return;
  }

  console.log('✅ Workflow compiled successfully');
  console.log(`   - Generated ${compileResult.workflowCode?.split('\n').length} lines of workflow code`);
  console.log(`   - Generated ${compileResult.activitiesCode?.split('\n').length} lines of activities code`);
  console.log(`   - Warnings: ${compileResult.warnings?.length || 0}\n`);

  // Step 3: Deploy to worker
  console.log('Step 3: Deploying compiled workflow to worker...');
  const deployResult = await api.deployment.deploy.mutate({
    workflowId: 'email-processor-workflow',
    forceRedeploy: false,
  });

  if (!deployResult.success) {
    console.error('❌ Deployment failed:', deployResult.error);
    return;
  }

  console.log('✅ Workflow deployed successfully');
  console.log(`   - Deployed at: ${deployResult.deployedAt}`);
  console.log(`   - Files created: ${deployResult.files?.length}`);
  deployResult.files?.forEach(file => {
    console.log(`     - ${file}`);
  });
  console.log('');

  // Step 4: Verify deployment status
  console.log('Step 4: Verifying deployment status...');
  const status = await api.deployment.status.query({
    workflowId: 'email-processor-workflow',
  });

  console.log('✅ Deployment verified');
  console.log(`   - Status: ${status.deploymentStatus}`);
  console.log(`   - Is Deployed: ${status.isDeployed}`);
  console.log(`   - Is Compiled: ${status.isCompiled}`);
  console.log(`   - Deployment Path: ${status.deploymentPath}`);
  console.log(`   - Deployed Files: ${status.deployedFiles?.length}\n`);

  // Step 5: List all deployed workflows
  console.log('Step 5: Listing all deployed workflows...');
  const deployed = await api.deployment.list.query();

  console.log(`✅ Found ${deployed.count} deployed workflows:`);
  deployed.workflows.forEach(workflow => {
    console.log(`   - ${workflow.name} (${workflow.deploymentStatus})`);
  });
  console.log('');

  console.log('🎉 Deployment workflow complete!\n');
}

/**
 * Example: Redeploy workflow after making changes
 */
async function redeployAfterChanges() {
  console.log('🔄 Redeploying workflow after changes...\n');

  // Step 1: Make changes to workflow (not shown)
  console.log('Step 1: Workflow changes made...');

  // Step 2: Recompile
  console.log('Step 2: Recompiling workflow...');
  await api.compiler.compile.mutate({
    workflowId: 'email-processor-workflow',
    saveToDatabase: true,
  });
  console.log('✅ Recompiled\n');

  // Step 3: Redeploy
  console.log('Step 3: Redeploying...');
  const result = await api.deployment.redeploy.mutate({
    workflowId: 'email-processor-workflow',
  });

  if (result.success) {
    console.log('✅ Redeployment successful');
    console.log(`   - Deployed at: ${result.deployedAt}\n`);
  }
}

/**
 * Example: Undeploy workflow
 */
async function undeployWorkflow() {
  console.log('🗑️  Undeploying workflow...\n');

  const result = await api.deployment.undeploy.mutate({
    workflowId: 'email-processor-workflow',
  });

  if (result.success) {
    console.log('✅ Workflow undeployed successfully\n');
  }
}

/**
 * Example: Error handling
 */
async function deployWithErrorHandling() {
  try {
    // Attempt to deploy without compiling first
    await api.deployment.deploy.mutate({
      workflowId: 'uncompiled-workflow',
    });
  } catch (error: any) {
    if (error.code === 'BAD_REQUEST') {
      console.log('⚠️  Workflow needs to be compiled first');

      // Compile and then deploy
      await api.compiler.compile.mutate({
        workflowId: 'uncompiled-workflow',
        saveToDatabase: true,
      });

      await api.deployment.deploy.mutate({
        workflowId: 'uncompiled-workflow',
      });

      console.log('✅ Compiled and deployed successfully');
    } else if (error.code === 'CONFLICT') {
      console.log('⚠️  Workflow already deployed, using redeploy...');

      await api.deployment.redeploy.mutate({
        workflowId: 'uncompiled-workflow',
      });

      console.log('✅ Redeployed successfully');
    } else {
      console.error('❌ Deployment failed:', error.message);
    }
  }
}

/**
 * Example: Production deployment checklist
 */
async function productionDeploymentChecklist() {
  const workflowId = 'production-workflow';

  console.log('📋 Production Deployment Checklist\n');

  // 1. Validate workflow
  console.log('[ ] Validating workflow...');
  const validation = await api.compiler.validate.mutate({
    workflowId,
  });

  if (!validation.valid) {
    console.log('❌ Validation failed:', validation.errors);
    return;
  }
  console.log('[✓] Workflow valid\n');

  // 2. Compile with strict mode
  console.log('[ ] Compiling with strict mode...');
  const compiled = await api.compiler.compile.mutate({
    workflowId,
    strictMode: true,
    optimizationLevel: 'aggressive',
    saveToDatabase: true,
  });

  if (!compiled.success) {
    console.log('❌ Compilation failed:', compiled.errors);
    return;
  }
  console.log('[✓] Compilation successful\n');

  // 3. Check deployment status
  console.log('[ ] Checking current deployment status...');
  const currentStatus = await api.deployment.status.query({
    workflowId,
  });

  if (currentStatus.isDeployed) {
    console.log('[i] Workflow already deployed, will redeploy\n');
  }

  // 4. Deploy
  console.log('[ ] Deploying to production...');
  const deployment = await api.deployment.deploy.mutate({
    workflowId,
    forceRedeploy: true,
  });

  if (!deployment.success) {
    console.log('❌ Deployment failed:', deployment.error);
    return;
  }
  console.log('[✓] Deployed successfully\n');

  // 5. Verify deployment
  console.log('[ ] Verifying deployment...');
  const finalStatus = await api.deployment.status.query({
    workflowId,
  });

  console.log('[✓] Deployment verified');
  console.log(`    Status: ${finalStatus.deploymentStatus}`);
  console.log(`    Files: ${finalStatus.deployedFiles?.length}\n`);

  console.log('✅ Production deployment complete!\n');
}

// Run examples (uncomment to test)
// deployEmailProcessorWorkflow();
// redeployAfterChanges();
// undeployWorkflow();
// deployWithErrorHandling();
// productionDeploymentChecklist();

export {
  deployEmailProcessorWorkflow,
  redeployAfterChanges,
  undeployWorkflow,
  deployWithErrorHandling,
  productionDeploymentChecklist,
};
