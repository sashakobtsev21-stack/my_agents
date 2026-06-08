#!/usr/bin/env node
/**
 * connect-to-project.mjs — install the AlexKo agent team INTO another project so
 * that, when you open that project's folder in Claude Code, the agents / skills /
 * commands / statusline are available there (and the panel reflects that project).
 *
 * It detects the target's profile and copies a TAILORED team (core + the matching
 * pack), plus all skills, commands, and the statusline helper, into <target>/.claude/.
 *
 * Usage:
 *   node scripts/connect-to-project.mjs <target-path> [--all] [--force]
 *     --all    copy every agent (not just core + the detected pack)
 *     --force  overwrite existing files in the target
 *
 * Run from the my_agents repo root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const ALL = args.includes('--all');
const FORCE = args.includes('--force');

if (!target) { console.error('Usage: node scripts/connect-to-project.mjs <target-path> [--all] [--force]'); process.exit(1); }
if (!fs.existsSync(target)) { console.error(`Target not found: ${target}`); process.exit(1); }

const SELF = process.cwd();
const srcClaude = path.join(SELF, '.claude');
if (!fs.existsSync(path.join(srcClaude, 'agents'))) { console.error('Run this from the my_agents repo root (.claude/agents not found).'); process.exit(1); }

// 1) Which agents to copy — core always, plus the detected profile's pack (unless --all).
const core = ['coder', 'reviewer', 'tester', 'planner', 'researcher', 'debugger', 'security-auditor'];
let wanted = null; // null => copy everything
if (!ALL) {
  try {
    const out = execSync(`node scripts/detect-profile.mjs "${target}" --json`, { cwd: SELF, encoding: 'utf8' });
    const prof = JSON.parse(out.slice(out.indexOf('{')));
    wanted = new Set([...core, ...(prof.recommendedAgents || [])]);
    console.log(`Detected profile: ${prof.primary} — copying ${wanted.size} agents (core + pack). Use --all for everything.`);
  } catch {
    console.log('Profile detection failed — copying ALL agents.');
  }
}

// 2) Copy helpers.
function copyFile(src, dst) {
  if (fs.existsSync(dst) && !FORCE) return false;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  return true;
}
function copyTree(srcDir, dstDir, filter) {
  let n = 0;
  if (!fs.existsSync(srcDir)) return 0;
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, e.name), d = path.join(dstDir, e.name);
    if (e.isDirectory()) n += copyTree(s, d, filter);
    else if (!filter || filter(s)) n += copyFile(s, d) ? 1 : 0;
  }
  return n;
}

const dstClaude = path.join(target, '.claude');
const nameOf = (file) => { const m = fs.readFileSync(file, 'utf8').match(/^name:\s*["']?(.+?)["']?\s*$/m); return m ? m[1] : path.basename(file, '.md'); };

const agentFilter = (f) => f.endsWith('.md') && (!wanted || wanted.has(nameOf(f)));
const nAgents = copyTree(path.join(srcClaude, 'agents'), path.join(dstClaude, 'agents'), agentFilter);
const nSkills = copyTree(path.join(srcClaude, 'skills'), path.join(dstClaude, 'skills'));
const nCommands = copyTree(path.join(srcClaude, 'commands'), path.join(dstClaude, 'commands'));
const nHelpers = copyTree(path.join(srcClaude, 'helpers'), path.join(dstClaude, 'helpers'));

console.log(`\n✓ Connected the team to ${path.resolve(target)}/.claude/`);
console.log(`  agents: ${nAgents}  ·  skills: ${nSkills}  ·  commands: ${nCommands}  ·  helpers: ${nHelpers}`);
console.log(`\nNext: open that project's folder in Claude Code — the agents/skills are now available there.`);
console.log(`(Commit them in the target so they travel with the repo. Re-run with --force to update later.)`);
