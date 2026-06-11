/**
 * Queen Coordinator - Central Orchestrator for 15-Agent Swarm
 *
 * The Queen Coordinator is the strategic decision-maker for the V3 hive-mind system.
 * It analyzes tasks, delegates to appropriate agents, monitors swarm health,
 * coordinates consensus, and learns from outcomes using ReasoningBank patterns.
 *
 * Features:
 * - Strategic task analysis with ReasoningBank pattern matching
 * - Agent delegation with capability scoring and load balancing
 * - Swarm health monitoring with bottleneck detection
 * - Consensus coordination (majority, weighted, unanimous)
 * - Learning from outcomes for continuous improvement
 *
 * Performance Targets:
 * - Task analysis: <50ms
 * - Agent scoring: <20ms
 * - Consensus coordination: <100ms
 * - Health check: <30ms
 *
 * @module @claude-flow/swarm/queen-coordinator
 */

import { EventEmitter } from 'events';
import type {
  AgentState,
  AgentType,
  TaskDefinition,
  TaskType,
  TaskPriority,
  CoordinatorMetrics,
  ConsensusResult,
} from './types.js';
import type { AgentDomain, DomainStatus } from './unified-coordinator.js';

// The task-analysis/delegation/health/consensus/learning types, the
// dependency interfaces, and DEFAULT_CONFIG were extracted into
// ./queen-coordinator-types.ts during the P3.50 god-file decomposition
// (W171). Import what the class uses + re-export the original public
// surface; DEFAULT_CONFIG stays module-private to this surface.
import { DEFAULT_CONFIG } from './queen-coordinator-types.js';
import type {
  TaskAnalysis,
  SubTask,
  MatchedPattern,
  ResourceRequirements,
  DelegationPlan,
  AgentAssignment,
  ParallelAssignment,
  ExecutionStrategy,
  AgentScore,
  HealthReport,
  DomainHealthStatus,
  AgentHealthEntry,
  Bottleneck,
  HealthAlert,
  HealthMetrics,
  Decision,
  DecisionType,
  TaskResult,
  QueenCoordinatorConfig,
  ISwarmCoordinator,
  INeuralLearningSystem,
  IMemoryService,
} from './queen-coordinator-types.js';

export type {
  TaskAnalysis,
  SubTask,
  MatchedPattern,
  ResourceRequirements,
  DelegationPlan,
  AgentAssignment,
  ParallelAssignment,
  ExecutionStrategy,
  AgentScore,
  HealthReport,
  DomainHealthStatus,
  AgentHealthEntry,
  Bottleneck,
  HealthAlert,
  HealthMetrics,
  Decision,
  DecisionType,
  ConsensusType,
  TaskResult,
  TaskMetrics,
  QueenCoordinatorConfig,
  ISwarmCoordinator,
  INeuralLearningSystem,
  PatternMatchResult,
  MemoryRetrievalResult,
  IMemoryService,
  SearchResultEntry,
  MemoryStoreEntry,
} from './queen-coordinator-types.js';

// =============================================================================
// Queen Coordinator Class
// =============================================================================

/**
 * Queen Coordinator - Central orchestrator for the 15-agent hive-mind swarm
 *
 * The Queen is responsible for:
 * 1. Strategic task analysis and decomposition
 * 2. Agent delegation with load balancing
 * 3. Swarm health monitoring
 * 4. Consensus coordination
 * 5. Learning from outcomes
 */
export class QueenCoordinator extends EventEmitter {
  private config: QueenCoordinatorConfig;
  private swarm: ISwarmCoordinator;
  private neural?: INeuralLearningSystem;
  private memory?: IMemoryService;

  // Internal state
  private analysisCache: Map<string, TaskAnalysis> = new Map();
  private delegationPlans: Map<string, DelegationPlan> = new Map();
  private activeDecisions: Map<string, Decision> = new Map();
  private outcomeHistory: TaskResult[] = [];
  private healthHistory: HealthReport[] = [];

  // Counters for IDs
  private analysisCounter = 0;
  private planCounter = 0;
  private reportCounter = 0;
  private decisionCounter = 0;

  // Health monitoring
  private healthCheckInterval?: NodeJS.Timeout;
  private lastHealthReport?: HealthReport;

  // Performance tracking
  private analysisLatencies: number[] = [];
  private delegationLatencies: number[] = [];
  private consensusLatencies: number[] = [];

