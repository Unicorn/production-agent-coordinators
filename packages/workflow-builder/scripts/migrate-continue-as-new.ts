/**
 * Migration Script: Auto-configure Continue-as-New for Existing Workflows
 * 
 * This script automatically classifies and configures all existing workflows
 * with continue-as-new settings. It runs automatically on deployment.
 * 
 * Principle: All configuration is automatic and invisible to users.
 */

import { createClient } from '@supabase/supabase-js';
import type { WorkflowDefinition } from '../src/lib/compiler/types';
import { classifyWorkflow, configureContinueAsNew } from '../src/lib/workflow-analyzer';

/**
 * Migrate all existing workflows to auto-configure continue-as-new
 */
export async function migrateExistingWorkflows() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔄 Starting workflow classification and continue-as-new migration...');

  // Fetch all workflows
  const { data: workflows, error: fetchError } = await supabase
    .from('workflows')
    .select('id, name, definition, workflow_type');

  if (fetchError) {
    throw new Error(`Failed to fetch workflows: ${fetchError.message}`);
  }

  if (!workflows || workflows.length === 0) {
    console.log('✅ No workflows to migrate');
    return;
  }

  console.log(`📋 Found ${workflows.length} workflows to migrate`);

  let classifiedServices = 0;
  let classifiedTasks = 0;
  let configuredContinueAsNew = 0;
  let errors = 0;

  // Process each workflow
  for (const workflow of workflows) {
    try {
      const definition = workflow.definition as WorkflowDefinition;
      
      if (!definition) {
        console.warn(`⚠️  Workflow ${workflow.id} has no definition, skipping`);
        continue;
      }

      // Classify workflow
      const workflowType = classifyWorkflow(definition);
      
      // Configure continue-as-new
      const updatedDefinition = configureContinueAsNew(definition, workflowType);

      // Update database
      const { error: updateError } = await supabase
        .from('workflows')
        .update({
          workflow_type: workflowType,
          definition: updatedDefinition,
        })
        .eq('id', workflow.id);

      if (updateError) {
        console.error(`❌ Failed to update workflow ${workflow.id}: ${updateError.message}`);
        errors++;
        continue;
      }

      // Track statistics
      if (workflowType === 'service') {
        classifiedServices++;
        if (updatedDefinition.settings._longRunning?.autoContinueAsNew) {
          configuredContinueAsNew++;
        }
      } else {
        classifiedTasks++;
      }

      console.log(`✅ Migrated workflow: ${workflow.name} (${workflowType})`);
    } catch (error) {
      console.error(`❌ Error processing workflow ${workflow.id}:`, error);
      errors++;
    }
  }

  // Print summary
  console.log('\n📊 Migration Summary:');
  console.log(`   Services: ${classifiedServices}`);
  console.log(`   Tasks: ${classifiedTasks}`);
  console.log(`   Continue-as-new enabled: ${configuredContinueAsNew}`);
  console.log(`   Errors: ${errors}`);
  console.log('\n✅ Migration complete!');
}

// Run migration if called directly
if (require.main === module) {
  migrateExistingWorkflows()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

