/**
 * GAIA Agent — constants, prompts & Anthropic plumbing
 *
 * The API constants, planning checkpoint, prompt builders, image-marker
 * parser, and the tool-call/response plumbing. Extracted verbatim from
 * gaia-agent.ts (lines 73-500) during campaign-2 wave 19 (W225).
 * gaia-agent.ts re-exports only the originally-public names.
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  GaiaQuestion,
} from './gaia-loader.js';
import {
  GaiaToolCatalogue,
  ToolDefinition,
  ToolUseBlock,
  TextBlock,
  ContentBlock,
} from './gaia-tools/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_API_VERSION = '2023-06-01';
export const DEFAULT_MODEL = 'claude-haiku-4-5';
export const DEFAULT_MAX_TURNS = 8;
export const DEFAULT_MAX_TOKENS_PER_TURN = 2048;
export const DEFAULT_PER_TURN_TIMEOUT_MS = 60_000;

/**
 * Every PLANNING_INTERVAL tool_use turns, inject a planning-checkpoint
 * message to force the agent to reassess its strategy.
 *
 * Based on iter 30 research: smolagents CodeAgent uses planning_interval=4.
 * HAL reliability analysis showed agents fail when they exhaust step
 * budgets without recalibrating.
 */
export const PLANNING_INTERVAL = 4;

/**
 * Build the planning-checkpoint text injected every PLANNING_INTERVAL turns.
 * Exported so tests can snapshot the exact wording.
 */
export function buildPlanningCheckpoint(turn: number, maxTurns: number): string {
  return (
    `[PLANNING CHECKPOINT — turn ${turn}/${maxTurns}]\n` +
    `You have used ${turn} turns so far. Before continuing:\n` +
    `1. Briefly summarize what you have learned from the tool calls so far.\n` +
    `2. State explicitly whether your current approach is making progress toward the answer.\n` +
    `3. If NOT making progress, switch strategy: try a different tool, different query, ` +
    `or decompose the question differently.\n` +
    `4. If you are confident in an answer, provide it now in your standard format: ` +
    `FINAL_ANSWER: <your answer>`
  );
}

/** Pattern Claude must output to signal it has a final answer. */
export const FINAL_ANSWER_RE = /FINAL_ANSWER:\s*(.+)/i;

// Haiku pricing (input/output per million tokens, as of 2026-05-27).
// Used only for smoke cost estimation — not billed here.
export const HAIKU_INPUT_COST_PER_M = 0.25;
export const HAIKU_OUTPUT_COST_PER_M = 1.25;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GaiaAgentResult {
  questionId: string;
  finalAnswer: string | null;
  turns: number;
  toolCallsByName: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
  wallMs: number;
  /** Number of planning-checkpoint injections during this run (0 when planning is disabled). */
  replanCount?: number;
  timedOut?: boolean;
  /** Set when the convergence layer fired and committed the final answer. */
  convergenceTrigger?: string;
  /** True when the convergence layer recovered the answer from prior message history. */
  convergenceUsedFallback?: boolean;
  error?: string;
}

export interface GaiaAgentOptions {
  /** Model to use (default: 'claude-haiku-4-5'). */
  model?: string;
  /** Maximum number of agent turns before giving up (default: 8). */
  maxTurns?: number;
  /** Maximum tokens per Anthropic API call (default: 2048). */
  maxTokensPerTurn?: number;
  /** Per-turn HTTP timeout in milliseconds (default: 60 000). */
  perTurnTimeoutMs?: number;
  /**
   * Inject a planning-checkpoint every N tool_use turns (default: PLANNING_INTERVAL = 4).
   * Set to 0 to disable planning checkpoints.
   */
  planningInterval?: number;
  /**
   * Anthropic API key.  Resolved automatically via env var + gcloud fallback
   * if omitted.
   */
  apiKey?: string;
  /**
   * Pre-built tool catalogue.  Defaults to `createDefaultToolCatalogue()`.
   * Exposed so callers can inject mocks for testing.
   */
  catalogue?: GaiaToolCatalogue;
  /**
   * Enable the convergence layer (default: true).
   *
   * When enabled, the convergence layer monitors for three failure modes:
   *   1. max_turns hit without FINAL_ANSWER
   *   2. Loop (same tool+args 3× in a 5-turn window)
   *   3. Token overflow (>120k input tokens)
   *
   * On detection, a forced-commit phase is run: one API call with a
   * directive prompt, no tools, then a fallback scan of prior messages.
   * Set to false to disable (e.g. for ablation testing).
   */
  enableConvergence?: boolean;
}

