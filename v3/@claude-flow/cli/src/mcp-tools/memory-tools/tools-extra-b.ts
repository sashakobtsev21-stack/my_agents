/**
 * Memory MCP tools — unified semantic search, detailed stats, and the
 * maintenance tools (cleanup / compress / export / import).
 * Extracted from memory-tools.ts (W126, P3.16 cut #4).
 */
import type { MCPTool } from '../types.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { validateIdentifier } from '../validate-input.js';
import {
  validateMemoryInput,
  getMemoryFunctions,
  ensureInitialized,
} from './helpers.js';

export const memorySearchUnified: MCPTool =   {
    name: 'memory_search_unified',
    description: 'Search across both Claude Code memories and AgentDB entries using semantic vector similarity. Returns merged, deduplicated results from all namespaces. Use when native Read/Write is wrong because you need (a) cross-session retrieval by semantic similarity (vector embeddings) not by file path, (b) namespacing across projects without managing directory layout, or (c) the .swarm/memory.db audit trail. For one-shot file I/O, native Read/Write is fine.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (natural language)' },
        limit: { type: 'number', description: 'Max results (default: 10)' },
        namespace: { type: 'string', description: 'Filter to a single namespace (mutually exclusive with `namespaces`)' },
        namespaces: { type: 'array', items: { type: 'string' }, description: 'Explicit list of namespaces to fan out across (overrides defaults and env)' },
      },
      required: ['query'],
    },
    handler: async (input) => {
      await ensureInitialized();
      const { searchEntries, listEntries } = await getMemoryFunctions();
      validateMemoryInput(undefined, undefined, input.query as string);

      const query = input.query as string;
      const limit = (input.limit as number) ?? 10;
      const ns = input.namespace as string | undefined;
      const nsList = Array.isArray(input.namespaces) ? (input.namespaces as string[]) : undefined;

      if (ns) { const vNs = validateIdentifier(ns, 'namespace'); if (!vNs.valid) return { success: false, query, results: [], total: 0, error: vNs.error }; }
      if (nsList) {
        for (const n of nsList) { const v = validateIdentifier(n, 'namespaces[]'); if (!v.valid) return { success: false, query, results: [], total: 0, error: v.error }; }
      }

      // #2246 fix: namespace resolution priority is
      //   1. explicit single `namespace` (back-compat)
      //   2. explicit `namespaces: string[]` (new in 3.10.29)
      //   3. env var CLAUDE_FLOW_MEMORY_SEARCH_NAMESPACES (CSV)
      //   4. dynamic enumeration via listEntries({}) over the actual store
      //   5. legacy 6-namespace hardcode as last-resort fallback
      // The legacy default was silently missing ~95% of entries on stores with
      // custom namespaces (issue #2246). Dynamic enumeration fixes that.
      const LEGACY_DEFAULT = ['default', 'claude-memories', 'auto-memory', 'patterns', 'tasks', 'feedback'];
      let namespaces: string[];
      let namespaceSource: 'param-single' | 'param-list' | 'env' | 'dynamic' | 'legacy-fallback';
      if (ns) {
        namespaces = [ns]; namespaceSource = 'param-single';
      } else if (nsList && nsList.length > 0) {
        namespaces = nsList; namespaceSource = 'param-list';
      } else if (process.env.CLAUDE_FLOW_MEMORY_SEARCH_NAMESPACES) {
        namespaces = process.env.CLAUDE_FLOW_MEMORY_SEARCH_NAMESPACES.split(',').map(s => s.trim()).filter(Boolean);
        namespaceSource = 'env';
      } else {
        // Dynamic enumeration — list all entries and collect distinct namespaces.
        // Cap entries at 100k to bound memory; in practice this is fast (<200ms).
        try {
          const all = await listEntries({ limit: 100000 });
          const seenNs = new Set<string>();
          for (const e of all?.entries ?? []) if (e.namespace) seenNs.add(e.namespace);
          namespaces = seenNs.size > 0 ? Array.from(seenNs).sort() : LEGACY_DEFAULT;
          namespaceSource = seenNs.size > 0 ? 'dynamic' : 'legacy-fallback';
        } catch {
          namespaces = LEGACY_DEFAULT; namespaceSource = 'legacy-fallback';
        }
      }

      const allResults: Array<{ key: string; content: string; score: number; namespace: string; source: string }> = [];

      for (const searchNs of namespaces) {
        try {
          const r = await searchEntries({ query, namespace: searchNs, limit: limit * 2 });
          if (r?.results) {
            for (const entry of r.results) {
              allResults.push({
                key: entry.key || entry.id || '',
                content: (entry.content || (entry as any).value || '').toString().slice(0, 200),
                score: entry.score || 0,
                namespace: searchNs,
                source: searchNs === 'claude-memories' ? 'claude-code' : searchNs === 'auto-memory' ? 'auto-memory' : 'agentdb',
              });
            }
          }
        } catch { /* namespace may not exist */ }
      }

      // Sort by score, deduplicate by key, take top N
      allResults.sort((a, b) => b.score - a.score);
      const seen = new Set<string>();
      const deduplicated = allResults.filter(r => {
        if (seen.has(r.key)) return false;
        seen.add(r.key);
        return true;
      }).slice(0, limit);

      return {
        success: true,
        query,
        results: deduplicated,
        total: deduplicated.length,
        searchedNamespaces: namespaces,
        namespaceSource,        // #2246 — surface how the namespace list was resolved
        searchTime: Date.now(),
      };
    },
  };

