/**
 * Legal Contracts MCP Tools — analysis helpers
 *
 * Clause/risk/obligation/playbook analysis helper functions. These were
 * module-private in the original mcp-tools.ts (P3.64, W185) and are
 * deliberately NOT re-exported by the mcp-tools.ts barrel — public API
 * unchanged.
 */

import type {
  ClauseType,
  DocumentMetadata,
  ExtractedClause,
  IAttentionBridge,
  Obligation,
  PlaybookMatch,
  RiskFinding,
  RiskSeverity,
} from './types.js';
import { RiskCategory } from './types.js';
import type { ToolContext } from './mcp-tools-types.js';

// Helper Functions
// ============================================================================

/**
 * Parse document metadata
 */
export function parseDocumentMetadata(document: string): DocumentMetadata {
  const hash = simpleHash(document);

  return {
    id: `doc-${hash.substring(0, 8)}`,
    format: 'txt',
    wordCount: document.split(/\s+/).length,
    charCount: document.length,
    language: 'en',
    parties: [],
    contentHash: hash,
  };
}

/**
 * Simple hash function
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Extract clauses from document
 */
export async function extractClauses(
  document: string,
  clauseTypes: ClauseType[] | undefined,
  _jurisdiction: string,
  _context: ToolContext
): Promise<ExtractedClause[]> {
  const clauses: ExtractedClause[] = [];

  // Define clause patterns
  const clausePatterns: Record<ClauseType, RegExp[]> = {
    indemnification: [/indemnif/i, /hold\s+harmless/i, /defend\s+and\s+indemnify/i],
    limitation_of_liability: [/limitation\s+of\s+liability/i, /liability\s+shall\s+not\s+exceed/i],
    termination: [/termination/i, /right\s+to\s+terminate/i, /upon\s+termination/i],
    confidentiality: [/confidential/i, /non-disclosure/i, /proprietary\s+information/i],
    ip_assignment: [/intellectual\s+property/i, /assignment\s+of\s+(ip|rights)/i, /work\s+for\s+hire/i],
    governing_law: [/governing\s+law/i, /governed\s+by\s+the\s+laws/i, /jurisdiction/i],
    arbitration: [/arbitration/i, /arbitral\s+proceedings/i, /binding\s+arbitration/i],
    force_majeure: [/force\s+majeure/i, /act\s+of\s+god/i, /beyond\s+reasonable\s+control/i],
    warranty: [/warrant/i, /represents\s+and\s+warrants/i, /as-is/i],
    payment_terms: [/payment/i, /invoic/i, /net\s+\d+/i],
    non_compete: [/non-?compet/i, /not\s+compete/i],
    non_solicitation: [/non-?solicit/i, /not\s+solicit/i],
    assignment: [/assignment/i, /may\s+not\s+assign/i],
    insurance: [/insurance/i, /maintain\s+coverage/i],
    representations: [/represent/i, /represent\s+and\s+warrant/i],
    covenants: [/covenant/i, /agrees\s+to/i],
    data_protection: [/data\s+protection/i, /personal\s+data/i, /gdpr/i, /privacy/i],
    audit_rights: [/audit/i, /right\s+to\s+inspect/i, /access\s+to\s+records/i],
  };

  // Split document into sections/paragraphs
  const sections = document.split(/\n\n+/);
  let offset = 0;

  for (const section of sections) {
    const sectionStart = document.indexOf(section, offset);
    const sectionEnd = sectionStart + section.length;
    offset = sectionEnd;

    // Try to classify section
    for (const [type, patterns] of Object.entries(clausePatterns)) {
      const clauseType = type as ClauseType;

      // Skip if not in requested types
      if (clauseTypes && clauseTypes.length > 0 && !clauseTypes.includes(clauseType)) {
        continue;
      }

      // Check patterns
      let matchCount = 0;
      for (const pattern of patterns) {
        if (pattern.test(section)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const confidence = Math.min(0.5 + matchCount * 0.2, 0.99);

        clauses.push({
          id: `clause-${clauses.length + 1}`,
          type: clauseType,
          text: section.trim(),
          startOffset: sectionStart,
          endOffset: sectionEnd,
          confidence,
          keyTerms: extractKeyTerms(section),
        });

        break; // Only classify as one type
      }
    }
  }

  return clauses;
}

/**
 * Extract key terms from text
 */
export function extractKeyTerms(text: string): string[] {
  const terms: string[] = [];
  const termPatterns = [
    /\$[\d,]+/g,              // Dollar amounts
    /\d+\s*(days?|months?|years?)/gi,  // Time periods
    /\d+%/g,                  // Percentages
    /"[^"]+"/g,               // Quoted terms
  ];

  for (const pattern of termPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      terms.push(...matches);
    }
  }

  return [...new Set(terms)].slice(0, 10);
}

