/**
 * Code Intelligence Plugin - MCP Tools
 *
 * Implements 5 MCP tools for advanced code analysis:
 * 1. code/semantic-search - Find semantically similar code patterns
 * 2. code/architecture-analyze - Analyze codebase architecture
 * 3. code/refactor-impact - Predict refactoring impact using GNN
 * 4. code/split-suggest - Suggest module splits using MinCut
 * 5. code/learn-patterns - Learn patterns from code history
 *
 * Based on ADR-035: Advanced Code Intelligence Plugin
 *
 * @module v3/plugins/code-intelligence/mcp-tools
 */

import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import type {
  SemanticSearchResult,
  ArchitectureAnalysisResult,
  RefactoringImpactResult,
  ModuleSplitResult,
  PatternLearningResult,
  CodeSearchResult,
  DependencyGraph,
  FileImpact,
  SuggestedModule,
  LearnedPattern,
  IGNNBridge,
  IMinCutBridge,
} from './types.js';
import {
  SemanticSearchInputSchema,
  ArchitectureAnalyzeInputSchema,
  RefactorImpactInputSchema,
  SplitSuggestInputSchema,
  LearnPatternsInputSchema,
  CodeIntelligenceError,
  CodeIntelligenceErrorCodes,
  maskSecrets,
  type AnalysisType,
} from './types.js';
import { createGNNBridge } from './bridges/gnn-bridge.js';
import { createMinCutBridge } from './bridges/mincut-bridge.js';

// ============================================================================

// The public tool types and the private security/analysis helpers were
// extracted into ./mcp-tools-types.ts and ./mcp-tools-helpers.ts during
// the P3.63 god-file decomposition (W184). Re-export the three public
// types; the helpers stay module-private to this surface.
export type { MCPTool, ToolContext, MCPToolResult } from './mcp-tools-types.js';
import type { MCPTool, ToolContext } from './mcp-tools-types.js';
import {
  isSensitivePath,
  validatePath,
  analyzeAPISurface,
  buildSuggestedModules,
  calculateCohesionMetrics,
  calculateCouplingMetrics,
  calculateHealthScore,
  countModules,
  detectCircularDeps,
  detectDrift,
  detectLayerViolations,
  findBreakingChanges,
  findDeadCode,
  generateMigrationSteps,
  generateRecommendations,
  getAffectedTests,
  getAllRelatedFiles,
  getChangesNeeded,
  getFilesInPath,
  getSuggestedOrder,
  learnPatternsFromHistory,
  performSemanticSearch,
} from './mcp-tools-helpers.js';

// Semantic Search Tool
// ============================================================================

/**
 * MCP Tool: code/semantic-search
 *
 * Search for semantically similar code patterns
 */
export const semanticSearchTool: MCPTool<
  z.infer<typeof SemanticSearchInputSchema>,
  SemanticSearchResult
> = {
  name: 'code/semantic-search',
  description: 'Search for semantically similar code patterns',
  category: 'code-intelligence',
  version: '3.0.0-alpha.1',
  inputSchema: SemanticSearchInputSchema,
  handler: async (input, context) => {
    const startTime = Date.now();

    try {
      const validated = SemanticSearchInputSchema.parse(input);

      // Validate paths
      const paths = validated.scope?.paths?.map(p =>
        validatePath(p, context.config.allowedRoots)
      ) ?? ['.'];

      // Filter out sensitive files
      const safePaths = paths.filter(p =>
        !isSensitivePath(p, context.config.blockedPatterns)
      );

      // Initialize GNN bridge for semantic embeddings
      const gnn = context.bridges.gnn;
      if (!gnn.isInitialized()) {
        await gnn.initialize();
      }

      // Perform search (simplified - in production would use vector index)
      const results = await performSemanticSearch(
        validated.query,
        safePaths,
        validated.searchType,
        validated.topK,
        validated.scope?.languages,
        validated.scope?.excludeTests ?? false,
        context
      );

      // Mask secrets in results
      if (context.config.maskSecrets) {
        for (const result of results) {
          (result as { snippet: string }).snippet = maskSecrets(result.snippet);
          (result as { context: string }).context = maskSecrets(result.context);
        }
      }

      const result: SemanticSearchResult = {
        success: true,
        query: validated.query,
        searchType: validated.searchType,
        results,
        totalMatches: results.length,
        scope: {
          paths: safePaths,
          languages: validated.scope?.languages,
          excludeTests: validated.scope?.excludeTests,
        },
        durationMs: Date.now() - startTime,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          }, null, 2),
        }],
      };
    }
  },
};