export const memoryDetailedStats: MCPTool =   {
    // #1916: `ruflo status memory` (the detailed view) referenced an
    // unregistered `memory_detailed-stats` tool. memory_stats returns a
    // different shape; this returns what the CLI renders.
    name: 'memory_detailed-stats',
    description: 'Detailed memory-store report — backend, entry count, total bytes, per-namespace counts, and (placeholder) perf metrics. Use when native Read/Glob is wrong because the data lives in .swarm/memory.db, not files, and you want an aggregate health view. For a quick count use memory_stats; for "what is in memory" use memory_list.',
    category: 'memory',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      await ensureInitialized();
      const { listEntries } = await getMemoryFunctions();
      const all = await listEntries({ limit: 100000 });
      const nsCounts: Record<string, number> = {};
      let bytes = 0;
      for (const e of all.entries) {
        nsCounts[e.namespace] = (nsCounts[e.namespace] || 0) + 1;
        bytes += (e.size as number) || 0;
      }
      return {
        backend: 'sql.js + HNSW',
        entries: all.total ?? all.entries.length,
        size: bytes,
        namespaces: Object.entries(nsCounts).map(([name, entries]) => ({ name, entries })),
        performance: { avgSearchTime: 0, avgWriteTime: 0, cacheHitRate: 0, hnswEnabled: true },
        note: 'perf metrics are placeholders; HNSW is always enabled in the sql.js backend',
      };
    },
  };

