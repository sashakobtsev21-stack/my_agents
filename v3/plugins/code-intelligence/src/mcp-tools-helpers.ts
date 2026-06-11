/**
 * Code Intelligence MCP Tools — security utilities & analysis helpers
 *
 * Path validation plus the cohesion/coupling/architecture analysis
 * helper functions. These were module-private in the original
 * mcp-tools.ts (P3.63, W184) and are deliberately NOT re-exported by
 * the mcp-tools.ts barrel — public API unchanged.
 */

import path from 'path';
import fs from 'fs';
import type { ToolContext } from './mcp-tools-types.js';
import type {
  CodeSearchResult,
  DependencyGraph,
  FileImpact,
  SuggestedModule,
  LearnedPattern,
  IGNNBridge,
  IMinCutBridge,
} from './types.js';
import {
  CodeIntelligenceError,
  CodeIntelligenceErrorCodes,
} from './types.js';

// Security Utilities
// ============================================================================

/**
 * Validate path for security
 */
export function validatePath(userPath: string, allowedRoots: string[]): string {
  const normalized = path.normalize(userPath);

  // Check for path traversal
  if (normalized.includes('..')) {
    throw new CodeIntelligenceError(
      CodeIntelligenceErrorCodes.PATH_TRAVERSAL,
      'Path traversal detected',
      { path: userPath }
    );
  }

  // Check against allowed roots
  const resolved = path.resolve(normalized);
  const isAllowed = allowedRoots.some(root => {
    const resolvedRoot = path.resolve(root);
    return resolved.startsWith(resolvedRoot);
  });

  if (!isAllowed && allowedRoots.length > 0 && !allowedRoots.includes('.')) {
    throw new CodeIntelligenceError(
      CodeIntelligenceErrorCodes.PATH_TRAVERSAL,
      'Path outside allowed roots',
      { path: userPath, allowedRoots }
    );
  }

  return normalized;
}

/**
 * Check if path is sensitive
 */
export function isSensitivePath(filePath: string, blockedPatterns: RegExp[]): boolean {
  return blockedPatterns.some(pattern => pattern.test(filePath));
}

// ============================================================================

// Helper Functions
// ============================================================================

// #1554/#1553: Real implementations replacing the previous `return []` stubs.
// Kept dep-free (no fast-glob, no @claude-flow/embeddings) so the plugin can
// ship without runtime peer-dep churn — semantic search uses a token-overlap
// score that returns real ranked results, with a TODO to upgrade to ONNX
// embeddings when the embeddings package is loadable. Architecture analysis
// and refactor-impact pull file lists via getFilesInPath and import edges via
// getAllRelatedFiles, which is enough to lift `0 edges / 0 results` to real
// non-empty data across all 5 tools.

const DEFAULT_CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIR_NAMES = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage', 'vendor',
  '.next', '.nuxt', '.turbo', '.cache', 'tmp', '.pnpm-store',
]);
const MAX_FILE_BYTES = 100 * 1024; // 100KB cap, matches issue suggestion

export async function getFilesInPath(rootPath: string): Promise<string[]> {
  const out: string[] = [];
  const visited = new Set<string>();

  const walk = (dir: string) => {
    let realDir: string;
    try {
      realDir = fs.realpathSync(dir);
    } catch {
      return;
    }
    if (visited.has(realDir)) return; // protect against symlink loops
    visited.add(realDir);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') {
        // skip dot-prefixed entries except the root marker
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        continue;
      }
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!DEFAULT_CODE_EXTS.has(ext)) continue;
        if (entry.name.endsWith('.min.js') || entry.name.endsWith('.min.mjs')) continue;
        try {
          const stat = fs.statSync(full);
          if (stat.size > MAX_FILE_BYTES) continue;
        } catch { continue; }
        out.push(full);
      }
    }
  };

  walk(rootPath);
  return out;
}

export function tokenize(text: string): Map<string, number> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && t.length <= 32);
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
}

