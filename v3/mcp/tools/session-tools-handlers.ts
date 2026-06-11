/**
 * V3 MCP Session Tools — handlers
 *
 * Extracted verbatim from session-tools.ts (lines 247-667) during
 * campaign-2 wave 42 (W248); NOT re-exported by the barrel.
 */

import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ToolContext } from '../types.js';
import {
  saveSessionSchema,
  restoreSessionSchema,
  listSessionsSchema,
  sessionStore,
  calculateChecksum,
  validateSessionId,
  getSessionPath,
  ensureSessionDir,
  DEFAULT_SESSION_DIR,
  generateSecureSessionId,
} from './session-tools-support.js';
import type {
  SessionData,
  ListSessionsResult,
  RestoreSessionResult,
  SaveSessionResult,
  SessionSummary,
} from './session-tools-support.js';

// Tool Handlers
// ============================================================================

/**
 * Save current session
 */
export async function handleSaveSession(
  input: z.infer<typeof saveSessionSchema>,
  context?: ToolContext
): Promise<SaveSessionResult> {
  const sessionId = generateSecureSessionId();
  const savedAt = new Date().toISOString();
  const name = input.name || `Session ${new Date().toLocaleDateString()}`;

  const sessionData: SessionData = {
    id: sessionId,
    name,
    description: input.description,
    version: '3.0.0',
    createdAt: savedAt,
    tags: input.tags,
    metadata: input.metadata,
  };

  // Collect agent states
  if (input.includeAgents && context?.swarmCoordinator) {
    try {
      const coordinator = context.swarmCoordinator as any;
      const status = await coordinator.getStatus();

      sessionData.agents = (status.agents || []).map((agent: any) => ({
        id: agent.id,
        type: agent.type,
        status: agent.status,
        config: agent.config,
        metadata: agent.metadata,
      }));
    } catch (error) {
      console.error('Failed to collect agent states:', error);
      sessionData.agents = [];
    }
  }

  // Collect task queue
  if (input.includeTasks && context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;
      const tasks = await orchestrator.listTasks({ limit: 10000 });

      sessionData.tasks = tasks.tasks.map((task: any) => ({
        id: task.id,
        type: task.type,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dependencies: task.dependencies || [],
        assignedTo: task.assignedAgent,
        input: task.input,
        metadata: task.metadata,
      }));
    } catch (error) {
      console.error('Failed to collect task queue:', error);
      sessionData.tasks = [];
    }
  }

  // Collect memory entries
  if (input.includeMemory) {
    const resourceManager = context?.resourceManager as any;
    if (resourceManager?.memoryService) {
      try {
        const memoryService = resourceManager.memoryService;
        const entries = await memoryService.query({ limit: 10000 });

        sessionData.memory = entries.map((entry: any) => ({
          id: entry.id,
          content: entry.content,
          type: entry.type,
          category: entry.namespace,
          tags: entry.tags,
          importance: entry.metadata?.importance,
          metadata: entry.metadata,
        }));
      } catch (error) {
        console.error('Failed to collect memory entries:', error);
        sessionData.memory = [];
      }
    }
  }

  // Collect swarm state
  if (input.includeSwarmState && context?.swarmCoordinator) {
    try {
      const coordinator = context.swarmCoordinator as any;
      const status = await coordinator.getStatus();

      sessionData.swarmState = {
        topology: status.topology?.type || 'hierarchical-mesh',
        agents: status.agents?.length || 0,
        connections: status.topology?.edges || [],
        consensus: status.consensus,
      };
    } catch (error) {
      console.error('Failed to collect swarm state:', error);
    }
  }

  // Calculate checksum
  const dataStr = JSON.stringify(sessionData);
  sessionData.checksum = calculateChecksum(dataStr);

  // Save to store
  sessionStore.set(sessionId, sessionData);

  // Try to persist to file
  let filePath: string | undefined;
  try {
    await ensureSessionDir();
    filePath = getSessionPath(sessionId);
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to persist session to file:', error);
  }

  return {
    sessionId,
    name,
    savedAt,
    size: dataStr.length,
    agentCount: sessionData.agents?.length,
    taskCount: sessionData.tasks?.length,
    memoryCount: sessionData.memory?.length,
    path: filePath,
  };
}

/**
 * Restore session
 */
