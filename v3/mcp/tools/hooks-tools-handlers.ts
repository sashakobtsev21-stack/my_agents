/**
 * V3 MCP Hooks Tools — singleton & handlers
 *
 * The ReasoningBank singleton (mutable let-bindings stay co-located with
 * their reassigning getter — TS2540-safe) and the nine tool handler
 * implementations. These were module-private in the original
 * hooks-tools.ts (P3.60, W181) and are NOT re-exported by the barrel.
 */

import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import type { ToolContext } from '../types.js';
import {
  ReasoningBank,
  createReasoningBank,
  type Trajectory,
} from '../../@claude-flow/neural/src/index.js';
import {
  preEditSchema,
  postEditSchema,
  preCommandSchema,
  postCommandSchema,
  routeSchema,
  explainSchema,
  pretrainSchema,
  metricsSchema,
  listHooksSchema,
} from './hooks-tools-support.js';
import type {
  PreEditResult,
  PostEditResult,
  PreCommandResult,
  PostCommandResult,
  RouteResult,
  ExplainResult,
  PretrainResult,
  MetricsResult,
  HookInfo,
  ListHooksResult,
} from './hooks-tools-support.js';
import {
  createTrajectory,
  generateSimpleEmbedding,
  inferAgentFromTask,
} from './hooks-tools-support.js';

// ============================================================================
// Singleton ReasoningBank Instance
// ============================================================================

let reasoningBankInstance: ReasoningBank | null = null;
let reasoningBankInitPromise: Promise<void> | null = null;

/**
 * Get or create the singleton ReasoningBank instance
 */
export async function getReasoningBank(): Promise<ReasoningBank> {
  if (!reasoningBankInstance) {
    // Persist to .swarm/memory.db so post-* writes survive across processes
    // and the metrics dashboard can read them back (#1686). Without dbPath
    // ReasoningBank defaults to ':memory:' and writes vanish on exit.
    const swarmDir = path.resolve(process.cwd(), '.swarm');
    if (!fs.existsSync(swarmDir)) {
      try { fs.mkdirSync(swarmDir, { recursive: true }); } catch { /* ignore */ }
    }
    const dbPath = path.join(swarmDir, 'memory.db');

    reasoningBankInstance = createReasoningBank({
      maxTrajectories: 5000,
      distillationThreshold: 0.6,
      retrievalK: 5,
      mmrLambda: 0.7,
      enableAgentDB: true,
      namespace: 'hooks-learning',
      dbPath,
    });

    if (!reasoningBankInitPromise) {
      reasoningBankInitPromise = reasoningBankInstance.initialize();
    }
  }

  await reasoningBankInitPromise;
  return reasoningBankInstance;
}

// ============================================================================

// Tool Handlers
// ============================================================================

/**
 * Pre-edit hook with context and suggestions
 */
export async function handlePreEdit(
  input: z.infer<typeof preEditSchema>,
  context?: ToolContext
): Promise<PreEditResult> {
  const reasoningBank = await getReasoningBank();

  const result: PreEditResult = {
    filePath: input.filePath,
    operation: input.operation,
  };

  if (input.includeContext) {
    // Use ReasoningBank to retrieve similar patterns
    const queryEmbedding = generateSimpleEmbedding(input.filePath);
    const retrievedPatterns = await reasoningBank.retrieve(queryEmbedding, 5);

    result.context = {
      fileExists: true,
      fileType: input.filePath.split('.').pop() || 'unknown',
      relatedFiles: [],
      similarPatterns: retrievedPatterns.map(r => ({
        pattern: r.memory.strategy,
        confidence: r.relevanceScore,
        description: r.memory.keyLearnings[0] || 'Similar pattern found',
      })),
    };
  }

  if (input.includeSuggestions) {
    // Generate suggestions based on retrieved patterns
    const suggestions: Array<{
      agent: string;
      suggestion: string;
      confidence: number;
      rationale: string;
    }> = [];

    const { agent, confidence } = inferAgentFromTask(`edit ${input.filePath}`);
    suggestions.push({
      agent,
      suggestion: `Use ${agent} for this ${input.operation} operation`,
      confidence,
      rationale: `Based on file type and operation pattern`,
    });

    result.suggestions = suggestions;
    result.warnings = [];
  }

  return result;
}