// ============================================================================
// Architecture Analyze Tool
// ============================================================================

/**
 * MCP Tool: code/architecture-analyze
 *
 * Analyze codebase architecture and detect drift
 */
export const architectureAnalyzeTool: MCPTool<
  z.infer<typeof ArchitectureAnalyzeInputSchema>,
  ArchitectureAnalysisResult
> = {
  name: 'code/architecture-analyze',
  description: 'Analyze codebase architecture and detect drift',
  category: 'code-intelligence',
  version: '3.0.0-alpha.1',
  inputSchema: ArchitectureAnalyzeInputSchema,
  handler: async (input, context) => {
    const startTime = Date.now();

    try {
      const validated = ArchitectureAnalyzeInputSchema.parse(input);

      // Validate root path
      const rootPath = validatePath(validated.rootPath, context.config.allowedRoots);

      // Initialize GNN bridge
      const gnn = context.bridges.gnn;
      if (!gnn.isInitialized()) {
        await gnn.initialize();
      }

      // Determine analyses to perform
      const analyses = validated.analysis ?? [
        'dependency_graph',
        'circular_deps',
        'component_coupling',
      ];

      // Build dependency graph
      const files = await getFilesInPath(rootPath);
      const safeFiles = files.filter(f =>
        !isSensitivePath(f, context.config.blockedPatterns)
      );

      const dependencyGraph = await gnn.buildCodeGraph(safeFiles, true);

      // Perform requested analyses
      const result: ArchitectureAnalysisResult = {
        success: true,
        rootPath,
        analyses: analyses as AnalysisType[],
        dependencyGraph: analyses.includes('dependency_graph') ? dependencyGraph : undefined,
        layerViolations: analyses.includes('layer_violations')
          ? detectLayerViolations(dependencyGraph, validated.layers)
          : undefined,
        circularDeps: analyses.includes('circular_deps')
          ? detectCircularDeps(dependencyGraph)
          : undefined,
        couplingMetrics: analyses.includes('component_coupling')
          ? calculateCouplingMetrics(dependencyGraph)
          : undefined,
        cohesionMetrics: analyses.includes('module_cohesion')
          ? calculateCohesionMetrics(dependencyGraph)
          : undefined,
        deadCode: analyses.includes('dead_code')
          ? findDeadCode(dependencyGraph)
          : undefined,
        apiSurface: analyses.includes('api_surface')
          ? analyzeAPISurface(dependencyGraph)
          : undefined,
        drift: analyses.includes('architectural_drift') && validated.baseline
          ? await detectDrift(dependencyGraph, validated.baseline)
          : undefined,
        summary: {
          totalFiles: dependencyGraph.nodes.length,
          totalModules: countModules(dependencyGraph),
          healthScore: calculateHealthScore(dependencyGraph),
          issues: 0,
          warnings: 0,
        },
        durationMs: Date.now() - startTime,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          }, null, 2),
        }],
      };
    }
  },
};

// ============================================================================
// Refactor Impact Tool
// ============================================================================

/**
 * MCP Tool: code/refactor-impact
 *
 * Analyze impact of proposed code changes using GNN
 */
export const refactorImpactTool: MCPTool<
  z.infer<typeof RefactorImpactInputSchema>,
  RefactoringImpactResult
