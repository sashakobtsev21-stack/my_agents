/**
 * Claude Flow V3 - Intelligent Guidance System
 *
 * Provides actionable context to Claude for optimal development decisions.
 * Based on Claude Code hooks research - outputs context Claude will follow.
 *
 * Key mechanisms:
 * - Exit 0 + stdout = Context added to Claude's view
 * - Exit 2 + stderr = Block with explanation
 * - JSON additionalContext = Discrete guidance Claude follows
 *
 * @module @claude-flow/hooks
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { execFileSync } from 'child_process';

// =============================================================================
// Types
// =============================================================================

export interface HookInput {
  session_id: string;
  transcript_path?: string;
  cwd: string;
  permission_mode: 'default' | 'plan' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions';
  hook_event_name: HookEventName;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  prompt?: string;
  stop_hook_active?: boolean;
}

export type HookEventName =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop'
  | 'SubagentStop';

export interface HookOutput {
  decision?: 'approve' | 'block' | 'allow' | 'deny';
  reason?: string;
  continue?: boolean;
  stopReason?: string;
  systemMessage?: string;
  suppressOutput?: boolean;
  hookSpecificOutput?: {
    hookEventName: HookEventName;
    additionalContext?: string;
    permissionDecision?: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
    updatedInput?: Record<string, unknown>;
  };
}

export interface GuidanceContext {
  projectState: ProjectState;
  recentPatterns: Pattern[];
  securityAlerts: SecurityAlert[];
  performanceHints: PerformanceHint[];
}

export interface ProjectState {
  v3Progress: number;
  activeDomain: string;
  recentFiles: string[];
  uncommittedChanges: number;
  testStatus: 'passing' | 'failing' | 'unknown';
}

export interface Pattern {
  id: string;
  strategy: string;
  domain: string;
  quality: number;
  usageCount: number;
}

export interface SecurityAlert {
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  file?: string;
}

export interface PerformanceHint {
  type: 'optimization' | 'warning' | 'suggestion';
  message: string;
  target?: string;
}

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  projectRoot: process.cwd(),
  guidanceDir: '.claude-flow/guidance',
  patternsDb: '.claude-flow/learning/patterns.db',
  metricsDir: '.claude-flow/metrics',

  // V3 Architecture guidance
  domains: [
    'task-management',
    'session-management',
    'health-monitoring',
    'lifecycle-management',
    'event-coordination',
  ],

  // Security patterns
  securityPatterns: {
    blocked: ['.env', '.pem', '.key', 'credentials', 'secret'],
    warned: ['prod', 'production', 'live', 'deploy'],
  },

  // Performance targets
  performanceTargets: {
    searchTimeMs: 1,
    operationTimeMs: 100,
    fileMaxLines: 500,
    memoryReduction: 0.5,
  },

  // Agent routing
  agentMapping: {
    security: ['security-architect', 'security-auditor'],
    testing: ['test-architect', 'tester'],
    performance: ['performance-engineer', 'perf-analyzer'],
    architecture: ['core-architect', 'architecture'],
    swarm: ['swarm-specialist', 'hierarchical-coordinator'],
    memory: ['memory-specialist', 'memory-coordinator'],
    code: ['coder', 'backend-dev'],
    review: ['reviewer', 'code-analyzer'],
  },
};

// =============================================================================
// Guidance Generators
// =============================================================================

/**
 * Generate session start context - loaded at beginning of every session
 */