// ---------------------------------------------------------------------------
// API key resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the Anthropic API key.
 *
 * Resolution order:
 *   1. Caller-supplied `apiKey`
 *   2. `ANTHROPIC_API_KEY` env var
 *   3. `gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY`
 *
 * Throws with a clear message if none of the above is available.
 */
export function resolveAnthropicApiKey(apiKey?: string): string {
  if (apiKey && apiKey.trim()) return apiKey.trim();

  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();

  try {
    const out = execSync(
      'gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY 2>/dev/null',
      { encoding: 'utf-8', timeout: 10_000 },
    ).trim();
    if (out) return out;
  } catch {
    /* fall through */
  }

  throw new Error(
    'ANTHROPIC_API_KEY not found.  Set the env var or store it in GCP Secret Manager under ' +
    '"ANTHROPIC_API_KEY" (e.g. `echo -n "$KEY" | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=-`).',
  );
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export function buildSystemPrompt(): string {
  return [
    'You are a precise question-answering agent.  Your task is to answer the user\'s question',
    'using the tools available to you.',
    '',
    'RULES:',
    '1. Use tools when you need information you do not have with certainty.',
    '2. When you reach a final answer, output it on its own line in this EXACT format:',
    '   FINAL_ANSWER: <your answer here>',
    '3. Keep answers concise.  For numbers, give just the number.  For names, give just the name.',
    '4. Do not include units unless the question specifically asks for them.',
    '5. MANDATORY: You MUST ALWAYS end your final response with a FINAL_ANSWER line.',
    '   NEVER end your reasoning without committing to a specific answer.',
    '6. IMPORTANT: If the question text appears garbled, reversed, or encoded, try to interpret it',
    '   (e.g. reverse it, decode it) before concluding you cannot answer.',
  ].join('\n');
}

/**
 * Detect whether a string looks like reversed English text.
 *
 * Heuristic: if reversing the string makes it parse as more-English than the
 * original (measured by the ratio of common English words present), flag it.
 */
export const ENGLISH_MARKERS = [
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was',
  'her', 'his', 'they', 'this', 'with', 'have', 'from', 'what', 'that',
  'write', 'word', 'answer', 'sentence', 'understand', 'left', 'right',
];

export function countEnglishMarkers(text: string): number {
  const lower = text.toLowerCase();
  return ENGLISH_MARKERS.filter((w) => lower.includes(w)).length;
}

/**
 * If the question text appears to be reversed English, prepend a de-reversed
 * version so the agent sees both the original and the decoded form.
 *
 * Iter 52 T2 — gate 1 finding: task 2d83110e has a reversed sentence.
 * Kept in iter 53a (this is not the source of the iter 52 regressions).
 */
export function buildUserMessage(question: string): string {
  const reversed = question.split('').reverse().join('');
  const origScore = countEnglishMarkers(question);
  const revScore = countEnglishMarkers(reversed);

  if (revScore >= origScore + 3 && revScore >= 4) {
    return (
      `[NOTE: The following question text appears to be written in reverse. ` +
      `Decoded: "${reversed}"]\n\n${question}`
    );
  }

  return question;
}

/** Anthropic image content block for vision API. */
export interface ImageContentBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * Parse an IMAGE_BASE64 marker returned by file_read's extractImage().
 * Returns an Anthropic image content block, or null if the marker is invalid.
 *
 * Marker format: [IMAGE_BASE64:{"mediaType":"image/png","base64":"...","path":"..."}]
 */
export function parseImageMarker(marker: string): ImageContentBlock | null {
  const match = /^\[IMAGE_BASE64:(\{.*\})\]$/.exec(marker.trim());
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { mediaType: string; base64: string };
    if (!parsed.mediaType || !parsed.base64) return null;
    return {
      type: 'image',
      source: { type: 'base64', media_type: parsed.mediaType, data: parsed.base64 },
    };
  } catch {
    return null;
  }
}

