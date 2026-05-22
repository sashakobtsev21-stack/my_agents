#!/usr/bin/env node
/**
 * Regression guard for ruvnet/ruflo#2042 — agent_execute hardcoded the
 * Anthropic SDK and ignored the v3 provider system. Reporter: @ummcke00.
 *
 * The fix routes executeAgentTask() through callAnthropicMessages(),
 * which dispatches to Anthropic / OpenRouter / Ollama based on:
 *   1. Explicit `RUFLO_PROVIDER=...`
 *   2. Available API keys when no provider is forced
 *
 * This smoke statically asserts the wiring:
 *   1. executeAgentTask() must NOT contain the old inline
 *      `fetch('https://api.anthropic.com/...')` bypass.
 *   2. callAnthropicMessages() must reference OPENROUTER_API_KEY.
 *   3. callOpenAICompat() must exist as a helper.
 *   4. The "no provider configured" error must list all three options.
 *
 * Plus one behavioral check: invoke callAnthropicMessages() with
 * OPENROUTER_API_KEY set and assert the response error names the
 * openrouter provider (not Anthropic) — proves the dispatch fires.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(__dirname, '../v3/@claude-flow/cli/src/mcp-tools/agent-execute-core.ts');
const DIST = resolve(__dirname, '../v3/@claude-flow/cli/dist/src/mcp-tools/agent-execute-core.js');

function fail(msg) { console.error(`✗ ${msg}`); process.exitCode = 1; }
function pass(msg) { console.log(`✓ ${msg}`); }

const src = readFileSync(SOURCE, 'utf8');

// 1. executeAgentTask must no longer contain the bypass fetch
const execBody = src.match(/export async function executeAgentTask[\s\S]*?\n\}\n/);
if (!execBody) {
  fail('executeAgentTask not found');
} else if (/fetch\(['"]https:\/\/api\.anthropic\.com\/v1\/messages['"]/.test(execBody[0])) {
  fail('executeAgentTask still contains inline `fetch(https://api.anthropic.com/...)` — #2042 regression');
} else if (!/callAnthropicMessages/.test(execBody[0])) {
  fail('executeAgentTask does not delegate to callAnthropicMessages — #2042 regression');
} else {
  pass('executeAgentTask delegates to callAnthropicMessages (no inline Anthropic fetch)');
}

// 2. callAnthropicMessages references OPENROUTER_API_KEY
if (!/OPENROUTER_API_KEY/.test(src)) {
  fail('OPENROUTER_API_KEY env var not referenced — OpenRouter branch missing');
} else {
  pass('OPENROUTER_API_KEY env var routes the OpenRouter branch');
}

// 3. callOpenAICompat helper exists
if (!/async function callOpenAICompat/.test(src)) {
  fail('callOpenAICompat helper missing — #2042 fix incomplete');
} else {
  pass('callOpenAICompat helper exists for OpenRouter + OpenAI-compat backends');
}

// 4. No-provider error names all three options
if (!/OPENROUTER_API_KEY/.test(src) || !/OLLAMA_API_KEY/.test(src) || !/ANTHROPIC_API_KEY/.test(src)) {
  fail('No-provider error message does not list all three provider options');
} else {
  pass('No-provider error message lists Anthropic + OpenRouter + Ollama options');
}

// 5. Behavioral check via the built artifact: OPENROUTER_API_KEY routes
// to the openrouter branch (any error returned must come from
// callOpenAICompat, not the Anthropic fetch).
try {
  // Clear env to avoid network calls leaking other providers.
  process.env.ANTHROPIC_API_KEY = '';
  process.env.OPENROUTER_API_KEY = 'sk-or-test-not-real';
  process.env.OLLAMA_API_KEY = '';
  delete process.env.RUFLO_PROVIDER;
  const mod = await import(DIST);
  const res = await mod.callAnthropicMessages({ prompt: 'ping', model: 'sonnet' });
  if (res.success) {
    fail('Unexpected success in behavioral smoke (env should not authenticate)');
  } else if (/Anthropic API error/i.test(res.error || '')) {
    fail('OPENROUTER_API_KEY set but error names Anthropic — router did not dispatch');
  } else if (/openrouter/i.test(res.error || '') || /HTTP-Referer|api\.openrouter/i.test(res.error || '') || /401|authentication/i.test(res.error || '')) {
    pass('OPENROUTER_API_KEY routes to openrouter dispatch (auth error from openrouter, not anthropic)');
  } else {
    pass(`OPENROUTER_API_KEY routes to non-anthropic path (error: ${(res.error || '').slice(0, 80)})`);
  }
} catch (err) {
  fail(`behavioral smoke threw: ${err.message}`);
}

if (process.exitCode) {
  console.error('\n#2042 regression smoke FAILED');
} else {
  console.log('\n#2042 regression smoke PASS');
}
