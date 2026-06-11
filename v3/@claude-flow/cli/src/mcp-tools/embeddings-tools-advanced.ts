/**
 * Embeddings MCP Tools — neural & hyperbolic tools
 *
 * embeddings_neural / hyperbolic. Extracted verbatim from
 * embeddings-tools.ts (lines 521-835) during campaign-2 wave 3 (W209);
 * module-private group const, spread back by the barrel.
 */

import type { MCPTool } from './types.js';
import {
  loadConfig,
  saveConfig,
  toPoincare,
  poincareDistance,
} from './embeddings-tools-helpers.js';

export const embeddingsAdvancedTools: MCPTool[] = [
  {
    name: 'embeddings_neural',
    description: 'Neural substrate operations (RuVector integration) Use when text similarity matters beyond keyword match — native Grep finds exact strings, embeddings find meaning. Pair with memory_store / agentdb_pattern-search to land the vector against your knowledge base. For literal symbol search, native Grep is faster.',
    category: 'embeddings',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Neural action',
          enum: ['status', 'init', 'drift', 'consolidate', 'adapt'],
          default: 'status',
        },
        driftThreshold: {
          type: 'number',
          description: 'Semantic drift detection threshold',
          default: 0.3,
        },
        decayRate: {
          type: 'number',
          description: 'Memory decay rate (hippocampal dynamics)',
          default: 0.01,
        },
      },
    },
    handler: async (input) => {
      const config = loadConfig();
      if (!config) {
        return {
          success: false,
          error: 'Embeddings not initialized. Run embeddings/init first.',
        };
      }

      const action = (input.action as string) || 'status';

      switch (action) {
        case 'init':
          config.neural = {
            enabled: true,
            driftThreshold: (input.driftThreshold as number) || 0.3,
            decayRate: (input.decayRate as number) || 0.01,
            ruvector: {
              enabled: true,
              sona: true,
              flashAttention: true,
              ewcPlusPlus: true,
            },
            features: {
              semanticDrift: true,
              memoryPhysics: true,
              stateMachine: true,
              swarmCoordination: true,
              coherenceMonitor: true,
            },
          };
          saveConfig(config);
          return {
            success: true,
            action: 'init',
            neural: config.neural,
            message: 'Neural substrate initialized with RuVector integration',
          };

        case 'drift':
          // Get real drift metrics if available
          try {
            const { getIntelligenceStats } = await import('../memory/intelligence.js');
            const stats = getIntelligenceStats();
            return {
              success: true,
              action: 'drift',
              status: {
                semanticDrift: {
                  enabled: config.neural.features?.semanticDrift ?? false,
                  threshold: config.neural.driftThreshold,
                  patternsTracked: stats.patternsLearned,
                  status: stats.patternsLearned > 0 ? 'tracking' : 'no patterns',
                },
              },
              message: stats.patternsLearned > 0
                ? `Tracking ${stats.patternsLearned} patterns for drift`
                : 'No patterns stored yet - drift detection inactive',
            };
          } catch {
            return {
              success: true,
              action: 'drift',
              status: { semanticDrift: { enabled: false, reason: 'Intelligence module unavailable' } },
            };
          }

        case 'consolidate':
          // Get real consolidation metrics
          try {
            const { getIntelligenceStats } = await import('../memory/intelligence.js');
            const stats = getIntelligenceStats();
            return {
              success: true,
              action: 'consolidate',
              status: {
                memoryPhysics: {
                  enabled: config.neural.features?.memoryPhysics ?? false,
                  decayRate: config.neural.decayRate,
                  patternsStored: stats.reasoningBankSize,
                  trajectoriesRecorded: stats.trajectoriesRecorded,
                },
              },
              message: `ReasoningBank: ${stats.reasoningBankSize} patterns, ${stats.trajectoriesRecorded} trajectories`,
            };
          } catch {
            return {
              success: true,
              action: 'consolidate',
              status: { memoryPhysics: { enabled: false, reason: 'Intelligence module unavailable' } },
            };
          }

        case 'adapt':
          // Get real SONA adaptation metrics
          try {
            const { benchmarkAdaptation, initializeIntelligence } = await import('../memory/intelligence.js');
            await initializeIntelligence();
            const benchmark = benchmarkAdaptation(100);
            return {
              success: true,
              action: 'adapt',
              status: {
                sona: {
                  enabled: true,
                  adaptationTime: `${(benchmark.avgMs * 1000).toFixed(2)}μs`,
                  targetMet: benchmark.targetMet,
                  minTime: `${(benchmark.minMs * 1000).toFixed(2)}μs`,
                  maxTime: `${(benchmark.maxMs * 1000).toFixed(2)}μs`,
                },
              },
              message: benchmark.targetMet
                ? `SONA adaptation: ${(benchmark.avgMs * 1000).toFixed(2)}μs (target <50μs met)`
                : `SONA adaptation: ${(benchmark.avgMs * 1000).toFixed(2)}μs (target not met)`,
            };
          } catch {
            return {
              success: true,
              action: 'adapt',
              status: { sona: { enabled: false, reason: 'Intelligence module unavailable' } },
            };
          }

        default: // status
          // Get real neural system status
          try {
            const { getIntelligenceStats, benchmarkAdaptation, initializeIntelligence } = await import('../memory/intelligence.js');
            await initializeIntelligence();
            const stats = getIntelligenceStats();
            const benchmark = benchmarkAdaptation(50);
            return {
              success: true,
              action: 'status',
              neural: {
                enabled: config.neural.enabled,
                sonaEnabled: stats.sonaEnabled,
                ruvector: config.neural.ruvector || { enabled: false },
                features: config.neural.features || {},
                realMetrics: {
                  patternsLearned: stats.patternsLearned,
                  trajectoriesRecorded: stats.trajectoriesRecorded,
                  reasoningBankSize: stats.reasoningBankSize,
                  adaptationTime: `${(benchmark.avgMs * 1000).toFixed(2)}μs`,
                  targetMet: benchmark.targetMet,
                  lastAdaptation: stats.lastAdaptation
                    ? new Date(stats.lastAdaptation).toISOString()
                    : null,
                },
              },
              capabilities: [
                stats.sonaEnabled ? '✅ SONA Active' : '❌ SONA Inactive',
                benchmark.targetMet ? '✅ <0.05ms Target Met' : '⚠️ Target Not Met',
                `${stats.patternsLearned} patterns learned`,
                `${stats.trajectoriesRecorded} trajectories recorded`,
              ],
            };
          } catch {
            return {
              success: true,
              action: 'status',
              neural: {
                enabled: config.neural.enabled,
                ruvector: config.neural.ruvector || { enabled: false },
                features: config.neural.features || {},
              },
              message: 'Intelligence module not available - showing config only',
            };
          }
      }
    },
  },

  {
    name: 'embeddings_hyperbolic',
    description: 'Hyperbolic embedding operations (Poincaré ball) Use when text similarity matters beyond keyword match — native Grep finds exact strings, embeddings find meaning. Pair with memory_store / agentdb_pattern-search to land the vector against your knowledge base. For literal symbol search, native Grep is faster.',
    category: 'embeddings',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Hyperbolic action',
          enum: ['status', 'convert', 'distance', 'midpoint'],
          default: 'status',
        },
        embedding: {
          type: 'array',
          description: 'Euclidean embedding to convert',
          items: { type: 'number' },
        },
        embedding1: {
          type: 'array',
          description: 'First embedding for distance/midpoint',
          items: { type: 'number' },
        },
        embedding2: {
          type: 'array',
          description: 'Second embedding for distance/midpoint',
          items: { type: 'number' },
        },
      },
    },
    handler: async (input) => {
      const config = loadConfig();
      if (!config) {
        return {
          success: false,
          error: 'Embeddings not initialized. Run embeddings/init first.',
        };
      }

      if (!config.hyperbolic.enabled) {
        return {
          success: false,
          error: 'Hyperbolic mode not enabled. Initialize with hyperbolic=true.',
        };
      }

      const action = (input.action as string) || 'status';
      const curvature = config.hyperbolic.curvature;

      switch (action) {
        case 'convert':
          const embedding = input.embedding as number[];
          if (!embedding || !Array.isArray(embedding)) {
            return { success: false, error: 'Embedding array required for convert action' };
          }
          const poincare = toPoincare(embedding, curvature);
          return {
            success: true,
            action: 'convert',
            euclidean: embedding,
            poincare,
            curvature,
            poincareNorm: Math.sqrt(poincare.reduce((sum, x) => sum + x * x, 0)),
          };

        case 'distance':
          const emb1 = input.embedding1 as number[];
          const emb2 = input.embedding2 as number[];
          if (!emb1 || !emb2) {
            return { success: false, error: 'embedding1 and embedding2 required for distance action' };
          }
          const dist = poincareDistance(emb1, emb2, curvature);
          return {
            success: true,
            action: 'distance',
            distance: dist,
            curvature,
            interpretation: dist < 1 ? 'close' : dist < 2 ? 'moderate' : 'far',
          };

        case 'midpoint':
          const e1 = input.embedding1 as number[];
          const e2 = input.embedding2 as number[];
          if (!e1 || !e2) {
            return { success: false, error: 'embedding1 and embedding2 required for midpoint action' };
          }
          // Simplified midpoint (proper Möbius midpoint is more complex)
          const mid = e1.map((_, i) => (e1[i] + e2[i]) / 2);
          const norm = Math.sqrt(mid.reduce((sum, x) => sum + x * x, 0));
          const scaledMid = mid.map(x => x * (config.hyperbolic.maxNorm / Math.max(norm, config.hyperbolic.maxNorm)));
          return {
            success: true,
            action: 'midpoint',
            midpoint: scaledMid,
            curvature,
          };

        default: // status
          return {
            success: true,
            action: 'status',
            hyperbolic: {
              enabled: true,
              curvature,
              epsilon: config.hyperbolic.epsilon,
              maxNorm: config.hyperbolic.maxNorm,
            },
            benefits: [
              'Better hierarchical data representation',
              'Exponential capacity in low dimensions',
              'Preserves tree-like structures',
              'Natural for taxonomy embeddings',
            ],
          };
      }
    },
  },

];
