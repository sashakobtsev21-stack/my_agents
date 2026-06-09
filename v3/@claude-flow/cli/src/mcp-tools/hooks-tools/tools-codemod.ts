/**
 * Deterministic codemod execution — the real Tier-1 path (ADR-143).
 *
 *   - hooks_codemod  (var-to-const / remove-console / add-logging, applied
 *                     via the TypeScript compiler with formatting-preserving
 *                     edits. Modes: raw code / single file / files[] /
 *                     glob batch. $0, no LLM.)
 *
 * Extracted from hooks-tools.ts (W49, P3.2 cut #19). Pulls along the
 * CODEMOD_EXTENSIONS allow-set, CODEMOD_MAX_FILES cap, and the
 * codemodLangForExt() language inferer.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as nodeFs from 'fs';
import { resolve } from 'path';
import { type MCPTool } from '../types.js';
import { validatePath } from '../validate-input.js';
import { projectRoot } from './base-path.js';

// Supported source extensions for codemods.
const CODEMOD_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']);
const CODEMOD_MAX_FILES = 2000;

function codemodLangForExt(abs: string): 'javascript' | 'typescript' | 'jsx' | 'tsx' {
  const ext = abs.slice(abs.lastIndexOf('.')).toLowerCase();
  if (ext === '.tsx') return 'tsx';
  if (ext === '.jsx') return 'jsx';
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'javascript';
  return 'typescript';
}

export const hooksCodemod: MCPTool = {
  name: 'hooks_codemod',
  description: 'Apply a deterministic, $0 (no-LLM) code transform — the real Tier-1 execution path (ADR-143). Supported intents: var-to-const, remove-console, add-logging. Uses the TypeScript compiler with formatting-preserving edits (comments/whitespace survive). Targets: raw `code` (returns transformed text, writes nothing) | a single `file` | a `files` array | a `glob` pattern (batch — applies the intent across every match in one $0 call). Files are rewritten in place unless `dryRun`. Intents that need reasoning — add-types, add-error-handling, async-await — are NOT supported here; route those to a model via hooks_model-route. Use when hooks_pre-task / hooks_route returned [CODEMOD_AVAILABLE].',
  inputSchema: {
    type: 'object',
    properties: {
      intent: { type: 'string', enum: ['var-to-const', 'remove-console', 'add-logging'], description: 'Deterministic codemod to apply' },
      file: { type: 'string', description: 'Path to a single existing source file to transform in place' },
      files: { type: 'array', items: { type: 'string' }, description: 'Multiple file paths to transform in one batch call' },
      glob: { type: 'string', description: 'Glob pattern (relative to project root, e.g. "src/**/*.ts") — applies the intent to every matching source file' },
      code: { type: 'string', description: 'Raw source to transform instead of files (returns transformed code, writes nothing)' },
      language: { type: 'string', enum: ['javascript', 'typescript', 'jsx', 'tsx'], description: 'Language hint for raw code (default typescript; inferred from extension for files)' },
      dryRun: { type: 'boolean', description: 'Report what would change without writing files' },
    },
    required: ['intent'],
  },
  handler: async (params: Record<string, unknown>) => {
    const intent = params.intent as string;
    const file = params.file as string | undefined;
    const files = Array.isArray(params.files) ? (params.files as string[]) : undefined;
    const glob = params.glob as string | undefined;
    const rawCode = params.code as string | undefined;
    const dryRun = params.dryRun === true;
    const langParam = params.language as string | undefined;

    const { applyCodemod, isDeterministicCodemod } = await import('../../ruvector/codemods/engine.js');
    if (!isDeterministicCodemod(intent)) {
      return {
        success: false,
        error: `"${intent}" is not a deterministic codemod. Route it to a model via hooks_model-route (Tier 2/3).`,
      };
    }

    // Mode A: transform raw code (never touches disk)
    if (typeof rawCode === 'string') {
      const language = (langParam as 'javascript' | 'typescript' | 'jsx' | 'tsx') ?? 'typescript';
      const r = applyCodemod(intent, rawCode, { language });
      return {
        success: r.success, intent, mode: 'code', changed: r.changed, edits: r.edits,
        output: r.output, language: r.language, reason: r.reason, cost: 0, tier: 1,
      };
    }

    const cwd = projectRoot();

    // Resolve the target file set (single / array / glob), with path containment.
    const resolveTargets = (): { abs: string[]; truncated: boolean; error?: string } => {
      const out = new Set<string>();
      const addRaw = (p: string): string | undefined => {
        const v = validatePath(p, 'path');
        if (!v.valid) return v.error;
        const abs = resolve(cwd, v.sanitized);
        if (!abs.startsWith(cwd)) return `path escapes project root: ${p}`;
        out.add(abs);
        return undefined;
      };

      if (file) { const e = addRaw(file); if (e) return { abs: [], truncated: false, error: e }; }
      if (files) for (const p of files) { const e = addRaw(p); if (e) return { abs: [], truncated: false, error: e }; }
      if (glob) {
        if (glob.includes('..')) return { abs: [], truncated: false, error: 'glob must not contain ".."' };
        // fs.globSync is Node 22+; @types/node here predates it, so type it locally.
        const globSync = (nodeFs as { globSync?: (p: string, o?: { cwd?: string }) => string[] }).globSync;
        if (typeof globSync !== 'function') {
          return { abs: [], truncated: false, error: 'glob requires Node 22+ (fs.globSync unavailable); pass `files[]` instead' };
        }
        let matches: string[] = [];
        try {
          matches = globSync(glob, { cwd });
        } catch (err) {
          return { abs: [], truncated: false, error: `glob failed: ${(err as Error).message}` };
        }
        for (const m of matches) {
          const abs = resolve(cwd, m);
          if (abs.startsWith(cwd) && CODEMOD_EXTENSIONS.has(abs.slice(abs.lastIndexOf('.')).toLowerCase())) {
            out.add(abs);
          }
        }
      }

      const all = [...out];
      const truncated = all.length > CODEMOD_MAX_FILES;
      return { abs: truncated ? all.slice(0, CODEMOD_MAX_FILES) : all, truncated };
    };

    const targets = resolveTargets();
    if (targets.error) return { success: false, error: targets.error };
    if (targets.abs.length === 0) {
      return { success: false, error: 'No target files. Provide `code`, `file`, `files[]`, or a matching `glob`.' };
    }

    // Apply to each file.
    const results: Array<Record<string, unknown>> = [];
    let filesChanged = 0, totalEdits = 0, failures = 0, skipped = 0;

    for (const abs of targets.abs) {
      const rel = abs.startsWith(cwd) ? abs.slice(cwd.length).replace(/^[/\\]/, '') : abs;
      if (!existsSync(abs)) { results.push({ file: rel, success: false, reason: 'not found' }); failures++; continue; }
      if (!CODEMOD_EXTENSIONS.has(abs.slice(abs.lastIndexOf('.')).toLowerCase())) {
        results.push({ file: rel, success: false, reason: 'unsupported extension' }); skipped++; continue;
      }
      const before = readFileSync(abs, 'utf-8');
      const r = applyCodemod(intent, before, { language: codemodLangForExt(abs) });
      if (!r.success) { results.push({ file: rel, success: false, changed: false, reason: r.reason }); failures++; continue; }
      const written = r.changed && !dryRun;
      if (written) writeFileSync(abs, r.output, 'utf-8');
      if (r.changed) { filesChanged++; totalEdits += r.edits; }
      results.push({ file: rel, success: true, changed: r.changed, edits: r.edits, written });
    }

    const single = targets.abs.length === 1 && !files && !glob;
    return {
      success: failures === 0,
      intent,
      mode: single ? (dryRun ? 'dry-run' : 'file') : (dryRun ? 'batch-dry-run' : 'batch'),
      summary: {
        filesScanned: targets.abs.length,
        filesChanged,
        filesUnchanged: targets.abs.length - filesChanged - failures - skipped,
        totalEdits,
        failures,
        skipped,
        truncatedAt: targets.truncated ? CODEMOD_MAX_FILES : undefined,
      },
      results: results.slice(0, 500),
      resultsTruncated: results.length > 500,
      cost: 0,
      tier: 1,
      timestamp: new Date().toISOString(),
    };
  },
};
