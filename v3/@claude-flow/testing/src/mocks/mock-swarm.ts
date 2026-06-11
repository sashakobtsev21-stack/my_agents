/**
 * Mock Services — swarm coordinator & agent
 *
 * Extracted verbatim from mock-services.ts (lines 110-375) during
 * campaign-2 wave 57 (W263). mock-services.ts stays the barrel.
 */

import { vi, type Mock } from 'vitest';
import { agentCapabilities } from './mock-service-types.js';
import type {
  AgentConfig,
  ConsensusRequest,
  ConsensusResponse,
  SwarmInitConfig,
  SwarmMessage,
  SwarmState,
  SwarmTask,
  TaskResult,
} from './mock-service-types.js';

export class MockSwarmCoordinator {
  private agents = new Map<string, MockSwarmAgent>();
  private state: SwarmState = {
    id: `swarm-${Date.now()}`,
    topology: 'hierarchical-mesh',
    status: 'idle',
    agentCount: 0,
    activeAgentCount: 0,
    leaderId: undefined,
    createdAt: new Date(),
  };
  private messageQueue: SwarmMessage[] = [];
  private taskQueue: SwarmTask[] = [];

  initialize = vi.fn(async (config: SwarmInitConfig) => {
    this.state = {
      ...this.state,
      topology: config.topology ?? 'hierarchical-mesh',
      status: 'active',
    };
    return this.state;
  });

  shutdown = vi.fn(async (graceful: boolean = true) => {
    if (graceful) {
      // Complete pending tasks
      await Promise.all(
        Array.from(this.agents.values()).map(agent => agent.terminate())
      );
    }
    this.state.status = 'shutdown';
    this.agents.clear();
  });

  addAgent = vi.fn(async (config: AgentConfig) => {
    const id = `agent-${config.type}-${Date.now()}`;
    const agent = new MockSwarmAgent(id, config);
    this.agents.set(id, agent);
    this.state.agentCount++;
    this.state.activeAgentCount++;

    if (config.type === 'queen-coordinator' && !this.state.leaderId) {
      this.state.leaderId = id;
    }

    return agent;
  });

  removeAgent = vi.fn(async (agentId: string) => {
    const agent = this.agents.get(agentId);
    if (agent) {
      await agent.terminate();
      this.agents.delete(agentId);
      this.state.agentCount--;
      this.state.activeAgentCount--;

      if (this.state.leaderId === agentId) {
        this.electNewLeader();
      }
    }
  });

  coordinate = vi.fn(async (task: SwarmTask) => {
    this.taskQueue.push(task);

    // Find suitable agents
    const suitableAgents = Array.from(this.agents.values())
      .filter(agent => agent.canHandle(task.type))
      .sort((a, b) => b.priority - a.priority);

    if (suitableAgents.length === 0) {
      return {
        success: false,
        error: 'No suitable agents available',
        taskId: task.id,
        duration: 0,
      };
    }

    const startTime = Date.now();
    const results: TaskResult[] = [];

    for (const agent of suitableAgents.slice(0, task.maxAgents ?? 1)) {
      const result = await agent.execute(task);
      results.push(result);
    }

    return {
      success: results.every(r => r.success),
      taskId: task.id,
      duration: Date.now() - startTime,
      results,
    };
  });

