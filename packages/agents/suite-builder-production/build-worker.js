#!/usr/bin/env node

/**
 * esbuild bundler for Suite Builder Production Worker
 *
 * Bundles the worker into a single executable file that resolves all ES modules correctly.
 * This solves the .js extension issue when running Node.js with ES modules.
 */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = {
  entryPoints: [join(__dirname, 'src/worker.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: join(__dirname, 'dist/worker.bundle.js'),
  external: [
    // Don't bundle Temporal packages (they have native modules)
    '@temporalio/core-bridge',
    '@temporalio/worker',
    '@temporalio/client',
    '@temporalio/workflow',
    '@temporalio/activity',
    // Don't bundle native modules
    '@swc/core',
    '@swc/wasm',
    'uglify-js',
  ],
  // Compile TypeScript source directly instead of using pre-compiled JS
  loader: {
    '.ts': 'ts',
  },
  // Use custom tsconfig that redirects to source files
  tsconfig: join(__dirname, 'tsconfig.bundle.json'),
  sourcemap: true,
  minify: false, // Keep readable for debugging
  logLevel: 'info',
  banner: {
    js: `
// Suite Builder Production Worker Bundle
// Generated: ${new Date().toISOString()}
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
    `.trim(),
  },
};

async function build() {
  try {
    console.log('🔨 Building Suite Builder Production worker bundle...\n');

    const result = await esbuild.build(config);

    console.log('\n✅ Worker bundle created successfully!');
    console.log(`   Output: ${config.outfile}`);
    console.log(`   Size: ${(result.metafile ? 'N/A' : 'Bundle complete')}`);
    console.log('\n📦 Bundle stats:');
    console.log(`   - Entry: ${config.entryPoints[0]}`);
    console.log(`   - Format: ${config.format}`);
    console.log(`   - Target: ${config.target}`);
    console.log(`   - Minified: ${config.minify}`);
    console.log(`   - Sourcemap: ${config.sourcemap}`);

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