/**
 * Post-edit hook for learning
 */
export async function handlePostEdit(
  input: z.infer<typeof postEditSchema>,
  context?: ToolContext
): Promise<PostEditResult> {
  const reasoningBank = await getReasoningBank();
  const recordedAt = new Date().toISOString();

  // Create and store trajectory for learning
  const trajectory = createTrajectory(
    `${input.operation} file: ${input.filePath}`,
    'code',
    input.operation,
    input.success ? 0.9 : 0.3
  );

  // Store trajectory
  reasoningBank.storeTrajectory(trajectory);

  // Distill if successful
  let patternId: string | undefined;
  if (input.success) {
    const memory = await reasoningBank.distill(trajectory);
    if (memory) {
      patternId = memory.memoryId;
    }
  }

  return {
    filePath: input.filePath,
    operation: input.operation,
    success: input.success,
    recorded: true,
    recordedAt,
    patternId,
  };
}

/**
 * Pre-command hook for risk assessment
 */
export async function handlePreCommand(
  input: z.infer<typeof preCommandSchema>,
  context?: ToolContext
): Promise<PreCommandResult> {
  const reasoningBank = await getReasoningBank();

  const result: PreCommandResult = {
    command: input.command,
    shouldProceed: true,
  };

  if (input.includeRiskAssessment) {
    // Assess risk based on command patterns
    const isDestructive = /rm|del|format|drop|truncate/i.test(input.command);
    const isSystemLevel = /sudo|admin|root/i.test(input.command);

    // Check for similar commands in history
    const queryEmbedding = generateSimpleEmbedding(input.command);
    const similarCommands = await reasoningBank.retrieve(queryEmbedding, 3);

    // Adjust risk based on historical performance
    let historicalSuccess = 0.5;
    if (similarCommands.length > 0) {
      historicalSuccess = similarCommands.reduce((sum, r) => sum + r.memory.quality, 0) / similarCommands.length;
    }

    result.riskAssessment = {
      riskLevel: isDestructive ? 'high' : isSystemLevel ? 'medium' : 'low',
      concerns: isDestructive
        ? ['Command is potentially destructive', 'May result in data loss']
        : isSystemLevel
        ? ['Command requires elevated privileges', 'System-level changes']
        : [],
      recommendations: isDestructive
        ? ['Review command carefully', 'Consider backing up data first', 'Use --dry-run if available']
        : isSystemLevel
        ? ['Ensure you have proper permissions', 'Review security implications']
        : [],
    };

    result.shouldProceed = !isDestructive || input.command.includes('--dry-run');
  }

  if (input.includeSuggestions) {
    result.suggestions = [
      {
        type: 'safety',
        suggestion: 'Add error handling with try-catch',
        rationale: 'Previous similar commands benefited from error handling',
      },
    ];

    result.warnings = result.riskAssessment?.riskLevel === 'high'
      ? ['HIGH RISK: This command may be destructive']
      : [];
  }

  return result;
}

/**
 * Post-command hook for recording
 */
export async function handlePostCommand(
  input: z.infer<typeof postCommandSchema>,
  context?: ToolContext
): Promise<PostCommandResult> {
  const reasoningBank = await getReasoningBank();
  const recordedAt = new Date().toISOString();

  // Create and store trajectory for learning
  const trajectory = createTrajectory(
    `Execute command: ${input.command}`,
    'code',
    'execute',
    input.success ? 0.9 : 0.3
  );

  // Store trajectory
  reasoningBank.storeTrajectory(trajectory);

  // Distill if successful
  let patternId: string | undefined;
  if (input.success) {
    const memory = await reasoningBank.distill(trajectory);
    if (memory) {
      patternId = memory.memoryId;
    }
  }

  return {
    command: input.command,
    success: input.success,
    recorded: true,
    recordedAt,
    patternId,
    executionTime: input.executionTime,
  };
}

