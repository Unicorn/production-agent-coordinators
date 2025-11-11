export interface CLICommand {
  command: 'run' | 'list-specs' | 'list-agents' | 'init-config';
  spec?: string;
  options: Record<string, any>;
}

export function parseCommand(args: string[]): CLICommand {
  if (args.length === 0) {
    throw new Error('No command provided');
  }

  const [command, ...restArgs] = args;

  switch (command) {
    case 'run':
      return parseRunCommand(restArgs);
    case 'list-specs':
      return parseListSpecsCommand(restArgs);
    case 'list-agents':
      return parseListAgentsCommand(restArgs);
    case 'init-config':
      return parseInitConfigCommand(restArgs);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function parseRunCommand(args: string[]): CLICommand {
  if (args.length === 0) {
    throw new Error('Spec name is required');
  }

  const [spec, ...optionArgs] = args;
  const options = parseOptions(optionArgs);

  return {
    command: 'run',
    spec,
    options
  };
}

function parseListSpecsCommand(args: string[]): CLICommand {
  const options = parseOptions(args);

  return {
    command: 'list-specs',
    options
  };
}

function parseListAgentsCommand(args: string[]): CLICommand {
  const options = parseOptions(args);

  return {
    command: 'list-agents',
    options
  };
}

function parseInitConfigCommand(args: string[]): CLICommand {
  const options = parseOptions(args);

  return {
    command: 'init-config',
    options
  };
}

function parseOptions(args: string[]): Record<string, any> {
  const options: Record<string, any> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);

      // Check if this is a boolean flag or has a value
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith('--')) {
        // Boolean flag
        options[key] = true;
      } else {
        // Has a value
        options[key] = nextArg;
        i++; // Skip the next arg since we consumed it
      }
    }
  }

  return options;
}
