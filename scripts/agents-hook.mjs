#!/usr/bin/env node
/**
 * agents-hook.mjs — Claude Code PostToolUse hook.
 *
 * After a Write/Edit/MultiEdit, if a file under .claude/agents/ changed, run
 * scripts/check-agents.mjs (validate + regenerate catalog/report + verify
 * connectivity) and surface a one-line result. Never blocks the session.
 *
 * Wired in .claude/settings.json (PostToolUse → "node scripts/agents-hook.mjs").
 */
import { execFileSync } from 'node:child_process';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let p = '';
  try { const j = JSON.parse(input); p = (j.tool_input && (j.tool_input.file_path || j.tool_input.path)) || ''; } catch { /* no payload */ }
  if (!/[\\/]\.claude[\\/]agents[\\/].+\.md$/.test(p)) process.exit(0); // not an agent edit

  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    const out = execFileSync('node', ['scripts/check-agents.mjs'], { cwd, stdio: 'pipe' }).toString();
    const last = out.trim().split('\n').pop();
    process.stderr.write('[agents-hook] ' + last + '\n');
  } catch (e) {
    const msg = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
    process.stderr.write('[agents-hook] agent check FAILED — catalog/connectivity issue:\n' + msg.trim() + '\n');
  }
  process.exit(0); // advisory only — never block
});