/**
 * Assess risks in clauses
 */
export async function assessRisks(
  clauses: ExtractedClause[],
  _partyRole: string,
  categories: RiskCategory[] | undefined,
  _industryContext: string | undefined
): Promise<RiskFinding[]> {
  const risks: RiskFinding[] = [];

  // Risk patterns by clause type and party role
  const riskPatterns: Record<string, Array<{
    pattern: RegExp;
    severity: RiskSeverity;
    category: RiskCategory;
    title: string;
    description: string;
    mitigation: string;
  }>> = {
    indemnification: [
      {
        pattern: /unlimited\s+indemnification/i,
        severity: 'critical',
        category: 'financial',
        title: 'Unlimited Indemnification',
        description: 'Contract requires unlimited indemnification which could expose party to significant financial risk',
        mitigation: 'Negotiate cap on indemnification liability',
      },
    ],
    limitation_of_liability: [
      {
        pattern: /no\s+limitation/i,
        severity: 'high',
        category: 'financial',
        title: 'No Liability Cap',
        description: 'Contract contains no limitation on liability',
        mitigation: 'Add liability cap based on contract value or insurance coverage',
      },
    ],
    termination: [
      {
        pattern: /immediate\s+termination/i,
        severity: 'medium',
        category: 'operational',
        title: 'Immediate Termination Right',
        description: 'Counterparty can terminate immediately without notice',
        mitigation: 'Negotiate notice period for termination',
      },
    ],
    warranty: [
      {
        pattern: /as-?is/i,
        severity: 'medium',
        category: 'legal',
        title: 'As-Is Warranty Disclaimer',
        description: 'Product/service provided without warranty',
        mitigation: 'Negotiate minimum performance warranties',
      },
    ],
  };

  for (const clause of clauses) {
    const patterns = riskPatterns[clause.type] ?? [];

    for (const riskPattern of patterns) {
      if (riskPattern.pattern.test(clause.text)) {
        // Filter by category if specified
        if (categories && !categories.includes(riskPattern.category)) {
          continue;
        }

        risks.push({
          id: `risk-${risks.length + 1}`,
          category: riskPattern.category,
          severity: riskPattern.severity,
          title: riskPattern.title,
          description: riskPattern.description,
          clauseIds: [clause.id],
          mitigations: [riskPattern.mitigation],
          deviatesFromStandard: true,
          confidence: clause.confidence,
        });
      }
    }
  }

  return risks;
}

/**
 * Get severity level as number
 */
export function getSeverityLevel(severity: RiskSeverity): number {
  const levels: Record<RiskSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return levels[severity];
}

/**
 * Build category summary
 */
export function buildCategorySummary(
  risks: RiskFinding[]
): Record<RiskCategory, { count: number; highestSeverity: RiskSeverity; averageScore: number }> {
  const summary: Record<string, { count: number; highestSeverity: RiskSeverity; totalScore: number }> = {};

  for (const category of Object.values(RiskCategory.options)) {
    summary[category] = { count: 0, highestSeverity: 'low', totalScore: 0 };
  }

  for (const risk of risks) {
    const cat = summary[risk.category];
    if (cat) {
      cat.count++;
      cat.totalScore += getSeverityLevel(risk.severity);
      if (getSeverityLevel(risk.severity) > getSeverityLevel(cat.highestSeverity)) {
        cat.highestSeverity = risk.severity;
      }
    }
  }

  const result: Record<RiskCategory, { count: number; highestSeverity: RiskSeverity; averageScore: number }> = {} as any;
  for (const [category, data] of Object.entries(summary)) {
    result[category as RiskCategory] = {
      count: data.count,
      highestSeverity: data.highestSeverity,
      averageScore: data.count > 0 ? data.totalScore / data.count : 0,
    };
  }

  return result;
}

/**
 * Calculate overall risk score
 */
export function calculateOverallRiskScore(risks: RiskFinding[]): number {
  if (risks.length === 0) return 100;

  const maxScore = 100;
  let penalty = 0;

  for (const risk of risks) {
    const severityPenalty: Record<RiskSeverity, number> = {
      low: 2,
      medium: 5,
      high: 15,
      critical: 30,
    };
    penalty += severityPenalty[risk.severity];
  }

  return Math.max(0, maxScore - penalty);
}

/**
 * Convert score to grade
 */
export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Detect changes between documents
 */
