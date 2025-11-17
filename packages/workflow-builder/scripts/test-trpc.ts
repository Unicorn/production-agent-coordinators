/**
 * Test tRPC API calls
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function testAPI() {
  console.log('🧪 Testing tRPC API\n');
  
  const baseUrl = 'http://localhost:3010';
  
  // Test 1: Simple component list query
  console.log('1️⃣ Testing components.list...');
  try {
    const url = `${baseUrl}/api/trpc/components.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%7D%7D%7D`;
    
    console.log('   📡 Making request...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    console.log('   ✅ Status:', response.status);
    const data = await response.json();
    console.log('   📋 Response:', JSON.stringify(data, null, 2));
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('   ❌ Request timed out after 5 seconds');
    } else {
      console.error('   ❌ Error:', err.message);
    }
  }
  
  console.log('\n✅ Test complete');
}

testAPI().catch(console.error);

