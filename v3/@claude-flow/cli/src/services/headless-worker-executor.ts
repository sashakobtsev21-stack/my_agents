/**
 * Headless Worker Executor
 * Enables workers to invoke Claude Code in headless mode with configurable sandbox profiles.
 *
 * ADR-020: Headless Worker Integration Architecture
 * - Integrates with CLAUDE_CODE_HEADLESS and CLAUDE_CODE_SANDBOX_MODE environment variables
 * - Provides process pool for concurrent execution
 * - Builds context from file glob patterns
 * - Supports prompt templates and output parsing
 * - Implements timeout and graceful error handling
 *
 * Key Features:
 * - Process pool with configurable maxConcurrent
 * - Context building from file glob patterns with caching
 * - Prompt template system with context injection
 * - Output parsing (text, json, markdown)
 * - Timeout handling with graceful termination
 * - Execution logging for debugging
 * - Event emission for monitoring
 */

import { spawn, execFileSync } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
// Types + worker-config tables moved to ./headless-worker-executor/
// {types,configs}.ts (W143, P3.25). Imported for the class below +
// re-exported so worker-daemon / hooks-tools / local-workers and other
// callers keep importing them from './headless-worker-executor.js'
// byte-identically.
import type {
  HeadlessWorkerType, LocalWorkerType, SandboxMode, ModelType,
  HeadlessOptions, HeadlessWorkerConfig, HeadlessExecutorConfig,
  HeadlessExecutionResult, PoolStatus, PoolEntry, QueueEntry, CacheEntry,
} from './headless-worker-executor/types.js';
export type {
  HeadlessWorkerType, LocalWorkerType, SandboxMode, ModelType, OutputFormat,
  ExecutionMode, WorkerPriority, WorkerConfig, HeadlessOptions,
  HeadlessWorkerConfig, HeadlessExecutorConfig, HeadlessExecutionResult,
  PoolStatus,
} from './headless-worker-executor/types.js';
import {
  HEADLESS_WORKER_TYPES, LOCAL_WORKER_TYPES, HEADLESS_WORKER_CONFIGS, MODEL_IDS,
} from './headless-worker-executor/configs.js';
export {
  HEADLESS_WORKER_TYPES, LOCAL_WORKER_TYPES, HEADLESS_WORKER_CONFIGS,
  LOCAL_WORKER_CONFIGS, ALL_WORKER_CONFIGS,
  isHeadlessWorker, isLocalWorker, getModelId, getWorkerConfig,
} from './headless-worker-executor/configs.js';

// ============================================
// HeadlessWorkerExecutor Class
// ============================================

/**
 * HeadlessWorkerExecutor - Executes workers using Claude Code in headless mode
 *
 * Features:
 * - Process pool with configurable concurrency limit
 * - Pending queue for overflow requests
 * - Context caching with configurable TTL
 * - Execution logging for debugging
 * - Event emission for monitoring
 * - Graceful termination
 */
export class HeadlessWorkerExecutor extends EventEmitter {
  private projectRoot: string;
  private config: Required<HeadlessExecutorConfig>;
  private processPool: Map<string, PoolEntry> = new Map();
  private pendingQueue: QueueEntry[] = [];
  private contextCache: Map<string, CacheEntry> = new Map();
  private claudeCodeAvailable: boolean | null = null;
  private claudeCodeVersion: string | null = null;

