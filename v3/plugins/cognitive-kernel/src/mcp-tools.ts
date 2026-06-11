/**
 * Cognitive Kernel MCP Tools
 *
 * 5 MCP tools for cognitive augmentation:
 * - cognition/working-memory: Working memory slot management
 * - cognition/attention-control: Cognitive attention control
 * - cognition/meta-monitor: Meta-cognitive monitoring
 * - cognition/scaffold: Cognitive scaffolding
 * - cognition/cognitive-load: Cognitive load management
 */

import type {
  MCPTool,
  MCPToolResult,
  ToolContext,
  WorkingMemoryOutput,
  AttentionControlOutput,
  MetaMonitorOutput,
  ScaffoldOutput,
  CognitiveLoadOutput,
  WorkingMemorySlot,
  AttentionState,
  AttentionMode,
  MonitoringType,
  ReflectionDepth,
  ScaffoldStep,
  TaskComplexity,
  ScaffoldType,
  LoadOptimization,
} from './types.js';
import {
  WorkingMemoryInputSchema,
  AttentionControlInputSchema,
  MetaMonitorInputSchema,
  ScaffoldInputSchema,
  CognitiveLoadInputSchema,
  successResult,
  errorResult,
  calculateTotalLoad,
  generateScaffoldSteps,
} from './types.js';

// ============================================================================

// The logger/state/schemas/handlers were extracted into
// ./mcp-tools-handlers.ts during the P3.65 god-file decomposition
// (W186). Module-private pre-split; only the five handler functions are
// imported back. The public surface (5 tool consts + cognitiveKernelTools
// + toolHandlers + getTool/getToolNames) stays here.
import {
  workingMemoryHandler,
  attentionControlHandler,
  metaMonitorHandler,
  scaffoldHandler,
  cognitiveLoadHandler,
} from './mcp-tools-handlers.js';

export const workingMemoryTool: MCPTool = {
  name: 'cognition/working-memory',
  description: 'Manage working memory slots for complex reasoning tasks. Supports allocate, update, retrieve, clear, and consolidate operations with Miller number capacity limits.',
  category: 'cognition',
  version: '0.1.0',
  tags: ['working-memory', 'cognitive', 'reasoning', 'slots'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['allocate', 'update', 'retrieve', 'clear', 'consolidate'],
      },
      slot: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          content: {},
          priority: { type: 'number', default: 0.5 },
          decay: { type: 'number', default: 0.1 },
        },
      },
      capacity: { type: 'number', default: 7 },
      consolidationTarget: {
        type: 'string',
        enum: ['episodic', 'semantic', 'procedural'],
      },
    },
    required: ['action'],
  },
  handler: workingMemoryHandler,
};

// ============================================================================

export const attentionControlTool: MCPTool = {
  name: 'cognition/attention-control',
  description: 'Control cognitive attention and information filtering. Supports focus, diffuse, selective, divided, and sustained attention modes.',
  category: 'cognition',
  version: '0.1.0',
  tags: ['attention', 'cognitive', 'focus', 'filter'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['focus', 'diffuse', 'selective', 'divided', 'sustained'],
      },
      targets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            entity: { type: 'string' },
            weight: { type: 'number' },
            duration: { type: 'number' },
          },
        },
      },
      filters: {
        type: 'object',
        properties: {
          includePatterns: { type: 'array', items: { type: 'string' } },
          excludePatterns: { type: 'array', items: { type: 'string' } },
          noveltyBias: { type: 'number', default: 0.5 },
        },
      },
    },
    required: ['mode'],
  },
  handler: attentionControlHandler,
};

// ============================================================================

export const metaMonitorTool: MCPTool = {
  name: 'cognition/meta-monitor',
  description: 'Meta-cognitive monitoring of reasoning quality. Monitors confidence, coherence, goal tracking, cognitive load, error detection, and uncertainty estimation.',
  category: 'cognition',
  version: '0.1.0',
  tags: ['meta-cognition', 'monitoring', 'reflection', 'self-assessment'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      monitoring: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['confidence_calibration', 'reasoning_coherence', 'goal_tracking', 'cognitive_load', 'error_detection', 'uncertainty_estimation'],
        },
      },
      reflection: {
        type: 'object',
        properties: {
          trigger: { type: 'string', enum: ['periodic', 'on_error', 'on_uncertainty'] },
          depth: { type: 'string', enum: ['shallow', 'medium', 'deep'] },
        },
      },
      interventions: { type: 'boolean', default: true },
    },
  },
  handler: metaMonitorHandler,
};

// ============================================================================

export const scaffoldTool: MCPTool = {
  name: 'cognition/scaffold',
  description: 'Provide cognitive scaffolding for complex reasoning. Supports decomposition, analogy, worked example, socratic, metacognitive prompting, and chain of thought scaffolds.',
  category: 'cognition',
  version: '0.1.0',
  tags: ['scaffolding', 'cognitive', 'learning', 'zpd'],
  cacheable: true,
  cacheTTL: 60000,
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          complexity: { type: 'string', enum: ['simple', 'moderate', 'complex', 'expert'] },
          domain: { type: 'string' },
        },
      },
      scaffoldType: {
        type: 'string',
        enum: ['decomposition', 'analogy', 'worked_example', 'socratic', 'metacognitive_prompting', 'chain_of_thought'],
      },
      adaptivity: {
        type: 'object',
        properties: {
          fading: { type: 'boolean', default: true },
          monitoring: { type: 'boolean', default: true },
        },
      },
    },
    required: ['task', 'scaffoldType'],
  },
  handler: scaffoldHandler,
};

// ============================================================================

export const cognitiveLoadTool: MCPTool = {
  name: 'cognition/cognitive-load',
  description: 'Monitor and balance cognitive load during reasoning. Manages intrinsic, extraneous, and germane load with optimization strategies.',
  category: 'cognition',
  version: '0.1.0',
  tags: ['cognitive-load', 'clt', 'optimization', 'learning'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      assessment: {
        type: 'object',
        properties: {
          intrinsic: { type: 'number', description: 'Task complexity (0-1)' },
          extraneous: { type: 'number', description: 'Presentation complexity (0-1)' },
          germane: { type: 'number', description: 'Learning investment (0-1)' },
        },
      },
      optimization: {
        type: 'string',
        enum: ['reduce_extraneous', 'chunk_intrinsic', 'maximize_germane', 'balanced'],
        default: 'balanced',
      },
      threshold: { type: 'number', default: 0.8 },
    },
  },
  handler: cognitiveLoadHandler,
};

// ============================================================================
// Export All Tools
// ============================================================================

export const cognitiveKernelTools: MCPTool[] = [
  workingMemoryTool,
  attentionControlTool,
  metaMonitorTool,
  scaffoldTool,
  cognitiveLoadTool,
];

export const toolHandlers = new Map<string, MCPTool['handler']>([
  ['cognition/working-memory', workingMemoryTool.handler],
  ['cognition/attention-control', attentionControlTool.handler],
  ['cognition/meta-monitor', metaMonitorTool.handler],
  ['cognition/scaffold', scaffoldTool.handler],
  ['cognition/cognitive-load', cognitiveLoadTool.handler],
]);

export function getTool(name: string): MCPTool | undefined {
  return cognitiveKernelTools.find(t => t.name === name);
}

export function getToolNames(): string[] {
  return cognitiveKernelTools.map(t => t.name);
}

export default cognitiveKernelTools;