> = {
  name: 'code/refactor-impact',
  description: 'Analyze impact of proposed code changes using GNN',
  category: 'code-intelligence',
  version: '3.0.0-alpha.1',
  inputSchema: RefactorImpactInputSchema,
  handler: async (input, context) => {
    const startTime = Date.now();

    try {
      const validated = RefactorImpactInputSchema.parse(input);

      // Validate file paths
      for (const change of validated.changes) {
        validatePath(change.file, context.config.allowedRoots);
      }

      // Initialize GNN bridge
      const gnn = context.bridges.gnn;
      if (!gnn.isInitialized()) {
        await gnn.initialize();
      }

      // Get affected files
      const changedFiles = validated.changes.map(c => c.file);

      // Build graph
      const allFiles = await getAllRelatedFiles(changedFiles);
      const safeFiles = allFiles.filter(f =>
        !isSensitivePath(f, context.config.blockedPatterns)
      );

      const graph = await gnn.buildCodeGraph(safeFiles, true);

      // Predict impact using GNN propagation
      const impactScores = await gnn.predictImpact(
        graph,
        changedFiles,
        validated.depth
      );

      // Build file impacts
      const impactedFiles: FileImpact[] = [];
      for (const [filePath, score] of impactScores) {
        if (score > 0.1) {
          impactedFiles.push({
            filePath,
            impactType: changedFiles.includes(filePath) ? 'direct' :
              score > 0.5 ? 'indirect' : 'transitive',
            requiresChange: changedFiles.includes(filePath) || score > 0.7,
            changesNeeded: getChangesNeeded(filePath, validated.changes),
            risk: score > 0.8 ? 'high' : score > 0.5 ? 'medium' : 'low',
            testsAffected: validated.includeTests
              ? getAffectedTests(filePath, graph)
              : [],
          });
        }
      }

      // Sort by impact
      impactedFiles.sort((a, b) => {
        const aScore = impactScores.get(a.filePath) ?? 0;
        const bScore = impactScores.get(b.filePath) ?? 0;
        return bScore - aScore;
      });

      const result: RefactoringImpactResult = {
        success: true,
        changes: validated.changes.map(c => ({
          file: c.file,
          type: c.type,
          details: c.details ?? {},
        })),
        impactedFiles,
        summary: {
          directlyAffected: impactedFiles.filter(f => f.impactType === 'direct').length,
          indirectlyAffected: impactedFiles.filter(f => f.impactType !== 'direct').length,
          testsAffected: new Set(impactedFiles.flatMap(f => f.testsAffected)).size,
          totalRisk: impactedFiles.some(f => f.risk === 'high') ? 'high' :
            impactedFiles.some(f => f.risk === 'medium') ? 'medium' : 'low',
        },
        suggestedOrder: getSuggestedOrder(impactedFiles, graph),
        breakingChanges: findBreakingChanges(validated.changes, graph),
        durationMs: Date.now() - startTime,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          }, null, 2),
        }],
      };
    }
  },
};

// ============================================================================
// Split Suggest Tool
// ============================================================================

/**
 * MCP Tool: code/split-suggest
 *
 * Suggest optimal code splitting using MinCut algorithm
 */
export const splitSuggestTool: MCPTool<
  z.infer<typeof SplitSuggestInputSchema>,
  ModuleSplitResult
> = {
  name: 'code/split-suggest',
  description: 'Suggest optimal code splitting using MinCut algorithm',
  category: 'code-intelligence',
  version: '3.0.0-alpha.1',
  inputSchema: SplitSuggestInputSchema,
  handler: async (input, context) => {
    const startTime = Date.now();

    try {
      const validated = SplitSuggestInputSchema.parse(input);

      // Validate path
      const targetPath = validatePath(validated.targetPath, context.config.allowedRoots);

      // Initialize bridges
      const gnn = context.bridges.gnn;
      const mincut = context.bridges.mincut;

      if (!gnn.isInitialized()) await gnn.initialize();
      if (!mincut.isInitialized()) await mincut.initialize();

      // Get files
      const files = await getFilesInPath(targetPath);
      const safeFiles = files.filter(f =>
        !isSensitivePath(f, context.config.blockedPatterns)
      );

      // Build graph
      const graph = await gnn.buildCodeGraph(safeFiles, true);

      // Determine number of modules
      const targetModules = validated.targetModules ??
        Math.max(2, Math.ceil(Math.sqrt(graph.nodes.length / 5)));

      // Find optimal cuts
      const partition = await mincut.findOptimalCuts(
        graph,
        targetModules,
        validated.constraints ?? {}
      );

      // Build suggested modules
      const modules = buildSuggestedModules(graph, partition, validated.strategy);

      // Calculate cut edges
      const cutEdges: Array<{ from: string; to: string; weight: number }> = [];
      for (const edge of graph.edges) {
        const fromPart = partition.get(edge.from);
        const toPart = partition.get(edge.to);
        if (fromPart !== undefined && toPart !== undefined && fromPart !== toPart) {
          cutEdges.push({
            from: edge.from,
            to: edge.to,
            weight: edge.weight,
          });
        }
      }

      // Calculate quality metrics
      const totalCutWeight = cutEdges.reduce((sum, e) => sum + e.weight, 0);
      const avgCohesion = modules.reduce((sum, m) => sum + m.cohesion, 0) / modules.length;
      const avgCoupling = modules.reduce((sum, m) => sum + m.coupling, 0) / modules.length;
      const sizes = modules.map(m => m.loc);
      const balanceScore = 1 - (Math.max(...sizes) - Math.min(...sizes)) /
        (Math.max(...sizes) + 1);

      const result: ModuleSplitResult = {
        success: true,
        targetPath,
        strategy: validated.strategy,
        modules,
        cutEdges,
        quality: {
          totalCutWeight,
          avgCohesion,
          avgCoupling,
          balanceScore,
        },
        migrationSteps: generateMigrationSteps(modules, cutEdges),
        durationMs: Date.now() - startTime,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          }, null, 2),
        }],
      };
    }
  },
};

