import { cosmiconfig } from 'cosmiconfig';
import { existsSync } from 'fs';

export interface CoordinatorConfig {
  defaultAgent: string;
  defaultSpec: string;
  apiKeys: Record<string, string>;
  [key: string]: any;
}

const DEFAULT_CONFIG: CoordinatorConfig = {
  defaultAgent: 'mock',
  defaultSpec: 'hello',
  apiKeys: {}
};

export async function loadConfig(
  searchFrom?: string,
  overrides?: Partial<CoordinatorConfig>
): Promise<CoordinatorConfig> {
  const explorer = cosmiconfig('coordinator');

  try {
    const result = await explorer.search(searchFrom);

    let config: CoordinatorConfig;

    if (result && result.config) {
      config = { ...DEFAULT_CONFIG, ...result.config };
    } else {
      config = { ...DEFAULT_CONFIG };
    }

    // Apply overrides
    if (overrides) {
      config = { ...config, ...overrides };
    }

    // Validate config
    validateConfig(config);

    return config;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid config')) {
      throw error;
    }
    // If config file doesn't exist or can't be loaded, return defaults with overrides
    const config = { ...DEFAULT_CONFIG, ...overrides };
    validateConfig(config);
    return config;
  }
}

function validateConfig(config: CoordinatorConfig): void {
  if (!config.defaultAgent) {
    throw new Error('Invalid config: defaultAgent is required');
  }

  if (!config.defaultSpec) {
    throw new Error('Invalid config: defaultSpec is required');
  }

  if (typeof config.apiKeys !== 'object' || Array.isArray(config.apiKeys)) {
    throw new Error('Invalid config: apiKeys must be an object');
  }
}

export async function loadConfigFromFile(filePath: string): Promise<CoordinatorConfig> {
  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  // Use dynamic import for ESM compatibility
  try {
    const module = await import(filePath);
    const config = module.default || module;
    validateConfig(config as CoordinatorConfig);
    return config as CoordinatorConfig;
  } catch (error) {
    throw new Error(`Failed to load config from ${filePath}: ${error}`);
  }
}