  broadcast = vi.fn(async (message: Omit<SwarmMessage, 'id' | 'timestamp'>) => {
    const fullMessage: SwarmMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      timestamp: new Date(),
      to: 'broadcast',
    };
    this.messageQueue.push(fullMessage);

    for (const agent of this.agents.values()) {
      await agent.receive(fullMessage);
    }
  });

  sendMessage = vi.fn(async (message: SwarmMessage) => {
    this.messageQueue.push(message);

    if (message.to === 'broadcast') {
      for (const agent of this.agents.values()) {
        await agent.receive(message);
      }
    } else {
      const agent = this.agents.get(message.to);
      if (agent) {
        await agent.receive(message);
      }
    }
  });

  requestConsensus = vi.fn(async <T>(request: ConsensusRequest<T>): Promise<ConsensusResponse<T>> => {
    const voters = request.voters ?? Array.from(this.agents.keys());
    const votes = new Map<string, T>();

    for (const voterId of voters) {
      const agent = this.agents.get(voterId);
      if (agent) {
        // Simulate voting - random selection
        const vote = request.options[Math.floor(Math.random() * request.options.length)];
        votes.set(voterId, vote);
      }
    }

    const voteCounts = new Map<string, number>();
    for (const vote of votes.values()) {
      const key = JSON.stringify(vote);
      voteCounts.set(key, (voteCounts.get(key) ?? 0) + 1);
    }

    const majority = Math.floor(voters.length / 2) + 1;
    let decision: T | null = null;
    let consensus = false;

    for (const [key, count] of voteCounts) {
      if (count >= majority) {
        decision = JSON.parse(key);
        consensus = true;
        break;
      }
    }

    return {
      topic: request.topic,
      decision,
      votes,
      consensus,
      votingDuration: 100,
      participatingAgents: Array.from(votes.keys()),
    };
  });

  getState = vi.fn(() => ({ ...this.state }));

  getAgent = vi.fn((id: string) => this.agents.get(id));

  getAgents = vi.fn(() => Array.from(this.agents.values()));

  getMessageQueue = vi.fn(() => [...this.messageQueue]);

  getTaskQueue = vi.fn(() => [...this.taskQueue]);

  private electNewLeader(): void {
    const candidates = Array.from(this.agents.values())
      .filter(a => a.config.type === 'queen-coordinator')
      .sort((a, b) => b.priority - a.priority);

    this.state.leaderId = candidates[0]?.id;
  }

  reset(): void {
    this.agents.clear();
    this.messageQueue = [];
    this.taskQueue = [];
    this.state = {
      id: `swarm-${Date.now()}`,
      topology: 'hierarchical-mesh',
      status: 'idle',
      agentCount: 0,
      activeAgentCount: 0,
      leaderId: undefined,
      createdAt: new Date(),
    };
    vi.clearAllMocks();
  }
}

/**
 * Mock Swarm Agent
 */
export class MockSwarmAgent {
  readonly id: string;
  readonly config: AgentConfig;
  status: 'idle' | 'busy' | 'terminated' = 'idle';
  priority: number;
  private messages: SwarmMessage[] = [];
  private taskResults: TaskResult[] = [];

  execute: Mock = vi.fn();
  receive: Mock = vi.fn();
  send: Mock = vi.fn();
  terminate: Mock = vi.fn();

  constructor(id: string, config: AgentConfig) {
    this.id = id;
    this.config = config;
    this.priority = config.priority ?? 50;

    this.execute.mockImplementation(async (task: SwarmTask) => {
      this.status = 'busy';
      await new Promise(resolve => setTimeout(resolve, 10));
      this.status = 'idle';

      const result: TaskResult = {
        taskId: task.id,
        agentId: this.id,
        success: true,
        duration: Math.random() * 100 + 10,
      };
      this.taskResults.push(result);
      return result;
    });

    this.receive.mockImplementation(async (message: SwarmMessage) => {
      this.messages.push(message);
    });

    this.send.mockImplementation(async () => {});

    this.terminate.mockImplementation(async () => {
      this.status = 'terminated';
    });
  }

  canHandle(taskType: string): boolean {
    const capabilities = agentCapabilities[this.config.type] ?? [];
    return capabilities.some(cap =>
      cap.includes(taskType) || taskType.includes(cap)
    );
  }

  getMessages(): SwarmMessage[] {
    return [...this.messages];
  }

  getTaskResults(): TaskResult[] {
    return [...this.taskResults];
  }
}

/**
 * Mock Memory Service with caching
 */
