/**
 * Enhanced Model Router — intent types, pattern tables & helpers
 *
 * Extracted verbatim from enhanced-model-router.ts (lines 18-257)
 * during campaign-2 wave 80 (W286). The 3 public shapes are re-exported
 * by the barrel; the pattern tables and codemodLanguageFor stay
 * unexported from it.
 */

import { extname } from 'path';
import type { CodemodLanguage } from './codemods/engine.js';
import type { ClaudeModel } from './model-router.js';

export function codemodLanguageFor(filePath: string, fallback?: string): CodemodLanguage {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.tsx') return 'tsx';
  if (ext === '.jsx') return 'jsx';
  if (ext === '.ts' || ext === '.mts' || ext === '.cts') return 'typescript';
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'javascript';
  return fallback === 'typescript' ? 'typescript' : 'javascript';
}

// ============================================================================
// Types
// ============================================================================

/**
 * Code editing intent types that Agent Booster can handle
 */
export type EditIntentType =
  | 'var-to-const'
  | 'add-types'
  | 'add-error-handling'
  | 'async-await'
  | 'add-logging'
  | 'remove-console';

/**
 * Detected edit intent from task analysis
 */
export interface EditIntent {
  type: EditIntentType;
  confidence: number;
  filePath?: string;
  language?: string;
  description: string;
}

/**
 * Enhanced routing result with Agent Booster support
 */
export interface EnhancedRouteResult {
  tier: 1 | 2 | 3;
  handler: 'codemod' | 'agent-booster' | 'haiku' | 'sonnet' | 'opus';
  model?: ClaudeModel;
  confidence: number;
  complexity?: number;
  reasoning: string;
  /** The detected edit intent (Tier 1 only). */
  codemodIntent?: EditIntent;
  /**
   * Back-compat alias for {@link codemodIntent}. Older callers read this field.
   * @deprecated use {@link codemodIntent}
   */
  agentBoosterIntent?: EditIntent;
  /** true when a deterministic, $0 codemod can fully apply this edit (no LLM). */
  deterministic?: boolean;
  canSkipLLM?: boolean;
  estimatedLatencyMs: number;
  estimatedCost: number;
}

/**
 * Enhanced model router configuration
 */
export interface EnhancedModelRouterConfig {
  agentBoosterEnabled: boolean;
  agentBoosterConfidenceThreshold: number;
  enabledIntents: EditIntentType[];
  complexityThresholds: {
    haiku: number;
    sonnet: number;
    opus: number;
  };
  preferCost: boolean;
  preferQuality: boolean;
}

// ============================================================================
// Intent Detection Patterns
// ============================================================================

/**
 * Pattern definitions for Agent Booster intent detection
 */
export const INTENT_PATTERNS: Record<EditIntentType, {
  patterns: RegExp[];
  weight: number;
  description: string;
}> = {
  'var-to-const': {
    patterns: [
      /convert\s+var\s+to\s+const/i,
      /change\s+var\s+to\s+const/i,
      /change\s+var\s+declarations?\s+to\s+const/i,
      /replace\s+var\s+with\s+const/i,
      /var\s*(?:→|->|to)\s*const/i,
      /use\s+const\s+instead\s+of\s+var/i,
    ],
    weight: 1.0,
    description: 'Convert var declarations to const/let',
  },
  'add-types': {
    patterns: [
      /add\s+type\s+annotations?/i,
      /add\s+typescript\s+types?/i,
      /type\s+this\s+function/i,
      /add\s+types?\s+to/i,
      /annotate\s+with\s+types?/i,
    ],
    weight: 0.9,
    description: 'Add TypeScript type annotations',
  },
  'add-error-handling': {
    patterns: [
      /add\s+error\s+handling/i,
      /wrap\s+in\s+try\s*[/-]?\s*catch/i,
      /add\s+try\s*[/-]?\s*catch/i,
      /handle\s+errors?/i,
      /add\s+exception\s+handling/i,
    ],
    weight: 0.7, // Lower weight - often needs more context
    description: 'Wrap code in try/catch blocks',
  },
  'async-await': {
    patterns: [
      /convert\s+to\s+async\s*[/-]?\s*await/i,
      /convert\s+\w+\s+to\s+async/i,
      /use\s+async\s*[/-]?\s*await/i,
      /change\s+promises?\s+to\s+async/i,
      /refactor\s+to\s+async/i,
      /\.then\s*(?:→|->|to)\s*await/i,
      /callback\s+to\s+async/i,
      /callbacks?\s+to\s+async/i,
    ],
    weight: 0.8,
    description: 'Convert callbacks/promises to async/await',
  },
  'add-logging': {
    patterns: [
      /add\s+logging/i,
      /add\s+console\.log/i,
      /add\s+debug\s+logs?/i,
      /log\s+this\s+function/i,
      /add\s+trace\s+logging/i,
    ],
    weight: 0.85,
    description: 'Add console.log or logging statements',
  },
  'remove-console': {
    patterns: [
      /remove\s+(?:all\s+)?console\.log/i,
      /remove\s+(?:all\s+)?console\s+statements?/i,
      /delete\s+(?:all\s+)?console\s+statements?/i,
      /strip\s+console/i,
      /clean\s+up\s+console/i,
      /clean\s+up\s+debug\s+logs?/i,
      /remove\s+(?:all\s+)?debug\s+logs?/i,
      /delete\s+(?:all\s+)?console\.log/i,
    ],
    weight: 0.95,
    description: 'Remove console.* calls',
  },
};