export function cosineFromCounts(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [tok, ca] of a) {
    const cb = b.get(tok);
    if (cb !== undefined) dot += ca * cb;
  }
  if (dot === 0) return 0;
  let na = 0; for (const v of a.values()) na += v * v;
  let nb = 0; for (const v of b.values()) nb += v * v;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function performSemanticSearch(
  query: string,
  paths: string[],
  _searchType: string,
  topK: number,
  languages: string[] | undefined,
  excludeTests: boolean,
  _context: ToolContext,
): Promise<CodeSearchResult[]> {
  // Discover candidate files across all requested roots.
  const candidates: string[] = [];
  for (const root of paths) {
    const files = await getFilesInPath(root);
    for (const f of files) candidates.push(f);
  }

  // Filter by language extension if requested.
  const langExt = (() => {
    if (!languages || languages.length === 0) return null;
    const exts = new Set<string>();
    for (const l of languages) {
      const k = l.toLowerCase();
      if (k === 'typescript' || k === 'ts') { exts.add('.ts'); exts.add('.tsx'); }
      else if (k === 'javascript' || k === 'js') { exts.add('.js'); exts.add('.jsx'); exts.add('.mjs'); exts.add('.cjs'); }
    }
    return exts;
  })();

  const queryTokens = tokenize(query);
  const scored: Array<{ file: string; score: number; preview: string }> = [];

  for (const file of candidates) {
    if (langExt && !langExt.has(path.extname(file).toLowerCase())) continue;
    if (excludeTests && /(\.|^)(test|spec)\.[mc]?[jt]sx?$/i.test(path.basename(file))) continue;

    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch { continue; }
    const head = content.split('\n').slice(0, 200).join('\n');
    const score = cosineFromCounts(queryTokens, tokenize(head));
    if (score < 0.05) continue;
    scored.push({ file, score, preview: head.slice(0, 240) });
  }

  scored.sort((a, b) => b.score - a.score);
  const langFromExt = (file: string): 'typescript' | 'javascript' => {
    const ext = path.extname(file).toLowerCase();
    return ext === '.ts' || ext === '.tsx' ? 'typescript' : 'javascript';
  };
  return scored.slice(0, topK).map((r) => ({
    filePath: r.file,
    lineNumber: 1,
    snippet: r.preview,
    matchType: 'semantic',
    score: r.score,
    context: r.preview,
    language: langFromExt(r.file),
    explanation: `Token-overlap cosine similarity ${(r.score * 100).toFixed(1)}% over first 200 lines.`,
  } satisfies CodeSearchResult));
}

const IMPORT_RX = /^\s*(?:import\s+[^'"]+from\s+|import\s+|export\s+\*?\s*from\s+|export\s+\{[^}]*\}\s+from\s+)['"]([^'"]+)['"]|^\s*(?:const|let|var)\s+[^=]+=\s*require\(\s*['"]([^'"]+)['"]\s*\)/gm;

export function extractImportSpecifiers(filePath: string): string[] {
  let content: string;
  try { content = fs.readFileSync(filePath, 'utf-8'); } catch { return []; }
  const out: string[] = [];
  IMPORT_RX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_RX.exec(content)) !== null) {
    const spec = m[1] ?? m[2];
    if (spec && (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/'))) {
      out.push(spec);
    }
  }
  return out;
}

export function resolveImportToFile(fromFile: string, spec: string): string | null {
  const baseDir = path.dirname(fromFile);
  const candidates: string[] = [];
  if (spec.startsWith('/')) {
    candidates.push(spec);
  } else {
    candidates.push(path.resolve(baseDir, spec));
  }
  // Try .ts/.tsx/.js/.jsx, plus index.* under a directory
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  for (const c of [...candidates]) {
    for (const e of exts) {
      candidates.push(c + e);
      candidates.push(path.join(c, `index${e}`));
    }
  }
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c; } catch { /* try next */ }
  }
  return null;
}