export function generateSessionContext(): string {
  const lines: string[] = [
    '## V3 Development Context',
    '',
    '**Architecture**: Domain-Driven Design with 15 @claude-flow modules',
    '**Priority**: Security-first (CVE-1, CVE-2, CVE-3 remediation)',
    '',
    '**Performance Targets**:',
    '- HNSW search: 150x-12,500x faster (<1ms)',
    '- Flash Attention: 2.49x-7.47x speedup',
    '- Memory: 50-75% reduction',
    '',
    '**Active Patterns**:',
    '- Use TDD London School (mock-first)',
    '- Event sourcing for state changes',
    '- agentic-flow@alpha as core foundation',
    '- Bounded contexts with clear interfaces',
    '',
    '**Code Quality Rules**:',
    '- Files under 500 lines',
    '- No hardcoded secrets',
    '- Input validation at boundaries',
    '- Typed interfaces for all public APIs',
  ];

  // Add git status (using execFileSync to avoid shell injection)
  try {
    const gitOutput = execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const uncommitted = gitOutput.split('\n').filter(line => line.trim()).length;
    lines.push('', `**Git Status**: ${uncommitted} uncommitted files`);
  } catch {
    // Ignore git errors
  }

  // Add patterns count (using execFileSync to avoid shell injection)
  const patternsPath = join(CONFIG.projectRoot, CONFIG.patternsDb);
  if (existsSync(patternsPath)) {
    try {
      const count = execFileSync('sqlite3', [patternsPath, 'SELECT COUNT(*) FROM short_term_patterns'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      lines.push(`**Learned Patterns**: ${count} available`);
    } catch {
      // Ignore db errors
    }
  }

  return lines.join('\n');
}

/**
 * Generate context based on user prompt analysis
 */
export function generatePromptContext(prompt: string): string {
  const guidance: string[] = [];
  const lowerPrompt = prompt.toLowerCase();

  // Security-related prompts
  if (/auth|security|password|token|secret|cve|vuln/i.test(lowerPrompt)) {
    guidance.push(
      '**Security Guidance**:',
      '- Validate all inputs at system boundaries',
      '- Use parameterized queries (no string concatenation)',
      '- Store secrets in environment variables only',
      '- Apply principle of least privilege',
      '- Check OWASP Top 10 patterns',
      ''
    );
  }

  // Performance-related prompts
  if (/optim|perf|fast|slow|memory|cache|speed/i.test(lowerPrompt)) {
    guidance.push(
      '**Performance Guidance**:',
      '- Use HNSW for vector search (not brute-force)',
      '- Batch database operations',
      '- Implement caching at appropriate layers',
      '- Profile before optimizing',
      `- Target: <${CONFIG.performanceTargets.searchTimeMs}ms searches, <${CONFIG.performanceTargets.operationTimeMs}ms operations`,
      ''
    );
  }

  // Testing-related prompts
  if (/test|spec|mock|assert|coverage/i.test(lowerPrompt)) {
    guidance.push(
      '**Testing Guidance (TDD London School)**:',
      '- Write test first, then implementation',
      '- Mock external dependencies',
      '- Test behavior, not implementation',
      '- One assertion per test concept',
      '- Use descriptive test names',
      ''
    );
  }

  // Architecture-related prompts
  if (/architect|design|struct|refactor|module|domain/i.test(lowerPrompt)) {
    guidance.push(
      '**Architecture Guidance (DDD)**:',
      '- Respect bounded context boundaries',
      '- Use domain events for cross-module communication',
      '- Keep domain logic in domain layer',
      '- Infrastructure adapters for external services',
      '- Follow ADR decisions (ADR-001 through ADR-010)',
      ''
    );
  }

  // Error/bug fixing prompts
  if (/fix|bug|error|issue|broken|fail/i.test(lowerPrompt)) {
    guidance.push(
      '**Debugging Guidance**:',
      '- Reproduce the issue first',
      '- Check recent changes in git log',
      '- Add logging before fixing',
      '- Write regression test',
      '- Verify fix doesn\'t break other tests',
      ''
    );
  }

  // Implementation prompts
  if (/implement|create|add|build|develop/i.test(lowerPrompt)) {
    guidance.push(
      '**Implementation Guidance**:',
      '- Check for existing similar implementations',
      '- Follow established patterns in codebase',
      '- Write tests alongside implementation',
      '- Keep functions focused and small',
      '- Document public interfaces',
      ''
    );
  }

  return guidance.join('\n');
}

/**
 * Generate pre-edit guidance for file modifications
 */
export function generatePreEditGuidance(
  filePath: string,
  toolName: string = 'Edit'
): HookOutput {
  const fileName = basename(filePath);
  const ext = extname(filePath);

  // Security checks - block sensitive files
  for (const pattern of CONFIG.securityPatterns.blocked) {
    if (filePath.toLowerCase().includes(pattern)) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Security: Cannot edit ${pattern} files directly. Use environment variables instead.`,
        },
      };
    }
  }

  // Warn about production files
  for (const pattern of CONFIG.securityPatterns.warned) {
    if (filePath.toLowerCase().includes(pattern)) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `This appears to be a ${pattern} file. Confirm this edit is intentional.`,
        },
      };
    }
  }

  // Generate file-specific guidance
  let guidance = '';

  if (/test|spec/i.test(fileName)) {
    guidance = 'Testing file: Use TDD London School patterns. Mock dependencies, test behavior not implementation.';
  } else if (/security|auth/i.test(filePath)) {
    guidance = 'Security module: Validate inputs, use parameterized queries, no hardcoded secrets.';
  } else if (/memory|cache/i.test(filePath)) {
    guidance = 'Memory module: Consider HNSW indexing, batch operations, proper cleanup.';
  } else if (/swarm|coordinator/i.test(filePath)) {
    guidance = 'Swarm module: Use event-driven communication, handle failures gracefully, respect bounded contexts.';
  } else if (ext === '.ts' || ext === '.tsx') {
    guidance = 'TypeScript: Use strict types, avoid any, export interfaces for public APIs.';
  } else if (ext === '.js' || ext === '.mjs') {
    guidance = 'JavaScript: Consider migrating to TypeScript for better type safety.';
  }

  if (guidance) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        additionalContext: guidance,
      },
    };
  }

  return { decision: 'allow' };
}

/**
 * Generate post-edit feedback for course correction
 */
export function generatePostEditFeedback(
  filePath: string,
  success: boolean = true
): HookOutput {
  if (!success) {
    return {
      decision: 'block',
      reason: 'Edit failed. Check file path and permissions.',
    };
  }

  if (!existsSync(filePath)) {
    return { decision: 'allow' };
  }

  const issues: string[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const ext = extname(filePath);
  const isTest = /test|spec/i.test(filePath);

  // Check for console.log in non-test files
  if (!isTest && content.includes('console.log')) {
    issues.push('Remove console.log statements (use proper logging)');
  }

  // Check for TODO/FIXME
  if (/TODO|FIXME|HACK/i.test(content)) {
    issues.push('Address TODO/FIXME comments before committing');
  }

  // Check for any type in TypeScript
  if ((ext === '.ts' || ext === '.tsx') && /:\s*any\b/.test(content)) {
    issues.push("Replace 'any' types with specific types");
  }

  // Check file size
  if (lines.length > CONFIG.performanceTargets.fileMaxLines) {
    issues.push(
      `File exceeds ${CONFIG.performanceTargets.fileMaxLines} lines (${lines.length}). Consider splitting.`
    );
  }

  // Check for hardcoded secrets patterns
  if (/password\s*=\s*['"][^'"]+['"]|api[_-]?key\s*=\s*['"][^'"]+['"]/i.test(content)) {
    issues.push('Possible hardcoded secret detected. Use environment variables.');
  }

  if (issues.length > 0) {
    return {
      decision: 'allow',
      reason: `Edit completed. Review suggestions:\n- ${issues.join('\n- ')}`,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `Quality check found items to address:\n- ${issues.join('\n- ')}`,
      },
    };
  }

  return { decision: 'allow' };
}

/**
 * Generate pre-command risk assessment
 */
export function generatePreCommandGuidance(command: string): HookOutput {
  // Block dangerous commands
  const dangerousPatterns = [
    'rm -rf',
    'drop database',
    'truncate',
    '--force.*push',
    'reset --hard',
    'format c:',
  ];

  for (const pattern of dangerousPatterns) {
    if (new RegExp(pattern, 'i').test(command)) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Destructive command blocked: ${pattern}. Use safer alternatives.`,
        },
      };
    }
  }

  // Warn about risky commands
  const riskyPatterns = ['npm publish', 'git push', 'deploy', 'kubectl apply'];
  for (const pattern of riskyPatterns) {
    if (command.toLowerCase().includes(pattern)) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `This command has external effects (${pattern}). Confirm before proceeding.`,
        },
      };
    }
  }

  // Guide test commands
  if (/npm test|vitest|jest|pnpm test/i.test(command)) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        additionalContext:
          'Running tests. If failures occur, fix them before proceeding. Check coverage thresholds.',
      },
    };
  }

  // Guide build commands
  if (/npm run build|tsc|pnpm build/i.test(command)) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        additionalContext:
          'Building project. Watch for type errors and warnings. All must pass before commit.',
      },
    };
  }

  return { decision: 'allow' };
}

