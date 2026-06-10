/**
 * Shared analysis infrastructure for the analyze subcommands — the lazy
 * AST/graph analyzer loaders plus the source-file scanner and the
 * regex-based fallback analyzer used when the native analyzer is
 * unavailable.
 *
 * Extracted from analyze.ts (W73, P3.5 cut #2) — the foundation the
 * AST / deps / diff / code command groups all build on, pulled out
 * before the command groups themselves.
 */
import * as path from 'path';
import * as fs from 'fs/promises';

// Dynamic import for AST analyzer
export async function getASTAnalyzer() {
  try {
    return await import('../../ruvector/ast-analyzer.js');
  } catch {
    return null;
  }
}

// Dynamic import for graph analyzer
export async function getGraphAnalyzer() {
  try {
    return await import('../../ruvector/graph-analyzer.js');
  } catch {
    return null;
  }
}

/**
 * Helper: Scan directory for source files
 */
export async function scanSourceFiles(dir: string, maxDepth: number = 10): Promise<string[]> {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  const excludeDirs = ['node_modules', 'dist', 'build', '.git', 'coverage', '__pycache__'];

  async function scan(currentDir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name)) {
            await scan(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await scan(dir, 0);
  return files;
}

/**
 * Fallback analysis when ruvector is not available
 */
export function fallbackAnalyze(code: string, filePath: string) {
  const lines = code.split('\n');
  const functions: Array<{ name: string; startLine: number; endLine: number }> = [];
  const classes: Array<{ name: string; startLine: number; endLine: number }> = [];
  const imports: string[] = [];
  const exports: string[] = [];

  // Extract functions
  const funcPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/gm;
  let match;
  while ((match = funcPattern.exec(code)) !== null) {
    const name = match[1] || match[2] || match[3];
    if (name && !['if', 'while', 'for', 'switch'].includes(name)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      functions.push({ name, startLine: lineNum, endLine: lineNum + 10 });
    }
  }

  // Extract classes
  const classPattern = /(?:export\s+)?class\s+(\w+)/gm;
  while ((match = classPattern.exec(code)) !== null) {
    const lineNum = code.substring(0, match.index).split('\n').length;
    classes.push({ name: match[1], startLine: lineNum, endLine: lineNum + 20 });
  }

  // Extract imports
  const importPattern = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/gm;
  while ((match = importPattern.exec(code)) !== null) {
    imports.push(match[1]);
  }
  const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = requirePattern.exec(code)) !== null) {
    imports.push(match[1]);
  }

  // Extract exports
  const exportPattern = /export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/gm;
  while ((match = exportPattern.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // Calculate complexity
  const nonEmptyLines = lines.filter(l => l.trim().length > 0).length;
  const commentLines = lines.filter(l => /^\s*(\/\/|\/\*|\*|#)/.test(l)).length;
  const decisionPoints = (code.match(/\b(if|else|for|while|switch|case|catch|&&|\|\||\?)\b/g) || []).length;

  let cognitive = 0;
  let nestingLevel = 0;
  for (const line of lines) {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    if (/\b(if|for|while|switch)\b/.test(line)) {
      cognitive += 1 + nestingLevel;
    }
    nestingLevel = Math.max(0, nestingLevel + opens - closes);
  }

  // Detect language
  const ext = path.extname(filePath).toLowerCase();
  const language = ext === '.ts' || ext === '.tsx' ? 'typescript' :
    ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs' ? 'javascript' :
    ext === '.py' ? 'python' : 'unknown';

  return {
    filePath,
    language,
    functions,
    classes,
    imports,
    exports,
    complexity: {
      cyclomatic: decisionPoints + 1,
      cognitive,
      loc: nonEmptyLines,
      commentDensity: lines.length > 0 ? commentLines / lines.length : 0,
    },
  };
}