export async function getAllRelatedFiles(changedFiles: string[]): Promise<string[]> {
  if (changedFiles.length === 0) return [];

  // Forward BFS — what does each changed file (transitively) import?
  const result = new Set<string>();
  const queue: string[] = [];
  for (const f of changedFiles) {
    const abs = path.resolve(f);
    result.add(abs);
    queue.push(abs);
  }
  const MAX_DEPTH = 3;
  let depth = 0;
  while (queue.length > 0 && depth < MAX_DEPTH) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const file = queue.shift()!;
      const specs = extractImportSpecifiers(file);
      for (const spec of specs) {
        const resolved = resolveImportToFile(file, spec);
        if (resolved && !result.has(resolved)) {
          result.add(resolved);
          queue.push(resolved);
        }
      }
    }
    depth++;
  }

  // Reverse scan — what files import any of the changed files? Use the
  // common ancestor directory of the changed files as the search root.
  const commonRoot = (() => {
    if (changedFiles.length === 0) return process.cwd();
    const parts = changedFiles.map((f) => path.resolve(f).split(path.sep));
    const minLen = Math.min(...parts.map((p) => p.length));
    const out: string[] = [];
    for (let i = 0; i < minLen; i++) {
      const seg = parts[0]?.[i];
      if (seg === undefined) break;
      if (parts.every((p) => p[i] === seg)) out.push(seg);
      else break;
    }
    const dir = out.length > 0 ? out.join(path.sep) || path.sep : process.cwd();
    try { return fs.statSync(dir).isDirectory() ? dir : path.dirname(dir); }
    catch { return path.dirname(dir); }
  })();

  const allFiles = await getFilesInPath(commonRoot);
  for (const file of allFiles) {
    if (result.has(path.resolve(file))) continue;
    const specs = extractImportSpecifiers(file);
    for (const spec of specs) {
      const resolved = resolveImportToFile(file, spec);
      if (resolved && result.has(resolved)) {
        result.add(path.resolve(file));
        break;
      }
    }
  }
  return Array.from(result);
}

export function detectLayerViolations(
  graph: DependencyGraph,
  layers?: Record<string, string[]>
): import('./types.js').LayerViolation[] {
  const violations: import('./types.js').LayerViolation[] = [];

  if (!layers) return violations;

  // Build layer lookup
  const nodeLayer = new Map<string, string>();
  for (const [layer, patterns] of Object.entries(layers)) {
    for (const pattern of patterns) {
      for (const node of graph.nodes) {
        if (node.id.includes(pattern)) {
          nodeLayer.set(node.id, layer);
        }
      }
    }
  }

  // Check edges for violations
  for (const edge of graph.edges) {
    const fromLayer = nodeLayer.get(edge.from);
    const toLayer = nodeLayer.get(edge.to);

    if (fromLayer && toLayer && fromLayer !== toLayer) {
      // Simplified check - in production would check layer order
      violations.push({
        source: edge.from,
        target: edge.to,
        sourceLayer: fromLayer,
        targetLayer: toLayer,
        violationType: 'cross',
        severity: 'medium',
        suggestedFix: `Move ${edge.from} or ${edge.to} to appropriate layer`,
      });
    }
  }

  return violations;
}

export function detectCircularDeps(graph: DependencyGraph): import('./types.js').CircularDependency[] {
  const cycles: import('./types.js').CircularDependency[] = [];

  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }
  for (const edge of graph.edges) {
    adj.get(edge.from)?.push(edge.to);
  }

  // DFS for cycle detection
  const visited = new Set<string>();
  const recStack = new Set<string>();

  const findCycle = (node: string, path: string[]): void => {
    visited.add(node);
    recStack.add(node);

    for (const neighbor of adj.get(node) ?? []) {
      if (recStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart >= 0) {
          cycles.push({
            cycle: [...path.slice(cycleStart), neighbor],
            length: path.length - cycleStart + 1,
            severity: path.length - cycleStart > 3 ? 'high' : 'medium',
            suggestedBreakPoint: neighbor,
          });
        }
      } else if (!visited.has(neighbor)) {
        findCycle(neighbor, [...path, neighbor]);
      }
    }

    recStack.delete(node);
  };

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      findCycle(node.id, [node.id]);
    }
  }

  return cycles;
}