export const memoryCleanup: MCPTool =   {
    // #1916: `ruflo memory cleanup` referenced an unregistered `memory_cleanup`
    // tool. Removes entries whose TTL has expired. Defaults to a dry run —
    // pass dryRun:false to actually delete.
    name: 'memory_cleanup',
    description: 'Prune memory entries whose TTL has expired (dry run by default; pass dryRun:false to delete). Use when native rm is wrong because the entries are rows in .swarm/memory.db, not files. For removing a specific known key use memory_delete. Stale/low-quality pruning is delegated to the agentdb consolidation curator (#1916 follow-up).',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        dryRun: { type: 'boolean', description: 'Only report candidates, do not delete (default true)' },
        namespace: { type: 'string', description: 'Limit cleanup to one namespace' },
      },
    },
    handler: async (input) => {
      await ensureInitialized();
      const { listEntries, deleteEntry } = await getMemoryFunctions();
      const dryRun = input.dryRun !== false; // default true
      const namespace = input.namespace ? String(input.namespace) : undefined;
      if (namespace) { const v = validateIdentifier(namespace, 'namespace'); if (!v.valid) throw new Error(v.error); }
      const all = await listEntries({ limit: 100000, namespace });
      const now = Date.now();
      const expired = all.entries.filter(e => {
        const exp = (e as { expiresAt?: string | number | null }).expiresAt;
        if (!exp) return false;
        const t = typeof exp === 'number' ? exp : Date.parse(String(exp));
        return Number.isFinite(t) && t < now;
      });
      let freedBytes = 0;
      let deleted = 0;
      if (!dryRun) {
        for (const e of expired) {
          try { await deleteEntry({ key: e.key, namespace: e.namespace }); freedBytes += (e.size as number) || 0; deleted++; }
          catch { /* ignore individual delete errors */ }
        }
      } else {
        freedBytes = expired.reduce((s, e) => s + ((e.size as number) || 0), 0);
      }
      return {
        dryRun,
        candidates: { expired: expired.length, stale: 0, lowQuality: 0, total: expired.length },
        deleted: { entries: dryRun ? 0 : deleted, vectors: 0, patterns: 0 },
        freed: { bytes: freedBytes },
        note: dryRun ? 'dry run — re-run with dryRun:false to delete' : undefined,
      };
    },
  };

export const memoryCompress: MCPTool =   {
    // #1916: `ruflo memory compress` referenced an unregistered tool. The
    // sql.js backend has no on-disk compression; this reports current sizes.
    name: 'memory_compress',
    description: 'Report memory-store size breakdown (the sql.js backend has no on-disk compression — entries are already stored compactly; quantized embeddings via RaBitQ are configured elsewhere). Use when native du is wrong because the data is in .swarm/memory.db. For pruning expired entries use memory_cleanup.',
    category: 'memory',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      await ensureInitialized();
      const { listEntries } = await getMemoryFunctions();
      const all = await listEntries({ limit: 100000 });
      const bytes = all.entries.reduce((s, e) => s + ((e.size as number) || 0), 0);
      const human = `${bytes}B`;
      const sizes = { totalSize: human, vectorsSize: 'n/a', textSize: human, patternsSize: 'n/a', indexSize: 'n/a' };
      return {
        before: sizes,
        after: sizes,
        compression: { ratio: 1, savedBytes: 0, method: 'none' },
        note: 'sql.js backend has no on-disk compression; nothing to compress. (RaBitQ embedding quantization is a separate feature.)',
      };
    },
  };

