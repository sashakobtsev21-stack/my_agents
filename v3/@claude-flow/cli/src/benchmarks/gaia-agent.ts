/**
 * GAIA Agent — ADR-133-PR3 / ADR-135 (planning interval)
 *
 * Multi-turn Anthropic Messages API loop that drives Claude through the
 * GAIA benchmark questions using a tool-use agent pattern.
 *
 * Loop algorithm:
 *   1. Build initial message with the question and a system prompt that
 *      instructs Claude to output `FINAL_ANSWER: <value>` when done.
 *   2. Call Anthropic Messages API with the registered tool definitions.
 *   3. On `stop_reason === 'tool_use'`: execute all tool_use blocks in
 *      parallel, append results as a `user` turn, and repeat.
 *      Every PLANNING_INTERVAL turns, inject a planning-checkpoint text
 *      alongside the tool results to force strategy re-evaluation.
 *   4. On `stop_reason === 'end_turn'`: scan content for the final answer
 *      pattern and return the result.
 *   5. On timeout (maxTurns exceeded): return `{ timedOut: true }`.
 *
 * API key resolution order (mirrors resolveHfToken from gaia-loader.ts):
 *   1. `options.apiKey` (caller-supplied)
 *   2. `ANTHROPIC_API_KEY` env var
 *   3. `gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY`
 *
 * Cost discipline: smoke runs use `claude-haiku-4-5` only.  The smoke
 * runner at the bottom of this file enforces that model.
 *
 * Planning interval (iter 30 finding #3):
 *   smolagents CodeAgent uses planning_interval=4 — replans every 4 steps
 *   to prevent tunnel-vision on bad strategies. Adds ~80 tokens per
 *   replan event (~$0.0001 each), negligible cost.
 *
 * Iter 53a T2 narrowing:
 *   Three precise changes from iter 52 T2 (which had net -1q: +6 recoveries, -7 regressions):
 *   1. extractFinalAnswer uses Stage 1 only (no Stage 2/3 prose fallback).
 *      Stage 2/3 fired too aggressively: overwriting correct Stage 1 answers and
 *      extracting wrong prose fragments. Now Stage 1 is the only extraction path.
 *   2. System prompt removes surrender instruction ("FINAL_ANSWER: unknown / I don't know").
 *      That instruction caused the agent to give up on questions it would have figured out.
 *      Replaced with: "When you reach a final answer, output FINAL_ANSWER: <value>."
 *   3. Reversed-text preprocessor is preserved (iter 52 T2 finding: 2d83110e has reversed text).
 *
 * Refs: ADR-133, ADR-135, iter 30, iter 52, iter 53a, #2156
 */

import {
  GaiaQuestion,
  SMOKE_FIXTURE,
} from './gaia-loader.js';
import {
  createDefaultToolCatalogue,
  ToolUseBlock,
  TextBlock,
  ContentBlock,
} from './gaia-tools/index.js';
import {
  checkConvergenceTriggers,
  createConvergenceState,
  forceCommit,
  recordTurn,
  argsHash as convergenceArgsHash,
} from './gaia-convergence.js';
import type { ConvergenceState } from './gaia-convergence.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


// Support pieces extracted into ./gaia-agent-support.ts during
// campaign-2 wave 19 (W225). Re-export the original public surface.
export {
  PLANNING_INTERVAL,
  buildPlanningCheckpoint,
  parseImageMarker,
  resolveAnthropicApiKey,
} from './gaia-agent-support.js';
export type { GaiaAgentOptions, GaiaAgentResult } from './gaia-agent-support.js';
import {
  AnthropicResponse,
  DEFAULT_MAX_TOKENS_PER_TURN,
  DEFAULT_MAX_TURNS,
  DEFAULT_MODEL,
  DEFAULT_PER_TURN_TIMEOUT_MS,
  HAIKU_INPUT_COST_PER_M,
  HAIKU_OUTPUT_COST_PER_M,
  MessageParam,
  PLANNING_INTERVAL,
  buildInitialContent,
  buildPlanningCheckpoint,
  buildUserMessage,
  callAnthropicWithTools,
  executeToolCalls,
  extractFinalAnswer,
  resolveAnthropicApiKey,
} from './gaia-agent-support.js';
import type { GaiaAgentOptions, GaiaAgentResult } from './gaia-agent-support.js';