export function calculateCouplingMetrics(graph: DependencyGraph): import('./types.js').CouplingMetrics[] {
  const metrics: import('./types.js').CouplingMetrics[] = [];

  for (const node of graph.nodes) {
    const afferent = graph.edges.filter(e => e.to === node.id).length;
    const efferent = graph.edges.filter(e => e.from === node.id).length;
    const instability = (afferent + efferent) > 0
      ? efferent / (afferent + efferent)
      : 0;

    metrics.push({
      componentId: node.id,
      afferentCoupling: afferent,
      efferentCoupling: efferent,
      instability,
      abstractness: 0.5, // Simplified
      distanceFromMain: Math.abs(instability - 0.5),
      inZoneOfPain: instability < 0.3 && false, // Simplified
      inZoneOfUselessness: instability > 0.7 && false, // Simplified
    });
  }

  return metrics;
}

export function calculateCohesionMetrics(_graph: DependencyGraph): import('./types.js').CohesionMetrics[] {
  return [];
}

export function findDeadCode(graph: DependencyGraph): import('./types.js').DeadCodeFinding[] {
  const deadCode: import('./types.js').DeadCodeFinding[] = [];

  // Find nodes with no incoming edges and not exported
  const hasIncoming = new Set(graph.edges.map(e => e.to));

  for (const node of graph.nodes) {
    if (!hasIncoming.has(node.id) && node.type === 'function') {
      deadCode.push({
        filePath: node.id,
        symbol: node.label,
        symbolType: 'function',
        lineNumber: 1,
        confidence: 0.7,
        reason: 'No references found',
        isExported: false,
      });
    }
  }

  return deadCode;
}

export function analyzeAPISurface(_graph: DependencyGraph): import('./types.js').APISurfaceElement[] {
  return [];
}

export async function detectDrift(
  _graph: DependencyGraph,
  _baseline: string
): Promise<import('./types.js').ArchitecturalDrift[]> {
  return [];
}

export function countModules(graph: DependencyGraph): number {
  const dirs = new Set<string>();
  for (const node of graph.nodes) {
    const parts = node.id.split('/');
    if (parts.length > 1) {
      dirs.add(parts.slice(0, -1).join('/'));
    }
  }
  return dirs.size;
}

export function calculateHealthScore(graph: DependencyGraph): number {
  // Simplified scoring
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;

  if (nodeCount === 0) return 100;

  const avgDegree = edgeCount / nodeCount;
  const idealDegree = 3;

  return Math.max(0, 100 - Math.abs(avgDegree - idealDegree) * 10);
}

export function getChangesNeeded(
  filePath: string,
  changes: Array<{ file: string; type: string; details?: Record<string, unknown> }>
): string[] {
  const changesNeeded: string[] = [];

  for (const change of changes) {
    if (change.file === filePath) {
      changesNeeded.push(`Apply ${change.type}`);
    }
  }

  return changesNeeded;
}

export function getAffectedTests(filePath: string, graph: DependencyGraph): string[] {
  const tests: string[] = [];

  for (const edge of graph.edges) {
    if (edge.from === filePath && edge.to.includes('.test')) {
      tests.push(edge.to);
    }
  }

  return tests;
}

export function getSuggestedOrder(
  impactedFiles: FileImpact[],
  _graph: DependencyGraph
): string[] {
  // Order by dependencies
  return impactedFiles
    .filter(f => f.requiresChange)
    .sort((a, b) => {
      const aRisk = a.risk === 'high' ? 3 : a.risk === 'medium' ? 2 : 1;
      const bRisk = b.risk === 'high' ? 3 : b.risk === 'medium' ? 2 : 1;
      return bRisk - aRisk;
    })
    .map(f => f.filePath);
}