export const memoryExport: MCPTool =   {
    // #1916: `ruflo memory export -o <file>` referenced an unregistered tool.
    // Dumps entry metadata (and values when the backend returns them) to JSON.
    name: 'memory_export',
    description: 'Export memory entries to a JSON file (keys, namespaces, timestamps, and values when available). Use when native Write is wrong because the data is rows in .swarm/memory.db, not a file you can copy. For ingesting an export elsewhere use memory_import. (CSV output and embedding-vector export are follow-ups.)',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        outputPath: { type: 'string', description: 'File path to write the JSON export to' },
        format: { type: 'string', enum: ['json', 'csv'], description: 'Export format (csv falls back to json today)' },
        namespace: { type: 'string', description: 'Limit export to one namespace' },
        includeVectors: { type: 'boolean', description: 'Include embedding vectors (advisory — not exported yet)' },
      },
      required: ['outputPath'],
    },
    handler: async (input) => {
      await ensureInitialized();
      const { listEntries } = await getMemoryFunctions();
      const outputPath = String(input.outputPath ?? '');
      if (!outputPath) return { error: 'outputPath is required' };
      const namespace = input.namespace ? String(input.namespace) : undefined;
      if (namespace) { const v = validateIdentifier(namespace, 'namespace'); if (!v.valid) throw new Error(v.error); }
      // #2073: pass includeContent so the value field carries the actual
      // entry body. Without this, `value` is always null because listEntries
      // strips content by default (callers pay for the JSON parse only when
      // they need it).
      const all = await listEntries({ limit: 100000, namespace, includeContent: true });
      const payload = {
        schema: 'ruflo-memory-export/v1',
        exportedAt: new Date().toISOString(),
        namespace: namespace ?? null,
        count: all.entries.length,
        entries: all.entries.map(e => ({
          key: e.key,
          namespace: e.namespace,
          // #2073: `e.content` is the stored value string; `e.value` was a
          // never-populated alias. Fall back to null only if content is
          // missing for backward-compat with the schema.
          value: typeof e.content === 'string' ? e.content : ((e as { value?: unknown }).value ?? null),
          createdAt: e.createdAt, updatedAt: e.updatedAt, accessCount: e.accessCount, hasEmbedding: e.hasEmbedding, size: e.size,
        })),
      };
      try { writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8'); }
      catch (e) { return { error: `Could not write ${outputPath}: ${(e as Error).message}` }; }
      const vectorsWithEmb = all.entries.filter(e => e.hasEmbedding).length;
      return {
        outputPath,
        format: (input.format as string) || 'json',
        exported: { entries: all.entries.length, vectors: vectorsWithEmb, patterns: 0 },
        fileSize: `${Buffer.byteLength(JSON.stringify(payload))}B`,
        note: input.format === 'csv' ? 'CSV not implemented yet — wrote JSON' : undefined,
      };
    },
  };

export const memoryImport: MCPTool =   {
    // #1916: `ruflo memory import <file>` referenced an unregistered tool.
    // Reads a ruflo-memory-export JSON and re-stores each entry.
    name: 'memory_import',
    description: 'Import memory entries from a JSON export file (produced by memory_export) into .swarm/memory.db, re-embedding values. Use when native Read is wrong because the data must be re-stored as memory rows (with new embeddings), not just read. For importing Claude Code\'s own memory files use memory_import_claude. Pair with memory_export on the source.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string', description: 'Path to the JSON export file' },
        merge: { type: 'boolean', description: 'Merge into existing entries (upsert) vs. fail on conflict (default true)' },
        namespace: { type: 'string', description: 'Override the namespace for all imported entries' },
      },
      required: ['inputPath'],
    },
    handler: async (input) => {
      await ensureInitialized();
      const { storeEntry } = await getMemoryFunctions();
      const t0 = Date.now();
      const inputPath = String(input.inputPath ?? '');
      if (!inputPath || !existsSync(inputPath)) return { error: `File not found: ${inputPath || '(empty)'}` };
      let doc: { entries?: Array<{ key: string; namespace?: string; value?: unknown }> };
      try { doc = JSON.parse(readFileSync(inputPath, 'utf-8')); }
      catch (e) { return { error: `Invalid export JSON: ${(e as Error).message}` }; }
      const entries = Array.isArray(doc.entries) ? doc.entries : [];
      const nsOverride = input.namespace ? String(input.namespace) : undefined;
      if (nsOverride) { const v = validateIdentifier(nsOverride, 'namespace'); if (!v.valid) throw new Error(v.error); }
      let imported = 0; let skipped = 0;
      for (const e of entries) {
        if (!e || typeof e.key !== 'string') { skipped++; continue; }
        const value = typeof e.value === 'string' ? e.value : JSON.stringify(e.value ?? null);
        try {
          await storeEntry({ key: e.key, value, namespace: nsOverride ?? e.namespace ?? 'default', upsert: input.merge !== false });
          imported++;
        } catch { skipped++; }
      }
      return {
        inputPath,
        imported: { entries: imported, vectors: 0, patterns: 0 },
        skipped,
        duration: Date.now() - t0,
      };
    },
  };