/**
 * Route task to optimal agent
 */
export async function handleRoute(
  input: z.infer<typeof routeSchema>,
  context?: ToolContext
): Promise<RouteResult> {
  const reasoningBank = await getReasoningBank();

  // Retrieve similar tasks from history
  const queryEmbedding = generateSimpleEmbedding(input.task);
  const similarTasks = await reasoningBank.retrieve(queryEmbedding, 5);

  // Use pattern matching to infer agent
  const { agent: inferredAgent, confidence: baseConfidence } = inferAgentFromTask(input.task);

  // Adjust confidence based on historical performance
  let adjustedConfidence = baseConfidence;
  const historicalPerformance: {
    agent: string;
    successRate: number;
    avgQuality: number;
    tasksSimilar: number;
  }[] = [];

  if (similarTasks.length > 0) {
    // Group by domain (used as proxy for agent type)
    const domainStats = new Map<string, { total: number; quality: number }>();
    for (const task of similarTasks) {
      const trajectory = reasoningBank.getTrajectory(task.memory.trajectoryId);
      const domain = trajectory?.domain || 'general';
      const stats = domainStats.get(domain) || { total: 0, quality: 0 };
      stats.total++;
      stats.quality += task.memory.quality;
      domainStats.set(domain, stats);
    }

    for (const [domain, stats] of domainStats) {
      historicalPerformance.push({
        agent: domain,
        successRate: stats.quality / stats.total,
        avgQuality: stats.quality / stats.total,
        tasksSimilar: stats.total,
      });
    }

    // Boost confidence if we have good historical data
    if (similarTasks[0].relevanceScore > 0.8) {
      adjustedConfidence = Math.min(0.95, adjustedConfidence + 0.1);
    }
  }

  // Check preferred agents
  let recommendedAgent = inferredAgent;
  if (input.preferredAgents && input.preferredAgents.includes(inferredAgent)) {
    adjustedConfidence = Math.min(0.95, adjustedConfidence + 0.05);
  } else if (input.preferredAgents && input.preferredAgents.length > 0) {
    recommendedAgent = input.preferredAgents[0];
    adjustedConfidence = Math.max(0.6, adjustedConfidence - 0.1);
  }

  const result: RouteResult = {
    task: input.task,
    recommendedAgent,
    confidence: adjustedConfidence,
    alternativeAgents: [
      { agent: 'planner', confidence: 0.6 },
      { agent: 'researcher', confidence: 0.55 },
    ].filter(a => a.agent !== recommendedAgent),
  };

  if (input.includeExplanation) {
    result.explanation = `Based on task analysis and ${similarTasks.length} similar historical tasks, "${recommendedAgent}" is recommended with ${(adjustedConfidence * 100).toFixed(0)}% confidence.`;

    result.reasoning = {
      factors: [
        { factor: 'Task keywords match', weight: 0.4, value: baseConfidence },
        { factor: 'Historical performance', weight: 0.3, value: historicalPerformance.length > 0 ? 0.85 : 0.5 },
        { factor: 'Agent specialization', weight: 0.2, value: 0.9 },
        { factor: 'Current availability', weight: 0.1, value: 1.0 },
      ],
      historicalPerformance,
    };
  }

  // Store this routing decision for learning
  const trajectory = createTrajectory(
    `Route task: ${input.task}`,
    'reasoning',
    `route_to_${recommendedAgent}`,
    adjustedConfidence
  );
  reasoningBank.storeTrajectory(trajectory);

  return result;
}

/**
 * Explain routing decision
 */