export function findBreakingChanges(
  changes: Array<{ file: string; type: string; details?: Record<string, unknown> }>,
  graph: DependencyGraph
): string[] {
  const breakingChanges: string[] = [];

  for (const change of changes) {
    if (change.type === 'delete') {
      const dependents = graph.edges.filter(e => e.to === change.file);
      if (dependents.length > 0) {
        breakingChanges.push(`Deleting ${change.file} breaks ${dependents.length} dependents`);
      }
    }
  }

  return breakingChanges;
}

export function buildSuggestedModules(
  graph: DependencyGraph,
  partition: Map<string, number>,
  _strategy: string
): SuggestedModule[] {
  const modules: SuggestedModule[] = [];
  const partitionGroups = new Map<number, string[]>();

  for (const [nodeId, partNum] of partition) {
    if (!partitionGroups.has(partNum)) {
      partitionGroups.set(partNum, []);
    }
    partitionGroups.get(partNum)?.push(nodeId);
  }

  for (const [partNum, files] of partitionGroups) {
    // Calculate cohesion (internal edges / possible internal edges)
    const internalEdges = graph.edges.filter(
      e => partition.get(e.from) === partNum && partition.get(e.to) === partNum
    ).length;
    const possibleEdges = files.length * (files.length - 1);
    const cohesion = possibleEdges > 0 ? internalEdges / possibleEdges : 1;

    // Calculate coupling (external edges)
    const externalEdges = graph.edges.filter(
      e => (partition.get(e.from) === partNum) !== (partition.get(e.to) === partNum)
    ).length;
    const coupling = externalEdges / Math.max(files.length, 1);

    // Get dependencies on other modules
    const dependencies = new Set<string>();
    for (const edge of graph.edges) {
      if (partition.get(edge.from) === partNum && partition.get(edge.to) !== partNum) {
        const depModule = partition.get(edge.to);
        if (depModule !== undefined) {
          dependencies.add(`module-${depModule}`);
        }
      }
    }

    modules.push({
      name: `module-${partNum}`,
      files,
      loc: files.length * 100, // Simplified
      cohesion,
      coupling,
      publicApi: [], // Simplified
      dependencies: Array.from(dependencies),
    });
  }

  return modules;
}

export function generateMigrationSteps(
  modules: SuggestedModule[],
  cutEdges: Array<{ from: string; to: string; weight: number }>
): string[] {
  const steps: string[] = [];

  steps.push(`1. Create ${modules.length} new module directories`);
  steps.push(`2. Move files to their respective modules`);
  steps.push(`3. Update ${cutEdges.length} cross-module imports`);
  steps.push(`4. Define public APIs for each module`);
  steps.push(`5. Run tests to verify no regressions`);

  return steps;
}

export async function learnPatternsFromHistory(
  _scope: { gitRange?: string; authors?: string[]; paths?: string[] },
  _patternTypes: string[],
  _minOccurrences: number,
  _context: ToolContext
): Promise<LearnedPattern[]> {
  // Simplified - in production would analyze git history
  return [
    {
      id: 'pattern-1',
      type: 'refactor_patterns',
      description: 'Convert callbacks to async/await',
      codeBefore: 'function(callback) { ... }',
      codeAfter: 'async function() { ... }',
      occurrences: 5,
      authors: ['developer1'],
      files: ['src/utils.ts'],
      confidence: 0.85,
      impact: 'positive',
      suggestedAction: 'Consider modernizing callback-based code to async/await',
    },
  ];
}

export function generateRecommendations(patterns: LearnedPattern[]): string[] {
  const recommendations: string[] = [];

  for (const pattern of patterns) {
    if (pattern.suggestedAction) {
      recommendations.push(pattern.suggestedAction);
    }
  }

  return recommendations;
}

// ============================================================================
