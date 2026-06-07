#!/usr/bin/env node
/**
 * check-agents.mjs — the "Adding a new agent" rule (see CLAUDE.md).
 *
 * 1. Validates every agent in .claude/agents/**.md (frontmatter name/description/
 *    model, the `## Model & cost` standard marker, unique kebab-case names).
 * 2. Re-verifies CONNECTIVITY: every `agent-name`-shaped reference inside a prompt
 *    must resolve to a real agent — or a real plugin / skill (valid reuse target).
 * 3. Regenerates docs/AGENT-CATALOG.md + .html and docs/agent-report.html so a new
 *    agent is automatically added to the list.
 *
 * Exits non-zero on any validation or connectivity error.
 * Run: node scripts/check-agents.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const AGENTS = '.claude/agents';
const TIERS = new Set(['opus', 'sonnet', 'haiku']);
const NAME_RE = /^[a-z0-9][a-z0-9]*(?:-[a-z0-9]+)*$/;       // kebab-case (leading digit ok, e.g. 3d-artist)
const REF_RE = /`([a-z][a-z0-9]+(?:-[a-z0-9]+)+)`/g;        // backticked, ≥1 hyphen

function walk(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.md') && e.name !== 'CATALOG.md') out.push(p);
  }
  return out;
}
function dirNames(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); }
  catch { return []; }
}

const errors = [], warnings = [];
const agents = {};            // name -> file
const bodies = [];            // { name, file, body }

for (const f of walk(AGENTS)) {
  const t = fs.readFileSync(f, 'utf8').replace(/\r/g, '');
  const m = t.match(/^---\n([\s\S]*?)\n---/);
  const rel = f.replace(/\\/g, '/');
  if (!m) { errors.push(`${rel}: no YAML frontmatter`); continue; }
  const fmBlock = m[1];
  const name = (fmBlock.match(/^name:\s*["']?(.+?)["']?\s*$/m) || [])[1];
  const desc = (fmBlock.match(/^description:/m) || [])[0];
  const model = (fmBlock.match(/^model:\s*(\w+)/m) || [])[1];
  if (!name) { errors.push(`${rel}: missing \`name\``); continue; }
  if (!NAME_RE.test(name)) warnings.push(`${name} (${rel}): name is not kebab-case`);
  if (agents[name]) errors.push(`duplicate agent name "${name}": ${rel} & ${agents[name]}`);
  agents[name] = rel;
  if (!desc) errors.push(`${name}: missing \`description\``);
  if (!TIERS.has(model)) errors.push(`${name}: model must be opus|sonnet|haiku (got "${model}")`);
  if (!/^##\s*Model & cost/m.test(t)) errors.push(`${name}: missing "## Model & cost" section (unified standard)`);
  bodies.push({ name, file: rel, body: t.replace(/^---\n[\s\S]*?\n---/, '') });
}

// Valid reference universe = agents ∪ plugins ∪ skills ∪ safe non-agent tokens
const valid = new Set(Object.keys(agents));
dirNames('plugins').forEach((n) => valid.add(n));                         // ruflo-*
try {
  const mk = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8'));
  (mk.plugins || []).forEach((p) => p.name && valid.add(p.name));
} catch { /* optional */ }
dirNames('.claude/skills').forEach((n) => valid.add(n));                  // skill-builder, agentdb-*, …
for (const p of dirNames('plugins')) dirNames(path.join('plugins', p, 'skills')).forEach((n) => valid.add(n));
// Non-agent tokens that legitimately appear backticked in prompts:
['workspace-write', 'read-only', 'danger-full-access', 'claude-flow', 'ruv-swarm', 'flow-nexus',
 'agentic-flow', 'agent-booster', 'agent-browser', 'claude-flow-codex', 'better-sqlite3',
 'all-minilm-l6-v2', 'controller-service-repository'].forEach((n) => valid.add(n));

const danglers = {};
for (const { file, body } of bodies) {
  for (const mm of body.matchAll(REF_RE)) {
    const tok = mm[1];
    if (!valid.has(tok)) (danglers[tok] = danglers[tok] || new Set()).add(path.basename(file));
  }
}
for (const [tok, set] of Object.entries(danglers))
  errors.push(`dangling reference \`${tok}\` (in ${[...set].join(', ')}) — not a known agent/plugin/skill; fix the name or add the target`);

// Validate skills (each .claude/skills/<name>/SKILL.md needs name + description)
let skillCount = 0;
for (const sdir of dirNames('.claude/skills')) {
  const sf = path.join('.claude/skills', sdir, 'SKILL.md');
  if (!fs.existsSync(sf)) { warnings.push(`skill "${sdir}" has no SKILL.md (won't load)`); continue; }
  skillCount++;
  const sm = fs.readFileSync(sf, 'utf8').replace(/\r/g, '').match(/^---\n([\s\S]*?)\n---/);
  if (!sm) { errors.push(`skill ${sdir}/SKILL.md: no frontmatter`); continue; }
  if (!/^name:/m.test(sm[1])) errors.push(`skill ${sdir}: missing \`name\``);
  if (!/^description:/m.test(sm[1])) errors.push(`skill ${sdir}: missing \`description\``);
}

// Regenerate the catalog + report + full breakdown so the lists stay in sync
for (const gen of ['gen-agent-catalog.mjs', 'gen-agent-report.mjs', 'gen-full-breakdown.mjs']) {
  try { execFileSync('node', ['scripts/' + gen], { stdio: 'pipe' }); }
  catch (e) { errors.push(`generator failed: ${gen} — ${String(e.message).split('\n')[0]}`); }
}

console.log(`check-agents: ${Object.keys(agents).length} agents · ${skillCount} skills · ${errors.length} error(s) · ${warnings.length} warning(s)`);
warnings.forEach((w) => console.log('  ⚠ ' + w));
errors.forEach((e) => console.error('  ✗ ' + e));
if (errors.length) { console.error('FAILED — fix the above before committing.'); process.exit(1); }
console.log('  ✓ all agents valid · connectivity clean · catalog + report regenerated');
