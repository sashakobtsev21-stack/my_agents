/**
 * Official Plugin Collections
 *
 * Pre-built collections of plugins for common use cases.
 */

import type { PluginCollection, PluginCollectionEntry } from '../collection-manager.js';
import { PluginBuilder } from '../../sdk/index.js';
import { HookEvent, HookPriority } from '../../types/index.js';
// Plugin definitions moved to ./plugins-a.ts + ./plugins-b.ts (W155,
// P3.34). Imported for the collections below + re-exported (callers
// import individual plugins from './official/index.js').
import {
  sessionPlugin,
  memoryCoordinatorPlugin,
  eventBusPlugin,
  coderAgentPlugin,
  testerAgentPlugin,
  reviewerAgentPlugin,
  gitIntegrationPlugin,
  linterPlugin,
  sonaPlugin,
  reasoningBankPlugin,
  patternLearningPlugin,
  hiveMindPlugin,
  maestroPlugin,
  consensusPlugin,
  coordinatorAgentPlugin,
} from './plugins-a.js';
import {
  inputValidationPlugin,
  pathSecurityPlugin,
  auditLogPlugin,
  securityScanPlugin,
  metricsPlugin,
  cachePlugin,
  ruvectorPostgresPlugin,
} from './plugins-b.js';
export {
  sessionPlugin,
  memoryCoordinatorPlugin,
  eventBusPlugin,
  coderAgentPlugin,
  testerAgentPlugin,
  reviewerAgentPlugin,
  gitIntegrationPlugin,
  linterPlugin,
  sonaPlugin,
  reasoningBankPlugin,
  patternLearningPlugin,
  hiveMindPlugin,
  maestroPlugin,
  consensusPlugin,
  coordinatorAgentPlugin,
} from './plugins-a.js';
export {
  inputValidationPlugin,
  pathSecurityPlugin,
  auditLogPlugin,
  securityScanPlugin,
  metricsPlugin,
  cachePlugin,
  ruvectorPostgresPlugin,
} from './plugins-b.js';

// ============================================================================
// Core Plugins
// ============================================================================

/**
 * Session management plugin - handles session lifecycle hooks.
 */

/**
 * Core collection - essential plugins for Claude Flow operation.
 */
export const coreCollection: PluginCollection = {
  id: 'claude-flow-core',
  name: 'Claude Flow Core Plugins',
  version: '3.0.0',
  description: 'Essential plugins for Claude Flow operation',
  author: 'Claude Flow',
  license: 'MIT',
  categories: ['hook', 'integration', 'utility'],
  plugins: [
    {
      plugin: sessionPlugin,
      defaultEnabled: true,
      category: 'hook',
      tags: ['core', 'session'],
      description: 'Session lifecycle management',
    },
    {
      plugin: memoryCoordinatorPlugin,
      defaultEnabled: true,
      category: 'integration',
      tags: ['core', 'memory'],
      description: 'Memory coordination across agents',
    },
    {
      plugin: eventBusPlugin,
      defaultEnabled: true,
      category: 'utility',
      tags: ['core', 'events'],
      description: 'Event pub/sub system',
    },
  ],
};

/**
 * Development collection - plugins for software development workflows.
 */
export const developmentCollection: PluginCollection = {
  id: 'claude-flow-development',
  name: 'Development Tools',
  version: '3.0.0',
  description: 'Plugins for software development workflows',
  author: 'Claude Flow',
  license: 'MIT',
  categories: ['agent', 'tool', 'integration'],
  plugins: [
    {
      plugin: coderAgentPlugin,
      defaultEnabled: true,
      category: 'agent',
      tags: ['development', 'coding'],
      description: 'AI coding assistant',
    },
    {
      plugin: testerAgentPlugin,
      defaultEnabled: true,
      category: 'agent',
      tags: ['development', 'testing'],
      description: 'AI testing assistant',
    },
    {
      plugin: reviewerAgentPlugin,
      defaultEnabled: false,
      category: 'agent',
      tags: ['development', 'review'],
      description: 'AI code reviewer',
    },
    {
      plugin: gitIntegrationPlugin,
      defaultEnabled: true,
      category: 'integration',
      tags: ['development', 'git'],
      description: 'Git version control integration',
    },
    {
      plugin: linterPlugin,
      defaultEnabled: false,
      category: 'tool',
      tags: ['development', 'linting'],
      description: 'Code linting and style checking',
    },
  ],
};

/**
 * Intelligence collection - AI/ML and learning plugins.
 */
