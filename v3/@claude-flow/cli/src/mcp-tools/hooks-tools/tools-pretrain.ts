/**
 * MCP tool definitions for pretraining + agent config generation:
 *   - hooks_pretrain     (repo recon → 4-step intelligence bootstrap,
 *                         #1953 code-files-first walker, #2245 dual
 *                         persistence to memory-bridge + neural store)
 *   - hooks_build-agents (generate optimized agent configs from pretrain
 *                         data, write yaml/json to disk)
 *
 * Extracted from hooks-tools.ts (W41, P3.2 cut #11).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { type MCPTool } from '../types.js';

// Pretrain hook - repository analysis for intelligence bootstrap
export const hooksPretrain: MCPTool = {
  name: 'hooks_pretrain',
  description: 'Analyze repository to bootstrap intelligence (4-step pipeline) Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' },
      depth: { type: 'string', description: 'Analysis depth (shallow, medium, deep)' },
      skipCache: { type: 'boolean', description: 'Skip cached analysis' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const repoPath = resolve((params.path as string) || '.');
    const depth = (params.depth as string) || 'medium';
    const startTime = performance.now();

    // Real file scanning — count files by extension, extract patterns.
    const extCounts: Record<string, number> = {};
    let filesAnalyzed = 0;
    // #1953: separate budget for code files. The old code gated the
    // import-pattern extraction on `filesAnalyzed <= 50`, which counts
    // EVERY directory entry (including .md/.yaml/.db/.log). In any
    // markdown/docs-heavy repo, the depth-first walker burned through the
    // 50-file budget on non-code files before reaching any source — so
    // `patternsExtracted: 0` even when hundreds of `.ts`/`.js` files existed.
    let codeFilesScanned = 0;
    let totalLines = 0;
    const maxDepth = depth === 'shallow' ? 2 : depth === 'deep' ? 6 : 4;
    const patterns: string[] = [];

    // #1953: recurse into directories that typically contain code first
    // (`src/`, `apps/`, `packages/`, `lib/`, `crates/`, `workers/`, `server/`)
    // before docs / specs / planning dirs, so the import-extraction budget
    // is spent on the highest-signal directories even in mixed repos.
    const CODE_DIR_PREFIXES = new Set([
      'src', 'apps', 'packages', 'lib', 'crates', 'workers',
      'server', 'backend', 'frontend', 'app', 'cli', 'core',
    ]);
    const scoreEntry = (name: string): number => {
      if (CODE_DIR_PREFIXES.has(name)) return 0;
      // Deprioritise common docs / output directories.
      if (/^(docs?|specs?|_.*|examples?|samples?|out|build|target|coverage|tests?)$/.test(name)) return 2;
      return 1;
    };

    const scan = (dir: string, currentDepth: number) => {
      if (currentDepth > maxDepth) return;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        // Sort: code-likely dirs first, files mixed in by name, deprioritised
        // dirs last. Stable for deterministic test behaviour.
        entries.sort((a, b) => {
          const sa = a.isDirectory() ? scoreEntry(a.name) : 1;
          const sb = b.isDirectory() ? scoreEntry(b.name) : 1;
          return sa - sb;
        });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(full, currentDepth + 1);
          } else if (entry.isFile()) {
            const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
            if (ext) extCounts[ext] = (extCounts[ext] || 0) + 1;
            filesAnalyzed++;
            // For code files, count lines and extract imports
            if (['.ts', '.js', '.tsx', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java'].includes(ext)) {
              try {
                const content = readFileSync(full, 'utf-8');
                const lines = content.split('\n');
                totalLines += lines.length;
                // #1953: gate on the code-file count, not every-file count.
                // Also widened the per-file scan window from 30 → 80 lines:
                // modern TS files often have license headers + JSDoc + type
                // imports before the first `import` statement.
                if (++codeFilesScanned <= 50) {
                  for (const line of lines.slice(0, 80)) {
                    if (line.startsWith('import ') || line.startsWith('from ') || (line.startsWith('const ') && line.includes('require('))) {
                      const trimmed = line.trim();
                      if (trimmed.length < 120 && !patterns.includes(trimmed)) patterns.push(trimmed);
                      if (patterns.length >= 100) break;
                    }
                  }
                }
              } catch { /* skip unreadable */ }
            }
          }
        }
      } catch { /* skip inaccessible dirs */ }
    };

    scan(repoPath, 0);
    const elapsed = Math.round(performance.now() - startTime);

    // Persist extracted patterns. Two stores get written so the user can find
    // them where they expect:
    //   1. memory-bridge `pretrain` namespace — one summary bundle
    //   2. neural store — one row PER pattern so `neural_patterns list` reflects them
    // #2245 — without (2), the dashboards reported "0 patterns" after pretrain.
    let patternsBundled = 0;
    let patternsIndexed = 0;
    try {
      const bridge = await import('../../memory/memory-bridge.js');
      await bridge.bridgeStoreEntry({
        key: `pretrain-${Date.now()}`,
        value: JSON.stringify({ filesAnalyzed, totalLines, topExtensions: Object.entries(extCounts).sort((a, b) => b[1] - a[1]).slice(0, 10), importPatterns: patterns.slice(0, 20) }),
        namespace: 'pretrain',
        tags: ['pretrain', depth],
      });
      patternsBundled = patterns.length;
    } catch { /* AgentDB not available */ }

    try {
      const neural = await import('../neural-tools.js');
      const items = patterns.map((p) => ({
        name: p.length > 200 ? p.slice(0, 200) : p,
        type: 'import-pattern',
        content: p,
        metadata: { source: 'hooks_pretrain', depth },
      }));
      const result = await neural.storeNeuralPatterns(items);
      patternsIndexed = result.stored;
    } catch { /* neural store unavailable */ }

    // Back-compat field
    const patternsStored = patternsBundled;

    // #1847: when the corpus contains files but no patterns were extracted
    // (typical for Markdown vaults), make the source-code-only extraction
    // contract explicit so users don't conclude the hook system is broken.
    const SUPPORTED_EXTRACTION_EXTS = ['.ts', '.js', '.tsx', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java'];
    let note: string | undefined;
    if (filesAnalyzed > 0 && patterns.length === 0) {
      const codeFileCount = SUPPORTED_EXTRACTION_EXTS.reduce(
        (sum, ext) => sum + (extCounts[ext] ?? 0),
        0,
      );
      note = codeFileCount === 0
        ? `No source-code patterns found. hooks_pretrain extracts import/require lines from ${SUPPORTED_EXTRACTION_EXTS.join('/')} files only — Markdown/text/asset corpora produce zero patterns by design. This is not a hook-system failure; live trajectories and statusline are independent.`
        : `Found ${codeFileCount} source-code file(s) but extracted zero import/require patterns. They may be empty, generated, or use non-standard module syntax.`;
    }

    return {
      success: true,
      _real: true,
      path: repoPath,
      depth,
      durationMs: elapsed,
      stats: {
        filesAnalyzed,
        totalLines,
        patternsExtracted: patterns.length,
        patternsBundled,                  // #2245: 1 summary row in memory-bridge `pretrain` namespace
        patternsIndexed,                  // #2245: per-pattern rows in neural store — surfaced by neural_patterns list
        patternsStored,                   // back-compat alias for patternsBundled
        fileTypes: Object.entries(extCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([ext, count]) => ({ ext, count })),
        // #1847: explicit extraction contract so callers can tell pretrain
        // patterns apart from live trajectories and hook statusline state.
        // #2245: also call out exactly which stores got written.
        sources: {
          extractedFrom: SUPPORTED_EXTRACTION_EXTS,
          scope: 'pretrain-only (live trajectories + statusline are tracked separately)',
          stores: {
            'memory-bridge:pretrain': patternsBundled > 0 ? 1 : 0, // one bundle row
            'neural-store (neural_patterns list)': patternsIndexed,
          },
        },
      },
      ...(note ? { note } : {}),
    };
  },
};

