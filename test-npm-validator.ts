import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkNpmPackageVersion(packageName: string): Promise<string | null> {
  console.log(`[TEST] Checking npm package: ${packageName}`);
  try {
    const { stdout, stderr } = await execAsync(`npm view ${packageName} version`);
    console.log(`[TEST] stdout: "${stdout}"`);
    console.log(`[TEST] stderr: "${stderr}"`);
    console.log(`[TEST] stdout.trim(): "${stdout.trim()}"`);
    const result = stdout.trim() || null;
    console.log(`[TEST] Returning: ${result}`);
    return result;
  } catch (error: any) {
    console.log(`[TEST] ERROR caught:`, error.message);
    // Package doesn't exist on npm
    if (error.message.includes('404') || error.message.includes('E404')) {
      console.log(`[TEST] 404 detected, returning null`);
      return null;
    }
    console.log(`[TEST] Re-throwing error`);
    throw error;
  }
}

async function main() {
  console.log('\n=== Testing @bernierllc/config-manager ===\n');
  const configManagerResult = await checkNpmPackageVersion('@bernierllc/config-manager');
  console.log(`\n[RESULT] config-manager: ${configManagerResult}`);
  console.log(`[RESULT] isPublished: ${configManagerResult !== null}`);
  console.log(`[RESULT] isNew: ${configManagerResult === null}`);

  console.log('\n=== Testing @bernierllc/ai-provider-core (known working) ===\n');
  const aiProviderResult = await checkNpmPackageVersion('@bernierllc/ai-provider-core');
  console.log(`\n[RESULT] ai-provider-core: ${aiProviderResult}`);
  console.log(`[RESULT] isPublished: ${aiProviderResult !== null}`);
  console.log(`[RESULT] isNew: ${aiProviderResult === null}`);
}

main().catch(console.error);