/**
 * Build the initial user-turn content for a GAIA question.
 *
 * - Image attachment: returns content array with text block + inline base64 image block
 *   so Claude can see the image on turn 0 without a file_read call.
 * - Non-image attachment: appends a path hint to the question text so Claude knows
 *   to call file_read.
 * - No attachment: returns the question as plain text.
 */
export function buildInitialContent(question: GaiaQuestion): ContentBlock[] | string {
  const questionText = buildUserMessage(question.question);

  if (!question.file_path) return questionText;

  const ext = path.extname(question.file_path).toLowerCase();
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

  if (imageExts.includes(ext)) {
    let buf: Buffer;
    try {
      buf = fs.readFileSync(question.file_path);
    } catch {
      return questionText + `\n\nNote: Attached image at path: ${question.file_path}\nCall file_read to get the IMAGE_BASE64 marker.`;
    }
    const mediaTypeMap: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp',
    };
    return [
      { type: 'text', text: questionText } as ContentBlock,
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaTypeMap[ext] ?? 'image/png', data: buf.toString('base64') },
      } as unknown as ContentBlock,
    ];
  }

  return questionText + `\n\nThis question has an attached file. Call file_read with path="${question.file_path}" to read it, then answer the question.`;
}

// ---------------------------------------------------------------------------
// Anthropic Messages API call (single turn)
// ---------------------------------------------------------------------------

/** Minimal types for the Anthropic Messages API response. */
export interface AnthropicResponse {
  id: string;
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | string;
  content: ContentBlock[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface MessageParam {
  role: 'user' | 'assistant';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: ContentBlock[] | string | any[];
}

export async function callAnthropicWithTools(
  apiKey: string,
  model: string,
  messages: MessageParam[],
  toolDefs: ToolDefinition[],
  maxTokens: number,
  timeoutMs: number,
): Promise<AnthropicResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: buildSystemPrompt(),
        messages,
        tools: toolDefs,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '<unreadable>');
    throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 400)}`);
  }

  return (await res.json()) as AnthropicResponse;
}

// ---------------------------------------------------------------------------
// Extract final answer from a response
// ---------------------------------------------------------------------------

export function extractFinalAnswer(resp: AnthropicResponse): string | null {
  for (const block of resp.content) {
    if (block.type === 'text') {
      const textBlock = block as TextBlock;
      const match = FINAL_ANSWER_RE.exec(textBlock.text);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Execute all tool_use blocks in a response
// ---------------------------------------------------------------------------

export interface ToolResultMessageContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | unknown[];
  is_error?: boolean;
}

/**
 * If a tool output string is entirely an IMAGE_BASE64 marker, convert it to
 * a mixed content array [text_hint, image_block] for the Anthropic vision API.
 * Otherwise return the string unchanged.
 */
export function wrapToolOutput(output: string): string | unknown[] {
  const imageBlock = parseImageMarker(output);
  if (imageBlock) {
    return [
      { type: 'text', text: 'Image file contents:' },
      imageBlock,
    ];
  }
  return output;
}

export async function executeToolCalls(
  resp: AnthropicResponse,
  catalogue: GaiaToolCatalogue,
): Promise<ToolResultMessageContent[]> {
  const toolUseBlocks = resp.content.filter(
    (b): b is ToolUseBlock => b.type === 'tool_use',
  );

  const results = await Promise.all(
    toolUseBlocks.map(async (block): Promise<ToolResultMessageContent> => {
      const tool = catalogue.find((t) => t.name === block.name);
      if (!tool) {
        return {
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Unknown tool: "${block.name}". Available tools: ${catalogue.map((t) => t.name).join(', ')}.`,
          is_error: true,
        };
      }
      try {
        const output = await tool.execute(block.input);
        return {
          type: 'tool_result',
          tool_use_id: block.id,
          content: wrapToolOutput(output),
        };
      } catch (err) {
        return {
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
          is_error: true,
        };
      }
    }),
  );

  return results;
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------

/**
 * Run a GAIA question through Claude with tool use.
 *
 * @returns GaiaAgentResult with the final answer (or null if timed out),
 * turn count, token totals, and per-tool call counts.
 */