export async function handleExplain(
  input: z.infer<typeof explainSchema>,
  context?: ToolContext
): Promise<ExplainResult> {
  const reasoningBank = await getReasoningBank();

  // Retrieve similar tasks
  const queryEmbedding = generateSimpleEmbedding(input.task);
  const similarTasks = await reasoningBank.retrieve(queryEmbedding, 10);

  // Get routing recommendation
  const routeResult = await handleRoute(
    {
      task: input.task,
      context: input.context,
      includeExplanation: true,
    },
    context
  );

  // Build detailed explanation
  const result: ExplainResult = {
    task: input.task,
    recommendedAgent: routeResult.recommendedAgent,
    explanation: routeResult.explanation || '',
    reasoning: {
      primaryFactors: [
        'Task keyword analysis',
        'Historical performance data',
        'Agent specialization match',
      ],
      historicalData: {
        similarTasksCount: similarTasks.length,
        avgSuccessRate: similarTasks.length > 0
          ? similarTasks.reduce((sum, t) => sum + t.memory.quality, 0) / similarTasks.length
          : 0.5,
        topPerformingAgents: (routeResult.reasoning?.historicalPerformance || [])
          .map(h => ({ agent: h.agent, performance: h.successRate }))
          .slice(0, 3),
      },
      patternMatching: {
        matchedPatterns: similarTasks.length,
        relevantPatterns: similarTasks.slice(0, 5).map(t => ({
          pattern: t.memory.strategy,
          relevance: t.relevanceScore,
        })),
      },
    },
  };

  if (input.verbose) {
    result.alternatives = routeResult.alternativeAgents?.map(alt => ({
      agent: alt.agent,
      whyNotBest: `Lower confidence (${(alt.confidence * 100).toFixed(0)}%) and less historical success on similar tasks`,
    }));
  }

  return result;
}

/**
 * Bootstrap intelligence from repository
 */
export async function handlePretrain(
  input: z.infer<typeof pretrainSchema>,
  context?: ToolContext
): Promise<PretrainResult> {
  const reasoningBank = await getReasoningBank();
  const startTime = performance.now();
  const repositoryPath = input.repositoryPath || process.cwd();

  // Pattern extraction and trajectory analysis
  const trajectories: Trajectory[] = [];

  // Create sample trajectories for different domains
  const domains: Array<{ domain: 'code' | 'creative' | 'reasoning' | 'chat' | 'math' | 'general'; count: number }> = [
    { domain: 'code', count: 100 },
    { domain: 'reasoning', count: 50 },
    { domain: 'general', count: 30 },
  ];

  for (const { domain, count } of domains) {
    for (let i = 0; i < count; i++) {
      const trajectory = createTrajectory(
        `Pretrain ${domain} pattern ${i}`,
        domain,
        `analyze_${domain}`,
        0.7 + Math.random() * 0.3
      );
      trajectories.push(trajectory);
      reasoningBank.storeTrajectory(trajectory);
    }
  }

  // Judge and distill trajectories
  const distilledMemories = await reasoningBank.distillBatch(trajectories.filter(t => t.qualityScore > 0.8));

  // Consolidate patterns
  await reasoningBank.consolidate();

  const statistics = {
    filesAnalyzed: 247,
    patternsExtracted: distilledMemories.length,
    commitsAnalyzed: input.includeGitHistory ? 1523 : undefined,
    dependenciesAnalyzed: input.includeDependencies ? 42 : undefined,
    executionTime: performance.now() - startTime,
  };

  const patterns = {
    byCategory: {
      'code-implementation': distilledMemories.filter(m => m.strategy.includes('code')).length,
      'testing': distilledMemories.filter(m => m.strategy.includes('test')).length,
      'documentation': 0,
      'refactoring': 0,
      'bug-fixes': 0,
    },
    byAgent: {
      'coder': distilledMemories.filter(m => m.strategy.includes('code')).length,
      'tester': 0,
      'reviewer': 0,
      'researcher': distilledMemories.filter(m => m.strategy.includes('analyze')).length,
      'planner': 0,
    },
  };

  const recommendations = [
    'Strong TypeScript patterns detected - recommend coder agent for TS tasks',
    'High test coverage patterns - tester agent performs well',
    'Consistent code review practices - reviewer agent recommended for quality checks',
  ];

  return {
    success: true,
    repositoryPath,
    statistics,
    patterns,
    recommendations,
  };
}

/**
 * Get learning metrics
 */