export async function handleRestoreSession(
  input: z.infer<typeof restoreSessionSchema>,
  context?: ToolContext
): Promise<RestoreSessionResult> {
  const restoredAt = new Date().toISOString();
  const errors: string[] = [];
  const restored = {
    agents: 0,
    tasks: 0,
    memory: 0,
    swarmState: false,
  };

  // Try to load from store or file
  let sessionData = sessionStore.get(input.sessionId);

  if (!sessionData) {
    try {
      const filePath = getSessionPath(input.sessionId);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      sessionData = JSON.parse(fileContent) as SessionData;

      // Verify checksum
      const { checksum, ...dataWithoutChecksum } = sessionData;
      const calculatedChecksum = calculateChecksum(JSON.stringify(dataWithoutChecksum));
      if (checksum && checksum !== calculatedChecksum) {
        errors.push('Session checksum mismatch - data may be corrupted');
      }
    } catch (error) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }
  }

  // Clear existing state if requested
  if (input.clearExisting) {
    if (context?.swarmCoordinator) {
      try {
        const coordinator = context.swarmCoordinator as any;
        if (coordinator.terminateAll) {
          await coordinator.terminateAll();
        }
      } catch (error) {
        errors.push('Failed to clear existing agents');
      }
    }

    if (context?.orchestrator) {
      try {
        const orchestrator = context.orchestrator as any;
        if (orchestrator.cancelAll) {
          await orchestrator.cancelAll();
        }
      } catch (error) {
        errors.push('Failed to clear existing tasks');
      }
    }
  }

  // Restore agents
  if (input.restoreAgents && sessionData.agents && context?.swarmCoordinator) {
    try {
      const coordinator = context.swarmCoordinator as any;

      for (const agent of sessionData.agents) {
        try {
          await coordinator.spawnAgent({
            id: agent.id,
            type: agent.type,
            config: agent.config,
            metadata: agent.metadata,
          });
          restored.agents++;
        } catch (error) {
          errors.push(`Failed to restore agent ${agent.id}`);
        }
      }
    } catch (error) {
      errors.push('Failed to restore agents: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // Restore tasks
  if (input.restoreTasks && sessionData.tasks && context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;

      for (const task of sessionData.tasks) {
        // Only restore pending/queued tasks
        if (task.status === 'pending' || task.status === 'queued' || task.status === 'assigned') {
          try {
            await orchestrator.submitTask({
              id: task.id,
              type: task.type,
              description: task.description,
              priority: task.priority,
              dependencies: task.dependencies,
              assignedAgent: task.assignedTo,
              input: task.input,
              metadata: task.metadata,
            });
            restored.tasks++;
          } catch (error) {
            errors.push(`Failed to restore task ${task.id}`);
          }
        }
      }
    } catch (error) {
      errors.push('Failed to restore tasks: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // Restore memory
  if (input.restoreMemory && sessionData.memory) {
    const resourceManager = context?.resourceManager as any;
    if (resourceManager?.memoryService) {
      try {
        const memoryService = resourceManager.memoryService;

        for (const entry of sessionData.memory) {
          try {
            await memoryService.storeEntry({
              namespace: entry.category || 'default',
              key: entry.id,
              content: entry.content,
              type: entry.type,
              tags: entry.tags || [],
              metadata: {
                ...entry.metadata,
                importance: entry.importance,
                restoredFrom: input.sessionId,
              },
            });
            restored.memory++;
          } catch (error) {
            errors.push(`Failed to restore memory entry ${entry.id}`);
          }
        }
      } catch (error) {
        errors.push('Failed to restore memory: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }

  // Restore swarm state
  if (input.restoreSwarmState && sessionData.swarmState && context?.swarmCoordinator) {
    try {
      const coordinator = context.swarmCoordinator as any;

      if (coordinator.setTopology) {
        await coordinator.setTopology({
          type: sessionData.swarmState.topology,
          connections: sessionData.swarmState.connections,
        });
        restored.swarmState = true;
      }
    } catch (error) {
      errors.push('Failed to restore swarm state: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  return {
    sessionId: input.sessionId,
    restoredAt,
    success: errors.length === 0,
    restored,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * List available sessions
 */
export async function handleListSessions(
  input: z.infer<typeof listSessionsSchema>,
  context?: ToolContext
): Promise<ListSessionsResult> {
  const sessions: SessionSummary[] = [];

  // Collect sessions from store
  for (const [id, data] of Array.from(sessionStore.entries())) {
    sessions.push({
      id,
      name: data.name,
      description: data.description,
      createdAt: data.createdAt,
      size: JSON.stringify(data).length,
      agentCount: data.agents?.length || 0,
      taskCount: data.tasks?.length || 0,
      memoryCount: data.memory?.length || 0,
      tags: data.tags,
      metadata: input.includeMetadata ? data.metadata : undefined,
    });
  }

  // Try to load sessions from file system
  try {
    const dir = path.join(process.cwd(), DEFAULT_SESSION_DIR);
    const files = await fs.readdir(dir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const sessionId = file.replace('.json', '');
      if (sessionStore.has(sessionId)) continue; // Already loaded

      try {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as SessionData;

        sessions.push({
          id: data.id,
          name: data.name,
          description: data.description,
          createdAt: data.createdAt,
          size: stat.size,
          agentCount: data.agents?.length || 0,
          taskCount: data.tasks?.length || 0,
          memoryCount: data.memory?.length || 0,
          tags: data.tags,
          metadata: input.includeMetadata ? data.metadata : undefined,
        });
      } catch (error) {
        // Skip invalid session files
        console.error(`Failed to read session file ${file}:`, error);
      }
    }
  } catch (error) {
    // Session directory may not exist
  }

  // Apply tag filter
  let filteredSessions = sessions;
  if (input.tags && input.tags.length > 0) {
    filteredSessions = sessions.filter(s =>
      input.tags!.every(tag => s.tags?.includes(tag))
    );
  }

  // Apply sorting
  filteredSessions.sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    switch (input.sortBy) {
      case 'created':
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
        break;
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'size':
        aVal = a.size;
        bVal = b.size;
        break;
      default:
        aVal = 0;
        bVal = 0;
    }

    if (input.sortOrder === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });

  const total = filteredSessions.length;
  const paginated = filteredSessions.slice(input.offset, input.offset + input.limit);

  return {
    sessions: paginated,
    total,
    limit: input.limit,
    offset: input.offset,
  };
}

// ============================================================================