  constructor(projectRoot: string, options?: HeadlessExecutorConfig) {
    super();
    this.projectRoot = projectRoot;

    // Merge with defaults
    this.config = {
      maxConcurrent: options?.maxConcurrent ?? 2,
      defaultTimeoutMs: options?.defaultTimeoutMs ?? 5 * 60 * 1000,
      maxContextFiles: options?.maxContextFiles ?? 20,
      maxCharsPerFile: options?.maxCharsPerFile ?? 5000,
      logDir: options?.logDir ?? join(projectRoot, '.claude-flow', 'logs', 'headless'),
      cacheContext: options?.cacheContext ?? true,
      cacheTtlMs: options?.cacheTtlMs ?? 60000, // 1 minute default
    };

    // Ensure log directory exists
    this.ensureLogDir();
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Check if Claude Code CLI is available.
   *
   * #2110 fix — three issues addressed:
   *   1. Cache only `true`, never `false`. A transient failure (WSL2 cold
   *      start, AV scanner, slow shell init) used to set
   *      `claudeCodeAvailable = false` for the rest of the daemon
   *      lifetime, so the daemon kept running local stubs even after the
   *      user fixed `claude auth login`. Now: false results re-probe on
   *      the next call.
   *   2. Log the actual error from the catch block instead of silently
   *      swallowing it. Operators couldn't distinguish timeout / ENOENT /
   *      auth-failure / exit-code without this.
   *   3. Honour `CLAUDE_CODE_AVAILABILITY_TIMEOUT_MS` for WSL2 / slow
   *      systems where `claude --version` can take >5s on first invoke.
   */
  async isAvailable(): Promise<boolean> {
    // Only the `true` result is cached — `false` is re-probed every call
    // so a transient failure doesn't poison the rest of the daemon's life.
    if (this.claudeCodeAvailable === true) {
      return true;
    }

    const timeoutMs = Number.parseInt(process.env.CLAUDE_CODE_AVAILABILITY_TIMEOUT_MS || '', 10) || 5000;
    try {
      // ADR-078: execFileSync (no shell, no user input in argv). On Windows the
      // npm shim is `claude.cmd`; bare `claude` would 404 without shell:true.
      const claudeBin = process.platform === 'win32' ? 'claude.cmd' : 'claude';
      const output = execFileSync(claudeBin, ['--version'], {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: timeoutMs,
        windowsHide: true,
      });
      this.claudeCodeAvailable = true;
      this.claudeCodeVersion = output.trim();
      this.emit('status', { available: true, version: this.claudeCodeVersion });
      return true;
    } catch (err) {
      // Don't cache false — let the next call retry. Surface the actual
      // error via emit so operators can diagnose timeout / ENOENT / auth.
      this.claudeCodeAvailable = null;
      const reason =
        err instanceof Error
          ? `${err.name}: ${err.message}`.slice(0, 200)
          : String(err).slice(0, 200);
      this.emit('status', { available: false, reason });
      return false;
    }
  }

  /**
   * Get Claude Code version
   */
  async getVersion(): Promise<string | null> {
    await this.isAvailable();
    return this.claudeCodeVersion;
  }

  /**
   * Execute a headless worker
   */
  async execute(
    workerType: HeadlessWorkerType,
    configOverrides?: Partial<HeadlessOptions>
  ): Promise<HeadlessExecutionResult> {
    const baseConfig = HEADLESS_WORKER_CONFIGS[workerType];
    if (!baseConfig) {
      throw new Error(`Unknown headless worker type: ${workerType}`);
    }

    // Check availability
    const available = await this.isAvailable();
    if (!available) {
      const result = this.createErrorResult(
        workerType,
        'Claude Code CLI not available. Install with: npm install -g @anthropic-ai/claude-code'
      );
      this.emit('error', result);
      return result;
    }

    // Check concurrent limit
    if (this.processPool.size >= this.config.maxConcurrent) {
      // Queue the request
      return new Promise((resolve, reject) => {
        const entry: QueueEntry = {
          workerType,
          config: configOverrides,
          resolve,
          reject,
          queuedAt: new Date(),
        };
        this.pendingQueue.push(entry);
        this.emit('queued', {
          workerType,
          queuePosition: this.pendingQueue.length,
        });
      });
    }

    // Execute immediately
    return this.executeInternal(workerType, configOverrides);
  }

  /**
   * Get pool status
   */
  /**
   * #1855: return the PIDs of all currently-running headless worker
   * children. Used by `WorkerDaemon` to snapshot active child PIDs to
   * disk so the next lifetime can reap orphans after a hard crash.
   */
  getActiveChildPids(): number[] {
    const out: number[] = [];
    for (const entry of this.processPool.values()) {
      const pid = entry.process?.pid;
      if (typeof pid === 'number' && pid > 0) out.push(pid);
    }
    return out;
  }

  getPoolStatus(): PoolStatus {
    const now = Date.now();
    return {
      activeCount: this.processPool.size,
      queueLength: this.pendingQueue.length,
      maxConcurrent: this.config.maxConcurrent,
      activeWorkers: Array.from(this.processPool.values()).map((entry) => ({
        executionId: entry.executionId,
        workerType: entry.workerType,
        startTime: entry.startTime,
        elapsedMs: now - entry.startTime.getTime(),
      })),
      queuedWorkers: this.pendingQueue.map((entry) => ({
        workerType: entry.workerType,
        queuedAt: entry.queuedAt,
        waitingMs: now - entry.queuedAt.getTime(),
      })),
    };
  }

  /**
   * Get number of active executions
   */
  getActiveCount(): number {
    return this.processPool.size;
  }

  /**
   * Cancel a running execution
   */
  cancel(executionId: string): boolean {
    const entry = this.processPool.get(executionId);
    if (!entry) {
      return false;
    }

    clearTimeout(entry.timeout);
    entry.process.kill('SIGTERM');
    this.processPool.delete(executionId);
    this.emit('cancelled', { executionId });

    // Process next in queue
    this.processQueue();

    return true;
  }

  /**
   * Cancel all running executions
   */
  cancelAll(): number {
    let cancelled = 0;

    // Cancel active processes (convert to array to avoid iterator issues)
    const entries = Array.from(this.processPool.entries());
    for (const [executionId, entry] of entries) {
      clearTimeout(entry.timeout);
      entry.process.kill('SIGTERM');
      // SIGKILL fallback after 5s to prevent orphan processes (#1395 Bug 6)
      setTimeout(() => {
        try { if (!entry.process.killed) entry.process.kill('SIGKILL'); } catch { /* already dead */ }
      }, 5000).unref();
      this.emit('cancelled', { executionId });
      cancelled++;
    }
    this.processPool.clear();

    // Reject pending queue
    for (const entry of this.pendingQueue) {
      entry.reject(new Error('Executor cancelled all executions'));
    }
    this.pendingQueue = [];

    this.emit('allCancelled', { count: cancelled });
    return cancelled;
  }

  /**
   * Clear context cache
   */
  clearContextCache(): void {
    this.contextCache.clear();
    this.emit('cacheClear', {});
  }

  /**
   * Get worker configuration
   */
  getConfig(workerType: HeadlessWorkerType): HeadlessWorkerConfig | undefined {
    return HEADLESS_WORKER_CONFIGS[workerType];
  }

  /**
   * Get all headless worker types
   */
  getHeadlessWorkerTypes(): HeadlessWorkerType[] {
    return [...HEADLESS_WORKER_TYPES];
  }

  /**
   * Get all local worker types
   */
  getLocalWorkerTypes(): LocalWorkerType[] {
    return [...LOCAL_WORKER_TYPES];
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Ensure log directory exists
   */
  private ensureLogDir(): void {
    try {
      if (!existsSync(this.config.logDir)) {
        mkdirSync(this.config.logDir, { recursive: true });
      }
    } catch (error) {
      this.emit('warning', { message: 'Failed to create log directory', error });
    }
  }

  /**
   * Internal execution logic
   */
  private async executeInternal(
    workerType: HeadlessWorkerType,
    configOverrides?: Partial<HeadlessOptions>
  ): Promise<HeadlessExecutionResult> {
    const baseConfig = HEADLESS_WORKER_CONFIGS[workerType];
    const headless = { ...baseConfig.headless!, ...configOverrides };

    const startTime = Date.now();
    const executionId = `${workerType}_${startTime}_${Math.random().toString(36).slice(2, 8)}`;

    this.emit('start', { executionId, workerType, config: headless });

    try {
      // Build context from file patterns
      const context = await this.buildContext(headless.contextPatterns || []);

      // Build the full prompt
      const fullPrompt = this.buildPrompt(headless.promptTemplate, context);

      // Log prompt for debugging
      this.logExecution(executionId, 'prompt', fullPrompt);

      // Execute Claude Code headlessly
      const result = await this.executeClaudeCode(fullPrompt, {
        sandbox: headless.sandbox,
        model: headless.model || 'sonnet',
        timeoutMs: headless.timeoutMs || this.config.defaultTimeoutMs,
        executionId,
        workerType,
      });

      // Parse output based on format
      let parsedOutput: unknown;
      if (headless.outputFormat === 'json' && result.output) {
        parsedOutput = this.parseJsonOutput(result.output);
      } else if (headless.outputFormat === 'markdown' && result.output) {
        parsedOutput = this.parseMarkdownOutput(result.output);
      }

      const executionResult: HeadlessExecutionResult = {
        success: result.success,
        output: result.output,
        parsedOutput,
        durationMs: Date.now() - startTime,
        tokensUsed: result.tokensUsed,
        model: headless.model || 'sonnet',
        sandboxMode: headless.sandbox,
        workerType,
        timestamp: new Date(),
        executionId,
        error: result.error,
      };

      // Log result
      this.logExecution(executionId, 'result', JSON.stringify(executionResult, null, 2));

      this.emit('complete', executionResult);
      return executionResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const executionResult = this.createErrorResult(workerType, errorMessage);
      executionResult.executionId = executionId;
      executionResult.durationMs = Date.now() - startTime;

      this.logExecution(executionId, 'error', errorMessage);
      this.emit('error', executionResult);

      return executionResult;
    } finally {
      // Process next in queue
      this.processQueue();
    }
  }

  /**
   * Process the pending queue
   */
  private processQueue(): void {
    while (
      this.pendingQueue.length > 0 &&
      this.processPool.size < this.config.maxConcurrent
    ) {
      const next = this.pendingQueue.shift();
      if (!next) break;

      this.executeInternal(next.workerType, next.config)
        .then(next.resolve)
        .catch(next.reject);
    }
  }

  /**
   * Build context from file patterns
   */
  private async buildContext(patterns: string[]): Promise<string> {
    if (patterns.length === 0) return '';

    // Check cache
    const cacheKey = patterns.sort().join('|');
    if (this.config.cacheContext) {
      const cached = this.contextCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTtlMs) {
        return cached.content;
      }
    }

    // Collect files matching patterns
    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = this.simpleGlob(pattern);
      files.push(...matches);
    }

    // Deduplicate and limit
    const uniqueFiles = Array.from(new Set(files)).slice(0, this.config.maxContextFiles);

    // Build context
    const contextParts: string[] = [];
    for (const file of uniqueFiles) {
      try {
        const fullPath = join(this.projectRoot, file);
        if (!existsSync(fullPath)) continue;

        const content = readFileSync(fullPath, 'utf-8');
        const truncated = content.slice(0, this.config.maxCharsPerFile);
        const wasTruncated = content.length > this.config.maxCharsPerFile;

        contextParts.push(
          `--- ${file}${wasTruncated ? ' (truncated)' : ''} ---\n${truncated}`
        );
      } catch {
        // Skip unreadable files
      }
    }

    const contextContent = contextParts.join('\n\n');

    // Cache the result
    if (this.config.cacheContext) {
      this.contextCache.set(cacheKey, {
        content: contextContent,
        timestamp: Date.now(),
        patterns,
      });
    }

    return contextContent;
  }