/**
 * File path extraction patterns
 */
export const FILE_PATH_PATTERNS: RegExp[] = [
  /(?:in|from|to|file|path)\s+[`"']?([a-zA-Z0-9_./\\-]+\.[a-zA-Z]+)[`"']?/i,
  /[`"']([a-zA-Z0-9_./\\-]+\.[a-zA-Z]+)[`"']/,
  /(\S+\.[tj]sx?)\b/i,
  /(\S+\.(?:js|ts|jsx|tsx|py|rb|go|rs|java|kt|swift|c|cpp|h))\b/i,
];

/**
 * Language detection by extension
 */
/**
 * High-complexity keywords that indicate Tier 3 (Opus) routing
 * These tasks require deep reasoning and architectural understanding
 */
export const TIER3_KEYWORDS: RegExp[] = [
  // Architecture & Design
  /\b(microservices?|architecture|system\s+design|distributed)\b/i,
  /\b(design|architect|plan)\s+(a|an|the|complex)\b/i,
  /\b(design)\s+\w+\s+(schema|system|architecture)\b/i,

  // Security
  /\b(oauth2?|pkce|jwt|rbac|authentication\s+system|security\s+audit)\b/i,
  /\b(refresh\s+token|token\s+rotation|role-based|permission|authorization)\b/i,
  /\b(encryption|cryptograph|certificate|ssl|tls)\b/i,
  /\b(end-to-end\s+encryption|key\s+rotation|secure\s+channel)\b/i,

  // Distributed Systems
  /\b(consensus|distributed|byzantine|raft|paxos)\b/i,
  /\b(replication|sharding|partitioning|eventual\s+consistency)\b/i,
  /\b(load\s+balanc|fault[- ]toleran|high\s+availability)\b/i,
  /\b(message\s+queue|event\s+sourc|cqrs|saga)\b/i,

  // Complex Algorithms
  /\b(algorithm|machine\s+learning|neural|optimization)\b/i,
  /\b(graph\s+algorithm|tree\s+traversal|dynamic\s+programming)\b/i,

  // Database Design
  /\b(schema\s+design|database\s+architect|data\s+model)\b/i,
  /\b(database\s+schema|multi[- ]tenant)\b/i,
  /\b(normalization|denormalization|index\s+strateg)\b/i,

  // Performance Critical
  /\b(performance\s+critical|low\s+latency|high\s+throughput)\b/i,
  /\b(memory\s+optimi|cache\s+strateg|concurrent)\b/i,
];

export const LANGUAGE_MAP: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
};

// ============================================================================
// Enhanced Model Router Implementation
// ============================================================================

/**
 * Enhanced Model Router with Agent Booster AST integration
 *
 * Provides intelligent 3-tier routing:
 * - Tier 1: Agent Booster for simple code transforms (352x faster, $0)
 * - Tier 2: Haiku for low complexity tasks
 * - Tier 3: Sonnet/Opus for complex reasoning tasks
 */