// Build agents hook - generate optimized agent configs
export const hooksBuildAgents: MCPTool = {
  name: 'hooks_build-agents',
  description: 'Generate optimized agent configurations from pretrain data Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      outputDir: { type: 'string', description: 'Output directory for configs' },
      focus: { type: 'string', description: 'Focus area (v3-implementation, security, performance, all)' },
      format: { type: 'string', description: 'Config format (yaml, json)' },
      persist: { type: 'boolean', description: 'Write configs to disk' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const outputDir = resolve((params.outputDir as string) || './agents');
    const focus = (params.focus as string) || 'all';
    const format = (params.format as string) || 'yaml';
    const persist = params.persist !== false; // Default to true

    const agents = [
      { type: 'coder', configFile: join(outputDir, `coder.${format}`), capabilities: ['code-generation', 'refactoring', 'debugging'], optimizations: ['flash-attention', 'token-reduction'] },
      { type: 'architect', configFile: join(outputDir, `architect.${format}`), capabilities: ['system-design', 'api-design', 'documentation'], optimizations: ['context-caching', 'memory-persistence'] },
      { type: 'tester', configFile: join(outputDir, `tester.${format}`), capabilities: ['unit-testing', 'integration-testing', 'coverage'], optimizations: ['parallel-execution'] },
      { type: 'security-architect', configFile: join(outputDir, `security-architect.${format}`), capabilities: ['threat-modeling', 'vulnerability-analysis', 'security-review'], optimizations: ['pattern-matching'] },
      { type: 'reviewer', configFile: join(outputDir, `reviewer.${format}`), capabilities: ['code-review', 'quality-analysis', 'best-practices'], optimizations: ['incremental-analysis'] },
    ];

    const filteredAgents = focus === 'all' ? agents :
      focus === 'security' ? agents.filter(a => a.type.includes('security') || a.type === 'reviewer') :
      focus === 'performance' ? agents.filter(a => ['coder', 'tester'].includes(a.type)) :
      agents;

    // Persist configs to disk if requested
    if (persist) {
      // Ensure output directory exists
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // Write each agent config
      for (const agent of filteredAgents) {
        const config = {
          type: agent.type,
          capabilities: agent.capabilities,
          optimizations: agent.optimizations,
          version: '3.0.0',
          createdAt: new Date().toISOString(),
        };

        const content = format === 'json'
          ? JSON.stringify(config, null, 2)
          : `# ${agent.type} agent configuration\ntype: ${agent.type}\nversion: "3.0.0"\ncapabilities:\n${agent.capabilities.map(c => `  - ${c}`).join('\n')}\noptimizations:\n${agent.optimizations.map(o => `  - ${o}`).join('\n')}\ncreatedAt: "${config.createdAt}"\n`;

        writeFileSync(agent.configFile, content, 'utf-8');
      }
    }

    return {
      outputDir,
      focus,
      persisted: persist,
      agents: filteredAgents,
      stats: {
        configsGenerated: filteredAgents.length,
        patternsApplied: filteredAgents.length * 3,
        optimizationsIncluded: filteredAgents.reduce((acc, a) => acc + a.optimizations.length, 0),
      },
    };
  },
};
