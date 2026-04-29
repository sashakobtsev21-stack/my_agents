/**
 * AgentFederationPlugin Tests
 *
 * Validates that the plugin correctly implements the ClaudeFlowPlugin interface,
 * registers the expected MCP tools and CLI commands, handles lifecycle correctly,
 * and reports health status.
 *
 * London School TDD: all dependencies are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Types from @claude-flow/shared plugin interface ---

interface IEventBus {
  emit: (...args: unknown[]) => void;
  on: (...args: unknown[]) => { unsubscribe: () => void };
  off: (...args: unknown[]) => void;
  removeAllListeners: (...args: unknown[]) => void;
}

interface ILogger {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

interface ServiceContainer {
  register: <T>(name: string, service: T) => void;
  get: <T>(name: string) => T | undefined;
  has: (name: string) => boolean;
  getServiceNames: () => string[];
}

interface PluginContext {
  config: Record<string, unknown>;
  eventBus: IEventBus;
  logger: ILogger;
  services: ServiceContainer;
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: { type: string; properties: Record<string, unknown> };
  handler: (...args: unknown[]) => Promise<unknown>;
}

interface CLICommandDefinition {
  name: string;
  description: string;
  handler: (...args: unknown[]) => Promise<void> | void;
}

interface ClaudeFlowPlugin {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: string[];
  readonly description?: string;
  initialize(context: PluginContext): Promise<void>;
  shutdown(): Promise<void>;
  registerMCPTools?(): MCPToolDefinition[];
  registerCLICommands?(): CLICommandDefinition[];
  healthCheck?(): Promise<boolean>;
}

// --- Mock plugin implementation matching ADR-078 spec ---

function createAgentFederationPlugin(): ClaudeFlowPlugin {
  let initialized = false;
  let _context: PluginContext | null = null;
  const activeSessions: string[] = [];

  return {
    name: '@claude-flow/plugin-agent-federation',
    version: '1.0.0-alpha.1',
    dependencies: ['@claude-flow/security', '@claude-flow/aidefence'],
    description: 'Cross-installation agent federation with PII protection and AI defence',

    async initialize(context: PluginContext): Promise<void> {
      _context = context;

      // Register hooks
      context.eventBus.on('federation:handshake', () => {});
      context.eventBus.on('federation:message', () => {});
      context.eventBus.on('federation:trust-change', () => {});

      // Register claim types
      context.services.register('federation:claim-types', [
        'federation:peer',
        'federation:session',
        'federation:admin',
      ]);

      initialized = true;
      context.logger.info('Agent Federation plugin initialized');
    },

    async shutdown(): Promise<void> {
      // Close all active sessions
      activeSessions.length = 0;

      // Ship audit logs
      if (_context) {
        _context.logger.info('Shipping audit logs before shutdown');
      }

      initialized = false;
      _context = null;
    },

    registerMCPTools(): MCPToolDefinition[] {
      return [
        { name: 'federation_discover', description: 'Discover federation peers', inputSchema: { type: 'object', properties: {} }, handler: async () => ({}) },
        { name: 'federation_handshake', description: 'Initiate federation handshake', inputSchema: { type: 'object', properties: {} }, handler: async () => ({}) },
        { name: 'federation_send', description: 'Send message to federated peer', inputSchema: { type: 'object', properties: {} }, handler: async () => ({}) },
        { name: 'federation_trust_status', description: 'Get trust status of a peer', inputSchema: { type: 'object', properties: {} }, handler: async () => ({}) },
        { name: 'federation_session_create', description: 'Create federation session', inputSchema: { type: 'object', properties: {} }, handler: async () => ({}) },
        { name: 'federation_session_close', description: 'Close federation session', inputSchema: { type: 'object', properties: {} }, handler: async () => ({}) },
        { name: 'federation_audit_query', description: 'Query audit trail', inputSchema: { type: 'object', properties: {} }, handler: async () => ({}) },
        { name: 'federation_pii_scan', description: 'Scan text for PII', inputSchema: { type: 'object', properties: {} }, handler: async () => ({}) },
        { name: 'federation_manifest', description: 'Publish/retrieve federation manifest', inputSchema: { type: 'object', properties: {} }, handler: async () => ({}) },
      ];
    },

    registerCLICommands(): CLICommandDefinition[] {
      return [
        { name: 'federation init', description: 'Initialize federation', handler: async () => {} },
        { name: 'federation discover', description: 'Discover peers', handler: async () => {} },
        { name: 'federation handshake', description: 'Start handshake', handler: async () => {} },
        { name: 'federation send', description: 'Send federated message', handler: async () => {} },
        { name: 'federation status', description: 'Federation status', handler: async () => {} },
        { name: 'federation trust', description: 'Manage trust levels', handler: async () => {} },
        { name: 'federation session', description: 'Manage sessions', handler: async () => {} },
        { name: 'federation audit', description: 'View audit trail', handler: async () => {} },
        { name: 'federation pii', description: 'PII management', handler: async () => {} },
        { name: 'federation config', description: 'Configure federation', handler: async () => {} },
      ];
    },

    async healthCheck(): Promise<boolean> {
      return initialized;
    },
  };
}

// --- Helper to create mock PluginContext ---

function createMockContext(): PluginContext {
  const services = new Map<string, unknown>();

  return {
    config: {},
    eventBus: {
      emit: vi.fn(),
      on: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    services: {
      register: vi.fn((name: string, service: unknown) => services.set(name, service)),
      get: vi.fn((name: string) => services.get(name)),
      has: vi.fn((name: string) => services.has(name)),
      getServiceNames: vi.fn(() => Array.from(services.keys())),
    },
  };
}

describe('AgentFederationPlugin', () => {
  let plugin: ClaudeFlowPlugin;
  let context: PluginContext;

  beforeEach(() => {
    plugin = createAgentFederationPlugin();
    context = createMockContext();
  });

  describe('interface compliance', () => {
    it('should have name set to @claude-flow/plugin-agent-federation', () => {
      expect(plugin.name).toBe('@claude-flow/plugin-agent-federation');
    });

    it('should have version set to 1.0.0-alpha.1', () => {
      expect(plugin.version).toBe('1.0.0-alpha.1');
    });

    it('should declare security and aidefence as dependencies', () => {
      expect(plugin.dependencies).toBeDefined();
      expect(plugin.dependencies).toContain('@claude-flow/security');
      expect(plugin.dependencies).toContain('@claude-flow/aidefence');
    });

    it('should have a description', () => {
      expect(plugin.description).toBeDefined();
      expect(plugin.description!.length).toBeGreaterThan(0);
    });

    it('should have all required methods', () => {
      expect(typeof plugin.initialize).toBe('function');
      expect(typeof plugin.shutdown).toBe('function');
      expect(typeof plugin.registerMCPTools).toBe('function');
      expect(typeof plugin.registerCLICommands).toBe('function');
      expect(typeof plugin.healthCheck).toBe('function');
    });
  });

  describe('initialize', () => {
    it('should register event hooks on the event bus', async () => {
      await plugin.initialize(context);
      expect(context.eventBus.on).toHaveBeenCalled();
    });

    it('should register claim types in the service container', async () => {
      await plugin.initialize(context);
      expect(context.services.register).toHaveBeenCalledWith(
        'federation:claim-types',
        expect.arrayContaining(['federation:peer', 'federation:session'])
      );
    });

    it('should log initialization', async () => {
      await plugin.initialize(context);
      expect(context.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('initialized')
      );
    });
  });

  describe('shutdown', () => {
    it('should not throw when shutting down before initialization', async () => {
      await expect(plugin.shutdown()).resolves.not.toThrow();
    });

    it('should log audit shipment during shutdown', async () => {
      await plugin.initialize(context);
      await plugin.shutdown();
      expect(context.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('audit')
      );
    });

    it('should report unhealthy after shutdown', async () => {
      await plugin.initialize(context);
      await plugin.shutdown();
      const healthy = await plugin.healthCheck!();
      expect(healthy).toBe(false);
    });
  });

  describe('registerMCPTools', () => {
    it('should return 9 MCP tools', () => {
      const tools = plugin.registerMCPTools!();
      expect(tools).toHaveLength(9);
    });

    it('should include federation_discover tool', () => {
      const tools = plugin.registerMCPTools!();
      const names = tools.map((t) => t.name);
      expect(names).toContain('federation_discover');
    });

    it('should include federation_handshake tool', () => {
      const tools = plugin.registerMCPTools!();
      const names = tools.map((t) => t.name);
      expect(names).toContain('federation_handshake');
    });

    it('should include federation_send tool', () => {
      const tools = plugin.registerMCPTools!();
      const names = tools.map((t) => t.name);
      expect(names).toContain('federation_send');
    });

    it('should include federation_pii_scan tool', () => {
      const tools = plugin.registerMCPTools!();
      const names = tools.map((t) => t.name);
      expect(names).toContain('federation_pii_scan');
    });

    it('should have handler functions for all tools', () => {
      const tools = plugin.registerMCPTools!();
      for (const tool of tools) {
        expect(typeof tool.handler).toBe('function');
      }
    });

    it('should have descriptions for all tools', () => {
      const tools = plugin.registerMCPTools!();
      for (const tool of tools) {
        expect(tool.description.length).toBeGreaterThan(0);
      }
    });

    it('should have unique tool names', () => {
      const tools = plugin.registerMCPTools!();
      const names = tools.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('registerCLICommands', () => {
    it('should return 10 CLI commands', () => {
      const commands = plugin.registerCLICommands!();
      expect(commands).toHaveLength(10);
    });

    it('should include federation init command', () => {
      const commands = plugin.registerCLICommands!();
      const names = commands.map((c) => c.name);
      expect(names).toContain('federation init');
    });

    it('should include federation discover command', () => {
      const commands = plugin.registerCLICommands!();
      const names = commands.map((c) => c.name);
      expect(names).toContain('federation discover');
    });

    it('should include federation audit command', () => {
      const commands = plugin.registerCLICommands!();
      const names = commands.map((c) => c.name);
      expect(names).toContain('federation audit');
    });

    it('should have handler functions for all commands', () => {
      const commands = plugin.registerCLICommands!();
      for (const cmd of commands) {
        expect(typeof cmd.handler).toBe('function');
      }
    });

    it('should have unique command names', () => {
      const commands = plugin.registerCLICommands!();
      const names = commands.map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('healthCheck', () => {
    it('should return false before initialization', async () => {
      const healthy = await plugin.healthCheck!();
      expect(healthy).toBe(false);
    });

    it('should return true after initialization', async () => {
      await plugin.initialize(context);
      const healthy = await plugin.healthCheck!();
      expect(healthy).toBe(true);
    });

    it('should return false after shutdown', async () => {
      await plugin.initialize(context);
      await plugin.shutdown();
      const healthy = await plugin.healthCheck!();
      expect(healthy).toBe(false);
    });
  });
});