  /**
   * Simple glob implementation for file matching
   */
  private simpleGlob(pattern: string): string[] {
    const results: string[] = [];

    // Handle simple patterns (no wildcards)
    if (!pattern.includes('*')) {
      const fullPath = join(this.projectRoot, pattern);
      if (existsSync(fullPath)) {
        results.push(pattern);
      }
      return results;
    }

    // Parse pattern parts
    const parts = pattern.split('/');

    const scanDir = (dir: string, remainingParts: string[]): void => {
      if (remainingParts.length === 0) return;
      if (results.length >= 100) return; // Limit results

      try {
        const fullDir = join(this.projectRoot, dir);
        if (!existsSync(fullDir)) return;

        const entries = readdirSync(fullDir, { withFileTypes: true });
        const currentPart = remainingParts[0];
        const isLastPart = remainingParts.length === 1;

        for (const entry of entries) {
          // Skip common non-code directories
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === 'coverage' ||
            entry.name === '.next' ||
            entry.name === '.cache'
          ) {
            continue;
          }

          const entryPath = dir ? `${dir}/${entry.name}` : entry.name;

          if (currentPart === '**') {
            // Recursive glob
            if (entry.isDirectory()) {
              scanDir(entryPath, remainingParts); // Continue with **
              scanDir(entryPath, remainingParts.slice(1)); // Try next part
            } else if (entry.isFile() && remainingParts.length > 1) {
              // Check if file matches next pattern part
              const nextPart = remainingParts[1];
              if (this.matchesPattern(entry.name, nextPart)) {
                results.push(entryPath);
              }
            }
          } else if (this.matchesPattern(entry.name, currentPart)) {
            if (isLastPart && entry.isFile()) {
              results.push(entryPath);
            } else if (!isLastPart && entry.isDirectory()) {
              scanDir(entryPath, remainingParts.slice(1));
            }
          }
        }
      } catch {
        // Skip unreadable directories
      }
    };

