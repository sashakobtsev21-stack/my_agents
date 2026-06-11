/**
 * Teammate MCP Tools — parameter validators & dispatcher
 *
 * The param validators and the handleMCPTool dispatcher with ToolResult.
 * Extracted verbatim from mcp-tools.ts (lines 25-56 + 526-898) during
 * campaign-2 wave 21 (W227). mcp-tools.ts stays the barrel; the
 * validators stay unexported from it.
 */

import type { TeammateBridge } from './teammate-bridge.js';
import type {
  TeamConfig,
  TeammateSpawnConfig,
  TeamPlan,
  PlanStep,
  TeleportTarget,
  MessageType,
} from './types.js';
import { MCP_PARAM_LIMITS } from './types.js';

const { MAX_PARAM_LENGTH, MAX_ARRAY_ITEMS } = MCP_PARAM_LIMITS;

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate string parameter
 */
export function validateStringParam(value: unknown, name: string, maxLength: number = MAX_PARAM_LENGTH): string {
  if (typeof value !== 'string') {
    throw new Error(`Parameter '${name}' must be a string`);
  }
  if (value.length > maxLength) {
    throw new Error(`Parameter '${name}' exceeds maximum length of ${maxLength}`);
  }
  return value;
}

/**
 * Validate array parameter
 */
