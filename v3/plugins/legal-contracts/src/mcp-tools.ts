/**
 * Legal Contracts Plugin - MCP Tools
 *
 * Implements 5 MCP tools for legal contract analysis:
 * 1. legal/clause-extract - Extract and classify clauses
 * 2. legal/risk-assess - Identify and score contractual risks
 * 3. legal/contract-compare - Compare contracts with attention-based alignment
 * 4. legal/obligation-track - Extract obligations with DAG analysis
 * 5. legal/playbook-match - Match clauses against negotiation playbook
 *
 * Based on ADR-034: Legal Contract Analysis Plugin
 *
 * @module v3/plugins/legal-contracts/mcp-tools
 */

import { z } from 'zod';
import type {
  ClauseExtractionResult,
  RiskAssessmentResult,
  ContractComparisonResult,
  ObligationTrackingResult,
  PlaybookMatchResult,
  ExtractedClause,
  RiskFinding,
  Obligation,
  PlaybookMatch,
  DocumentMetadata,
  IAttentionBridge,
  IDAGBridge,
} from './types.js';
import {
  ClauseExtractInputSchema,
  RiskAssessInputSchema,
  ContractCompareInputSchema,
  ObligationTrackInputSchema,
  PlaybookMatchInputSchema,
  ClauseType,
  RiskCategory,
  RiskSeverity,
} from './types.js';
import { createAttentionBridge } from './bridges/attention-bridge.js';
import { createDAGBridge } from './bridges/dag-bridge.js';

// ============================================================================

// The public tool types and the private analysis helpers were extracted
// into ./mcp-tools-types.ts and ./mcp-tools-helpers.ts during the P3.64
// god-file decomposition (W185). Re-export the three public types; the
// helpers stay module-private to this surface.
export type { MCPTool, ToolContext, MCPToolResult } from './mcp-tools-types.js';
import type { MCPTool, ToolContext } from './mcp-tools-types.js';
import {
  assessRisks,
  buildCategorySummary,
  buildNegotiationPriorities,
  buildTimeline,
  calculateOverallRiskScore,
  detectChanges,
  extractClauses,
  extractObligations,
  filterByTimeframe,
  generateRedlineMarkup,
  getSeverityLevel,
  matchAgainstPlaybook,
  parseDocumentMetadata,
  parsePlaybook,
  scoreToGrade,
} from './mcp-tools-helpers.js';

// Clause Extract Tool
// ============================================================================

/**
 * MCP Tool: legal/clause-extract
 *
 * Extract and classify clauses from legal documents
 */
export const clauseExtractTool: MCPTool<
  z.infer<typeof ClauseExtractInputSchema>,
  ClauseExtractionResult