    scanDir('', parts);
    return results;
  }

  /**
   * Match filename against a simple pattern
   */
  private matchesPattern(name: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === '**') return true;

    // Handle *.ext patterns
    if (pattern.startsWith('*.')) {
      return name.endsWith(pattern.slice(1));
    }

    // Handle prefix* patterns
    if (pattern.endsWith('*')) {
      return name.startsWith(pattern.slice(0, -1));
    }

    // Handle *suffix patterns
    if (pattern.startsWith('*')) {
      return name.endsWith(pattern.slice(1));
    }

    // Exact match
    return name === pattern;
  }

  /**
   * Build full prompt with context
   */
  private buildPrompt(template: string, context: string): string {
    if (!context) {
      return `${template}

## Instructions

Analyze the codebase and provide your response following the format specified in the task.`;
    }

    return `${template}

## Codebase Context

${context}

## Instructions

Analyze the above codebase context and provide your response following the format specified in the task.`;
  }

  /**
   * Execute Claude Code in headless mode
   */
  private executeClaudeCode(
    prompt: string,
    options: {
      sandbox: SandboxMode;
      model: ModelType;
      timeoutMs: number;
      executionId: string;
      workerType: HeadlessWorkerType;
    }
  ): Promise<{ success: boolean; output: string; tokensUsed?: number; error?: string }> {
    return new Promise((resolve) => {
      const env: Record<string, string> = {
        ...(process.env as Record<string, string>),
        CLAUDE_CODE_HEADLESS: 'true',
        CLAUDE_CODE_SANDBOX_MODE: options.sandbox,
        // Fix #1395 Bug 2: Workers fail inside active Claude Code session.
        // Claude Code detects nested sessions and exits immediately.
        // Setting CLAUDE_ENTRYPOINT=worker bypasses the nested-session check,
        // and unsetting CLAUDE_SESSION_ID prevents parent session detection.
        CLAUDE_ENTRYPOINT: 'worker',
      };
      // Remove parent session markers so the child doesn't detect a "nested" session
      delete env.CLAUDE_SESSION_ID;
      delete env.CLAUDE_PARENT_SESSION_ID;

      // Set model
      // Resolve model: user env override > config override > default alias
      env.ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || MODEL_IDS[options.model];

      // Spawn claude CLI process. #1852: previously the prompt was passed
      // as a positional CLI arg. On Windows `claude` resolves to
      // `claude.cmd`, which Node refuses to exec directly (CVE-2024-27980
      // mitigation) — it routes through `cmd.exe /d /s /c`, which then
      // re-tokenizes the entire command line including the prompt.
      // Source-code prompts contain `>` `<` `&` `|` (arrow functions,
      // comparisons, redirections) — cmd.exe parses those as redirects
      // and creates zero-byte files in cwd named after the next token
      // (`controller.abort()`, `{const`, `0`, `HTTP`, etc.).
      //
      // Fix: pipe the prompt via stdin instead. `child.stdin.end(prompt)`
      // writes the prompt and closes stdin atomically — the EOF still
      // unblocks `claude --print` (the original concern in #1395) but no
      // shell tokenization touches the prompt.
      // #2098B / #2093 — `claude --print` can spawn grandchildren (MCP
      // server stdio bridges, plugin tools). When the head times out a
      // plain `child.kill()` only signals the head; grandchildren get
      // reparented to init and survive — the symptom @maxstefanakis1114
      // diagnosed as a 5-second redispatch + subprocess-table growth.
      // `detached: true` puts the child in its own process group so we
      // can signal the whole tree with `process.kill(-pid, sig)`.
      const child = spawn('claude', ['--print'], {
        cwd: this.projectRoot,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true, // Prevent phantom console windows on Windows
        detached: process.platform !== 'win32',
      });
      try {
        child.stdin?.end(prompt);
      } catch {
        // stdin already closed (e.g. spawn failed) — `error` handler below
        // will surface the real cause.
      }

      // Kill the whole process group on POSIX, fall back to the child on
      // Windows (where setsid-style detach isn't available the same way).
      const killTree = (signal: NodeJS.Signals) => {
        if (process.platform !== 'win32' && typeof child.pid === 'number') {
          try { process.kill(-child.pid, signal); return; } catch { /* fall through */ }
        }
        try { child.kill(signal); } catch { /* already dead */ }
      };

      // Setup timeout
      const timeoutHandle = setTimeout(() => {
        if (this.processPool.has(options.executionId)) {
          killTree('SIGTERM');
          // Give it a moment to terminate gracefully
          setTimeout(() => {
            if (!child.killed) {
              killTree('SIGKILL');
            }
          }, 5000);
        }
      }, options.timeoutMs);

      // Track in process pool
      const poolEntry: PoolEntry = {
        process: child,
        executionId: options.executionId,
        workerType: options.workerType,
        startTime: new Date(),
        timeout: timeoutHandle,
      };
      this.processPool.set(options.executionId, poolEntry);

      let stdout = '';
      let stderr = '';
      let resolved = false;

      const cleanup = () => {
        clearTimeout(timeoutHandle);
        this.processPool.delete(options.executionId);
      };

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        this.emit('output', {
          executionId: options.executionId,
          type: 'stdout',
          data: chunk,
        });
      });

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        this.emit('output', {
          executionId: options.executionId,
          type: 'stderr',
          data: chunk,
        });
      });

      child.on('close', (code: number | null) => {
        if (resolved) return;
        resolved = true;
        cleanup();

        resolve({
          success: code === 0,
          output: stdout || stderr,
          error: code !== 0 ? stderr || `Process exited with code ${code}` : undefined,
        });
      });

      child.on('error', (error: Error) => {
        if (resolved) return;
        resolved = true;
        cleanup();

        resolve({
          success: false,
          output: '',
          error: error.message,
        });
      });

      // Handle timeout
      setTimeout(() => {
        if (resolved) return;
        if (!this.processPool.has(options.executionId)) return;

        resolved = true;
        killTree('SIGTERM');
        cleanup();

        resolve({
          success: false,
          output: stdout || stderr,
          error: `Execution timed out after ${options.timeoutMs}ms`,
        });
      }, options.timeoutMs + 100); // Slightly after the kill timeout
    });
  }

  /**
   * Parse JSON output from Claude Code
   */
  private parseJsonOutput(output: string): unknown {
    try {
      // Try to find JSON in code blocks first
      const codeBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1].trim());
      }

      // Try to find any JSON object
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Try direct parse
      return JSON.parse(output.trim());
    } catch {
      return {
        parseError: true,
        rawOutput: output,
      };
    }
  }

  /**
   * Parse markdown output into sections
   */
  private parseMarkdownOutput(output: string): {
    sections: Array<{ title: string; content: string; level: number }>;
    codeBlocks: Array<{ language: string; code: string }>;
  } {
    const sections: Array<{ title: string; content: string; level: number }> = [];
    const codeBlocks: Array<{ language: string; code: string }> = [];

    // Extract code blocks first
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let codeMatch;
    while ((codeMatch = codeBlockRegex.exec(output)) !== null) {
      codeBlocks.push({
        language: codeMatch[1] || 'text',
        code: codeMatch[2].trim(),
      });
    }

    // Parse sections
    const lines = output.split('\n');
    let currentSection: { title: string; content: string; level: number } | null = null;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: headerMatch[2].trim(),
          content: '',
          level: headerMatch[1].length,
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      currentSection.content = currentSection.content.trim();
      sections.push(currentSection);
    }

    return { sections, codeBlocks };
  }

  /**
   * Create an error result
   */
  private createErrorResult(
    workerType: HeadlessWorkerType,
    error: string
  ): HeadlessExecutionResult {
    return {
      success: false,
      output: '',
      durationMs: 0,
      model: 'unknown',
      sandboxMode: 'strict',
      workerType,
      timestamp: new Date(),
      executionId: `error_${Date.now()}`,
      error,
    };
  }

  /**
   * Log execution details for debugging
   */
  private logExecution(
    executionId: string,
    type: 'prompt' | 'result' | 'error',
    content: string
  ): void {
    try {
      const timestamp = new Date().toISOString();
      const logFile = join(this.config.logDir, `${executionId}_${type}.log`);
      const logContent = `[${timestamp}] ${type.toUpperCase()}\n${'='.repeat(60)}\n${content}\n`;
      writeFileSync(logFile, logContent);
    } catch {
      // Ignore log write errors
    }
  }
}

// Export default
export default HeadlessWorkerExecutor;
