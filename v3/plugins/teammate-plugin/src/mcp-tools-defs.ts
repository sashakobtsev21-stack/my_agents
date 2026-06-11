/**
 * Teammate MCP Tools — tool definitions
 *
 * The MCPTool shape and the TEAMMATE_MCP_TOOLS catalog. Extracted
 * verbatim from mcp-tools.ts (lines 57-525) during campaign-2 wave 21
 * (W227). mcp-tools.ts stays the barrel.
 */

// ============================================================================
// Tool Definitions
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TEAMMATE_MCP_TOOLS: MCPTool[] = [
  // ==========================================================================
  // Team Management Tools
  // ==========================================================================
  {
    name: 'teammate_spawn_team',
    description:
      'Create a new team for multi-agent collaboration using native TeammateTool. ' +
      'Requires Claude Code >= 2.1.19.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique team name',
        },
        topology: {
          type: 'string',
          enum: ['flat', 'hierarchical', 'mesh'],
          description: 'Team topology (default: hierarchical)',
        },
        maxTeammates: {
          type: 'number',
          description: 'Maximum number of teammates (default: 8)',
        },
        planModeRequired: {
          type: 'boolean',
          description: 'Require plan approval before execution',
        },
        autoApproveJoin: {
          type: 'boolean',
          description: 'Auto-approve join requests (default: true)',
        },
        delegationEnabled: {
          type: 'boolean',
          description: 'Allow authority delegation (default: true)',
        },
      },
      required: ['name'],
    },
  },

  {
    name: 'teammate_discover_teams',
    description: 'Discover existing teams in ~/.claude/teams/',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'teammate_spawn',
    description:
      'Spawn a new teammate in a team. Returns AgentInput for Claude Code Task tool.',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: {
          type: 'string',
          description: 'Team to join',
        },
        name: {
          type: 'string',
          description: 'Teammate name',
        },
        role: {
          type: 'string',
          description: 'Teammate role (coder, tester, reviewer, etc.)',
        },
        prompt: {
          type: 'string',
          description: 'Task prompt for the teammate',
        },
        model: {
          type: 'string',
          enum: ['sonnet', 'opus', 'haiku'],
          description: 'Model to use',
        },
        allowedTools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tools to grant (e.g., ["Edit", "Write", "Bash"])',
        },
        mode: {
          type: 'string',
          enum: ['acceptEdits', 'bypassPermissions', 'default', 'delegate', 'dontAsk', 'plan'],
          description: 'Permission mode',
        },
        delegateAuthority: {
          type: 'boolean',
          description: 'Can this teammate delegate to others',
        },
      },
      required: ['teamName', 'name', 'role', 'prompt'],
    },
  },

  // ==========================================================================
  // Messaging Tools
  // ==========================================================================
  {
    name: 'teammate_send_message',
    description: 'Send a message to a specific teammate',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string', description: 'Team name' },
        fromId: { type: 'string', description: 'Sender teammate ID' },
        toId: { type: 'string', description: 'Recipient teammate ID' },
        type: {
          type: 'string',
          enum: ['task', 'result', 'status', 'plan', 'approval', 'delegation', 'context_update'],
          description: 'Message type',
        },
        payload: { description: 'Message payload (any JSON)' },
        priority: {
          type: 'string',
          enum: ['urgent', 'high', 'normal', 'low'],
          description: 'Message priority',
        },
      },
      required: ['teamName', 'fromId', 'toId', 'type', 'payload'],
    },
  },

  {
    name: 'teammate_broadcast',
    description: 'Broadcast message to all teammates in a team',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string', description: 'Team name' },
        fromId: { type: 'string', description: 'Sender teammate ID' },
        type: {
          type: 'string',
          enum: ['task', 'result', 'status', 'plan', 'approval', 'delegation', 'context_update'],
          description: 'Message type',
        },
        payload: { description: 'Message payload (any JSON)' },
        priority: {
          type: 'string',
          enum: ['urgent', 'high', 'normal', 'low'],
          description: 'Message priority',
        },
      },
      required: ['teamName', 'fromId', 'type', 'payload'],
    },
  },

  // ==========================================================================
  // Plan Management Tools
  // ==========================================================================
  {
    name: 'teammate_submit_plan',
    description: 'Submit a plan for team approval',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string', description: 'Team name' },
        description: { type: 'string', description: 'Plan description' },
        proposedBy: { type: 'string', description: 'Proposer teammate ID' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              order: { type: 'number' },
              action: { type: 'string' },
              assignee: { type: 'string' },
              tools: { type: 'array', items: { type: 'string' } },
              estimatedDuration: { type: 'number' },
            },
            required: ['order', 'action'],
          },
          description: 'Plan steps',
        },
        requiredApprovals: {
          type: 'number',
          description: 'Number of approvals needed (default: majority)',
        },
      },
      required: ['teamName', 'description', 'proposedBy', 'steps'],
    },
  },

  {
    name: 'teammate_approve_plan',
    description: 'Approve a submitted plan',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
        planId: { type: 'string' },
        approverId: { type: 'string' },
      },
      required: ['teamName', 'planId', 'approverId'],
    },
  },

  {
    name: 'teammate_launch_swarm',
    description: 'Launch swarm to execute an approved plan',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
        planId: { type: 'string' },
        teammateCount: {
          type: 'number',
          description: 'Number of teammates to spawn (default: number of steps)',
        },
      },
      required: ['teamName', 'planId'],
    },
  },

  // ==========================================================================
  // Delegation Tools
  // ==========================================================================
  {
    name: 'teammate_delegate',
    description: 'Delegate authority/permissions to another teammate',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
        fromId: { type: 'string', description: 'Delegator teammate ID' },
        toId: { type: 'string', description: 'Recipient teammate ID' },
        permissions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Permissions to delegate (e.g., ["approve_plan", "spawn_teammate"])',
        },
      },
      required: ['teamName', 'fromId', 'toId', 'permissions'],
    },
  },

  // ==========================================================================
  // Context & Memory Tools
  // ==========================================================================
  {
    name: 'teammate_update_context',
    description: 'Update team shared context',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
        sharedVariables: {
          type: 'object',
          description: 'Variables to add/update',
        },
        inheritedPermissions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Permissions for new teammates',
        },
        workingDirectory: { type: 'string' },
        environmentVariables: {
          type: 'object',
          description: 'Environment variables',
        },
      },
      required: ['teamName'],
    },
  },

  {
    name: 'teammate_save_memory',
    description: 'Save teammate session memory to disk',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
        teammateId: { type: 'string' },
      },
      required: ['teamName', 'teammateId'],
    },
  },

  {
    name: 'teammate_share_transcript',
    description: 'Share message transcript with another teammate',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
        fromId: { type: 'string', description: 'Source teammate ID' },
        toId: { type: 'string', description: 'Target teammate ID' },
        start: { type: 'number', description: 'Start message index' },
        end: { type: 'number', description: 'End message index' },
      },
      required: ['teamName', 'fromId', 'toId'],
    },
  },

  // ==========================================================================
  // Remote & Teleport Tools
  // ==========================================================================
  {
    name: 'teammate_push_remote',
    description: 'Push team to Claude.ai remote session',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
      },
      required: ['teamName'],
    },
  },

  {
    name: 'teammate_teleport',
    description: 'Teleport team to a new context/working directory',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
        workingDirectory: { type: 'string' },
        gitRepo: { type: 'string' },
        gitBranch: { type: 'string' },
        sessionId: { type: 'string' },
      },
      required: ['teamName'],
    },
  },

  // ==========================================================================
  // Status & Cleanup Tools
  // ==========================================================================
  {
    name: 'teammate_get_status',
    description: 'Get team and teammate status',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
      },
      required: ['teamName'],
    },
  },

  {
    name: 'teammate_cleanup',
    description: 'Cleanup team resources and save state',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
      },
      required: ['teamName'],
    },
  },

  // ==========================================================================
  // BMSSP Optimization Tools (10-15x faster with WASM)
  // ==========================================================================
  {
    name: 'teammate_enable_optimizers',
    description:
      'Enable BMSSP-powered optimization for team topology and task routing. ' +
      'Uses WebAssembly for 10-15x faster pathfinding and semantic matching.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'teammate_find_optimal_path',
    description:
      'Find optimal message routing path between two teammates using BMSSP graph algorithms.',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string', description: 'Team name' },
        fromId: { type: 'string', description: 'Source teammate ID' },
        toId: { type: 'string', description: 'Target teammate ID' },
      },
      required: ['teamName', 'fromId', 'toId'],
    },
  },

  {
    name: 'teammate_get_topology_stats',
    description:
      'Get topology statistics and optimization suggestions for a team.',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string', description: 'Team name' },
        includeOptimizations: {
          type: 'boolean',
          description: 'Include optimization suggestions (default: true)',
        },
      },
      required: ['teamName'],
    },
  },

  {
    name: 'teammate_route_task',
    description:
      'Route a task to the best-suited teammate using semantic matching ' +
      'based on skills, performance, and neural embeddings.',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string', description: 'Team name' },
        taskId: { type: 'string', description: 'Unique task ID' },
        description: { type: 'string', description: 'Task description' },
        requiredSkills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required skills (e.g., ["typescript", "testing"])',
        },
        priority: {
          type: 'string',
          enum: ['urgent', 'high', 'normal', 'low'],
          description: 'Task priority (default: normal)',
        },
      },
      required: ['teamName', 'taskId', 'description', 'requiredSkills'],
    },
  },

  {
    name: 'teammate_batch_route',
    description:
      'Route multiple tasks to teammates optimally, avoiding over-assignment.',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string', description: 'Team name' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              description: { type: 'string' },
              requiredSkills: { type: 'array', items: { type: 'string' } },
              priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'] },
            },
            required: ['id', 'description', 'requiredSkills'],
          },
          description: 'Tasks to route',
        },
      },
      required: ['teamName', 'tasks'],
    },
  },
];