export async function runGaiaAgent(
  question: GaiaQuestion,
  options: GaiaAgentOptions = {},
): Promise<GaiaAgentResult> {
  const {
    model = DEFAULT_MODEL,
    maxTurns = DEFAULT_MAX_TURNS,
    maxTokensPerTurn = DEFAULT_MAX_TOKENS_PER_TURN,
    perTurnTimeoutMs = DEFAULT_PER_TURN_TIMEOUT_MS,
    planningInterval = PLANNING_INTERVAL,
    apiKey: suppliedKey,
    catalogue: suppliedCatalogue,
    enableConvergence = true,
  } = options;

  const wallStart = Date.now();
  const apiKey = resolveAnthropicApiKey(suppliedKey);
  const catalogue = suppliedCatalogue ?? createDefaultToolCatalogue();
  const toolDefs = catalogue.map((t) => t.definition);

  const toolCallsByName: Record<string, number> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let replanCount = 0;

  // Convergence layer state — tracks turns, tokens, and tool call patterns.
  const convState: ConvergenceState = createConvergenceState();

  const messages: MessageParam[] = [
    { role: 'user', content: buildInitialContent(question) },
  ];

  let turns = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    turns = turn + 1;

    // --- Convergence check: token overflow or loop (BEFORE the API call) ---
    if (enableConvergence) {
      const earlyTrigger = checkConvergenceTriggers(convState, maxTurns);
      if (earlyTrigger === 'token_overflow' || earlyTrigger === 'loop') {
        process.stderr.write(
          `[convergence] ${earlyTrigger} detected at turn ${turns} — forcing commit\n`,
        );
        const commitResult = await forceCommit(
          messages as Array<{ role: string; content: string | unknown }>,
          async (msgs) => {
            const r = await callAnthropicWithTools(
              apiKey, model,
              msgs as MessageParam[],
              [], // NO tools in forced-commit call
              maxTokensPerTurn,
              perTurnTimeoutMs,
            );
            const textParts = r.content
              .filter((b) => b.type === 'text')
              .map((b) => (b as TextBlock).text)
              .join('\n');
            totalInputTokens += r.usage.input_tokens;
            totalOutputTokens += r.usage.output_tokens;
            return textParts;
          },
          earlyTrigger,
        );
        return {
          questionId: question.task_id,
          finalAnswer: commitResult.answer,
          turns,
          toolCallsByName,
          totalInputTokens,
          totalOutputTokens,
          wallMs: Date.now() - wallStart,
          replanCount,
          convergenceTrigger: earlyTrigger,
          convergenceUsedFallback: commitResult.usedFallback,
        };
      }
    }

    let resp: AnthropicResponse;
    try {
      resp = await callAnthropicWithTools(
        apiKey,
        model,
        messages,
        toolDefs,
        maxTokensPerTurn,
        perTurnTimeoutMs,
      );
    } catch (err) {
      return {
        questionId: question.task_id,
        finalAnswer: null,
        turns,
        toolCallsByName,
        totalInputTokens,
        totalOutputTokens,
        wallMs: Date.now() - wallStart,
        replanCount,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    totalInputTokens += resp.usage.input_tokens;
    totalOutputTokens += resp.usage.output_tokens;

    // Update convergence state: record token usage for this turn (tool calls tracked below).
    if (enableConvergence) {
      recordTurn(convState, resp.usage.input_tokens, []);
    }

    if (resp.stop_reason === 'end_turn' || resp.stop_reason === 'max_tokens') {
      const finalAnswer = extractFinalAnswer(resp);
      return {
        questionId: question.task_id,
        finalAnswer,
        turns,
        toolCallsByName,
        totalInputTokens,
        totalOutputTokens,
        wallMs: Date.now() - wallStart,
        replanCount,
      };
    }

    if (resp.stop_reason === 'tool_use') {
      // Track tool call counts and update convergence state with this turn's tool calls.
      const toolCallsThisTurn: Array<{ name: string; args: object }> = [];
      for (const block of resp.content) {
        if (block.type === 'tool_use') {
          const toolBlock = block as ToolUseBlock;
          toolCallsByName[toolBlock.name] = (toolCallsByName[toolBlock.name] ?? 0) + 1;
          if (enableConvergence) {
            toolCallsThisTurn.push({
              name: toolBlock.name,
              args: (toolBlock.input ?? {}) as object,
            });
          }
        }
      }

      // Append tool call fingerprints to convergence state.
      if (enableConvergence && toolCallsThisTurn.length > 0) {
        for (const tc of toolCallsThisTurn) {
          convState.toolCalls.push({
            name: tc.name,
            argsHash: convergenceArgsHash(tc.name, tc.args),
            turn: turns,
          });
        }
      }

      // Execute all tool calls in parallel
      const toolResults = await executeToolCalls(resp, catalogue);

      // Append assistant turn (with tool_use blocks)
      messages.push({ role: 'assistant', content: resp.content });

      // Planning checkpoint: every planningInterval turns (starting from turn 1),
      // inject a replan prompt alongside the tool results.
      // Conditions: interval is positive, turn>0 (has history), and (turns % interval === 0).
      const shouldReplan =
        planningInterval > 0 &&
        turns > 0 &&
        turns % planningInterval === 0;

      if (shouldReplan) {
        replanCount++;
        const checkpoint = buildPlanningCheckpoint(turns, maxTurns);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content: any[] = [
          ...toolResults,
          { type: 'text', text: checkpoint } as ContentBlock,
        ];
        messages.push({ role: 'user', content });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages.push({ role: 'user', content: toolResults as any[] });
      }

      continue;
    }

    // Unexpected stop_reason — treat as end_turn
    const finalAnswer = extractFinalAnswer(resp);
    return {
      questionId: question.task_id,
      finalAnswer,
      turns,
      toolCallsByName,
      totalInputTokens,
      totalOutputTokens,
      wallMs: Date.now() - wallStart,
      replanCount,
    };
  }

  // Exhausted maxTurns — attempt convergence-layer forced commit if enabled.
  if (enableConvergence) {
    process.stderr.write(
      `[convergence] max_turns (${maxTurns}) exhausted — forcing commit\n`,
    );
    const commitResult = await forceCommit(
      messages as Array<{ role: string; content: string | unknown }>,
      async (msgs) => {
        const r = await callAnthropicWithTools(
          apiKey, model,
          msgs as MessageParam[],
          [], // NO tools in forced-commit call
          maxTokensPerTurn,
          perTurnTimeoutMs,
        );
        const textParts = r.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as TextBlock).text)
          .join('\n');
        totalInputTokens += r.usage.input_tokens;
        totalOutputTokens += r.usage.output_tokens;
        return textParts;
      },
      'max_turns',
    );
    return {
      questionId: question.task_id,
      finalAnswer: commitResult.answer,
      turns,
      toolCallsByName,
      totalInputTokens,
      totalOutputTokens,
      wallMs: Date.now() - wallStart,
      replanCount,
      timedOut: !commitResult.answer,
      convergenceTrigger: 'max_turns',
      convergenceUsedFallback: commitResult.usedFallback,
    };
  }

  return {
    questionId: question.task_id,
    finalAnswer: null,
    turns,
    toolCallsByName,
    totalInputTokens,
    totalOutputTokens,
    wallMs: Date.now() - wallStart,
    replanCount,
    timedOut: true,
  };
}