// ============================================================================
// Learn Patterns Tool
// ============================================================================

/**
 * MCP Tool: code/learn-patterns
 *
 * Learn recurring patterns from code changes using SONA
 */
export const learnPatternsTool: MCPTool<
  z.infer<typeof LearnPatternsInputSchema>,
  PatternLearningResult
> = {
  name: 'code/learn-patterns',
  description: 'Learn recurring patterns from code changes using SONA',
  category: 'code-intelligence',
  version: '3.0.0-alpha.1',
  inputSchema: LearnPatternsInputSchema,
  handler: async (input, context) => {
    const startTime = Date.now();

    try {
      const validated = LearnPatternsInputSchema.parse(input);

      // Analyze git history
      const scope = validated.scope ?? { gitRange: 'HEAD~100..HEAD' };
      const patternTypes = validated.patternTypes ?? [
        'bug_patterns',
        'refactor_patterns',
      ];

      // Learn patterns from commits (simplified)
      const patterns = await learnPatternsFromHistory(
        scope,
        patternTypes,
        validated.minOccurrences,
        context
      );

      // Generate recommendations
      const recommendations = generateRecommendations(patterns);

      const result: PatternLearningResult = {
        success: true,
        scope,
        patternTypes,
        patterns,
        summary: {
          commitsAnalyzed: 100, // Simplified
          filesAnalyzed: patterns.reduce((sum, p) => sum + p.files.length, 0),
          patternsFound: patterns.length,
          byType: patternTypes.reduce((acc, type) => {
            acc[type] = patterns.filter(p => p.type === type).length;
            return acc;
          }, {} as Record<string, number>),
        },
        recommendations,
        durationMs: Date.now() - startTime,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          }, null, 2),
        }],
      };
    }
  },
};

// ============================================================================

// Tool Registry
// ============================================================================

/**
 * All Code Intelligence MCP Tools
 */
export const codeIntelligenceTools: MCPTool[] = [
  semanticSearchTool as unknown as MCPTool,
  architectureAnalyzeTool as unknown as MCPTool,
  refactorImpactTool as unknown as MCPTool,
  splitSuggestTool as unknown as MCPTool,
  learnPatternsTool as unknown as MCPTool,
];

/**
 * Tool name to handler map
 */
export const toolHandlers = new Map<string, MCPTool['handler']>([
  ['code/semantic-search', semanticSearchTool.handler as MCPTool['handler']],
  ['code/architecture-analyze', architectureAnalyzeTool.handler as MCPTool['handler']],
  ['code/refactor-impact', refactorImpactTool.handler as MCPTool['handler']],
  ['code/split-suggest', splitSuggestTool.handler as MCPTool['handler']],
  ['code/learn-patterns', learnPatternsTool.handler as MCPTool['handler']],
]);

/**
 * Create tool context with bridges
 */
export function createToolContext(config?: Partial<ToolContext['config']>): ToolContext {
  const store = new Map<string, unknown>();

  const defaultBlockedPatterns = [
    /\.env$/,
    /\.git\/config$/,
    /credentials/i,
    /secrets?\./i,
    /\.pem$/,
    /\.key$/,
    /id_rsa/i,
  ];

  return {
    get: <T>(key: string) => store.get(key) as T | undefined,
    set: <T>(key: string, value: T) => { store.set(key, value); },
    bridges: {
      gnn: createGNNBridge(),
      mincut: createMinCutBridge(),
    },
    config: {
      allowedRoots: config?.allowedRoots ?? ['.'],
      blockedPatterns: config?.blockedPatterns ?? defaultBlockedPatterns,
      maskSecrets: config?.maskSecrets ?? true,
    },
  };
}

export default codeIntelligenceTools;