> = {
  name: 'legal/clause-extract',
  description: 'Extract and classify clauses from legal documents',
  category: 'legal',
  version: '3.0.0-alpha.1',
  inputSchema: ClauseExtractInputSchema,
  handler: async (input, context) => {
    const startTime = Date.now();

    try {
      // Validate input
      const validated = ClauseExtractInputSchema.parse(input);

      // Parse document and extract clauses
      const metadata = parseDocumentMetadata(validated.document);
      const clauses = await extractClauses(
        validated.document,
        validated.clauseTypes,
        validated.jurisdiction,
        context
      );

      // Separate classified and unclassified
      const classifiedClauses = clauses.filter(c => c.confidence >= 0.7);
      const unclassified = clauses
        .filter(c => c.confidence < 0.7)
        .map(c => ({
          text: c.text,
          startOffset: c.startOffset,
          endOffset: c.endOffset,
          reason: `Low confidence: ${(c.confidence * 100).toFixed(1)}%`,
        }));

      const result: ClauseExtractionResult = {
        success: true,
        clauses: classifiedClauses,
        metadata,
        unclassified,
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
// Risk Assess Tool
// ============================================================================

/**
 * MCP Tool: legal/risk-assess
 *
 * Assess contractual risks with severity scoring
 */
export const riskAssessTool: MCPTool<
  z.infer<typeof RiskAssessInputSchema>,
  RiskAssessmentResult
> = {
  name: 'legal/risk-assess',
  description: 'Assess contractual risks with severity scoring',
  category: 'legal',
  version: '3.0.0-alpha.1',
  inputSchema: RiskAssessInputSchema,
  handler: async (input, context) => {
    const startTime = Date.now();

    try {
      const validated = RiskAssessInputSchema.parse(input);

      // Extract clauses first
      const clauses = await extractClauses(validated.document, undefined, 'US', context);

      // Assess risks
      const risks = await assessRisks(
        clauses,
        validated.partyRole,
        validated.riskCategories,
        validated.industryContext
      );

      // Filter by threshold if specified
      const filteredRisks = validated.threshold
        ? risks.filter(r => getSeverityLevel(r.severity) >= getSeverityLevel(validated.threshold!))
        : risks;

      // Build category summary
      const categorySummary = buildCategorySummary(filteredRisks);

      // Calculate overall score
      const overallScore = calculateOverallRiskScore(filteredRisks);
      const grade = scoreToGrade(overallScore);

      const result: RiskAssessmentResult = {
        success: true,
        partyRole: validated.partyRole,
        risks: filteredRisks,
        categorySummary,
        overallScore,
        grade,
        criticalRisks: filteredRisks
          .filter(r => r.severity === 'critical' || r.severity === 'high')
          .slice(0, 5),
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
// Contract Compare Tool
// ============================================================================

/**
 * MCP Tool: legal/contract-compare
 *
 * Compare two contracts with detailed diff and semantic alignment
 */
export const contractCompareTool: MCPTool<
  z.infer<typeof ContractCompareInputSchema>,
  ContractComparisonResult
> = {
  name: 'legal/contract-compare',
  description: 'Compare two contracts with detailed diff and semantic alignment',
  category: 'legal',
  version: '3.0.0-alpha.1',
  inputSchema: ContractCompareInputSchema,
  handler: async (input, context) => {
    const startTime = Date.now();

    try {
      const validated = ContractCompareInputSchema.parse(input);

      // Extract clauses from both documents
      const baseClauses = await extractClauses(validated.baseDocument, undefined, 'US', context);
      const compareClauses = await extractClauses(validated.compareDocument, undefined, 'US', context);

      // Initialize attention bridge
      const attention = context.bridges.attention;
      if (!attention.isInitialized()) {
        await attention.initialize();
      }

      // Align clauses using attention
      const alignments = await attention.alignClauses(baseClauses, compareClauses);

      // Detect changes
      const changes = detectChanges(baseClauses, compareClauses, alignments);

      // Calculate similarity score
      const similarityScore = alignments.length > 0
        ? alignments.reduce((sum, a) => sum + a.similarity, 0) / alignments.length
        : 0;

      // Build summary
      const summary = {
        totalChanges: changes.length,
        added: changes.filter(c => c.type === 'added').length,
        removed: changes.filter(c => c.type === 'removed').length,
        modified: changes.filter(c => c.type === 'modified').length,
        favorable: changes.filter(c => c.impact === 'favorable').length,
        unfavorable: changes.filter(c => c.impact === 'unfavorable').length,
      };

      // Generate redline if requested
      const redlineMarkup = validated.generateRedline
        ? generateRedlineMarkup(validated.baseDocument, changes)
        : undefined;

      const result: ContractComparisonResult = {
        success: true,
        mode: validated.comparisonMode,
        changes,
        alignments,
        similarityScore,
        summary,
        redlineMarkup,
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
// Obligation Track Tool
// ============================================================================

/**
 * MCP Tool: legal/obligation-track
 *
 * Extract obligations, deadlines, and dependencies using DAG analysis
 */
export const obligationTrackTool: MCPTool<
  z.infer<typeof ObligationTrackInputSchema>,
  ObligationTrackingResult
> = {
  name: 'legal/obligation-track',
  description: 'Extract obligations, deadlines, and dependencies using DAG analysis',
  category: 'legal',
  version: '3.0.0-alpha.1',
  inputSchema: ObligationTrackInputSchema,
  handler: async (input, context) => {
    const startTime = Date.now();

    try {
      const validated = ObligationTrackInputSchema.parse(input);

      // Extract obligations
      let obligations = await extractObligations(
        validated.document,
        validated.obligationTypes
      );

      // Filter by party if specified
      if (validated.party) {
        obligations = obligations.filter(o =>
          o.party.toLowerCase().includes(validated.party!.toLowerCase())
        );
      }

      // Filter by timeframe if specified
      if (validated.timeframe) {
        obligations = filterByTimeframe(obligations, validated.timeframe);
      }

      // Initialize DAG bridge
      const dag = context.bridges.dag;
      if (!dag.isInitialized()) {
        await dag.initialize();
      }

      // Build dependency graph
      const graph = await dag.buildDependencyGraph(obligations);

      // Build timeline
      const timeline = buildTimeline(obligations);

      // Find upcoming deadlines (next 30 days)
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const upcomingDeadlines = obligations.filter(o =>
        o.dueDate && o.dueDate >= now && o.dueDate <= thirtyDaysLater
      );

      // Find overdue
      const overdue = obligations.filter(o =>
        o.dueDate && o.dueDate < now && o.status !== 'completed' && o.status !== 'waived'
      );

      const result: ObligationTrackingResult = {
        success: true,
        obligations,
        graph,
        timeline,
        upcomingDeadlines,
        overdue,
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
// Playbook Match Tool
// ============================================================================

/**
 * MCP Tool: legal/playbook-match
 *
 * Compare contract clauses against negotiation playbook
 */
export const playbookMatchTool: MCPTool<
  z.infer<typeof PlaybookMatchInputSchema>,
  PlaybookMatchResult
> = {
  name: 'legal/playbook-match',
  description: 'Compare contract clauses against negotiation playbook',
  category: 'legal',
  version: '3.0.0-alpha.1',
  inputSchema: PlaybookMatchInputSchema,
  handler: async (input, context) => {
    const startTime = Date.now();

    try {
      const validated = PlaybookMatchInputSchema.parse(input);

      // Parse playbook
      const playbook = parsePlaybook(validated.playbook);

      // Extract clauses from document
      const clauses = await extractClauses(validated.document, undefined, 'US', context);

      // Initialize attention bridge
      const attention = context.bridges.attention;
      if (!attention.isInitialized()) {
        await attention.initialize();
      }

      // Match clauses against playbook
      const matches = await matchAgainstPlaybook(
        clauses,
        playbook,
        validated.strictness,
        validated.suggestAlternatives,
        attention
      );

      // Build summary
      const summary = {
        totalClauses: matches.length,
        matchesPreferred: matches.filter(m => m.status === 'matches_preferred').length,
        matchesAcceptable: matches.filter(m => m.status === 'matches_acceptable').length,
        requiresFallback: matches.filter(m => m.status === 'requires_fallback').length,
        violatesRedline: matches.filter(m => m.status === 'violates_redline').length,
        noMatch: matches.filter(m => m.status === 'no_match').length,
      };

      // Find red line violations
      const redLineViolations = matches.filter(m => m.status === 'violates_redline');

      // Prioritize negotiations
      const negotiationPriorities = buildNegotiationPriorities(matches, validated.prioritizeClauses);

      const result: PlaybookMatchResult = {
        success: true,
        playbook: {
          id: playbook.id,
          name: playbook.name,
          version: playbook.version,
        },
        matches,
        summary,
        redLineViolations,
        negotiationPriorities,
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
 * All Legal Contracts MCP Tools
 */
export const legalContractsTools: MCPTool[] = [
  clauseExtractTool as unknown as MCPTool,
  riskAssessTool as unknown as MCPTool,
  contractCompareTool as unknown as MCPTool,
  obligationTrackTool as unknown as MCPTool,
  playbookMatchTool as unknown as MCPTool,
];

/**
 * Tool name to handler map
 */
export const toolHandlers = new Map<string, MCPTool['handler']>([
  ['legal/clause-extract', clauseExtractTool.handler as MCPTool['handler']],
  ['legal/risk-assess', riskAssessTool.handler as MCPTool['handler']],
  ['legal/contract-compare', contractCompareTool.handler as MCPTool['handler']],
  ['legal/obligation-track', obligationTrackTool.handler as MCPTool['handler']],
  ['legal/playbook-match', playbookMatchTool.handler as MCPTool['handler']],
]);

/**
 * Create tool context with bridges
 */
export function createToolContext(): ToolContext {
  const store = new Map<string, unknown>();

  return {
    get: <T>(key: string) => store.get(key) as T | undefined,
    set: <T>(key: string, value: T) => { store.set(key, value); },
    bridges: {
      attention: createAttentionBridge(),
      dag: createDAGBridge(),
    },
  };
}

export default legalContractsTools;