export function detectChanges(
  baseClauses: ExtractedClause[],
  compareClauses: ExtractedClause[],
  alignments: import('./types.js').ClauseAlignment[]
): import('./types.js').ContractChange[] {
  const changes: import('./types.js').ContractChange[] = [];
  const alignedCompare = new Set(alignments.map(a => a.compareClauseId));

  for (const alignment of alignments) {
    const baseClause = baseClauses.find(c => c.id === alignment.baseClauseId);
    const compareClause = compareClauses.find(c => c.id === alignment.compareClauseId);

    if (alignment.alignmentType === 'no_match') {
      changes.push({
        type: 'removed',
        clauseType: baseClause?.type,
        baseSection: baseClause?.section,
        baseText: baseClause?.text,
        significance: 0.8,
        impact: 'requires_review',
        explanation: 'Clause exists in base but not in comparison document',
      });
    } else if (alignment.alignmentType !== 'exact') {
      changes.push({
        type: 'modified',
        clauseType: baseClause?.type,
        baseSection: baseClause?.section,
        compareSection: compareClause?.section,
        baseText: baseClause?.text,
        compareText: compareClause?.text,
        significance: 1 - alignment.similarity,
        impact: 'requires_review',
        explanation: `Clause modified (${(alignment.similarity * 100).toFixed(1)}% similarity)`,
      });
    }
  }

  // Find added clauses
  for (const clause of compareClauses) {
    if (!alignedCompare.has(clause.id)) {
      changes.push({
        type: 'added',
        clauseType: clause.type,
        compareSection: clause.section,
        compareText: clause.text,
        significance: 0.7,
        impact: 'requires_review',
        explanation: 'New clause in comparison document',
      });
    }
  }

  return changes;
}

/**
 * Generate redline markup
 */
export function generateRedlineMarkup(
  baseDocument: string,
  changes: import('./types.js').ContractChange[]
): string {
  // Simplified redline generation
  let markup = baseDocument;

  for (const change of changes) {
    if (change.type === 'removed' && change.baseText) {
      markup = markup.replace(
        change.baseText,
        `<del style="color:red">${change.baseText}</del>`
      );
    } else if (change.type === 'added' && change.compareText) {
      markup += `\n<ins style="color:green">${change.compareText}</ins>`;
    }
  }

  return markup;
}

/**
 * Extract obligations from document
 */
export async function extractObligations(
  document: string,
  types: import('./types.js').ObligationType[] | undefined
): Promise<Obligation[]> {
  const obligations: Obligation[] = [];

  // Obligation patterns
  const obligationPatterns: Record<string, { pattern: RegExp; type: import('./types.js').ObligationType }[]> = {
    payment: [
      { pattern: /shall\s+pay/i, type: 'payment' },
      { pattern: /payment\s+due/i, type: 'payment' },
    ],
    delivery: [
      { pattern: /shall\s+deliver/i, type: 'delivery' },
      { pattern: /delivery\s+date/i, type: 'delivery' },
    ],
    notification: [
      { pattern: /shall\s+notify/i, type: 'notification' },
      { pattern: /provide\s+notice/i, type: 'notification' },
    ],
    approval: [
      { pattern: /shall\s+approve/i, type: 'approval' },
      { pattern: /written\s+approval/i, type: 'approval' },
    ],
    compliance: [
      { pattern: /shall\s+comply/i, type: 'compliance' },
      { pattern: /in\s+compliance\s+with/i, type: 'compliance' },
    ],
  };

  const sentences = document.split(/[.!?]+/);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]?.trim() ?? '';
    if (!sentence) continue;

    for (const [, patterns] of Object.entries(obligationPatterns)) {
      for (const { pattern, type } of patterns) {
        if (types && !types.includes(type)) continue;

        if (pattern.test(sentence)) {
          obligations.push({
            id: `obl-${obligations.length + 1}`,
            type,
            party: extractParty(sentence),
            description: sentence,
            dependsOn: [],
            blocks: [],
            clauseIds: [],
            status: 'pending',
            priority: 'medium',
          });
          break;
        }
      }
    }
  }

  return obligations;
}

/**
 * Extract party from sentence
 */
