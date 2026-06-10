/**
 * DefaultHeadlessExecutor — the content-aware default executor used by
 * headlessBenchmark / validateEffect / abBenchmark. Swaps CLAUDE.md for
 * the configured context, runs `claude -p … --output-format json` via
 * execFile, then restores the original. Self-contained (only Node
 * built-ins + the IContentAwareExecutor interface).
 *
 * Extracted from analyzer.ts (W115, P3.13 cut #5) so the headless,
 * validation, and A/B paths share one implementation without a cycle.
 */
import type { IContentAwareExecutor } from './types.js';

export class DefaultHeadlessExecutor implements IContentAwareExecutor {
  private contextContent: string | null = null;

  setContext(claudeMdContent: string): void {
    this.contextContent = claudeMdContent;
  }

  async execute(prompt: string, workDir: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const fs = await import('node:fs/promises');
    const { join } = await import('node:path');
    const execFileAsync = promisify(execFile);

    const claudeMdPath = join(workDir, 'CLAUDE.md');
    const backupPath = join(workDir, '.CLAUDE.md.ab-backup');
    let swapped = false;

    if (this.contextContent !== null) {
      try { await fs.copyFile(claudeMdPath, backupPath); } catch { /* no file to back up */ }

      if (this.contextContent.length > 0) {
        await fs.writeFile(claudeMdPath, this.contextContent, 'utf-8');
      } else {
        await fs.unlink(claudeMdPath).catch(() => {});
      }
      swapped = true;
    }

    try {
      const { stdout, stderr } = await execFileAsync(
        'claude',
        ['-p', prompt, '--output-format', 'json'],
        { timeout: 60000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8', cwd: workDir }
      );
      return { stdout, stderr, exitCode: 0 };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; code?: number };
      return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', exitCode: err.code ?? 1 };
    } finally {
      if (swapped) {
        try {
          await fs.copyFile(backupPath, claudeMdPath);
          await fs.unlink(backupPath);
        } catch {
          await fs.unlink(claudeMdPath).catch(() => {});
        }
      }
    }
  }
}
