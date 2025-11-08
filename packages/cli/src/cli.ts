#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from './config-loader.js';
import { runWorkflow, listSpecs, listAgents, getSpecInfo, getAgentInfo } from './workflow-runner.js';
import { ConsoleLogger } from '@coordinator/coordinator';
import { writeFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

program
  .name('coordinator')
  .description('CLI tool for executing agent workflows')
  .version('0.1.0');

// Run command
program
  .command('run <spec>')
  .description('Run a workflow with the specified spec')
  .option('-a, --agent <agent>', 'Agent to use for execution')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (spec: string, options: { agent?: string; config?: string }) => {
    const spinner = ora('Loading configuration...').start();

    try {
      // Load config
      const searchFrom = options.config ? options.config : process.cwd();
      const config = await loadConfig(searchFrom, {
        defaultAgent: options.agent
      });

      spinner.succeed('Configuration loaded');

      const logger = new ConsoleLogger();

      // Run workflow
      spinner.start('Executing workflow...');

      const result = await runWorkflow({
        spec,
        agent: options.agent,
        config,
        logger
      });

      if (result.success) {
        spinner.succeed(chalk.green('Workflow completed successfully'));
        if (result.output) {
          console.log(chalk.cyan('\nOutput:'));
          console.log(JSON.stringify(result.output, null, 2));
        }
        process.exit(0);
      } else {
        spinner.fail(chalk.red('Workflow failed'));
        if (result.error) {
          console.error(chalk.red(`Error: ${result.error.message}`));
        }
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to run workflow'));
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// List specs command
program
  .command('list-specs')
  .description('List all available workflow specs')
  .option('-v, --verbose', 'Show detailed information')
  .action((options: { verbose?: boolean }) => {
    console.log(chalk.bold('\nAvailable Workflow Specs:\n'));

    const specs = listSpecs();

    if (options.verbose) {
      specs.forEach(spec => {
        const info = getSpecInfo(spec);
        console.log(chalk.cyan(`  ${spec}`));
        if (info) {
          console.log(chalk.gray(`    ${info.description}`));
        }
        console.log();
      });
    } else {
      specs.forEach(spec => {
        console.log(chalk.cyan(`  - ${spec}`));
      });
    }

    console.log(chalk.gray(`\nTotal: ${specs.length} specs\n`));
  });

// List agents command
program
  .command('list-agents')
  .description('List all available agents')
  .option('-v, --verbose', 'Show detailed information')
  .action((options: { verbose?: boolean }) => {
    console.log(chalk.bold('\nAvailable Agents:\n'));

    const agents = listAgents();

    if (options.verbose) {
      agents.forEach(agent => {
        const info = getAgentInfo(agent);
        console.log(chalk.cyan(`  ${agent}`));
        if (info) {
          console.log(chalk.gray(`    ${info.description}`));
        }
        console.log();
      });
    } else {
      agents.forEach(agent => {
        console.log(chalk.cyan(`  - ${agent}`));
      });
    }

    console.log(chalk.gray(`\nTotal: ${agents.length} agents\n`));
  });

// Init config command
program
  .command('init-config')
  .description('Initialize a configuration file')
  .option('-f, --format <format>', 'Config format (json or js)', 'json')
  .option('-o, --output <path>', 'Output path for config file')
  .action((options: { format?: string; output?: string }) => {
    const format = options.format || 'json';
    const isJson = format === 'json';

    const defaultFileName = isJson ? '.coordinatorrc' : 'coordinator.config.js';
    const outputPath = options.output || join(process.cwd(), defaultFileName);

    const spinner = ora('Creating configuration file...').start();

    try {
      let content: string;

      if (isJson) {
        const config = {
          defaultAgent: 'mock',
          defaultSpec: 'hello',
          apiKeys: {
            anthropic: '${ANTHROPIC_API_KEY}'
          }
        };
        content = JSON.stringify(config, null, 2);
      } else {
        content = `export default {
  defaultAgent: 'mock',
  defaultSpec: 'hello',
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY || ''
  }
};
`;
      }

      writeFileSync(outputPath, content);
      spinner.succeed(chalk.green(`Configuration file created: ${outputPath}`));

      console.log(chalk.cyan('\nNext steps:'));
      console.log(chalk.gray('  1. Edit the configuration file to set your preferences'));
      console.log(chalk.gray('  2. Set API keys in environment variables or the config file'));
      console.log(chalk.gray('  3. Run workflows with: coordinator run <spec>\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to create configuration file'));
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
