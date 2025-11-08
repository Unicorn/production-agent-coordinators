import { describe, it, expect } from 'vitest';
import { parseCommand, type CLICommand } from '../src/command-parser.js';

describe('Command Parser', () => {
  describe('run command', () => {
    it('should parse run command with spec name', () => {
      const result = parseCommand(['run', 'hello']);

      expect(result).toEqual({
        command: 'run',
        spec: 'hello',
        options: {}
      });
    });

    it('should parse run command with agent option', () => {
      const result = parseCommand(['run', 'hello', '--agent', 'anthropic']);

      expect(result).toEqual({
        command: 'run',
        spec: 'hello',
        options: {
          agent: 'anthropic'
        }
      });
    });

    it('should parse run command with config option', () => {
      const result = parseCommand(['run', 'todo', '--config', './custom-config.js']);

      expect(result).toEqual({
        command: 'run',
        spec: 'todo',
        options: {
          config: './custom-config.js'
        }
      });
    });

    it('should throw error when spec name is missing', () => {
      expect(() => parseCommand(['run'])).toThrow('Spec name is required');
    });
  });

  describe('list-specs command', () => {
    it('should parse list-specs command', () => {
      const result = parseCommand(['list-specs']);

      expect(result).toEqual({
        command: 'list-specs',
        options: {}
      });
    });

    it('should parse list-specs with verbose option', () => {
      const result = parseCommand(['list-specs', '--verbose']);

      expect(result).toEqual({
        command: 'list-specs',
        options: {
          verbose: true
        }
      });
    });
  });

  describe('list-agents command', () => {
    it('should parse list-agents command', () => {
      const result = parseCommand(['list-agents']);

      expect(result).toEqual({
        command: 'list-agents',
        options: {}
      });
    });

    it('should parse list-agents with verbose option', () => {
      const result = parseCommand(['list-agents', '--verbose']);

      expect(result).toEqual({
        command: 'list-agents',
        options: {
          verbose: true
        }
      });
    });
  });

  describe('init-config command', () => {
    it('should parse init-config command', () => {
      const result = parseCommand(['init-config']);

      expect(result).toEqual({
        command: 'init-config',
        options: {}
      });
    });

    it('should parse init-config with format option', () => {
      const result = parseCommand(['init-config', '--format', 'js']);

      expect(result).toEqual({
        command: 'init-config',
        options: {
          format: 'js'
        }
      });
    });

    it('should parse init-config with output option', () => {
      const result = parseCommand(['init-config', '--output', './config/coordinator.config.js']);

      expect(result).toEqual({
        command: 'init-config',
        options: {
          output: './config/coordinator.config.js'
        }
      });
    });
  });

  describe('unknown command', () => {
    it('should throw error for unknown command', () => {
      expect(() => parseCommand(['unknown'])).toThrow('Unknown command: unknown');
    });

    it('should throw error when no command is provided', () => {
      expect(() => parseCommand([])).toThrow('No command provided');
    });
  });
});