// ---------------------------------------------------------------------------
// Answer matching
// ---------------------------------------------------------------------------

/**
 * Check whether a model answer matches the expected ground-truth answer.
 *
 * Matching rules (mirrors GAIA evaluation):
 * - Normalise: trim whitespace, lowercase.
 * - Substring match: expected is contained in model answer (handles "Paris" vs "Paris, France").
 * - Direct equality after normalisation.
 * - Numeric: parse as floats and compare with ±1% tolerance.
 */
export function isAnswerCorrect(modelAnswer: string, expected: string): boolean {
  if (!modelAnswer) return false;

  const norm = (s: string) => s.trim().toLowerCase();
  const normModel = norm(modelAnswer);
  const normExpected = norm(expected);

  // Exact match
  if (normModel === normExpected) return true;

  // Substring match (expected contained in model answer or vice versa)
  if (normModel.includes(normExpected)) return true;
  if (normExpected.includes(normModel)) return true;

  // Numeric match with tolerance
  const numModel = parseFloat(normModel.replace(/[^0-9.\-]/g, ''));
  const numExpected = parseFloat(normExpected.replace(/[^0-9.\-]/g, ''));
  if (
    !Number.isNaN(numModel) &&
    !Number.isNaN(numExpected) &&
    numExpected !== 0 &&
    Math.abs((numModel - numExpected) / numExpected) < 0.01
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Smoke runner
// ---------------------------------------------------------------------------

/**
 * Run all 5 SMOKE_FIXTURE questions and report results to stdout.
 *
 * Pass criteria: ≥3/5 correct (60% pass rate).
 *
 * Cost estimate is printed at the end using Haiku pricing.
 *
 * This function is exported so tests can call it directly and capture output;
 * it also runs when this file is executed directly via `node gaia-agent.js --smoke`.
 */
export async function runSmokeTest(opts: {
  verbose?: boolean;
  apiKey?: string;
} = {}): Promise<{ passRate: number; passed: number; total: number }> {
  const { verbose = true, apiKey } = opts;

  if (verbose) {
    console.log('\n=== GAIA Smoke Test (ADR-133-PR3) ===');
    console.log(`Model: ${DEFAULT_MODEL}`);
    console.log(`Questions: ${SMOKE_FIXTURE.length}\n`);
  }

  let passed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const results: Array<{
    question: GaiaQuestion;
    result: GaiaAgentResult;
    correct: boolean;
  }> = [];

  for (const question of SMOKE_FIXTURE) {
    const result = await runGaiaAgent(question, {
      model: DEFAULT_MODEL,
      apiKey,
    });

    const correct =
      result.finalAnswer !== null && isAnswerCorrect(result.finalAnswer, question.final_answer);

    if (correct) passed++;
    totalInputTokens += result.totalInputTokens;
    totalOutputTokens += result.totalOutputTokens;
    results.push({ question, result, correct });

    if (verbose) {
      const status = correct ? 'PASS' : 'FAIL';
      console.log(`[${status}] ${question.task_id}: ${question.question.slice(0, 60)}`);
      console.log(
        `       Expected: "${question.final_answer}" | Got: "${result.finalAnswer ?? 'null'}"`,
      );
      console.log(
        `       Turns: ${result.turns} | Replans: ${result.replanCount} | Tools: ${JSON.stringify(result.toolCallsByName)} | Wall: ${result.wallMs}ms`,
      );
      if (result.error) console.log(`       Error: ${result.error}`);
      console.log();
    }
  }

  const passRate = passed / SMOKE_FIXTURE.length;
  const estimatedCostUsd =
    (totalInputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_M +
    (totalOutputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_M;

  if (verbose) {
    console.log('=== Summary ===');
    console.log(`Pass rate:   ${passed}/${SMOKE_FIXTURE.length} (${(passRate * 100).toFixed(0)}%)`);
    console.log(`Threshold:   3/5 (60%)`);
    console.log(`Status:      ${passed >= 3 ? 'SMOKE PASSED' : 'SMOKE FAILED'}`);
    console.log(`Tokens in:   ${totalInputTokens.toLocaleString()}`);
    console.log(`Tokens out:  ${totalOutputTokens.toLocaleString()}`);
    console.log(`Est. cost:   $${estimatedCostUsd.toFixed(4)} (Haiku pricing)`);
    console.log(
      '\nTool-call breakdown (totals):',
      results.reduce(
        (acc, r) => {
          for (const [k, v] of Object.entries(r.result.toolCallsByName)) {
            acc[k] = (acc[k] ?? 0) + v;
          }
          return acc;
        },
        {} as Record<string, number>,
      ),
    );
    console.log();

    if (passed < 3) {
      console.warn(
        'WARNING: Smoke pass rate below threshold (3/5).  ' +
        'Common causes: web_search returning low-signal DDG results, ' +
        'ANTHROPIC_API_KEY unavailable, or per-turn timeout too tight.',
      );
    }
  }

  return { passRate, passed, total: SMOKE_FIXTURE.length };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

/**
 * Run when invoked as: node gaia-agent.js --smoke
 *
 * Exits with code 0 if ≥3/5 pass, 1 otherwise.
 */
if (process.argv.includes('--smoke')) {
  runSmokeTest({ verbose: true })
    .then(({ passed }) => {
      process.exit(passed >= 3 ? 0 : 1);
    })
    .catch((err) => {
      console.error('Smoke test crashed:', err);
      process.exit(2);
    });
}

// ---------------------------------------------------------------------------
// Test-only exports (iter 53a — gaia-extract.smoke.ts)
// These expose private functions for unit testing without polluting the
// public API.  Named with a leading underscore to signal test-only use.
// ---------------------------------------------------------------------------

export {
  extractFinalAnswer as _extractFinalAnswerForTest,
  buildUserMessage as _buildUserMessageForTest,
};