export function extractParty(sentence: string): string {
  const partyPatterns = [
    /the\s+(buyer|seller|licensor|licensee|employer|employee)/i,
    /(party\s+a|party\s+b)/i,
    /the\s+company/i,
  ];

  for (const pattern of partyPatterns) {
    const match = sentence.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return 'Unknown Party';
}

/**
 * Filter obligations by timeframe
 */
export function filterByTimeframe(
  obligations: Obligation[],
  _timeframe: string
): Obligation[] {
  // Parse ISO duration or date range
  // Simplified implementation
  return obligations;
}

/**
 * Build timeline from obligations
 */
export function buildTimeline(
  obligations: Obligation[]
): Array<{ date: Date; obligations: string[]; isMilestone: boolean }> {
  const timeline: Map<string, { date: Date; obligations: string[]; isMilestone: boolean }> = new Map();

  for (const obligation of obligations) {
    if (obligation.dueDate) {
      const dateKey = obligation.dueDate.toISOString().split('T')[0] ?? '';
      const existing = timeline.get(dateKey);

      if (existing) {
        existing.obligations.push(obligation.id);
      } else {
        timeline.set(dateKey, {
          date: obligation.dueDate,
          obligations: [obligation.id],
          isMilestone: obligation.priority === 'critical',
        });
      }
    }
  }

  return Array.from(timeline.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Parse playbook from string (JSON or ID)
 */
export function parsePlaybook(playbookInput: string): import('./types.js').Playbook {
  try {
    const parsed = JSON.parse(playbookInput);
    return parsed as import('./types.js').Playbook;
  } catch {
    // Return a default playbook
    return {
      id: playbookInput,
      name: 'Default Playbook',
      contractType: 'General',
      jurisdiction: 'US',
      partyRole: 'buyer',
      updatedAt: new Date(),
      version: '1.0.0',
      positions: [],
    };
  }
}

/**
 * Match clauses against playbook
 */
export async function matchAgainstPlaybook(
  clauses: ExtractedClause[],
  playbook: import('./types.js').Playbook,
  strictness: import('./types.js').PlaybookStrictness,
  suggestAlternatives: boolean,
  _attention: IAttentionBridge
): Promise<PlaybookMatch[]> {
  const matches: PlaybookMatch[] = [];

  for (const clause of clauses) {
    const position = playbook.positions.find(p => p.clauseType === clause.type);

    if (!position) {
      matches.push({
        clauseId: clause.id,
        position: {
          clauseType: clause.type,
          preferredLanguage: '',
          acceptableVariations: [],
          redLines: [],
          fallbackPositions: [],
          negotiationNotes: '',
          businessJustification: '',
        },
        status: 'no_match',
        preferredSimilarity: 0,
        recommendation: 'No playbook position defined for this clause type',
      });
      continue;
    }

    // Check against preferred language
    const preferredSimilarity = calculateTextSimilarity(clause.text, position.preferredLanguage);

    // Determine status based on similarity and strictness
    let status: PlaybookMatch['status'];
    const thresholds = {
      strict: { preferred: 0.95, acceptable: 0.9, fallback: 0.8 },
      moderate: { preferred: 0.85, acceptable: 0.75, fallback: 0.6 },
      flexible: { preferred: 0.7, acceptable: 0.6, fallback: 0.4 },
    };

    const threshold = thresholds[strictness];

    // Check red lines first
    const violatesRedLine = position.redLines.some(rl =>
      clause.text.toLowerCase().includes(rl.toLowerCase())
    );

    if (violatesRedLine) {
      status = 'violates_redline';
    } else if (preferredSimilarity >= threshold.preferred) {
      status = 'matches_preferred';
    } else if (position.acceptableVariations.some(v =>
      calculateTextSimilarity(clause.text, v) >= threshold.acceptable
    )) {
      status = 'matches_acceptable';
    } else if (position.fallbackPositions.length > 0) {
      status = 'requires_fallback';
    } else {
      status = 'no_match';
    }

    matches.push({
      clauseId: clause.id,
      position,
      status,
      preferredSimilarity,
      suggestedAlternative: suggestAlternatives ? position.preferredLanguage : undefined,
      recommendation: generateRecommendation(status, clause.type),
    });
  }

  return matches;
}

/**
 * Calculate text similarity (simplified)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Generate recommendation based on match status
 */
export function generateRecommendation(status: PlaybookMatch['status'], _clauseType: ClauseType): string {
  const recommendations: Record<PlaybookMatch['status'], string> = {
    matches_preferred: 'Clause matches preferred playbook position. No action required.',
    matches_acceptable: 'Clause is within acceptable variation. Consider negotiating closer to preferred position.',
    requires_fallback: 'Clause requires fallback position. Review fallback options and negotiate accordingly.',
    violates_redline: 'CRITICAL: Clause violates red line. This must be negotiated before signing.',
    no_match: 'No playbook position available. Conduct independent review of this clause.',
  };

  return recommendations[status];
}

/**
 * Build negotiation priorities
 */
export function buildNegotiationPriorities(
  matches: PlaybookMatch[],
  prioritizedTypes: ClauseType[] | undefined
): Array<{ clauseId: string; priority: number; reason: string }> {
  const priorities: Array<{ clauseId: string; priority: number; reason: string }> = [];

  const statusPriority: Record<PlaybookMatch['status'], number> = {
    violates_redline: 100,
    requires_fallback: 70,
    no_match: 50,
    matches_acceptable: 30,
    matches_preferred: 10,
  };

  for (const match of matches) {
    let priority = statusPriority[match.status];

    // Boost priority for prioritized clause types
    if (prioritizedTypes?.includes(match.position.clauseType)) {
      priority += 20;
    }

    priorities.push({
      clauseId: match.clauseId,
      priority,
      reason: match.recommendation,
    });
  }

  return priorities.sort((a, b) => b.priority - a.priority);
}

// ============================================================================