  constructor(
    swarm: ISwarmCoordinator,
    config: Partial<QueenCoordinatorConfig> = {},
    neural?: INeuralLearningSystem,
    memory?: IMemoryService
  ) {
    super();
    this.swarm = swarm;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.neural = neural;
    this.memory = memory;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Initialize the Queen Coordinator
   */
  async initialize(): Promise<void> {
    // Initialize neural system if available
    if (this.neural && this.config.enableLearning) {
      await this.neural.initialize();
    }

    // Start health monitoring
    this.startHealthMonitoring();

    this.emitEvent('queen.initialized', {
      config: this.config,
      learningEnabled: this.config.enableLearning && !!this.neural,
    });
  }

  /**
   * Shutdown the Queen Coordinator
   */
  async shutdown(): Promise<void> {
    this.stopHealthMonitoring();

    // Trigger final learning if enabled
    if (this.neural && this.config.enableLearning) {
      await this.neural.triggerLearning();
    }

    this.emitEvent('queen.shutdown', {
      totalAnalyses: this.analysisCounter,
      totalPlans: this.planCounter,
      totalDecisions: this.decisionCounter,
    });
  }

  // ===========================================================================
  // Strategic Task Analysis
  // ===========================================================================

  /**
   * Analyze a task for optimal execution
   *
   * @param task - Task to analyze
   * @returns Task analysis with recommendations
   */
  async analyzeTask(task: TaskDefinition): Promise<TaskAnalysis> {
    const startTime = performance.now();

    this.analysisCounter++;
    const analysisId = `analysis_${Date.now()}_${this.analysisCounter}`;

    // Decompose complex tasks
    const subtasks = this.decomposeTask(task);

    // Identify required capabilities
    const requiredCapabilities = this.identifyRequiredCapabilities(task);

    // Calculate complexity
    const complexity = this.calculateComplexity(task, subtasks);

    // Estimate duration
    const estimatedDurationMs = this.estimateDuration(task, complexity, subtasks);

    // Determine recommended domain
    const recommendedDomain = this.determineOptimalDomain(task, requiredCapabilities);

    // Find matching patterns from ReasoningBank
    const matchedPatterns = await this.findMatchingPatterns(task);

    // Estimate resource requirements
    const resourceRequirements = this.estimateResources(task, complexity);

    // Calculate confidence
    const confidence = this.calculateAnalysisConfidence(
      matchedPatterns,
      complexity,
      requiredCapabilities
    );

    const analysis: TaskAnalysis = {
      analysisId,
      taskId: task.id.id,
      complexity,
      estimatedDurationMs,
      requiredCapabilities,
      recommendedDomain,
      subtasks,
      matchedPatterns,
      resourceRequirements,
      confidence,
      timestamp: new Date(),
    };

    // Cache the analysis
    this.analysisCache.set(analysisId, analysis);

    // Record latency
    const latency = performance.now() - startTime;
    this.analysisLatencies.push(latency);
    if (this.analysisLatencies.length > 100) {
      this.analysisLatencies.shift();
    }

    this.emitEvent('queen.task.analyzed', {
      analysisId,
      taskId: task.id.id,
      complexity,
      recommendedDomain,
      patternsFound: matchedPatterns.length,
      latencyMs: latency,
    });

    return analysis;
  }

  /**
   * Decompose a complex task into subtasks
   */
  private decomposeTask(task: TaskDefinition): SubTask[] {
    const subtasks: SubTask[] = [];

    // Simple tasks don't need decomposition
    if (this.isSimpleTask(task)) {
      return subtasks;
    }

    // Decompose based on task type
    switch (task.type) {
      case 'coding':
        subtasks.push(...this.decomposeCodingTask(task));
        break;
      case 'testing':
        subtasks.push(...this.decomposeTestingTask(task));
        break;
      case 'research':
        subtasks.push(...this.decomposeResearchTask(task));
        break;
      case 'coordination':
        subtasks.push(...this.decomposeCoordinationTask(task));
        break;
      default:
        // Generic decomposition
        subtasks.push(...this.decomposeGenericTask(task));
    }

    return subtasks;
  }

  private isSimpleTask(task: TaskDefinition): boolean {
    // Estimate if task is simple based on description length and type
    const descLength = task.description?.length || 0;
    const isSimpleType = ['documentation', 'review'].includes(task.type);
    return descLength < 200 || isSimpleType;
  }

  private decomposeCodingTask(task: TaskDefinition): SubTask[] {
    return [
      {
        id: `${task.id.id}_design`,
        name: 'Design & Planning',
        description: 'Design the solution architecture',
        type: 'analysis',
        priority: task.priority,
        dependencies: [],
        estimatedDurationMs: 10000,
        requiredCapabilities: ['design', 'architecture'],
        recommendedDomain: 'core',
      },
      {
        id: `${task.id.id}_implement`,
        name: 'Implementation',
        description: 'Implement the designed solution',
        type: 'coding',
        priority: task.priority,
        dependencies: [`${task.id.id}_design`],
        estimatedDurationMs: 30000,
        requiredCapabilities: ['coding', 'implementation'],
        recommendedDomain: 'integration',
      },
      {
        id: `${task.id.id}_test`,
        name: 'Testing',
        description: 'Test the implementation',
        type: 'testing',
        priority: task.priority,
        dependencies: [`${task.id.id}_implement`],
        estimatedDurationMs: 15000,
        requiredCapabilities: ['testing', 'validation'],
        recommendedDomain: 'support',
      },
    ];
  }

  private decomposeTestingTask(task: TaskDefinition): SubTask[] {
    return [
      {
        id: `${task.id.id}_analyze`,
        name: 'Test Analysis',
        description: 'Analyze what needs to be tested',
        type: 'analysis',
        priority: task.priority,
        dependencies: [],
        estimatedDurationMs: 5000,
        requiredCapabilities: ['analysis', 'testing'],
        recommendedDomain: 'support',
      },
      {
        id: `${task.id.id}_execute`,
        name: 'Test Execution',
        description: 'Execute the tests',
        type: 'testing',
        priority: task.priority,
        dependencies: [`${task.id.id}_analyze`],
        estimatedDurationMs: 20000,
        requiredCapabilities: ['testing', 'execution'],
        recommendedDomain: 'support',
      },
    ];
  }

  private decomposeResearchTask(task: TaskDefinition): SubTask[] {
    return [
      {
        id: `${task.id.id}_gather`,
        name: 'Information Gathering',
        description: 'Gather relevant information',
        type: 'research',
        priority: task.priority,
        dependencies: [],
        estimatedDurationMs: 15000,
        requiredCapabilities: ['research', 'analysis'],
        recommendedDomain: 'core',
      },
      {
        id: `${task.id.id}_analyze`,
        name: 'Analysis',
        description: 'Analyze gathered information',
        type: 'analysis',
        priority: task.priority,
        dependencies: [`${task.id.id}_gather`],
        estimatedDurationMs: 10000,
        requiredCapabilities: ['analysis', 'synthesis'],
        recommendedDomain: 'core',
      },
    ];
  }

  private decomposeCoordinationTask(task: TaskDefinition): SubTask[] {
    return [
      {
        id: `${task.id.id}_plan`,
        name: 'Planning',
        description: 'Create coordination plan',
        type: 'coordination',
        priority: task.priority,
        dependencies: [],
        estimatedDurationMs: 5000,
        requiredCapabilities: ['planning', 'coordination'],
        recommendedDomain: 'queen',
      },
      {
        id: `${task.id.id}_execute`,
        name: 'Execution',
        description: 'Execute coordination plan',
        type: 'coordination',
        priority: task.priority,
        dependencies: [`${task.id.id}_plan`],
        estimatedDurationMs: 10000,
        requiredCapabilities: ['coordination', 'oversight'],
        recommendedDomain: 'queen',
      },
    ];
  }

  private decomposeGenericTask(task: TaskDefinition): SubTask[] {
    return [
      {
        id: `${task.id.id}_execute`,
        name: 'Task Execution',
        description: task.description,
        type: task.type,
        priority: task.priority,
        dependencies: [],
        estimatedDurationMs: 20000,
        requiredCapabilities: this.identifyRequiredCapabilities(task),
        recommendedDomain: this.inferDomainFromType(task.type),
      },
    ];
  }

  /**
   * Identify required capabilities for a task
   */
  private identifyRequiredCapabilities(task: TaskDefinition): string[] {
    const capabilities: Set<string> = new Set();

    // Add type-based capabilities
    const typeCapabilities: Record<TaskType, string[]> = {
      research: ['research', 'analysis', 'synthesis'],
      analysis: ['analysis', 'reasoning', 'synthesis'],
      coding: ['coding', 'implementation', 'debugging'],
      testing: ['testing', 'validation', 'quality'],
      review: ['review', 'analysis', 'feedback'],
      documentation: ['documentation', 'writing', 'clarity'],
      coordination: ['coordination', 'planning', 'oversight'],
      consensus: ['consensus', 'voting', 'agreement'],
      custom: ['general', 'execution'],
    };

    for (const cap of typeCapabilities[task.type] || ['general']) {
      capabilities.add(cap);
    }

    // Extract additional capabilities from description
    const descLower = (task.description || '').toLowerCase();
    if (descLower.includes('security')) capabilities.add('security');
    if (descLower.includes('performance')) capabilities.add('performance');
    if (descLower.includes('architecture')) capabilities.add('architecture');
    if (descLower.includes('integration')) capabilities.add('integration');
    if (descLower.includes('deploy')) capabilities.add('deployment');

    return Array.from(capabilities);
  }

  /**
   * Calculate task complexity score
   */
  private calculateComplexity(task: TaskDefinition, subtasks: SubTask[]): number {
    let complexity = 0.3; // Base complexity

    // Add complexity for subtasks
    complexity += subtasks.length * 0.1;

    // Add complexity for dependencies
    const totalDeps = subtasks.reduce((sum, st) => sum + st.dependencies.length, 0);
    complexity += totalDeps * 0.05;

    // Add complexity for priority
    const priorityMultipliers: Record<TaskPriority, number> = {
      critical: 1.3,
      high: 1.15,
      normal: 1.0,
      low: 0.9,
      background: 0.8,
    };
    complexity *= priorityMultipliers[task.priority];

    // Add complexity for task type
    const typeComplexity: Record<TaskType, number> = {
      coordination: 0.2,
      consensus: 0.25,
      coding: 0.15,
      testing: 0.1,
      analysis: 0.1,
      research: 0.1,
      review: 0.05,
      documentation: 0.05,
      custom: 0.1,
    };
    complexity += typeComplexity[task.type] || 0.1;

    // Add complexity for description length
    const descLength = task.description?.length || 0;
    complexity += Math.min(descLength / 2000, 0.2);

    return Math.min(complexity, 1.0);
  }

  /**
   * Estimate task duration
   */
  private estimateDuration(
    task: TaskDefinition,
    complexity: number,
    subtasks: SubTask[]
  ): number {
    // Base duration by type (in ms)
    const baseDurations: Record<TaskType, number> = {
      research: 30000,
      analysis: 20000,
      coding: 60000,
      testing: 30000,
      review: 15000,
      documentation: 20000,
      coordination: 10000,
      consensus: 15000,
      custom: 30000,
    };

    const baseDuration = baseDurations[task.type] || 30000;

    // Adjust for complexity
    const complexityMultiplier = 0.5 + complexity * 1.5;

    // Add subtask durations
    const subtaskDuration = subtasks.reduce((sum, st) => sum + st.estimatedDurationMs, 0);

    // Total estimate
    return Math.round(baseDuration * complexityMultiplier + subtaskDuration * 0.5);
  }

  /**
   * Determine optimal domain for task execution
   */
  private determineOptimalDomain(
    task: TaskDefinition,
    capabilities: string[]
  ): AgentDomain {
    // Check capabilities for domain hints
    if (capabilities.includes('security')) return 'security';
    if (capabilities.includes('coordination') || capabilities.includes('planning')) return 'queen';
    if (capabilities.includes('testing') || capabilities.includes('performance')) return 'support';
    if (capabilities.includes('integration')) return 'integration';

    // Fall back to type-based inference
    return this.inferDomainFromType(task.type);
  }

  private inferDomainFromType(type: TaskType): AgentDomain {
    const typeDomains: Record<TaskType, AgentDomain> = {
      coordination: 'queen',
      consensus: 'queen',
      coding: 'integration',
      testing: 'support',
      review: 'security',
      analysis: 'core',
      research: 'core',
      documentation: 'support',
      custom: 'core',
    };
    return typeDomains[type] || 'core';
  }

  /**
   * Find matching patterns from ReasoningBank
   */
  private async findMatchingPatterns(task: TaskDefinition): Promise<MatchedPattern[]> {
    const patterns: MatchedPattern[] = [];

    if (!this.neural || !this.config.enableLearning) {
      return patterns;
    }

    try {
      // Create a simple embedding from task description
      const embedding = this.createSimpleEmbedding(task.description || task.name);

      // Query ReasoningBank for similar patterns
      const results = await this.neural.findPatterns(embedding, this.config.patternRetrievalK);

      for (const result of results) {
        if (result.relevanceScore >= this.config.patternThreshold) {
          patterns.push({
            patternId: result.patternId,
            strategy: result.strategy,
            successRate: result.successRate,
            relevanceScore: result.relevanceScore,
            keyLearnings: result.keyLearnings || [],
          });
        }
      }
    } catch (error) {
      // Log but don't fail - patterns are optional
      this.emitEvent('queen.pattern.error', { error: String(error) });
    }

    return patterns;
  }

  /**
   * Create a simple embedding from text using hash-based approach.
   * For higher quality embeddings, integrate agentic-flow's computeEmbedding.
   */
  private createSimpleEmbedding(text: string): Float32Array {
    // Hash-based embedding - lightweight and fast for local similarity matching
    // For production ML embeddings, use: import('agentic-flow').computeEmbedding
    const embedding = new Float32Array(768);
    const words = text.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) * (i + 1) * (j + 1)) % 768;
        embedding[idx] += 1 / words.length;
      }
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  /**
   * Estimate resource requirements
   */
  private estimateResources(task: TaskDefinition, complexity: number): ResourceRequirements {
    const minAgents = complexity > 0.7 ? 2 : 1;
    const maxAgents = complexity > 0.8 ? 4 : complexity > 0.5 ? 3 : 2;

    return {
      minAgents,
      maxAgents,
      memoryMb: Math.round(256 + complexity * 512),
      cpuIntensive: ['coding', 'analysis'].includes(task.type),
      ioIntensive: ['research', 'testing'].includes(task.type),
      networkRequired: task.type === 'research',
    };
  }

  /**
   * Calculate confidence in analysis
   */
  private calculateAnalysisConfidence(
    patterns: MatchedPattern[],
    complexity: number,
    capabilities: string[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence with more matching patterns
    confidence += patterns.length * 0.1;

    // Higher confidence for simpler tasks
    confidence += (1 - complexity) * 0.2;

    // Higher confidence with clear capabilities
    confidence += Math.min(capabilities.length * 0.05, 0.15);

    // Boost from high-success patterns
    const avgPatternSuccess = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length
      : 0;
    confidence += avgPatternSuccess * 0.1;

    return Math.min(confidence, 0.95);
  }

  // ===========================================================================
  // Agent Delegation
  // ===========================================================================

  /**
   * Delegate a task to agents based on analysis
   *
   * @param task - Task to delegate
   * @param analysis - Previous task analysis
   * @returns Delegation plan
   */
  async delegateToAgents(task: TaskDefinition, analysis: TaskAnalysis): Promise<DelegationPlan> {
    const startTime = performance.now();

    this.planCounter++;
    const planId = `plan_${Date.now()}_${this.planCounter}`;

    // Score all available agents for this task
    const agentScores = this.scoreAgents(task, analysis.matchedPatterns);

    // Select primary agent
    const primaryAgent = this.selectPrimaryAgent(task, agentScores, analysis);

    // Select backup agents
    const backupAgents = this.selectBackupAgents(task, agentScores, primaryAgent);

    // Create parallel assignments for subtasks
    const parallelAssignments = this.createParallelAssignments(
      analysis.subtasks,
      agentScores
    );

    // Determine execution strategy
    const strategy = this.determineExecutionStrategy(analysis);

    const plan: DelegationPlan = {
      planId,
      taskId: task.id.id,
      analysisId: analysis.analysisId,
      primaryAgent,
      backupAgents,
      parallelAssignments,
      strategy,
      estimatedCompletionMs: analysis.estimatedDurationMs,
      timestamp: new Date(),
    };

    // Store the plan
    this.delegationPlans.set(planId, plan);

    // Execute the delegation
    await this.executeDelegation(plan);

    // Record latency
    const latency = performance.now() - startTime;
    this.delegationLatencies.push(latency);
    if (this.delegationLatencies.length > 100) {
      this.delegationLatencies.shift();
    }

    this.emitEvent('queen.task.delegated', {
      planId,
      taskId: task.id.id,
      primaryAgent: primaryAgent.agentId,
      strategy,
      latencyMs: latency,
    });

    return plan;
  }

  /**
   * Score agents for task assignment
   */
  scoreAgents(task: TaskDefinition, patterns: MatchedPattern[]): AgentScore[] {
    const agents = this.swarm.getAllAgents();
    const scores: AgentScore[] = [];

    for (const agent of agents) {
      const score = this.scoreAgent(agent, task, patterns);
      scores.push(score);
    }

    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);

    return scores;
  }

  private scoreAgent(
    agent: AgentState,
    task: TaskDefinition,
    patterns: MatchedPattern[]
  ): AgentScore {
    const domain = this.getAgentDomain(agent);

    // Capability score - how well agent capabilities match task
    const capabilityScore = this.calculateCapabilityScore(agent, task);

    // Load score - prefer less loaded agents
    const loadScore = 1 - agent.workload;

    // Performance score - based on past performance
    const performanceScore = this.calculatePerformanceScore(agent, patterns);

    // Health score - agent health
    const healthScore = agent.health;

    // Availability score - is agent actually available
    const availabilityScore = agent.status === 'idle' ? 1.0 :
                              agent.status === 'busy' ? 0.3 : 0.0;

    // Weighted total
    const totalScore =
      capabilityScore * 0.30 +
      loadScore * 0.20 +
      performanceScore * 0.25 +
      healthScore * 0.15 +
      availabilityScore * 0.10;

    return {
      agentId: agent.id.id,
      domain,
      totalScore,
      capabilityScore,
      loadScore,
      performanceScore,
      healthScore,
      availabilityScore,
    };
  }

  private calculateCapabilityScore(agent: AgentState, task: TaskDefinition): number {
    let score = 0.5; // Base score

    // Check type match
    const typeMatches: Record<TaskType, AgentType[]> = {
      research: ['researcher'],
      analysis: ['analyst', 'researcher'],
      coding: ['coder'],
      testing: ['tester'],
      review: ['reviewer'],
      documentation: ['documenter'],
      coordination: ['coordinator', 'queen'],
      consensus: ['coordinator', 'queen'],
      custom: ['worker'],
    };

    const preferredTypes = typeMatches[task.type] || ['worker'];
    if (preferredTypes.includes(agent.type)) {
      score += 0.3;
    }

    // Check specific capabilities
    const caps = agent.capabilities;
    if (task.type === 'coding' && caps.codeGeneration) score += 0.1;
    if (task.type === 'review' && caps.codeReview) score += 0.1;
    if (task.type === 'testing' && caps.testing) score += 0.1;
    if (task.type === 'coordination' && caps.coordination) score += 0.1;

    return Math.min(score, 1.0);
  }

  private calculatePerformanceScore(
    agent: AgentState,
    patterns: MatchedPattern[]
  ): number {
    // Base on agent's success rate
    let score = agent.metrics.successRate;

    // Boost if patterns suggest this agent type is successful
    const agentDomain = this.getAgentDomain(agent);
    for (const pattern of patterns) {
      if (pattern.strategy.toLowerCase().includes(agentDomain)) {
        score += pattern.successRate * 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  private getAgentDomain(agent: AgentState): AgentDomain {
    // Determine domain from agent type
    switch (agent.type) {
      case 'queen':
        return 'queen';
      case 'specialist':
        return 'security';
      case 'architect':
        return 'core';
      case 'coder':
        return 'integration';
      case 'tester':
        return 'support';
      default:
        return 'core';
    }
  }

  private selectPrimaryAgent(
    task: TaskDefinition,
    scores: AgentScore[],
    analysis: TaskAnalysis
  ): AgentAssignment {
    // Prefer agent from recommended domain
    const domainAgents = scores.filter(s => s.domain === analysis.recommendedDomain);

    // Fall back to best overall if no domain match
    const bestScore = domainAgents.length > 0 ? domainAgents[0] : scores[0];

    return {
      agentId: bestScore.agentId,
      domain: bestScore.domain,
      taskId: task.id.id,
      score: bestScore.totalScore,
      assignedAt: new Date(),
    };
  }

  private selectBackupAgents(
    task: TaskDefinition,
    scores: AgentScore[],
    primary: AgentAssignment
  ): AgentAssignment[] {
    const backups: AgentAssignment[] = [];

    // Select up to 2 backup agents
    for (const score of scores) {
      if (score.agentId === primary.agentId) continue;
      if (score.totalScore < 0.3) continue;
      if (backups.length >= 2) break;

      backups.push({
        agentId: score.agentId,
        domain: score.domain,
        taskId: task.id.id,
        score: score.totalScore,
        assignedAt: new Date(),
      });
    }

    return backups;
  }

  private createParallelAssignments(
    subtasks: SubTask[],
    scores: AgentScore[]
  ): ParallelAssignment[] {
    const assignments: ParallelAssignment[] = [];

    for (const subtask of subtasks) {
      // Find best agent for this subtask's domain
      const domainScores = scores.filter(s => s.domain === subtask.recommendedDomain);
      const bestScore = domainScores.length > 0 ? domainScores[0] : scores[0];

      assignments.push({
        subtaskId: subtask.id,
        agentId: bestScore.agentId,
        domain: subtask.recommendedDomain,
        dependencies: subtask.dependencies,
      });
    }

    return assignments;
  }

  private determineExecutionStrategy(analysis: TaskAnalysis): ExecutionStrategy {
    const subtaskCount = analysis.subtasks.length;

    if (subtaskCount === 0) {
      return 'sequential';
    }

    // Check for dependencies
    const hasDependencies = analysis.subtasks.some(st => st.dependencies.length > 0);

    if (!hasDependencies && subtaskCount > 2) {
      return 'parallel';
    }

    if (hasDependencies && subtaskCount > 3) {
      return 'pipeline';
    }

    if (analysis.complexity > 0.7) {
      return 'fan-out-fan-in';
    }

    return 'hybrid';
  }

  private async executeDelegation(plan: DelegationPlan): Promise<void> {
    // Delegate to the primary agent
    await this.swarm.assignTaskToDomain(plan.taskId, plan.primaryAgent.domain);

    // Notify about the delegation
    await this.swarm.broadcastMessage(
      {
        type: 'delegation',
        planId: plan.planId,
        taskId: plan.taskId,
        primaryAgent: plan.primaryAgent.agentId,
        strategy: plan.strategy,
      },
      'normal'
    );
  }

  // ===========================================================================
  // Swarm Health Monitoring
  // ===========================================================================

  /**
   * Monitor swarm health and detect issues
   *
   * @returns Health report
   */
  async monitorSwarmHealth(): Promise<HealthReport> {
    this.reportCounter++;
    const reportId = `health_${Date.now()}_${this.reportCounter}`;

    const agents = this.swarm.getAllAgents();
    const status = this.swarm.getStatus();
    const metrics = this.swarm.getMetrics();

    // Compute domain health
    const domainHealth = this.computeDomainHealth(status.domains);

    // Compute agent health
    const agentHealth = this.computeAgentHealth(agents);

    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks(status, agents, metrics);

    // Generate alerts
    const alerts = this.generateAlerts(bottlenecks, agentHealth, metrics);

    // Overall health score
    const overallHealth = this.calculateOverallHealth(domainHealth, agentHealth, bottlenecks);

    // Generate recommendations
    const recommendations = this.generateRecommendations(bottlenecks, overallHealth);

    // Compile health metrics
    const healthMetrics: HealthMetrics = {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'idle' || a.status === 'busy').length,
      idleAgents: agents.filter(a => a.status === 'idle').length,
      errorAgents: agents.filter(a => a.status === 'error').length,
      totalTasks: metrics.totalTasks,
      completedTasks: metrics.completedTasks,
      failedTasks: metrics.failedTasks,
      avgTaskDurationMs: metrics.avgTaskDurationMs,
      taskThroughputPerMin: metrics.completedTasks / Math.max(metrics.uptime / 60, 1),
      consensusSuccessRate: metrics.consensusSuccessRate,
    };

    const report: HealthReport = {
      reportId,
      timestamp: new Date(),
      overallHealth,
      domainHealth,
      agentHealth,
      bottlenecks,
      alerts,
      metrics: healthMetrics,
      recommendations,
    };

    // Store in history
    this.healthHistory.push(report);
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }
    this.lastHealthReport = report;

    this.emitEvent('queen.health.report', {
      reportId,
      overallHealth,
      bottleneckCount: bottlenecks.length,
      alertCount: alerts.length,
    });

    return report;
  }

  private computeDomainHealth(domains: DomainStatus[]): Map<AgentDomain, DomainHealthStatus> {
    const health = new Map<AgentDomain, DomainHealthStatus>();

    for (const domain of domains) {
      const utilization = domain.agentCount > 0
        ? domain.busyAgents / domain.agentCount
        : 0;

      const queuePressure = domain.tasksQueued > 5 ? 0.3 : domain.tasksQueued * 0.05;
      const domainHealth = Math.max(0, 1 - queuePressure - (1 - utilization) * 0.2);

      health.set(domain.name, {
        domain: domain.name,
        health: domainHealth,
        activeAgents: domain.availableAgents + domain.busyAgents,
        totalAgents: domain.agentCount,
        queuedTasks: domain.tasksQueued,
        avgResponseTimeMs: 0, // Would need tracking
        errorRate: 0, // Would need tracking
      });
    }

    return health;
  }

  private computeAgentHealth(agents: AgentState[]): AgentHealthEntry[] {
    return agents.map(agent => ({
      agentId: agent.id.id,
      domain: this.getAgentDomain(agent),
      health: agent.health,
      status: agent.status,
      lastHeartbeat: agent.lastHeartbeat,
      currentLoad: agent.workload,
      recentErrors: agent.metrics.tasksFailed,
    }));
  }

  private detectBottlenecks(
    status: { domains: DomainStatus[]; metrics: CoordinatorMetrics },
    agents: AgentState[],
    metrics: CoordinatorMetrics
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Check domain queues
    for (const domain of status.domains) {
      if (domain.tasksQueued > this.config.bottleneckThresholds.queueDepth) {
        bottlenecks.push({
          type: 'domain',
          location: domain.name,
          severity: domain.tasksQueued > 20 ? 'critical' : 'high',
          description: `High task queue depth in ${domain.name} domain`,
          impact: `${domain.tasksQueued} tasks waiting for processing`,
          suggestedAction: `Consider scaling ${domain.name} domain agents`,
        });
      }
    }

    // Check error agents
    const errorAgents = agents.filter(a => a.status === 'error');
    if (errorAgents.length > 0) {
      bottlenecks.push({
        type: 'agent',
        location: errorAgents.map(a => a.id.id).join(', '),
        severity: errorAgents.length > 3 ? 'critical' : 'medium',
        description: `${errorAgents.length} agents in error state`,
        impact: 'Reduced processing capacity',
        suggestedAction: 'Investigate and recover error agents',
      });
    }

    // Check coordination latency
    if (metrics.coordinationLatencyMs > this.config.bottleneckThresholds.responseTimeMs) {
      bottlenecks.push({
        type: 'resource',
        location: 'coordination',
        severity: 'high',
        description: 'High coordination latency detected',
        impact: `Current latency: ${metrics.coordinationLatencyMs}ms`,
        suggestedAction: 'Optimize coordination or reduce concurrent tasks',
      });
    }

    return bottlenecks;
  }

  private generateAlerts(
    bottlenecks: Bottleneck[],
    agentHealth: AgentHealthEntry[],
    metrics: CoordinatorMetrics
  ): HealthAlert[] {
    const alerts: HealthAlert[] = [];

    // Generate alerts for critical bottlenecks
    for (const bottleneck of bottlenecks) {
      if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
        alerts.push({
          alertId: `alert_${Date.now()}_${alerts.length}`,
          type: bottleneck.severity === 'critical' ? 'critical' : 'error',
          source: bottleneck.location,
          message: bottleneck.description,
          timestamp: new Date(),
          acknowledged: false,
        });
      }
    }

    // Alert on low overall agent health
    const avgHealth = agentHealth.length > 0
      ? agentHealth.reduce((sum, a) => sum + a.health, 0) / agentHealth.length
      : 1.0;

    if (avgHealth < 0.5) {
      alerts.push({
        alertId: `alert_${Date.now()}_health`,
        type: avgHealth < 0.3 ? 'critical' : 'warning',
        source: 'swarm',
        message: `Low average agent health: ${(avgHealth * 100).toFixed(1)}%`,
        timestamp: new Date(),
        acknowledged: false,
      });
    }

    // Alert on high failure rate
    const failureRate = metrics.totalTasks > 0
      ? metrics.failedTasks / metrics.totalTasks
      : 0;

    if (failureRate > this.config.bottleneckThresholds.errorRate) {
      alerts.push({
        alertId: `alert_${Date.now()}_failures`,
        type: failureRate > 0.2 ? 'critical' : 'warning',
        source: 'tasks',
        message: `High task failure rate: ${(failureRate * 100).toFixed(1)}%`,
        timestamp: new Date(),
        acknowledged: false,
      });
    }

    return alerts;
  }

  private calculateOverallHealth(
    domainHealth: Map<AgentDomain, DomainHealthStatus>,
    agentHealth: AgentHealthEntry[],
    bottlenecks: Bottleneck[]
  ): number {
    // Average domain health
    const domainHealthAvg = domainHealth.size > 0
      ? Array.from(domainHealth.values()).reduce((sum, d) => sum + d.health, 0) / domainHealth.size
      : 1.0;

    // Average agent health
    const agentHealthAvg = agentHealth.length > 0
      ? agentHealth.reduce((sum, a) => sum + a.health, 0) / agentHealth.length
      : 1.0;

    // Bottleneck penalty
    const bottleneckPenalty = bottlenecks.reduce((penalty, b) => {
      switch (b.severity) {
        case 'critical': return penalty + 0.2;
        case 'high': return penalty + 0.1;
        case 'medium': return penalty + 0.05;
        case 'low': return penalty + 0.02;
        default: return penalty;
      }
    }, 0);

    const overallHealth = (domainHealthAvg * 0.4 + agentHealthAvg * 0.4) - bottleneckPenalty;
    return Math.max(0, Math.min(1, overallHealth));
  }

  private generateRecommendations(bottlenecks: Bottleneck[], overallHealth: number): string[] {
    const recommendations: string[] = [];

    // Add bottleneck-specific recommendations
    for (const bottleneck of bottlenecks) {
      recommendations.push(bottleneck.suggestedAction);
    }

    // General recommendations based on health
    if (overallHealth < 0.5) {
      recommendations.push('Consider reducing task load or adding more agents');
    }

    if (overallHealth < 0.3) {
      recommendations.push('URGENT: Investigate system-wide issues immediately');
    }

    return [...new Set(recommendations)]; // Deduplicate
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.monitorSwarmHealth();
      } catch (error) {
        this.emitEvent('queen.health.error', { error: String(error) });
      }
    }, this.config.healthCheckIntervalMs);
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  // ===========================================================================
  // Consensus Coordination
  // ===========================================================================

  /**
   * Coordinate consensus for a decision
   *
   * @param decision - Decision requiring consensus
   * @returns Consensus result
   */
  async coordinateConsensus(decision: Decision): Promise<ConsensusResult> {
    const startTime = performance.now();

    this.decisionCounter++;
    decision.decisionId = `decision_${Date.now()}_${this.decisionCounter}`;

    // Store active decision
    this.activeDecisions.set(decision.decisionId, decision);

    try {
      let result: ConsensusResult;

      switch (decision.requiredConsensus) {
        case 'queen-override':
          // Queen can make unilateral decisions for certain types
          result = this.queenOverride(decision);
          break;

        case 'unanimous':
          result = await this.unanimousConsensus(decision);
          break;

        case 'supermajority':
          result = await this.supermajorityConsensus(decision);
          break;

        case 'weighted':
          result = await this.weightedConsensus(decision);
          break;

        case 'majority':
        default:
          result = await this.majorityConsensus(decision);
      }

      // Record latency
      const latency = performance.now() - startTime;
      this.consensusLatencies.push(latency);
      if (this.consensusLatencies.length > 100) {
        this.consensusLatencies.shift();
      }

      this.emitEvent('queen.consensus.completed', {
        decisionId: decision.decisionId,
        type: decision.requiredConsensus,
        approved: result.approved,
        approvalRate: result.approvalRate,
        latencyMs: latency,
      });

      return result;
    } finally {
      this.activeDecisions.delete(decision.decisionId);
    }
  }

  private queenOverride(decision: Decision): ConsensusResult {
    // Queen can make immediate decisions for:
    // - Emergency actions
    // - Agent termination
    // - Priority overrides
    const allowedTypes: DecisionType[] = ['emergency-action', 'agent-termination', 'priority-override'];

    if (!allowedTypes.includes(decision.type)) {
      throw new Error(`Queen override not allowed for decision type: ${decision.type}`);
    }

    return {
      proposalId: decision.decisionId,
      approved: true,
      approvalRate: 1.0,
      participationRate: 1.0,
      finalValue: decision.proposal,
      rounds: 1,
      durationMs: 0,
    };
  }

  private async majorityConsensus(decision: Decision): Promise<ConsensusResult> {
    // Use swarm's consensus engine with majority threshold
    const result = await this.swarm.proposeConsensus({
      decision,
      threshold: 0.51,
      timeout: this.config.consensusTimeouts.majority,
    });

    return result;
  }

  private async supermajorityConsensus(decision: Decision): Promise<ConsensusResult> {
    // Use swarm's consensus engine with 2/3 threshold
    const result = await this.swarm.proposeConsensus({
      decision,
      threshold: 0.67,
      timeout: this.config.consensusTimeouts.supermajority,
    });

    return result;
  }

  private async unanimousConsensus(decision: Decision): Promise<ConsensusResult> {
    // Use swarm's consensus engine with unanimous requirement
    const result = await this.swarm.proposeConsensus({
      decision,
      threshold: 1.0,
      timeout: this.config.consensusTimeouts.unanimous,
    });

    return result;
  }

  private async weightedConsensus(decision: Decision): Promise<ConsensusResult> {
    // Weighted consensus based on agent performance
    // For now, delegate to the standard consensus with metadata
    const agents = this.swarm.getAllAgents();
    const weights = new Map<string, number>();

    for (const agent of agents) {
      const weight = agent.metrics.successRate * agent.health;
      weights.set(agent.id.id, weight);
    }

    const result = await this.swarm.proposeConsensus({
      decision,
      weights: Object.fromEntries(weights),
      threshold: 0.51,
      timeout: this.config.consensusTimeouts.majority,
    });

    return result;
  }

  // ===========================================================================
  // Learning from Outcomes
  // ===========================================================================

  /**
   * Record task outcome for learning
   *
   * @param task - Completed task
   * @param result - Task result
   */
  async recordOutcome(task: TaskDefinition, result: TaskResult): Promise<void> {
    // Store in outcome history
    this.outcomeHistory.push(result);
    if (this.outcomeHistory.length > 1000) {
      this.outcomeHistory.shift();
    }

    // Learn from outcome if neural system available
    if (this.neural && this.config.enableLearning) {
      await this.learnFromOutcome(task, result);
    }

    // Store in memory service if available
    if (this.memory) {
      await this.storeOutcomeMemory(task, result);
    }

    this.emitEvent('queen.outcome.recorded', {
      taskId: task.id.id,
      success: result.success,
      durationMs: result.durationMs,
      qualityScore: result.metrics.qualityScore,
    });
  }

  private async learnFromOutcome(task: TaskDefinition, result: TaskResult): Promise<void> {
    if (!this.neural) return;

    // Create trajectory for this task
    const trajectoryId = this.neural.beginTask(
      task.description || task.name,
      result.domain
    );

    // Record the execution step
    const embedding = this.createSimpleEmbedding(task.description || task.name);
    const reward = result.success
      ? result.metrics.qualityScore * 0.8 + 0.2
      : result.metrics.qualityScore * 0.3;

    this.neural.recordStep(
      trajectoryId,
      `executed_${task.type}_in_${result.domain}`,
      reward,
      embedding
    );

    // Complete the task trajectory
    await this.neural.completeTask(trajectoryId, result.metrics.qualityScore);
  }

  private async storeOutcomeMemory(task: TaskDefinition, result: TaskResult): Promise<void> {
    if (!this.memory) return;

    try {
      await this.memory.store({
        key: `outcome_${task.id.id}`,
        content: this.formatOutcomeContent(task, result),
        namespace: 'queen-outcomes',
        tags: [
          task.type,
          result.domain,
          result.success ? 'success' : 'failure',
        ],
        metadata: {
          taskId: task.id.id,
          success: result.success,
          durationMs: result.durationMs,
          qualityScore: result.metrics.qualityScore,
          agentId: result.agentId,
        },
      });
    } catch (error) {
      // Log but don't fail - memory storage is optional
      this.emitEvent('queen.memory.error', { error: String(error) });
    }
  }

  private formatOutcomeContent(task: TaskDefinition, result: TaskResult): string {
    return [
      `Task: ${task.name}`,
      `Type: ${task.type}`,
      `Domain: ${result.domain}`,
      `Agent: ${result.agentId}`,
      `Success: ${result.success}`,
      `Duration: ${result.durationMs}ms`,
      `Quality: ${result.metrics.qualityScore}`,
      `Description: ${task.description || 'N/A'}`,
    ].join('\n');
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get the last health report
   */
  getLastHealthReport(): HealthReport | undefined {
    return this.lastHealthReport;
  }

  /**
   * Get outcome history
   */
  getOutcomeHistory(): TaskResult[] {
    return [...this.outcomeHistory];
  }

  /**
   * Get analysis cache
   */
  getAnalysisCache(): Map<string, TaskAnalysis> {
    return new Map(this.analysisCache);
  }

  /**
   * Get delegation plans
   */
  getDelegationPlans(): Map<string, DelegationPlan> {
    return new Map(this.delegationPlans);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    avgAnalysisLatencyMs: number;
    avgDelegationLatencyMs: number;
    avgConsensusLatencyMs: number;
    totalAnalyses: number;
    totalDelegations: number;
    totalDecisions: number;
  } {
    const avg = (arr: number[]) => arr.length > 0
      ? arr.reduce((a, b) => a + b, 0) / arr.length
      : 0;

    return {
      avgAnalysisLatencyMs: avg(this.analysisLatencies),
      avgDelegationLatencyMs: avg(this.delegationLatencies),
      avgConsensusLatencyMs: avg(this.consensusLatencies),
      totalAnalyses: this.analysisCounter,
      totalDelegations: this.planCounter,
      totalDecisions: this.decisionCounter,
    };
  }

  /**
   * Check if learning is enabled
   */
  isLearningEnabled(): boolean {
    return this.config.enableLearning && !!this.neural;
  }

  private emitEvent(type: string, data: Record<string, unknown>): void {
    const event = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      source: 'queen-coordinator',
      timestamp: new Date(),
      data,
    };

    this.emit(type, event);
    this.emit('event', event);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Queen Coordinator instance
 */
export function createQueenCoordinator(
  swarm: ISwarmCoordinator,
  config?: Partial<QueenCoordinatorConfig>,
  neural?: INeuralLearningSystem,
  memory?: IMemoryService
): QueenCoordinator {
  return new QueenCoordinator(swarm, config, neural, memory);
}

export default QueenCoordinator;
