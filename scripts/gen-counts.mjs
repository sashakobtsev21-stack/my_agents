#!/usr/bin/env node
/**
 * gen-counts.mjs — keep agent/skill/plugin counts in README.md, CLAUDE.md and
 * package.json honest.
 *
 * Why this exists: when an agent gets archived (e.g. 124 -> 104) someone has to
 * remember to update the "104 agents" claims in five different sentences across
 * three files. They never do, and the docs drift. `check-agents.mjs` regens the
 * catalog but does not patch these prose strings. This is the missing half.
 *
 * Modes:
 *   --check  (default) — diff expected vs actual; exit 1 on drift, 0 if clean.
 *                        Used by .githooks/pre-commit.
 *   --fix              — rewrite the values in place. Run when drift is found.
 *
 * Files touched (only the well-known sentence/badge patterns — surgical):
 *   README.md       — header badges, intro sentence, summary table, "Состояние" line, "Структура" block
 *   CLAUDE.md       — header "Verified in this checkout" line
 *   package.json    — description (NN agents, NN skills, NN plugins)
 *
 * Source of truth:
 *   agents   = .md files under .claude/agents/ excluding README.md and CATALOG.md
 *   skills   = SKILL.md files under .claude/skills/
 *   plugins  = directories under plugins/ excluding README.md (one dir == one plugin)
 *
 * NOTE: this does NOT recount commands or MCP tools — those need deeper
 * enumeration. If you change those numbers, edit them by hand.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const FIX = args.has('--fix');

function walkMd(dir, skipNames = new Set()) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkMd(p, skipNames));
    else if (e.name.endsWith('.md') && !skipNames.has(e.name)) out.push(p);
  }
  return out;
}

function countAgents() {
  return walkMd(path.join(ROOT, '.claude/agents'), new Set(['README.md', 'CATALOG.md'])).length;
}
function countSkills() {
  const dir = path.join(ROOT, '.claude/skills');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))
    .length;
}
function countPlugins() {
  const dir = path.join(ROOT, 'plugins');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory()).length;
}

const counts = {
  agents: countAgents(),
  skills: countSkills(),
  plugins: countPlugins(),
};

/**
 * A patch is { file, pattern, replacement(counts) }. We diff each on-disk match
 * against the regenerated string; mismatch == drift.
 */
