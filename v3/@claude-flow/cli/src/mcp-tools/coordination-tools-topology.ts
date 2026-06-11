/**
 * Coordination MCP Tools — topology/balance/sync group
 *
 * Extracted verbatim from coordination-tools.ts (lines 133-454) during
 * campaign-2 wave 48 (W254); module-private group const.
 */

import type { MCPTool } from './types.js';
import { validateIdentifier, validateText } from './validate-input.js';
import {
  loadCoordStore,
  saveCoordStore,
} from './coordination-tools-store.js';
import type {
  LoadBalanceConfig,
  TopologyConfig,
} from './coordination-tools-store.js';

export const coordinationTopologyTools: MCPTool[] = [
  {
    name: 'coordination_topology',
    description: 'Configure swarm topology Use when native Task is wrong because the work crosses multiple agents that need to vote/sync/load-balance — TodoWrite + a single Task cannot orchestrate consensus. For one-off subtask dispatch, native Task is fine.',
    category: 'coordination',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'set', 'optimize'], description: 'Action to perform' },
        type: { type: 'string', enum: ['mesh', 'hierarchical', 'ring', 'star', 'hybrid', 'hierarchical-mesh'], description: 'Topology type' },
        maxNodes: { type: 'number', description: 'Maximum nodes' },
        redundancy: { type: 'number', description: 'Redundancy level' },
        consensusAlgorithm: { type: 'string', enum: ['raft', 'byzantine', 'gossip', 'crdt'], description: 'Consensus algorithm' },
      },
    },
    handler: async (input) => {
      const store = loadCoordStore();
      const action = (input.action as string) || 'get';

      if (action === 'get') {
        return {
          success: true,
          topology: store.topology,
          nodes: Object.keys(store.nodes).length,
          status: 'active',
        };
      }

      if (action === 'set') {
        if (input.type) store.topology.type = input.type as TopologyConfig['type'];
        if (input.maxNodes) store.topology.maxNodes = input.maxNodes as number;
        if (input.redundancy) store.topology.redundancy = input.redundancy as number;
        if (input.consensusAlgorithm) store.topology.consensusAlgorithm = input.consensusAlgorithm as string;

        saveCoordStore(store);

        return {
          success: true,
          action: 'updated',
          topology: store.topology,
        };
      }

      if (action === 'optimize') {
        // Analyze current state and suggest optimal topology
        const nodeCount = Object.keys(store.nodes).length;
        let recommended: TopologyConfig['type'] = 'hierarchical';

        if (nodeCount <= 5) {
          recommended = 'mesh';
        } else if (nodeCount <= 15) {
          recommended = 'hierarchical';
        } else {
          recommended = 'hybrid';
        }

        return {
          success: true,
          action: 'optimize',
          current: store.topology.type,
          recommended,
          reason: nodeCount <= 5
            ? 'Small cluster benefits from full mesh connectivity'
            : nodeCount <= 15
              ? 'Medium cluster works well with hierarchical coordination'
              : 'Large cluster needs hybrid approach for scalability',
        };
      }

      return { success: false, error: 'Unknown action' };
    },
  },
  {
    name: 'coordination_load_balance',
    description: 'Configure load balancing Use when native Task is wrong because the work crosses multiple agents that need to vote/sync/load-balance — TodoWrite + a single Task cannot orchestrate consensus. For one-off subtask dispatch, native Task is fine.',
    category: 'coordination',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'set', 'distribute'], description: 'Action to perform' },
        algorithm: { type: 'string', enum: ['round-robin', 'least-connections', 'weighted', 'adaptive'], description: 'Algorithm' },
        weights: { type: 'object', description: 'Node weights' },
        task: { type: 'string', description: 'Task to distribute' },
      },
    },
    handler: async (input) => {
      if (input.task) { const vTask = validateText(input.task, 'task'); if (!vTask.valid) return { success: false, error: vTask.error }; }
      const store = loadCoordStore();
      const action = (input.action as string) || 'get';

      if (action === 'get') {
        const nodes = Object.values(store.nodes);
        const avgLoad = nodes.length > 0
          ? nodes.reduce((sum, n) => sum + n.load, 0) / nodes.length
          : 0;

        return {
          success: true,
          loadBalance: store.loadBalance,
          metrics: {
            nodeCount: nodes.length,
            avgLoad,
            maxLoad: nodes.length > 0 ? Math.max(...nodes.map(n => n.load)) : 0,
            minLoad: nodes.length > 0 ? Math.min(...nodes.map(n => n.load)) : 0,
          },
        };
      }

      if (action === 'set') {
        if (input.algorithm) store.loadBalance.algorithm = input.algorithm as LoadBalanceConfig['algorithm'];
        if (input.weights) store.loadBalance.weights = input.weights as Record<string, number>;

        saveCoordStore(store);

        return {
          success: true,
          action: 'updated',
          loadBalance: store.loadBalance,
        };
      }

      if (action === 'distribute') {
        const task = input.task as string;
        const nodes = Object.values(store.nodes).filter(n => n.status === 'active');

        if (nodes.length === 0) {
          return { success: false, error: 'No active nodes available' };
        }

        // Select node based on algorithm
        let selectedNode: typeof nodes[0];
        const algorithm = store.loadBalance.algorithm;

        if (algorithm === 'least-connections' || algorithm === 'adaptive') {
          selectedNode = nodes.reduce((min, n) => n.load < min.load ? n : min);
        } else if (algorithm === 'weighted') {
          const weights = store.loadBalance.weights;
          selectedNode = nodes.reduce((max, n) => (weights[n.id] || 1) > (weights[max.id] || 1) ? n : max);
        } else {
          // Round robin - just pick first active
          selectedNode = nodes[0];
        }

        // Update load
        selectedNode.load += 1;
        saveCoordStore(store);

        return {
          success: true,
          action: 'distributed',
          task,
          assignedTo: selectedNode.id,
          algorithm,
          nodeLoad: selectedNode.load,
        };
      }

      return { success: false, error: 'Unknown action' };
    },
  },
  {
    name: 'coordination_sync',
    description: 'Synchronize state across nodes Use when native Task is wrong because the work crosses multiple agents that need to vote/sync/load-balance — TodoWrite + a single Task cannot orchestrate consensus. For one-off subtask dispatch, native Task is fine.',
    category: 'coordination',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'trigger', 'resolve'], description: 'Action to perform' },
        force: { type: 'boolean', description: 'Force synchronization' },
        conflictResolution: { type: 'string', enum: ['latest', 'merge', 'manual'], description: 'Conflict resolution strategy' },
      },
    },
    handler: async (input) => {
      const store = loadCoordStore();
      const action = (input.action as string) || 'status';

      if (action === 'status') {
        const timeSinceSync = Date.now() - new Date(store.sync.lastSync).getTime();

        return {
          success: true,
          sync: store.sync,
          timeSinceSync: `${Math.floor(timeSinceSync / 1000)}s`,
          status: store.sync.conflicts > 0 ? 'conflicts' : store.sync.pendingChanges > 0 ? 'pending' : 'synced',
        };
      }

      if (action === 'trigger') {
        store.sync.syncCount++;
        store.sync.lastSync = new Date().toISOString();
        store.sync.pendingChanges = 0;

        // Simulate sync
        await new Promise(resolve => setTimeout(resolve, 50));

        saveCoordStore(store);

        return {
          success: true,
          action: 'synchronized',
          syncCount: store.sync.syncCount,
          syncedAt: store.sync.lastSync,
          nodesSync: Object.keys(store.nodes).length,
        };
      }

      if (action === 'resolve') {
        const strategy = (input.conflictResolution as string) || 'latest';

        if (store.sync.conflicts > 0) {
          const resolved = store.sync.conflicts;
          store.sync.conflicts = 0;
          saveCoordStore(store);

          return {
            success: true,
            action: 'resolved',
            strategy,
            conflictsResolved: resolved,
          };
        }

        return {
          success: true,
          action: 'resolve',
          message: 'No conflicts to resolve',
        };
      }

      return { success: false, error: 'Unknown action' };
    },
  },
  {
    name: 'coordination_node',
    description: 'Manage coordination nodes Use when native Task is wrong because the work crosses multiple agents that need to vote/sync/load-balance — TodoWrite + a single Task cannot orchestrate consensus. For one-off subtask dispatch, native Task is fine.',
    category: 'coordination',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'add', 'remove', 'heartbeat'], description: 'Action to perform' },
        nodeId: { type: 'string', description: 'Node ID' },
        status: { type: 'string', description: 'Node status' },
      },
    },
    handler: async (input) => {
      if (input.nodeId) { const vNode = validateIdentifier(input.nodeId, 'nodeId'); if (!vNode.valid) return { success: false, error: vNode.error }; }
      const store = loadCoordStore();
      const action = (input.action as string) || 'list';

      if (action === 'list') {
        const nodes = Object.values(store.nodes);

        return {
          success: true,
          nodes: nodes.map(n => ({
            id: n.id,
            status: n.status,
            load: n.load,
            lastHeartbeat: n.lastHeartbeat,
          })),
          total: nodes.length,
          active: nodes.filter(n => n.status === 'active').length,
        };
      }

      if (action === 'add') {
        const nodeId = (input.nodeId as string) || `node-${Date.now()}`;

        store.nodes[nodeId] = {
          id: nodeId,
          status: 'active',
          load: 0,
          lastHeartbeat: new Date().toISOString(),
        };

        saveCoordStore(store);

        return {
          success: true,
          action: 'added',
          nodeId,
          totalNodes: Object.keys(store.nodes).length,
        };
      }

      if (action === 'remove') {
        const nodeId = input.nodeId as string;

        if (!store.nodes[nodeId]) {
          return { success: false, error: 'Node not found' };
        }

        delete store.nodes[nodeId];
        saveCoordStore(store);

        return {
          success: true,
          action: 'removed',
          nodeId,
          totalNodes: Object.keys(store.nodes).length,
        };
      }

      if (action === 'heartbeat') {
        const nodeId = input.nodeId as string;

        if (store.nodes[nodeId]) {
          store.nodes[nodeId].lastHeartbeat = new Date().toISOString();
          store.nodes[nodeId].status = 'active';
          saveCoordStore(store);
        }

        return {
          success: true,
          action: 'heartbeat',
          nodeId,
          timestamp: new Date().toISOString(),
        };
      }

      return { success: false, error: 'Unknown action' };
    },
  },
];
