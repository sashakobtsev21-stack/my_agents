/**
 * Memory MCP tools — statistics, legacy->sqlite migration, and the AgentDB
 * bridge import + status tools.
 * Extracted from memory-tools.ts (W126, P3.16 cut #3).
 */
import type { MCPTool } from '../types.js';
import { existsSync, readdirSync, readFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { validateIdentifier } from '../validate-input.js';
import {
  sanitizeMemoryKey,
  globToRegex,
  resolveProjectMemoryDir,
  loadLegacyStore,
  getMigrationMarkerPath,
  getMemoryFunctions,
  ensureInitialized,
} from './helpers.js';

export const memoryStats: MCPTool =   {
    name: 'memory_stats',
    description: 'Get memory storage statistics including HNSW index status Use when native Read/Write is wrong because you need (a) cross-session retrieval by semantic similarity (vector embeddings) not by file path, (b) namespacing across projects without managing directory layout, or (c) the .swarm/memory.db audit trail. For one-shot file I/O, native Read/Write is fine.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      await ensureInitialized();
      const { checkMemoryInitialization, listEntries } = await getMemoryFunctions();

      try {
        const status = await checkMemoryInitialization();
        const allEntries = await listEntries({ limit: 100000 });

        // Count by namespace
        const namespaces: Record<string, number> = {};
        let withEmbeddings = 0;

        for (const entry of allEntries.entries) {
          namespaces[entry.namespace] = (namespaces[entry.namespace] || 0) + 1;
          if (entry.hasEmbedding) withEmbeddings++;
        }

        return {
          initialized: status.initialized,
          totalEntries: allEntries.total,
          entriesWithEmbeddings: withEmbeddings,
          embeddingCoverage: allEntries.total > 0
            ? `${((withEmbeddings / allEntries.total) * 100).toFixed(1)}%`
            : '0%',
          namespaces,
          backend: 'sql.js + HNSW',
          version: status.version || '3.0.0',
          features: status.features || {
            vectorEmbeddings: true,
            hnswIndex: true,
            semanticSearch: true,
          },
        };
      } catch (error) {
        return {
          initialized: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };

export const memoryMigrate: MCPTool =   {
    name: 'memory_migrate',
    description: 'Manually trigger migration from legacy JSON store to sql.js Use when native Read/Write is wrong because you need (a) cross-session retrieval by semantic similarity (vector embeddings) not by file path, (b) namespacing across projects without managing directory layout, or (c) the .swarm/memory.db audit trail. For one-shot file I/O, native Read/Write is fine.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        force: { type: 'boolean', description: 'Force re-migration even if already done' },
      },
    },
    handler: async (input) => {
      const force = input.force as boolean;

      // Remove migration marker if forcing
      if (force) {
        const markerPath = getMigrationMarkerPath();
        if (existsSync(markerPath)) {
          unlinkSync(markerPath);
        }
      }

      // Check for legacy data
      const legacyStore = loadLegacyStore();
      if (!legacyStore || Object.keys(legacyStore.entries).length === 0) {
        return {
          success: true,
          message: 'No legacy data to migrate',
          migrated: 0,
        };
      }

      // Run migration via ensureInitialized
      await ensureInitialized();

      return {
        success: true,
        message: 'Migration completed',
        migrated: Object.keys(legacyStore.entries).length,
        backend: 'sql.js + HNSW',
      };
    },
  };

export const memoryImportClaude: MCPTool =   {
    name: 'memory_import_claude',
    description: 'Import Claude Code auto-memory files into AgentDB with ONNX vector embeddings. Reads ~/.claude/projects/*/memory/*.md files, parses YAML frontmatter, splits into sections, and stores with 384-dim embeddings for semantic search. Use allProjects=true to import from ALL Claude projects. Pass projectPath to override cwd-based detection (#1883 — required when Ruflo runs in WSL but Claude Code is on Windows). Pass excludeFilePatterns (glob list) or excludeFiles (absolute path list) to skip voice-load-bearing, PII, or persona-restricted files (#1937). Use when native Read/Write is wrong because you need (a) cross-session retrieval by semantic similarity (vector embeddings) not by file path, (b) namespacing across projects without managing directory layout, or (c) the .swarm/memory.db audit trail. For one-shot file I/O, native Read/Write is fine.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        allProjects: { type: 'boolean', description: 'Import from all Claude projects (default: current project only)' },
        namespace: { type: 'string', description: 'Target namespace (default: "claude-memories")' },
        projectPath: { type: 'string', description: '#1883 — explicit project path to hash, used when cwd does not match Claude Code\'s view (e.g. WSL bridge to Windows host). Pass the canonical project root as Claude Code sees it.' },
        excludeFilePatterns: {
          type: 'array',
          items: { type: 'string' },
          description: '#1937 — glob patterns matched against the absolute file path. Files matching ANY pattern are skipped. Supports `*` (any chars within a path segment), `**` (any chars including separators), and `?` (single char). Examples: `**/voice-*.md`, `**/persona-*.md`. Combine with excludeFiles for explicit paths.',
        },
        excludeFiles: {
          type: 'array',
          items: { type: 'string' },
          description: '#1937 — absolute file paths to skip verbatim. Faster than a pattern when the list is known ahead of time (operator captured baselines). Combine with excludeFilePatterns.',
        },
      },
    },
    handler: async (input) => {
      await ensureInitialized();
      const { storeEntry } = await getMemoryFunctions();

      const ns = (input.namespace as string) || 'claude-memories';
      if (input.namespace) { const vNs = validateIdentifier(ns, 'namespace'); if (!vNs.valid) return { success: false, imported: 0, error: vNs.error }; }
      const allProjects = input.allProjects as boolean;
      const projectPathOverride = input.projectPath as string | undefined;
      const claudeProjectsDir = join(homedir(), '.claude', 'projects');

      // #1937 — voice-fidelity / persona-restricted exclusion.
      const excludeFilePatterns = Array.isArray(input.excludeFilePatterns) ? input.excludeFilePatterns as string[] : [];
      const excludeFilesList = Array.isArray(input.excludeFiles) ? new Set(input.excludeFiles as string[]) : new Set<string>();
      const excludeRegexes = excludeFilePatterns.map(globToRegex);
      const isExcluded = (absPath: string): boolean => {
        if (excludeFilesList.has(absPath)) return true;
        return excludeRegexes.some(re => re.test(absPath));
      };

      // Find memory files
      const memoryFiles: Array<{ path: string; project: string; file: string }> = [];

      let excludedByPattern = 0;

      if (allProjects) {
        // Scan all projects
        if (existsSync(claudeProjectsDir)) {
          try {
            for (const project of readdirSync(claudeProjectsDir, { withFileTypes: true })) {
              if (!project.isDirectory()) continue;
              const memDir = join(claudeProjectsDir, project.name, 'memory');
              if (!existsSync(memDir)) continue;
              for (const file of readdirSync(memDir).filter((f: string) => f.endsWith('.md'))) {
                const absPath = join(memDir, file);
                if (isExcluded(absPath)) { excludedByPattern++; continue; }
                memoryFiles.push({ path: absPath, project: project.name, file });
              }
            }
          } catch { /* scan error */ }
        }
      } else {
        // #1883 — current project: try multiple candidate hashes (POSIX, WSL-translated,
        // leading-dash-stripped, space-replaced). Caller can pass projectPath to override.
        const resolved = resolveProjectMemoryDir(claudeProjectsDir, projectPathOverride);
        if (resolved) {
          try {
            for (const file of readdirSync(resolved.memDir).filter((f: string) => f.endsWith('.md'))) {
              const absPath = join(resolved.memDir, file);
              if (isExcluded(absPath)) { excludedByPattern++; continue; }
              memoryFiles.push({ path: absPath, project: resolved.projectHash, file });
            }
          } catch { /* scan error */ }
        }
      }

      if (memoryFiles.length === 0) {
        return { success: true, imported: 0, message: 'No Claude memory files found' };
      }

      let imported = 0;
      let skipped = 0;
      // #1791.8 — Claude Code's `~/.claude/projects/` accumulates historical
      // project_id directories (truncated forms, sandbox cwds, renamed
      // workspaces) that all contain copies of the same memory files. The
      // previous import indexed each copy under a different `project_id`
      // prefix, producing 5–8x duplication on long-lived homes. Dedupe by
      // file content hash so the same memory is imported once even if it
      // appears under several project directories.
      const seenContentHashes = new Set<string>();
      let duplicatesSkipped = 0;
      const projects = new Set<string>();

      for (const memFile of memoryFiles) {
        projects.add(memFile.project);
        try {
          const content = readFileSync(memFile.path, 'utf-8');

          // #1791.8 — Skip if we've already imported this exact content under
          // a different project_id directory.
          const contentHash = createHash('sha256').update(content).digest('hex').slice(0, 16);
          if (seenContentHashes.has(contentHash)) {
            duplicatesSkipped++;
            continue;
          }
          seenContentHashes.add(contentHash);

          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
          let name = memFile.file.replace('.md', '');
          let body = content;

          if (frontmatterMatch) {
            const yaml = frontmatterMatch[1];
            body = frontmatterMatch[2].trim();
            const nameMatch = yaml.match(/^name:\s*(.+)$/m);
            if (nameMatch) name = nameMatch[1].trim();
          }

          // Split into sections for granular search
          const sections = body.split(/^(?=## )/m).filter(s => s.trim().length > 20);

          if (sections.length === 0 && body.length > 10) {
            // #1884 — sanitize key so memory_delete can later remove it. Without
            // this, dangerous chars from frontmatter `name` strand the key.
            const key = sanitizeMemoryKey(`claude:${memFile.project}:${name}`);
            await storeEntry({ key, value: body.slice(0, 4096), namespace: ns, generateEmbeddingFlag: true });
            imported++;
          } else {
            for (const section of sections) {
              const titleMatch = section.match(/^##\s+(.+)/);
              const sectionTitle = titleMatch ? titleMatch[1].trim() : name;
              const sectionBody = section.replace(/^##\s+.+\n/, '').trim();
              if (sectionBody.length < 10) continue;
              // #1884 — sanitize so any dangerous chars in the heading don't
              // produce keys memory_delete will reject.
              const key = sanitizeMemoryKey(`claude:${memFile.project}:${name}:${sectionTitle.slice(0, 50)}`);
              await storeEntry({ key, value: sectionBody.slice(0, 4096), namespace: ns, generateEmbeddingFlag: true });
              imported++;
            }
          }
        } catch {
          skipped++;
        }
      }

      // AUDIT #3: report the embedding backend truthfully — a hash-fallback
      // import is NOT semantically searchable, so an operator must not read
      // "ONNX ... (384-dim)" when the vectors are mock.
      let importBackend: 'onnx' | 'mock' | 'unknown' = 'unknown';
      try {
        const { generateEmbedding } = await import('../../memory/memory-initializer.js');
        const probe = await generateEmbedding('memory_import_claude backend probe');
        importBackend = probe.backend ?? 'unknown';
      } catch { /* probe failed — leave 'unknown' */ }

      return {
        success: true,
        imported,
        skipped,
        duplicatesSkipped,
        excludedByPattern,
        files: memoryFiles.length,
        projects: projects.size,
        namespace: ns,
        embedding: `all-MiniLM-L6-v2 (384-dim, backend=${importBackend})`,
        embeddingBackend: importBackend,
      };
    },
  };

export const memoryBridgeStatus: MCPTool =   {
    name: 'memory_bridge_status',
    description: 'Show Claude Code memory bridge status — AgentDB vectors, SONA learning, intelligence patterns, and connection health. Use when native Read/Write is wrong because you need (a) cross-session retrieval by semantic similarity (vector embeddings) not by file path, (b) namespacing across projects without managing directory layout, or (c) the .swarm/memory.db audit trail. For one-shot file I/O, native Read/Write is fine.',
    category: 'memory',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      await ensureInitialized();

      // Count Claude memory files
      const claudeProjectsDir = join(homedir(), '.claude', 'projects');
      let claudeFiles = 0;
      let claudeProjects = 0;
      if (existsSync(claudeProjectsDir)) {
        try {
          for (const project of readdirSync(claudeProjectsDir, { withFileTypes: true })) {
            if (!project.isDirectory()) continue;
            const memDir = join(claudeProjectsDir, project.name, 'memory');
            if (!existsSync(memDir)) continue;
            const files = readdirSync(memDir).filter((f: string) => f.endsWith('.md'));
            if (files.length > 0) { claudeProjects++; claudeFiles += files.length; }
          }
        } catch { /* ignore */ }
      }

      // AgentDB status
      // #1940: previously used `allEntries.entries.length` for the totals,
      // but `listEntries({})` returns the first 20 entries with a separate
      // `total` field for the full row count. So `memory_bridge_status`
      // reported `totalEntries: 0`...20 even when the DB had hundreds of
      // rows. Use `.total` for the count, and surface the namespaces with
      // entries so the report matches what's actually in the store.
      let agentdbEntries = 0;
      let claudeMemoryEntries = 0;
      const namespaceCounts: Record<string, number> = {};
      try {
        const { listEntries } = await getMemoryFunctions();
        const allEntries = await listEntries({});
        agentdbEntries = (allEntries as { total?: number })?.total
          ?? allEntries?.entries?.length ?? 0;
        const claudeEntries = await listEntries({ namespace: 'claude-memories' });
        claudeMemoryEntries = (claudeEntries as { total?: number })?.total
          ?? claudeEntries?.entries?.length ?? 0;
        // Per-namespace counts for the namespaces the reporter referenced
        // (#1940). Best-effort — a namespace with 0 entries is omitted.
        for (const ns of ['default', 'patterns', 'claude-memories', 'auto-memory', 'tasks', 'feedback', 'pretrain']) {
          try {
            const r = await listEntries({ namespace: ns });
            const t = (r as { total?: number })?.total ?? r?.entries?.length ?? 0;
            if (t > 0) namespaceCounts[ns] = t;
          } catch { /* skip per-namespace failure */ }
        }
      } catch { /* ignore */ }

      // Intelligence status
      let intelligence = { sonaEnabled: false, patternsLearned: 0, trajectoriesRecorded: 0 };
      try {
        const int = await import('../../memory/intelligence.js');
        const stats = int.getIntelligenceStats?.();
        if (stats) intelligence = { sonaEnabled: stats.sonaEnabled, patternsLearned: stats.patternsLearned, trajectoriesRecorded: stats.trajectoriesRecorded };
      } catch { /* not initialized */ }

      // AUDIT #3: probe the embedding backend so operators can tell real ONNX
      // output from the deterministic hash fallback (which has inverted/
      // meaningless semantics). Without this, the status string reports the
      // model name unconditionally and mock output is indistinguishable.
      let embeddingBackend: 'onnx' | 'mock' | 'unknown' = 'unknown';
      try {
        const { generateEmbedding } = await import('../../memory/memory-initializer.js');
        const probe = await generateEmbedding('memory_bridge_status backend probe');
        embeddingBackend = probe.backend ?? 'unknown';
      } catch { /* probe failed — leave 'unknown' */ }

      const embeddingLabel = `all-MiniLM-L6-v2 (384-dim, backend=${embeddingBackend})`;

      return {
        claudeCode: { memoryFiles: claudeFiles, projects: claudeProjects },
        agentdb: {
          totalEntries: agentdbEntries,
          claudeMemoryEntries,
          namespaces: namespaceCounts,
          backend: embeddingBackend === 'mock' ? 'sql.js + MOCK (hash fallback)' : 'sql.js + ONNX',
          embeddingBackend,
        },
        intelligence,
        // #1940: report 'connected' whenever ANY namespace has imported
        // content, not just `claude-memories` — the bridge can be in active
        // use from other import paths (e.g. plugin namespaces, task memory).
        bridge: {
          status: agentdbEntries > 0 ? 'connected' : 'not-synced',
          embedding: embeddingLabel,
          embeddingBackend,
        },
      };
    },
  };