const patches = [
  // README.md — agents badge
  { file: 'README.md',
    pattern: /(\[!\[agents\]\(https:\/\/img\.shields\.io\/badge\/agents-)(\d+)(-)/,
    val: ({ agents }) => agents },
  // README.md — plugins badge
  { file: 'README.md',
    pattern: /(\[!\[plugins\]\(https:\/\/img\.shields\.io\/badge\/plugins-)(\d+)(-)/,
    val: ({ plugins }) => plugins },
  // README.md — "**NNN специализированных агента**"
  { file: 'README.md',
    pattern: /(\*\*)(\d+)( специализированн)/,
    val: ({ agents }) => agents },
  // README.md — table row "| 🤖 **Агенты** | NNN |"
  { file: 'README.md',
    pattern: /(\| 🤖 \*\*Агенты\*\* \| )(\d+)( \|)/,
    val: ({ agents }) => agents },
  // README.md — table row "| 🧩 **Скиллы** | NNN |"
  { file: 'README.md',
    pattern: /(\| 🧩 \*\*Скиллы\*\* \| )(\d+)( \|)/,
    val: ({ skills }) => skills },
  // README.md — table row "| 🔌 **Плагины** | NNN |"
  { file: 'README.md',
    pattern: /(\| 🔌 \*\*Плагины\*\* \| )(\d+)( \|)/,
    val: ({ plugins }) => plugins },
  // README.md — "agents/ (NNN)" inside the Структура fence
  { file: 'README.md',
    pattern: /(agents\/ \()(\d+)(\))/,
    val: ({ agents }) => agents },
  // README.md — "skills/ (NNN)" inside the Структура fence
  { file: 'README.md',
    pattern: /(skills\/ \()(\d+)(\))/,
    val: ({ skills }) => skills },
  // README.md — "Состояние" line "NNN агента / NNN скилл"
  { file: 'README.md',
    pattern: /(- \*\*Агенты:\*\* )(\d+)( агент(?:а|ов) \/ )(\d+)( скилл)/,
    val: ({ agents, skills }, match) => [agents, skills],
    multi: true },

  // CLAUDE.md — "Verified in this checkout: NN agents, NN skills, ..., NN bundled plugins"
  // The middle part has nested parens — "NN command/subcommand entries (NN top-level commands)"
  // so the gap-skip must accept ',' inside it. Anchor strictly on the literal " bundled plugins".
  { file: 'CLAUDE.md',
    pattern: /(> Verified in this checkout: )(\d+)( agents, )(\d+)( skills,[\s\S]*?, )(\d+)( bundled plugins)/,
    val: ({ agents, skills, plugins }) => [agents, skills, plugins],
    multi: true },

  // package.json — description "NN agents, NN skills, NN plugins"
  { file: 'package.json',
    pattern: /("description":\s*"[^"]*?: )(\d+)( agents, )(\d+)( skills, )(\d+)( plugins)/,
    val: ({ agents, skills, plugins }) => [agents, skills, plugins],
    multi: true },
];

function readUtf8(rel) {
  const abs = path.join(ROOT, rel);
  return fs.readFileSync(abs, 'utf8');
}
function writeUtf8(rel, txt) {
  const abs = path.join(ROOT, rel);
  fs.writeFileSync(abs, txt);
}

const drift = [];
const touched = new Set();

for (const p of patches) {
  let txt = readUtf8(p.file);
  const m = txt.match(p.pattern);
  if (!m) {
    drift.push({ file: p.file, kind: 'pattern-missing', pattern: p.pattern.toString() });
    continue;
  }
  const vals = p.multi ? p.val(counts) : [p.val(counts)];

  let newTxt = txt;
  if (p.multi) {
    // Reconstruct match by interleaving captures with new values.
    // Groups are: [prefix1, N1, prefix2, N2, prefix3, N3, suffix]
    const captures = m.slice(1); // captured groups in order
    let newMatch = '';
    let valIdx = 0;
    for (let i = 0; i < captures.length; i++) {
      if (/^\d+$/.test(captures[i])) {
        newMatch += String(vals[valIdx++]);
      } else {
        newMatch += captures[i];
      }
    }
    if (newMatch !== m[0]) {
      newTxt = txt.replace(m[0], newMatch);
    }
  } else {
    const newMatch = m[1] + String(vals[0]) + m[3];
    if (newMatch !== m[0]) {
      newTxt = txt.replace(m[0], newMatch);
    }
  }

  if (newTxt !== txt) {
    drift.push({
      file: p.file,
      kind: 'count-drift',
      was: m[0],
      now: p.multi
        ? m[0].replace(/\d+/g, () => String(vals.shift()))
        : (m[1] + String(p.val(counts)) + m[3]),
    });
    if (FIX) {
      writeUtf8(p.file, newTxt);
      touched.add(p.file);
    }
  }
}

const tag = FIX ? 'gen-counts --fix' : 'gen-counts';
console.log(`${tag}: agents=${counts.agents} skills=${counts.skills} plugins=${counts.plugins}`);

if (drift.length === 0) {
  console.log('  ✓ all counts match — no drift');
  process.exit(0);
}

if (FIX) {
  console.log(`  ✓ rewrote ${touched.size} file(s):`);
  for (const f of touched) console.log(`     - ${f}`);
  process.exit(0);
}

console.log(`  ✗ ${drift.length} drift(s) — run \`node scripts/gen-counts.mjs --fix\`:`);
for (const d of drift) {
  if (d.kind === 'pattern-missing') {
    console.log(`     - ${d.file}: pattern not found ${d.pattern}`);
  } else {
    console.log(`     - ${d.file}: \`${d.was}\` -> \`${d.now}\``);
  }
}
process.exit(1);
