/**
 * Graph Analyzer — import/export extraction & path resolution
 *
 * Extracted verbatim from graph-analyzer.ts (lines 128-234) during
 * campaign-2 wave 40 (W246). Module-private pre-split; NOT re-exported
 * by the barrel.
 */

import { join, extname, dirname } from 'path';
import type { GraphEdge } from './graph-analyzer/types.js';

export function extractImports(content: string, _filePath: string): Array<{ path: string; type: GraphEdge['type'] }> {
  const imports: Array<{ path: string; type: GraphEdge['type'] }> = [];

  // ES6 import statements
  const esImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*\s*from\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = esImportRegex.exec(content)) !== null) {
    imports.push({ path: match[1], type: 'import' });
  }

  // Side-effect imports: import 'module'
  const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
  while ((match = sideEffectRegex.exec(content)) !== null) {
    imports.push({ path: match[1], type: 'import' });
  }

  // CommonJS require
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push({ path: match[1], type: 'require' });
  }

  // Dynamic imports
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push({ path: match[1], type: 'dynamic' });
  }

  // Re-exports: export * from 'module'
  const reExportRegex = /export\s+(?:\*|\{[^}]*\})\s+from\s*['"]([^'"]+)['"]/g;
  while ((match = reExportRegex.exec(content)) !== null) {
    imports.push({ path: match[1], type: 're-export' });
  }

  return imports;
}

/**
 * Extract exports from TypeScript/JavaScript file
 */
export function extractExports(content: string): string[] {
  const exports: string[] = [];

  // Named exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  // Export list: export { a, b, c }
  const exportListRegex = /export\s+\{([^}]+)\}/g;
  while ((match = exportListRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
    exports.push(...names.filter(n => n));
  }

  // Default export
  if (/export\s+default/.test(content)) {
    exports.push('default');
  }

  return exports;
}

/**
 * Resolve import path to absolute file path
 */
export function resolveImportPath(importPath: string, fromFile: string, rootDir: string): string | null {
  // Skip external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  const fromDir = dirname(fromFile);
  let resolved: string;

  if (importPath.startsWith('/')) {
    resolved = join(rootDir, importPath);
  } else {
    resolved = join(fromDir, importPath);
  }

  // Handle extension-less imports
  const ext = extname(resolved);
  if (!ext) {
    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    for (const tryExt of extensions) {
      const tryPath = resolved + tryExt;
      return tryPath; // Return normalized, existence check done later
    }
    // Could be index file
    return join(resolved, 'index');
  }

  return resolved;
}

// ============================================================================
// Graph Builder
// ============================================================================

/**
 * Build dependency graph from source directory (with caching)
 */