/**
 * Route task to optimal agent
 */
export function routeTask(task: string): {
  agent: string;
  confidence: number;
  alternatives: string[];
  reasoning: string;
} {
  const lowerTask = task.toLowerCase();

  // Define keyword patterns for each category
  const patterns: Record<string, RegExp> = {
    security: /security|auth|cve|vuln|encrypt|password|token/i,
    testing: /test|spec|mock|coverage|tdd|assert/i,
    performance: /perf|optim|fast|memory|cache|speed|slow/i,
    architecture: /architect|design|ddd|domain|refactor|struct/i,
    swarm: /swarm|agent|coordinate|orchestrat|parallel/i,
    memory: /memory|agentdb|hnsw|vector|embedding/i,
    code: /fix|bug|implement|create|add|build|error/i,
    review: /review|quality|lint|check|audit/i,
  };

  // Find best match
  let bestCategory = 'code';
  let bestConfidence = 70;

  for (const [category, pattern] of Object.entries(patterns)) {
    if (pattern.test(lowerTask)) {
      const matches = lowerTask.match(pattern);
      const confidence = 85 + (matches ? matches.length * 5 : 0);
      if (confidence > bestConfidence) {
        bestCategory = category;
        bestConfidence = Math.min(confidence, 98);
      }
    }
  }

  const agents = CONFIG.agentMapping[bestCategory] || ['coder'];
  const alternatives = Object.entries(CONFIG.agentMapping)
    .filter(([cat]) => cat !== bestCategory)
    .slice(0, 3)
    .map(([, agentList]) => agentList[0]);

  return {
    agent: agents[0],
    confidence: bestConfidence,
    alternatives,
    reasoning: `Task matches ${bestCategory} patterns. Use Task tool with subagent_type="${agents[0]}".`,
  };
}