export const intelligenceCollection: PluginCollection = {
  id: 'claude-flow-intelligence',
  name: 'Intelligence & Learning',
  version: '3.0.0',
  description: 'AI/ML features and learning capabilities',
  author: 'Claude Flow',
  license: 'MIT',
  categories: ['integration', 'memory', 'hook', 'database'],
  plugins: [
    {
      plugin: sonaPlugin,
      defaultEnabled: false,
      category: 'integration',
      tags: ['intelligence', 'neural'],
      requiredCapabilities: ['memory', 'llm'],
      description: 'SONA self-optimizing neural architecture',
    },
    {
      plugin: reasoningBankPlugin,
      defaultEnabled: false,
      category: 'memory',
      tags: ['intelligence', 'patterns'],
      requiredCapabilities: ['memory'],
      description: 'Reasoning pattern storage',
    },
    {
      plugin: patternLearningPlugin,
      defaultEnabled: false,
      category: 'hook',
      tags: ['intelligence', 'learning'],
      description: 'Learn from task execution',
    },
    {
      plugin: ruvectorPostgresPlugin,
      defaultEnabled: false,
      category: 'database',
      tags: ['intelligence', 'vector', 'postgresql', 'attention', 'gnn'],
      requiredCapabilities: ['memory', 'database'],
      description: 'RuVector PostgreSQL Bridge - Advanced vector search with 39 attention mechanisms, GNN layers, and hyperbolic embeddings',
    },
  ],
};

/**
 * Database collection - database and storage plugins.
 */
export const databaseCollection: PluginCollection = {
  id: 'claude-flow-database',
  name: 'Database & Storage',
  version: '3.0.0',
  description: 'Database integrations and storage plugins',
  author: 'Claude Flow',
  license: 'MIT',
  categories: ['database', 'integration'],
  plugins: [
    {
      plugin: ruvectorPostgresPlugin,
      defaultEnabled: false,
      category: 'database',
      tags: ['postgresql', 'vector', 'attention', 'gnn', 'hyperbolic'],
      requiredCapabilities: ['database'],
      description: 'RuVector PostgreSQL - 52K+ inserts/sec, sub-ms queries, 39 attention mechanisms, GNN, hyperbolic embeddings',
    },
  ],
};

/**
 * Swarm collection - multi-agent coordination plugins.
 */
export const swarmCollection: PluginCollection = {
  id: 'claude-flow-swarm',
  name: 'Swarm Coordination',
  version: '3.0.0',
  description: 'Multi-agent swarm coordination and orchestration',
  author: 'Claude Flow',
  license: 'MIT',
  categories: ['integration', 'agent'],
  plugins: [
    {
      plugin: hiveMindPlugin,
      defaultEnabled: true,
      category: 'integration',
      tags: ['swarm', 'consensus'],
      description: 'Collective intelligence coordination',
    },
    {
      plugin: maestroPlugin,
      defaultEnabled: true,
      category: 'integration',
      tags: ['swarm', 'orchestration'],
      description: 'Workflow orchestration',
    },
    {
      plugin: consensusPlugin,
      defaultEnabled: false,
      category: 'integration',
      tags: ['swarm', 'byzantine'],
      description: 'Byzantine fault-tolerant consensus',
    },
    {
      plugin: coordinatorAgentPlugin,
      defaultEnabled: true,
      category: 'agent',
      tags: ['swarm', 'coordination'],
      description: 'Swarm coordinator agent',
    },
  ],
};

/**
 * Security collection - security and audit plugins.
 */
export const securityCollection: PluginCollection = {
  id: 'claude-flow-security',
  name: 'Security & Audit',
  version: '3.0.0',
  description: 'Security validation and audit logging',
  author: 'Claude Flow',
  license: 'MIT',
  categories: ['hook', 'tool'],
  plugins: [
    {
      plugin: inputValidationPlugin,
      defaultEnabled: true,
      category: 'hook',
      tags: ['security', 'validation'],
      description: 'Input validation and sanitization',
    },
    {
      plugin: pathSecurityPlugin,
      defaultEnabled: true,
      category: 'hook',
      tags: ['security', 'filesystem'],
      description: 'Path traversal prevention',
    },
    {
      plugin: auditLogPlugin,
      defaultEnabled: false,
      category: 'hook',
      tags: ['security', 'audit'],
      description: 'Comprehensive audit logging',
    },
    {
      plugin: securityScanPlugin,
      defaultEnabled: false,
      category: 'tool',
      tags: ['security', 'scanning'],
      description: 'Security vulnerability scanning',
    },
  ],
};

/**
 * Utility collection - general utility plugins.
 */
export const utilityCollection: PluginCollection = {
  id: 'claude-flow-utility',
  name: 'Utilities',
  version: '3.0.0',
  description: 'General utility plugins',
  author: 'Claude Flow',
  license: 'MIT',
  categories: ['utility'],
  plugins: [
    {
      plugin: metricsPlugin,
      defaultEnabled: false,
      category: 'utility',
      tags: ['metrics', 'monitoring'],
      description: 'Performance metrics collection',
    },
    {
      plugin: cachePlugin,
      defaultEnabled: false,
      category: 'utility',
      tags: ['cache', 'performance'],
      description: 'Caching utilities',
    },
  ],
};

/**
 * All official collections.
 */
export const officialCollections: PluginCollection[] = [
  coreCollection,
  developmentCollection,
  intelligenceCollection,
  swarmCollection,
  securityCollection,
  utilityCollection,
  databaseCollection,
];

/**
 * Get all official plugins as a flat list.
 */
export function getAllOfficialPlugins(): PluginCollectionEntry[] {
  return officialCollections.flatMap(c => c.plugins);
}

/**
 * Get an official collection by ID.
 */
export function getOfficialCollection(id: string): PluginCollection | undefined {
  return officialCollections.find(c => c.id === id);
}
