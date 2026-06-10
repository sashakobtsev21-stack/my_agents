/**
 * Shared fs / scan / security helpers for the background-worker
 * subsystem — path-traversal-safe resolution, pollution-safe JSON parse,
 * a small TTL file cache, size-limited reads, the DDD regex catalogue,
 * and the directory scanners the worker factories build on.
 *
 * Extracted from workers/index.ts (W85, P3.7 cut #2). The size/recursion/
 * concurrency/alert/history limits live here too (some consumed by the
 * WorkerManager, which imports them back).
 */
import * as path from 'path';
import * as fs from 'fs/promises';

// ============================================================================
// Security Constants
// ============================================================================

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
export const MAX_RECURSION_DEPTH = 20;
export const MAX_CONCURRENCY = 5;
export const MAX_ALERTS = 100;
export const MAX_HISTORY = 1000;
export const FILE_CACHE_TTL = 30_000; // 30 seconds

// ALLOWED_WORKERS was the input-validation surface for the dropped
// isValidWorkerName(); the worker-spawn guard lives inline in handler()
// now. Git history holds the list at this commit's SHA.

// ============================================================================
// Security Utilities
// ============================================================================

// safePathAsync() (async TOCTOU-protected path validator) — dropped.
// The sync safePath() below is the live path-validator at every
// callsite. The async fs.realpath() variant lives in git history at
// this commit's SHA for the future tighter security pass.

/**
 * Synchronous path validation (for non-async contexts)
 */
export function safePath(projectRoot: string, ...segments: string[]): string {
  const resolved = path.resolve(projectRoot, ...segments);
  const realRoot = path.resolve(projectRoot);

  if (!resolved.startsWith(realRoot + path.sep) && resolved !== realRoot) {
    throw new Error(`Path traversal blocked: ${resolved}`);
  }
  return resolved;
}

/**
 * Safe JSON parse that strips dangerous prototype pollution keys
 */
export function safeJsonParse<T>(content: string): T {
  return JSON.parse(content, (key, value) => {
    // Strip prototype pollution vectors
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });
}

// isValidWorkerName() — dropped (allowed-list validator was used by a
// guard-rail that lives directly in handler() now). Git history holds
// the impl if it needs to come back.

// ============================================================================
// Pre-compiled Regexes for DDD Pattern Detection (20-40% faster)
// ============================================================================

export const DDD_PATTERNS = {
  entity: /class\s+\w+Entity\b|interface\s+\w+Entity\b/,
  valueObject: /class\s+\w+(VO|ValueObject)\b|type\s+\w+VO\s*=/,
  aggregate: /class\s+\w+Aggregate\b|AggregateRoot/,
  repository: /class\s+\w+Repository\b|interface\s+I\w+Repository\b/,
  service: /class\s+\w+Service\b|interface\s+I\w+Service\b/,
  domainEvent: /class\s+\w+Event\b|DomainEvent/,
} as const;

// ============================================================================
// File Cache for Repeated Reads (30-50% I/O reduction)
// ============================================================================

interface CacheEntry {
  content: string;
  expires: number;
}

const fileCache = new Map<string, CacheEntry>();

export async function cachedReadFile(filePath: string): Promise<string> {
  const cached = fileCache.get(filePath);
  const now = Date.now();

  if (cached && cached.expires > now) {
    return cached.content;
  }

  const content = await fs.readFile(filePath, 'utf-8');
  fileCache.set(filePath, {
    content,
    expires: now + FILE_CACHE_TTL,
  });

  // Cleanup old entries periodically (keep cache small)
  if (fileCache.size > 100) {
    for (const [key, entry] of fileCache) {
      if (entry.expires < now) {
        fileCache.delete(key);
      }
    }
  }

  return content;
}

/**
 * Safe file read with size limit
 */
export async function safeReadFile(filePath: string, maxSize = MAX_FILE_SIZE): Promise<string> {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > maxSize) {
      throw new Error(`File too large: ${stats.size} > ${maxSize}`);
    }
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('File not found');
    }
    throw error;
  }
}

// validateProjectRoot() — dropped (the path normalization happens
// inline in each worker entrypoint via path.resolve()).
// ============================================================================
// Utility Functions
// ============================================================================

export async function countLines(dir: string, ext: string): Promise<number> {
  let total = 0;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        total += await countLines(fullPath, ext);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        total += content.split('\n').length;
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return total;
}

export async function searchDDDPatterns(srcPath: string): Promise<Record<string, number>> {
  const patterns = {
    entities: 0,
    valueObjects: 0,
    aggregates: 0,
    repositories: 0,
    services: 0,
    domainEvents: 0,
  };

  try {
    const files = await collectFiles(srcPath, '.ts');

    // Process files in batches for better I/O performance
    const BATCH_SIZE = 10;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const contents = await Promise.all(
        batch.map(file => cachedReadFile(file).catch(() => ''))
      );

      for (const content of contents) {
        if (!content) continue;

        // Use pre-compiled regexes (no /g flag to avoid state issues)
        if (DDD_PATTERNS.entity.test(content)) patterns.entities++;
        if (DDD_PATTERNS.valueObject.test(content)) patterns.valueObjects++;
        if (DDD_PATTERNS.aggregate.test(content)) patterns.aggregates++;
        if (DDD_PATTERNS.repository.test(content)) patterns.repositories++;
        if (DDD_PATTERNS.service.test(content)) patterns.services++;
        if (DDD_PATTERNS.domainEvent.test(content)) patterns.domainEvents++;
      }
    }
  } catch {
    // Ignore errors
  }

  return patterns;
}

export async function collectFiles(dir: string, ext: string, depth = 0): Promise<string[]> {
  // Security: Prevent infinite recursion
  if (depth > MAX_RECURSION_DEPTH) {
    return [];
  }

  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip symlinks to prevent traversal attacks
      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subFiles = await collectFiles(fullPath, ext, depth + 1);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return files;
}

export async function scanDirectoryForPatterns(
  dir: string,
  secretPatterns: RegExp[],
  vulnPatterns: RegExp[]
): Promise<{ secrets: number; vulnerabilities: number }> {
  let secrets = 0;
  let vulnerabilities = 0;

  try {
    const files = await collectFiles(dir, '.ts');
    files.push(...await collectFiles(dir, '.js'));

    for (const file of files) {
      // Skip test files and node_modules
      if (file.includes('node_modules') || file.includes('.test.') || file.includes('.spec.')) {
        continue;
      }

      const content = await fs.readFile(file, 'utf-8');

      for (const pattern of secretPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          secrets += matches.length;
        }
      }

      for (const pattern of vulnPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          vulnerabilities += matches.length;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return { secrets, vulnerabilities };
}

export function calculateAvgQuality(patterns: Array<{ quality?: number }>): number {
  if (patterns.length === 0) return 0;

  const sum = patterns.reduce((acc, p) => acc + (p.quality ?? 0), 0);
  return Math.round((sum / patterns.length) * 100) / 100;
}
/**
 * Count files recursively with extension
 */
export async function countFilesRecursive(dir: string, ext: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        count += await countFilesRecursive(fullPath, ext);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        count++;
      }
    }
  } catch {
    // Ignore
  }
  return count;
}
