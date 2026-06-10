/**
 * Metric extraction + the six dimension scorers for the guidance analyzer.
 *
 *   - extractMetrics       (parse a CLAUDE.md into structural metrics)
 *   - scoreStructure / scoreCoverage / scoreEnforceability /
 *     scoreCompilability / scoreClarity / scoreCompleteness
 *
 * The hoisted module-level regexes (Phase-1 perf) are private to this
 * module — nothing outside the scorers referenced them.
 *
 * Extracted from analyzer.ts (W112, P3.13 cut #2).
 */
import { createCompiler } from '../compiler.js';
import type { AnalysisMetrics, DimensionScore } from './types.js';

// ============================================================================
// Metric Extraction
// ============================================================================

// Phase 1 perf — module-level patterns so we don't reconstruct them on
// every `extractMetrics` call. Hoisted from previous in-body literals.
const HEADING_RE = /^#+\s/;
const H2_RE = /^##\s/;
const RULE_LINE_RE = /^[\s]*[-*]\s+(?:NEVER|ALWAYS|MUST|Do not|Never|Always|Prefer|Avoid|Use|Run|Ensure|Follow|No\s|All\s|Keep)\b/;
const ANY_BULLET_RE = /^[\s]*[-*]\s/;
const STRICT_RULE_PREFIX_RE = /^[\s]*[-*]\s+(?:NEVER|ALWAYS|MUST|Prefer|Use|No\s|All\s)/i;
const ENFORCEMENT_RE = /\b(NEVER|ALWAYS|MUST|REQUIRED|FORBIDDEN|DO NOT|SHALL NOT)\b/gi;
const TOOL_RE = /\b(npm|pnpm|yarn|bun|docker|git|make|cargo|go|pip|poetry)\b/gi;
const CODE_FENCE_RE = /```/g;
const BUILD_CMD_RE = /\b(build|compile|tsc|webpack|vite|rollup)\b/i;
const TEST_CMD_RE = /\b(test|vitest|jest|pytest|mocha|cargo test)\b/i;
const SECURITY_SEC_RE = /^##.*security/im;
const ARCH_SEC_RE = /^##.*(architecture|structure|design)/im;
const IMPORTS_RE = /@[~/]/;

export function extractMetrics(content: string): AnalysisMetrics {
  // Phase 1 perf — replace 6 separate `lines.filter()` passes + two `for-of`
  // loops with a single pass that accumulates every line-derived metric in
  // one iteration. The 10+ predicates that used to traverse `lines`
  // independently now share one walk; measurable on `analyzer.analyze()`
  // which is called on every analyze, optimizeForSize, and scoreCompilability.
  const lines = content.split('\n');
  const totalLines = lines.length;

  let contentLines = 0;
  let headingCount = 0;
  let sectionCount = 0;
  let ruleCount = 0;
  let domainRuleCount = 0;
  let constitutionLines = 0;
  let h2Count = 0;
  let longestSectionLines = 0;
  let currentSectionLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // contentLines — non-empty (after trim)
    if (line.trim().length > 0) contentLines++;

    // headingCount — any heading
    if (HEADING_RE.test(line)) headingCount++;

    // H2-driven metrics: sectionCount, constitutionLines, longestSectionLines
    if (H2_RE.test(line)) {
      sectionCount++;
      h2Count++;
      if (h2Count === 2 && constitutionLines === 0) {
        constitutionLines = i;
      }
      // Close out the longest-section accumulator at every H2 boundary.
      if (currentSectionLength > longestSectionLines) {
        longestSectionLines = currentSectionLength;
      }
      currentSectionLength = 0;
    } else {
      currentSectionLength++;
    }

    // ruleCount — bullets that start with an enforcement verb
    if (RULE_LINE_RE.test(line)) ruleCount++;

    // domainRuleCount — bullets that are NOT enforcement-prefixed and long
    if (line.length > 20 && ANY_BULLET_RE.test(line) && !STRICT_RULE_PREFIX_RE.test(line)) {
      domainRuleCount++;
    }
  }

  // Flush the last section length
  if (currentSectionLength > longestSectionLines) {
    longestSectionLines = currentSectionLength;
  }
  if (constitutionLines === 0) constitutionLines = Math.min(totalLines, 60);

  // Content-level (whole-string) regex passes — these scan once and don't
  // benefit from per-line iteration. Kept as separate calls.
  const codeBlockCount = (content.match(CODE_FENCE_RE) || []).length / 2;
  const enforcementStatements = (content.match(ENFORCEMENT_RE) || []).length;
  const toolMatches = content.match(TOOL_RE);
  let toolMentions = 0;
  if (toolMatches) {
    // Cheaper than Set when count is small (typical CLAUDE.md has <12 unique tools)
    const seen = new Set<string>();
    for (const m of toolMatches) seen.add(m.toLowerCase());
    toolMentions = seen.size;
  }

  const estimatedShards = Math.max(1, sectionCount);

  return {
    totalLines,
    contentLines,
    headingCount,
    sectionCount,
    constitutionLines,
    ruleCount,
    codeBlockCount,
    enforcementStatements,
    toolMentions,
    estimatedShards,
    hasBuildCommand: BUILD_CMD_RE.test(content),
    hasTestCommand: TEST_CMD_RE.test(content),
    hasSecuritySection: SECURITY_SEC_RE.test(content),
    hasArchitectureSection: ARCH_SEC_RE.test(content),
    longestSectionLines,
    hasImports: IMPORTS_RE.test(content),
    domainRuleCount,
  };
}

// ============================================================================
// Scoring Functions
// ============================================================================

export function scoreStructure(metrics: AnalysisMetrics, content: string): DimensionScore {
  let score = 0;
  const findings: string[] = [];

  // Has H1 title (10 pts)
  if (/^# /.test(content)) { score += 10; }
  else { findings.push('Missing H1 title'); }

  // Has at least 3 H2 sections (20 pts)
  if (metrics.sectionCount >= 5) { score += 20; }
  else if (metrics.sectionCount >= 3) { score += 15; findings.push('Consider adding more sections'); }
  else if (metrics.sectionCount >= 1) { score += 5; findings.push('Too few sections'); }
  else { findings.push('No H2 sections found'); }

  // Content length: 20-200 lines ideal (20 pts)
  if (metrics.contentLines >= 20 && metrics.contentLines <= 200) { score += 20; }
  else if (metrics.contentLines >= 10) { score += 10; findings.push('File is short — add more guidance'); }
  else if (metrics.contentLines > 200) { score += 15; findings.push('File is long — consider splitting'); }
  else { findings.push('File is very short'); }

  // No section longer than 50 lines (20 pts)
  if (metrics.longestSectionLines <= 50) { score += 20; }
  else if (metrics.longestSectionLines <= 80) { score += 10; findings.push('Longest section is over 50 lines — consider splitting'); }
  else { findings.push(`Longest section is ${metrics.longestSectionLines} lines — too long for reliable retrieval`); }

  // Constitution section exists and is reasonable length (30 pts)
  if (metrics.constitutionLines >= 10 && metrics.constitutionLines <= 60) { score += 30; }
  else if (metrics.constitutionLines > 0) { score += 15; findings.push('Constitution (top section) should be 10-60 lines'); }
  else { findings.push('No clear constitution section'); }

  return { name: 'Structure', score: Math.min(score, 100), max: 100, weight: 0.20, findings };
}

export function scoreCoverage(metrics: AnalysisMetrics, content: string): DimensionScore {
  let score = 0;
  const findings: string[] = [];

  // Has build command (20 pts)
  if (metrics.hasBuildCommand) { score += 20; }
  else { findings.push('No build command found'); }

  // Has test command (20 pts)
  if (metrics.hasTestCommand) { score += 20; }
  else { findings.push('No test command found'); }

  // Has security section (20 pts)
  if (metrics.hasSecuritySection) { score += 20; }
  else { findings.push('No security section'); }

  // Has architecture section (20 pts)
  if (metrics.hasArchitectureSection) { score += 20; }
  else { findings.push('No architecture/structure section'); }

  // Has domain rules (20 pts)
  if (metrics.domainRuleCount >= 3) { score += 20; }
  else if (metrics.domainRuleCount >= 1) { score += 10; findings.push('Add more domain-specific rules'); }
  else { findings.push('No domain-specific rules'); }

  return { name: 'Coverage', score: Math.min(score, 100), max: 100, weight: 0.20, findings };
}

export function scoreEnforceability(metrics: AnalysisMetrics, content: string): DimensionScore {
  let score = 0;
  const findings: string[] = [];

  // Has enforcement statements NEVER/ALWAYS/MUST (30 pts)
  if (metrics.enforcementStatements >= 5) { score += 30; }
  else if (metrics.enforcementStatements >= 2) { score += 15; findings.push('Add more NEVER/ALWAYS/MUST statements for stronger enforcement'); }
  else { findings.push('No enforcement statements (NEVER/ALWAYS/MUST)'); }

  // Has rule-like statements (30 pts)
  if (metrics.ruleCount >= 10) { score += 30; }
  else if (metrics.ruleCount >= 5) { score += 20; findings.push('Add more concrete rules'); }
  else if (metrics.ruleCount >= 1) { score += 10; findings.push('Too few concrete rules'); }
  else { findings.push('No actionable rules found'); }

  // Rules are specific, not vague (20 pts) — check for vague words
  const vaguePatterns = /\b(try to|should probably|might want to|consider|if possible|when appropriate)\b/gi;
  const vagueCount = (content.match(vaguePatterns) || []).length;
  if (vagueCount === 0) { score += 20; }
  else if (vagueCount <= 3) { score += 10; findings.push(`${vagueCount} vague statements — make rules concrete`); }
  else { findings.push(`${vagueCount} vague statements undermine enforceability`); }

  // Ratio of rules to total content (20 pts)
  const ruleRatio = metrics.contentLines > 0 ? metrics.ruleCount / metrics.contentLines : 0;
  if (ruleRatio >= 0.15) { score += 20; }
  else if (ruleRatio >= 0.08) { score += 10; findings.push('Low rule density — add more actionable statements'); }
  else { findings.push('Very low rule density'); }

  return { name: 'Enforceability', score: Math.min(score, 100), max: 100, weight: 0.25, findings };
}

export function scoreCompilability(content: string, localContent?: string): DimensionScore {
  let score = 0;
  const findings: string[] = [];

  try {
    const compiler = createCompiler();
    const bundle = compiler.compile(content, localContent);

    // Successfully compiles (30 pts)
    score += 30;

    // Has constitution (20 pts)
    if (bundle.constitution.rules.length > 0) { score += 20; }
    else { findings.push('Constitution compiled but has no rules'); }

    // Has shards (20 pts)
    if (bundle.shards.length >= 3) { score += 20; }
    else if (bundle.shards.length >= 1) { score += 10; findings.push('Few shards — add more sections'); }
    else { findings.push('No shards produced'); }

    // Has valid manifest (15 pts)
    if (bundle.manifest && bundle.manifest.rules.length > 0) { score += 15; }
    else { findings.push('Manifest is empty'); }

    // Local overlay compiles cleanly (15 pts)
    if (localContent) {
      if (bundle.shards.length > 0) { score += 15; }
    } else {
      score += 15; // No local = no issue
    }
  } catch (e) {
    findings.push(`Compilation failed: ${(e as Error).message}`);
  }

  return { name: 'Compilability', score: Math.min(score, 100), max: 100, weight: 0.15, findings };
}

export function scoreClarity(metrics: AnalysisMetrics, content: string): DimensionScore {
  let score = 0;
  const findings: string[] = [];

  // Has code blocks with examples (30 pts)
  if (metrics.codeBlockCount >= 3) { score += 30; }
  else if (metrics.codeBlockCount >= 1) { score += 15; findings.push('Add more code examples'); }
  else { findings.push('No code examples'); }

  // Mentions specific tools (30 pts)
  if (metrics.toolMentions >= 3) { score += 30; }
  else if (metrics.toolMentions >= 1) { score += 15; findings.push('Mention specific tools and commands'); }
  else { findings.push('No specific tool references'); }

  // Uses tables or structured formatting (20 pts)
  if (/\|.*\|.*\|/.test(content)) { score += 20; }
  else { findings.push('Consider using tables for structured data'); }

  // Average line length is reasonable (20 pts)
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const avgLen = lines.reduce((s, l) => s + l.length, 0) / (lines.length || 1);
  if (avgLen >= 20 && avgLen <= 100) { score += 20; }
  else if (avgLen > 100) { score += 10; findings.push('Lines are very long — break into shorter statements'); }
  else { score += 10; }

  return { name: 'Clarity', score: Math.min(score, 100), max: 100, weight: 0.10, findings };
}

export function scoreCompleteness(metrics: AnalysisMetrics, content: string): DimensionScore {
  let score = 0;
  const findings: string[] = [];

  // Checks for common sections
  const checks: Array<[string, RegExp, number]> = [
    ['Build/Test commands', /\b(build|test|lint)\b/i, 15],
    ['Security rules', /\b(secret|credential|injection|xss)\b/i, 15],
    ['Coding standards', /\b(style|convention|standard|format)\b/i, 15],
    ['Error handling', /\b(error|exception|catch|throw)\b/i, 10],
    ['Git/VCS practices', /\b(commit|branch|merge|pull request|pr)\b/i, 10],
    ['File organization', /\b(directory|folder|structure|organize)\b/i, 10],
    ['Dependencies', /\b(dependency|package|import|require)\b/i, 10],
    ['Documentation', /\b(doc|comment|jsdoc|readme)\b/i, 5],
    ['Performance', /\b(performance|optimize|cache|lazy)\b/i, 5],
    ['Deployment', /\b(deploy|production|staging|ci\/cd)\b/i, 5],
  ];

  for (const [name, pattern, points] of checks) {
    if (pattern.test(content)) {
      score += points;
    } else {
      findings.push(`Missing topic: ${name}`);
    }
  }

  return { name: 'Completeness', score: Math.min(score, 100), max: 100, weight: 0.10, findings };
}