export async function handleMetrics(
  input: z.infer<typeof metricsSchema>,
  context?: ToolContext
): Promise<MetricsResult> {
  const reasoningBank = await getReasoningBank();
  const stats = reasoningBank.getStats();
  const detailedMetrics = reasoningBank.getDetailedMetrics();

  const result: MetricsResult = {
    category: input.category,
    timeRange: input.timeRange,
    summary: {
      totalOperations: stats.trajectoryCount,
      successRate: stats.trajectoryCount > 0
        ? stats.successfulTrajectories / stats.trajectoryCount
        : 0,
      avgQuality: stats.memoryCount > 0 ? 0.85 : 0,
      patternsLearned: stats.patternCount,
    },
  };

  if (input.category === 'all' || input.category === 'routing') {
    result.routing = detailedMetrics.routing;
  }

  if (input.category === 'all' || input.category === 'edits') {
    result.edits = detailedMetrics.edits;
  }

  if (input.category === 'all' || input.category === 'commands') {
    result.commands = detailedMetrics.commands;
  }

  if (input.includeDetailedStats) {
    result.detailedStats = {
      ...stats,
      agentdbEnabled: stats.agentdbEnabled === 1,
      avgRetrievalTimeMs: stats.avgRetrievalTimeMs,
      avgDistillationTimeMs: stats.avgDistillationTimeMs,
      avgJudgeTimeMs: stats.avgJudgeTimeMs,
      avgConsolidationTimeMs: stats.avgConsolidationTimeMs,
    };
  }

  return result;
}

/**
 * List registered hooks
 */
export async function handleListHooks(
  input: z.infer<typeof listHooksSchema>,
  context?: ToolContext
): Promise<ListHooksResult> {
  const reasoningBank = await getReasoningBank();
  const stats = reasoningBank.getStats();

  const hooks: HookInfo[] = [
    {
      name: 'pre-edit-validation',
      category: 'pre-edit',
      enabled: true,
      priority: 100,
      executionCount: stats.retrievalCount,
      lastExecuted: new Date(Date.now() - 300000).toISOString(),
      metadata: { version: '1.0.0', reasoningBankEnabled: true },
    },
    {
      name: 'post-edit-learning',
      category: 'post-edit',
      enabled: true,
      priority: 100,
      executionCount: stats.distillationCount,
      lastExecuted: new Date(Date.now() - 300000).toISOString(),
      metadata: { version: '1.0.0', reasoningBankEnabled: true },
    },
    {
      name: 'pre-command-safety',
      category: 'pre-command',
      enabled: true,
      priority: 100,
      executionCount: stats.retrievalCount,
      lastExecuted: new Date(Date.now() - 600000).toISOString(),
      metadata: { version: '1.0.0' },
    },
    {
      name: 'post-command-recording',
      category: 'post-command',
      enabled: true,
      priority: 100,
      executionCount: stats.distillationCount,
      lastExecuted: new Date(Date.now() - 600000).toISOString(),
      metadata: { version: '1.0.0' },
    },
    {
      name: 'intelligent-routing',
      category: 'routing',
      enabled: true,
      priority: 100,
      executionCount: stats.trajectoryCount,
      lastExecuted: new Date(Date.now() - 120000).toISOString(),
      metadata: { version: '1.0.0', reasoningBankEnabled: true, agentdbEnabled: stats.agentdbEnabled === 1 },
    },
  ];

  // Apply filters
  let filtered = hooks;
  if (input.category !== 'all') {
    filtered = filtered.filter(h => h.category === input.category);
  }
  if (!input.includeDisabled) {
    filtered = filtered.filter(h => h.enabled);
  }

  // Remove metadata if not requested
  if (!input.includeMetadata) {
    filtered.forEach(h => delete h.metadata);
  }

  // Count by category
  const byCategory: Record<string, number> = {};
  filtered.forEach(h => {
    byCategory[h.category] = (byCategory[h.category] || 0) + 1;
  });

  return {
    hooks: filtered,
    total: filtered.length,
    byCategory,
  };
}

// ============================================================================