export function validateArrayParam<T>(value: unknown, name: string, maxItems: number = MAX_ARRAY_ITEMS): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Parameter '${name}' must be an array`);
  }
  if (value.length > maxItems) {
    throw new Error(`Parameter '${name}' exceeds maximum of ${maxItems} items`);
  }
  return value as T[];
}


// ============================================================================
// Tool Handler
// ============================================================================

export type ToolResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

export async function handleMCPTool(
  bridge: TeammateBridge,
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  try {
    // Security: Validate tool name
    if (typeof toolName !== 'string' || toolName.length > 100) {
      return { success: false, error: 'Invalid tool name' };
    }

    switch (toolName) {
      // Team Management
      case 'teammate_spawn_team': {
        // Security: Validate required parameters
        const name = validateStringParam(params.name, 'name', 64);
        const config: Partial<TeamConfig> & { name: string } = {
          name,
          topology: (params.topology as TeamConfig['topology']) ?? 'hierarchical',
          maxTeammates: (params.maxTeammates as number) ?? 8,
          planModeRequired: (params.planModeRequired as boolean) ?? false,
          autoApproveJoin: (params.autoApproveJoin as boolean) ?? true,
          delegationEnabled: (params.delegationEnabled as boolean) ?? true,
        };
        const teamState = await bridge.spawnTeam(config);
        return { success: true, data: teamState };
      }

      case 'teammate_discover_teams': {
        const teams = await bridge.discoverTeams();
        return { success: true, data: { teams } };
      }

      case 'teammate_spawn': {
        // Security: Validate required parameters
        const name = validateStringParam(params.name, 'name', 64);
        const role = validateStringParam(params.role, 'role', 64);
        const prompt = validateStringParam(params.prompt, 'prompt', MAX_PARAM_LENGTH);
        const teamName = validateStringParam(params.teamName, 'teamName', 64);
        const allowedTools = params.allowedTools
          ? validateArrayParam<string>(params.allowedTools, 'allowedTools', 50)
          : undefined;

        const spawnConfig: TeammateSpawnConfig = {
          name,
          role,
          prompt,
          teamName,
          model: params.model as TeammateSpawnConfig['model'],
          allowedTools,
          mode: params.mode as TeammateSpawnConfig['mode'],
          delegateAuthority: params.delegateAuthority as boolean,
          runInBackground: true,
        };
        const teammate = await bridge.spawnTeammate(spawnConfig);
        const agentInput = bridge.buildAgentInput(spawnConfig);
        return {
          success: true,
          data: {
            teammate,
            agentInput,
            instruction: 'Pass agentInput to Claude Code Task tool to spawn the teammate',
          },
        };
      }

      // Messaging
      case 'teammate_send_message': {
        const message = await bridge.sendMessage(
          params.teamName as string,
          params.fromId as string,
          params.toId as string,
          {
            type: params.type as MessageType,
            payload: params.payload,
            priority: params.priority as any,
          }
        );
        return { success: true, data: { message } };
      }

      case 'teammate_broadcast': {
        const message = await bridge.broadcast(
          params.teamName as string,
          params.fromId as string,
          {
            type: params.type as MessageType,
            payload: params.payload,
            priority: params.priority as any,
          }
        );
        return { success: true, data: { message } };
      }

      // Plan Management
      case 'teammate_submit_plan': {
        const team = bridge.getTeamState(params.teamName as string);
        const requiredApprovals = (params.requiredApprovals as number) ??
          Math.ceil((team?.teammates.length ?? 1) / 2);

        const plan = await bridge.submitPlan(params.teamName as string, {
          description: params.description as string,
          proposedBy: params.proposedBy as string,
          steps: params.steps as PlanStep[],
          requiredApprovals,
        });
        return { success: true, data: { plan } };
      }

      case 'teammate_approve_plan': {
        await bridge.approvePlan(
          params.teamName as string,
          params.planId as string,
          params.approverId as string
        );
        const team = bridge.getTeamState(params.teamName as string);
        const plan = team?.activePlans.find(p => p.id === params.planId);
        return { success: true, data: { plan } };
      }

      case 'teammate_launch_swarm': {
        const exitPlanInput = await bridge.launchSwarm(
          params.teamName as string,
          params.planId as string,
          params.teammateCount as number
        );
        return {
          success: true,
          data: {
            exitPlanInput,
            instruction: 'Use exitPlanInput with ExitPlanMode tool to launch the swarm',
          },
        };
      }

      // Delegation
      case 'teammate_delegate': {
        const delegation = await bridge.delegateToTeammate(
          params.teamName as string,
          params.fromId as string,
          params.toId as string,
          params.permissions as string[]
        );
        return { success: true, data: { delegation } };
      }

      // Context & Memory
      case 'teammate_update_context': {
        const context = await bridge.updateTeamContext(params.teamName as string, {
          sharedVariables: params.sharedVariables as Record<string, unknown>,
          inheritedPermissions: params.inheritedPermissions as string[],
          workingDirectory: params.workingDirectory as string,
          environmentVariables: params.environmentVariables as Record<string, string>,
        });
        return { success: true, data: { context } };
      }

      case 'teammate_save_memory': {
        await bridge.saveTeammateMemory(
          params.teamName as string,
          params.teammateId as string
        );
        return { success: true, data: { saved: true } };
      }

      case 'teammate_share_transcript': {
        await bridge.shareTranscript(
          params.teamName as string,
          params.fromId as string,
          params.toId as string,
          {
            start: params.start as number,
            end: params.end as number,
          }
        );
        return { success: true, data: { shared: true } };
      }

      // Remote & Teleport
      case 'teammate_push_remote': {
        const remoteSession = await bridge.pushTeamToRemote(params.teamName as string);
        return { success: true, data: { remoteSession } };
      }

      case 'teammate_teleport': {
        const target: TeleportTarget = {
          workingDirectory: params.workingDirectory as string,
          gitRepo: params.gitRepo as string,
          gitBranch: params.gitBranch as string,
          sessionId: params.sessionId as string,
        };
        const result = await bridge.teleportTeam(params.teamName as string, target);
        return { success: result.success, data: result };
      }

      // Status & Cleanup
      case 'teammate_get_status': {
        const teamState = bridge.getTeamState(params.teamName as string);
        if (!teamState) {
          return { success: false, error: `Team not found: ${params.teamName}` };
        }
        const backendStatus = await bridge.getBackendStatus();
        return {
          success: true,
          data: {
            team: teamState,
            backends: backendStatus,
            version: bridge.getVersionInfo(),
          },
        };
      }

      case 'teammate_cleanup': {
        await bridge.cleanup(params.teamName as string);
        return { success: true, data: { cleaned: true } };
      }

      // BMSSP Optimization Tools
      case 'teammate_enable_optimizers': {
        const wasmAvailable = await bridge.enableOptimizers();
        return {
          success: true,
          data: {
            enabled: true,
            wasmAccelerated: wasmAvailable,
            message: wasmAvailable
              ? 'BMSSP WASM optimization enabled (10-15x faster)'
              : 'Optimization enabled with JavaScript fallback',
          },
        };
      }

      case 'teammate_find_optimal_path': {
        if (!bridge.areOptimizersEnabled()) {
          return {
            success: false,
            error: 'Optimizers not enabled. Call teammate_enable_optimizers first.',
          };
        }

        const teamName = validateStringParam(params.teamName, 'teamName', 64);
        const fromId = validateStringParam(params.fromId, 'fromId', 64);
        const toId = validateStringParam(params.toId, 'toId', 64);

        const pathResult = await bridge.findOptimalPath(teamName, fromId, toId);
        if (!pathResult) {
          return { success: false, error: 'No path found between teammates' };
        }

        return { success: true, data: { path: pathResult } };
      }

      case 'teammate_get_topology_stats': {
        const teamName = validateStringParam(params.teamName, 'teamName', 64);
        const includeOptimizations = params.includeOptimizations !== false;

        const stats = bridge.getTopologyStats(teamName);
        if (!stats) {
          return {
            success: false,
            error: bridge.areOptimizersEnabled()
              ? `Team not found: ${teamName}`
              : 'Optimizers not enabled. Call teammate_enable_optimizers first.',
          };
        }

        const result: Record<string, unknown> = { stats };

        if (includeOptimizations) {
          const optimizations = bridge.getTopologyOptimizations(teamName);
          if (optimizations) {
            result.optimizations = optimizations;
          }
        }

        return { success: true, data: result };
      }

      case 'teammate_route_task': {
        if (!bridge.areOptimizersEnabled()) {
          return {
            success: false,
            error: 'Optimizers not enabled. Call teammate_enable_optimizers first.',
          };
        }

        const teamName = validateStringParam(params.teamName, 'teamName', 64);
        const taskId = validateStringParam(params.taskId, 'taskId', 64);
        const description = validateStringParam(params.description, 'description', MAX_PARAM_LENGTH);
        const requiredSkills = validateArrayParam<string>(params.requiredSkills, 'requiredSkills', 20);

        const decision = await bridge.findBestTeammateForTask(teamName, {
          id: taskId,
          description,
          requiredSkills,
          priority: (params.priority as 'urgent' | 'high' | 'normal' | 'low') ?? 'normal',
        });

        if (!decision) {
          return { success: false, error: 'Could not determine routing decision' };
        }

        return {
          success: true,
          data: {
            decision,
            selectedTeammate: decision.selectedTeammate,
            alternates: decision.alternates,
            instruction: decision.selectedTeammate
              ? `Route task to teammate "${decision.selectedTeammate}"`
              : 'No suitable teammate found with sufficient confidence',
          },
        };
      }

      case 'teammate_batch_route': {
        if (!bridge.areOptimizersEnabled()) {
          return {
            success: false,
            error: 'Optimizers not enabled. Call teammate_enable_optimizers first.',
          };
        }

        const teamName = validateStringParam(params.teamName, 'teamName', 64);
        const tasks = validateArrayParam<{
          id: string;
          description: string;
          requiredSkills: string[];
          priority?: 'urgent' | 'high' | 'normal' | 'low';
        }>(params.tasks, 'tasks', 50);

        const decisions = await bridge.batchRouteTasksToTeammates(teamName, tasks);

        // Convert Map to object for JSON serialization
        const results: Record<string, unknown> = {};
        for (const [taskId, decision] of decisions) {
          results[taskId] = {
            selectedTeammate: decision.selectedTeammate,
            confidence: decision.matches[0]?.confidence ?? 0,
            alternates: decision.alternates,
          };
        }

        return {
          success: true,
          data: {
            routingResults: results,
            tasksRouted: decisions.size,
          },
        };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

