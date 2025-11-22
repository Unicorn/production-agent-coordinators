/**
 * Seed Components and Agents Directly via Supabase API
 * 
 * This script creates components and agents by inserting them via the REST API
 * instead of running the full SQL migration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🌱 Seeding Components and Agents via API\n');
  
  // Step 1: Get reference IDs
  console.log('1️⃣ Getting reference data...');
  
  const { data: systemUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'system@example.com')
    .single();
  
  if (!systemUser) {
    console.error('❌ System user not found. Please run migration 20251118000000_create_system_user.sql first');
    process.exit(1);
  }
  
  const { data: publicVisibility } = await supabase
    .from('component_visibility')
    .select('id')
    .eq('name', 'public')
    .single();
  
  const { data: activityType } = await supabase
    .from('component_types')
    .select('id')
    .eq('name', 'activity')
    .single();
  
  const { data: agentType } = await supabase
    .from('component_types')
    .select('id')
    .eq('name', 'agent')
    .single();
  
  const { data: triggerType } = await supabase
    .from('component_types')
    .select('id')
    .eq('name', 'trigger')
    .single();
  
  if (!publicVisibility || !activityType || !agentType || !triggerType) {
    console.error('❌ Missing required reference data');
    console.error('   Please ensure initial schema migrations have been applied');
    process.exit(1);
  }
  
  console.log('   ✅ Got all reference IDs\n');
  
  // Step 2: Seed Activity Components
  console.log('2️⃣ Seeding activity components...');
  
  const activities = [
    {
      id: '20000000-0000-0000-0000-000000000001',
      name: 'fetch-api-data',
      display_name: 'Fetch API Data',
      description: 'Fetches data from an external API endpoint',
      component_type_id: activityType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['api', 'http', 'network'],
    },
    {
      id: '20000000-0000-0000-0000-000000000002',
      name: 'process-data',
      display_name: 'Process Data',
      description: 'Transforms and processes data',
      component_type_id: activityType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['processing', 'transformation'],
    },
    {
      id: '20000000-0000-0000-0000-000000000003',
      name: 'send-notification',
      display_name: 'Send Notification',
      description: 'Sends notifications via multiple channels',
      component_type_id: activityType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['notification', 'communication'],
    },
    {
      id: '20000000-0000-0000-0000-000000000004',
      name: 'save-to-database',
      display_name: 'Save to Database',
      description: 'Saves data to a database',
      component_type_id: activityType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['database', 'storage'],
    },
    {
      id: '20000000-0000-0000-0000-000000000005',
      name: 'read-from-database',
      display_name: 'Read from Database',
      description: 'Reads data from a database',
      component_type_id: activityType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['database', 'query'],
    },
    {
      id: '20000000-0000-0000-0000-000000000006',
      name: 'log-message',
      display_name: 'Log Message',
      description: 'Logs a message for debugging',
      component_type_id: activityType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['logging', 'debugging'],
    },
  ];
  
  for (const activity of activities) {
    const { error } = await supabase
      .from('components')
      .upsert(activity, { onConflict: 'id', ignoreDuplicates: false });
    
    if (error) {
      console.error(`   ❌ Failed to create ${activity.name}:`, error.message);
    } else {
      console.log(`   ✅ ${activity.display_name}`);
    }
  }
  
  // Step 3: Seed Agent Components
  console.log('\n3️⃣ Seeding agent components...');
  
  const agents = [
    {
      id: '30000000-0000-0000-0000-000000000001',
      name: 'code-analysis-agent',
      display_name: 'Code Analysis Agent',
      description: 'AI agent that analyzes code for issues and improvements',
      component_type_id: agentType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['ai', 'analysis', 'code-quality'],
      model_provider: 'anthropic',
      model_name: 'claude-sonnet-4',
    },
    {
      id: '30000000-0000-0000-0000-000000000002',
      name: 'test-generation-agent',
      display_name: 'Test Generation Agent',
      description: 'AI agent that generates unit tests',
      component_type_id: agentType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['ai', 'testing', 'automation'],
      model_provider: 'openai',
      model_name: 'gpt-4',
    },
  ];
  
  for (const agent of agents) {
    const { error } = await supabase
      .from('components')
      .upsert(agent, { onConflict: 'id', ignoreDuplicates: false });
    
    if (error) {
      console.error(`   ❌ Failed to create ${agent.name}:`, error.message);
    } else {
      console.log(`   ✅ ${agent.display_name}`);
    }
  }
  
  // Step 4: Seed Trigger Components
  console.log('\n4️⃣ Seeding trigger components...');
  
  const triggers = [
    {
      id: '40000000-0000-0000-0000-000000000001',
      name: 'manual-trigger',
      display_name: 'Manual Trigger',
      description: 'Manually triggered workflow start',
      component_type_id: triggerType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['trigger', 'manual'],
    },
    {
      id: '40000000-0000-0000-0000-000000000002',
      name: 'schedule-trigger',
      display_name: 'Schedule Trigger',
      description: 'Triggers workflow on a schedule',
      component_type_id: triggerType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['trigger', 'schedule', 'cron'],
    },
    {
      id: '40000000-0000-0000-0000-000000000003',
      name: 'webhook-trigger',
      display_name: 'Webhook Trigger',
      description: 'Triggers workflow via HTTP webhook',
      component_type_id: triggerType.id,
      version: '1.0.0',
      created_by: systemUser.id,
      visibility_id: publicVisibility.id,
      tags: ['trigger', 'webhook', 'api'],
    },
  ];
  
  for (const trigger of triggers) {
    const { error } = await supabase
      .from('components')
      .upsert(trigger, { onConflict: 'id', ignoreDuplicates: false });
    
    if (error) {
      console.error(`   ❌ Failed to create ${trigger.name}:`, error.message);
    } else {
      console.log(`   ✅ ${trigger.display_name}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Components and agents seeded successfully!');
  console.log('='.repeat(60));
  console.log('\n📋 Summary:');
  console.log('  • 6 Activity components');
  console.log('  • 2 Agent components');
  console.log('  • 3 Trigger components');
  console.log('\n🌐 Refresh your browser to see the components in the palette!\n');
}

main().catch((error) => {
  console.error('\n❌ Seeding failed:', error);
  process.exit(1);
});