/**
 * Check if work is complete before stopping
 */
export function checkStopConditions(): HookOutput {
  const issues: string[] = [];

  // Check for uncommitted changes
  try {
    const uncommitted = parseInt(
      execSync('git status --porcelain 2>/dev/null | wc -l', { encoding: 'utf-8' }).trim()
    );
    if (uncommitted > 0) {
      issues.push(`${uncommitted} uncommitted files`);
    }
  } catch {
    // Ignore git errors
  }

  // Check for test failures
  const testResultsPath = join(CONFIG.projectRoot, CONFIG.metricsDir, 'test-results.json');
  if (existsSync(testResultsPath)) {
    try {
      const results = JSON.parse(readFileSync(testResultsPath, 'utf-8'));
      if (results.failures > 0) {
        issues.push(`${results.failures} failing tests`);
      }
    } catch {
      // Ignore parse errors
    }
  }

  if (issues.length > 0) {
    return {
      decision: 'block',
      reason: `Work may be incomplete:\n- ${issues.join('\n- ')}`,
    };
  }

  return { decision: 'approve' };
}

// =============================================================================
// CLI Interface
// =============================================================================

export function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'session-context':
    case 'session':
      console.log(generateSessionContext());
      process.exit(0);
      break;

    case 'user-prompt':
    case 'prompt':
      console.log(generatePromptContext(args[1] || ''));
      process.exit(0);
      break;

    case 'pre-edit':
      console.log(JSON.stringify(generatePreEditGuidance(args[1] || '', args[2])));
      process.exit(0);
      break;

    case 'post-edit':
      console.log(JSON.stringify(generatePostEditFeedback(args[1] || '', args[2] !== 'false')));
      process.exit(0);
      break;

    case 'pre-command':
      console.log(JSON.stringify(generatePreCommandGuidance(args[1] || '')));
      process.exit(0);
      break;

    case 'route':
      const routing = routeTask(args[1] || '');
      console.log(`**Recommended Agent**: ${routing.agent}`);
      console.log(`**Confidence**: ${routing.confidence}%`);
      console.log(`**Reasoning**: ${routing.reasoning}`);
      console.log(`**Alternatives**: ${routing.alternatives.join(', ')}`);
      process.exit(0);
      break;

    case 'stop-check':
      const stopResult = checkStopConditions();
      if (stopResult.decision === 'block') {
        console.error(stopResult.reason);
        process.exit(2);
      }
      process.exit(0);
      break;

    case 'help':
    case '--help':
    case '-h':
      console.log(`
Claude Flow V3 - Intelligent Guidance System

Usage: guidance-system.ts <command> [args]

Commands:
  session-context         Output project context for SessionStart
  user-prompt <prompt>    Analyze prompt and inject relevant guidance
  pre-edit <path>         Validate and guide before file edit
  post-edit <path>        Provide feedback after file edit
  pre-command <cmd>       Risk assessment for bash commands
  route <task>            Suggest optimal agent for task
  stop-check              Verify work complete before stopping

Exit Codes:
  0 - Success (stdout added as context)
  2 - Block (stderr shown to Claude)
`);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
