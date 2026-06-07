#!/usr/bin/env node
/**
 * gen-full-breakdown.mjs — generates the exhaustive project reference:
 *   docs/full-breakdown.html  (styled, browseable)
 *   docs/FULL-BREAKDOWN.md     (renders on GitHub)
 *
 * Everything, from real data: agents (by area), all skills, all commands (by
 * group), all 33 plugins (what each bundles), MCP tool groups, and v3 packages.
 *
 * Run: node scripts/gen-full-breakdown.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT_HTML = 'docs/full-breakdown.html';
const OUT_MD = 'docs/FULL-BREAKDOWN.md';

const walk = (d) => !fs.existsSync(d) ? [] : fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : (e.name.endsWith('.md') ? [p] : []);
});
const dirs = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } };
function fm(file) {
  const t = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const m = t.match(/^---\n([\s\S]*?)\n---/);
  const o = {};
  if (m) for (const ln of m[1].split('\n')) { const kv = ln.match(/^([A-Za-z0-9_-]+):\s?(.*)$/); if (kv) o[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim(); }
  return o;
}
function readJSON(f, d = {}) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } }

// ---- AGENTS (by area) ----
const agentRows = walk('.claude/agents').filter((f) => path.basename(f) !== 'CATALOG.md');
const agentByCat = {};
for (const f of agentRows) { const c = path.relative('.claude/agents', path.dirname(f)).split(path.sep)[0] || '(root)'; agentByCat[c] = (agentByCat[c] || 0) + 1; }

// ---- SKILLS ----
const skills = walk('.claude/skills').filter((f) => path.basename(f) === 'SKILL.md').map((f) => {
  const o = fm(f); return { name: o.name || path.basename(path.dirname(f)), dir: path.basename(path.dirname(f)), desc: (o.description || '').trim() };
}).sort((a, b) => a.dir.localeCompare(b.dir));

// ---- COMMANDS (by group) ----
const cmdByGroup = {};
for (const f of walk('.claude/commands')) {
  const rel = path.relative('.claude/commands', f);
  const g = rel.includes(path.sep) ? rel.split(path.sep)[0] : '(root)';
  (cmdByGroup[g] = cmdByGroup[g] || []).push(path.basename(f, '.md'));
}
for (const g of Object.keys(cmdByGroup)) cmdByGroup[g].sort();
const cmdTotal = Object.values(cmdByGroup).reduce((a, b) => a + b.length, 0);

// ---- PLUGINS ----
const mk = readJSON('.claude-plugin/marketplace.json', { plugins: [] });
const pluginDesc = {}; (mk.plugins || []).forEach((p) => (pluginDesc[p.name] = p.description));
const plugins = dirs('plugins').sort().map((n) => {
  const base = path.join('plugins', n);
  const count = (sub, file) => walk(path.join(base)).filter((f) => f.includes(path.sep + sub + path.sep) && (!file || path.basename(f) === file)).length;
  return { name: n, desc: pluginDesc[n] || '', a: count('agents'), s: count('skills', 'SKILL.md'), c: count('commands') };
});

// ---- MCP tool groups ----
const MCP_GROUPS = {
  'agent': 'Spawn/list/manage agents', 'agentdb': 'AgentDB vector memory ops', 'analyze': 'Code/repo analysis',
  'autopilot': 'Autonomous /loop task runs', 'browser': 'Playwright browser automation', 'browser-session': 'Browser session lifecycle',
  'claims': 'Claims-based authorization', 'config': 'Configuration & providers', 'coordination': 'Swarm coordination/sync',
  'daa': 'Dynamic agentic architecture', 'embeddings': 'Vector embeddings', 'github': 'PRs/issues/repos/releases',
  'guidance': 'Governance control plane', 'hive-mind': 'Queen-led consensus', 'hooks': 'Lifecycle hooks + codemods + workers',
  'managed-agent': 'Anthropic Managed Agents (cloud)', 'memory': 'Store/search/retrieve memory (HNSW)', 'neural': 'SONA/MoE neural training',
  'performance': 'Benchmark/profile/optimize', 'progress': 'Implementation progress', 'ruvllm': 'Local LLM inference',
  'security': 'Scan/audit/CVE/threats', 'session': 'Session state & persistence', 'swarm': 'Init/scale/monitor swarms',
  'system': 'System diagnostics/doctor', 'task': 'Task lifecycle', 'terminal': 'Sandboxed command execution',
  'transfer': 'Pattern transfer (IPFS)', 'wasm-agent': 'Local WASM-sandboxed agents', 'workflow': 'Workflow templates/execution',
  'agent-execute-core': 'Agent execution core',
};
const mcpModules = dirs('v3/@claude-flow/cli/src/mcp-tools').length
  ? [] : [];
const mcpToolFiles = (fs.existsSync('v3/@claude-flow/cli/src/mcp-tools') ? fs.readdirSync('v3/@claude-flow/cli/src/mcp-tools') : [])
  .filter((f) => f.endsWith('-tools.ts')).map((f) => f.replace(/-tools\.ts$/, ''));
const inv = readJSON('verification/inventory.json', {});
const mcpTotal = (inv.mcp && (inv.mcp.total || inv.mcp.count || (Array.isArray(inv.mcp.tools) && inv.mcp.tools.length))) || '~313';

// ---- V3 packages ----
const v3pkgs = dirs('v3/@claude-flow').sort().map((n) => ({ name: '@claude-flow/' + n, desc: (readJSON(path.join('v3/@claude-flow', n, 'package.json')).description || '').trim() }))
  .filter((p) => p.desc);

const totals = { agents: agentRows.length, skills: skills.length, commands: cmdTotal, plugins: plugins.length, mcp: mcpTotal, v3: v3pkgs.length };

// =================== MARKDOWN ===================
const M = [];
M.push('# 📚 my_agents — полный разбор проекта', '');
M.push('> Авто-генерируется: `node scripts/gen-full-breakdown.mjs`. Новичкам сначала — [`CONCEPTS.md`](CONCEPTS.md).', '');
M.push(`**Состав:** ${totals.agents} агентов · ${totals.skills} скиллов · ${totals.commands} команд · ${totals.plugins} плагинов · ${totals.mcp} MCP-инструментов · ${totals.v3} v3-пакетов.`, '');
M.push('## 🤖 Агенты (по направлениям)', '', '| Направление | Кол-во |', '|---|---:|');
Object.entries(agentByCat).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => M.push(`| ${c} | ${n} |`));
M.push('', 'Полный реестр с ролями и тирами → [`AGENT-CATALOG.md`](AGENT-CATALOG.md).', '');
M.push('## 🧩 Скиллы (' + skills.length + ')', '', '| Скилл | Что делает |', '|---|---|');
skills.forEach((s) => M.push(`| \`${s.dir}\` | ${s.desc.replace(/\|/g, '\\|').slice(0, 160)} |`));
M.push('', '## ⌨️ Команды (' + cmdTotal + ', по группам)', '');
Object.entries(cmdByGroup).sort((a, b) => b[1].length - a[1].length).forEach(([g, list]) => {
  M.push(`**${g}** (${list.length}): ` + list.map((c) => '`' + c + '`').join(' · '), '');
});
M.push('## 🔌 Плагины (' + plugins.length + ')', '', '| Плагин | Привозит | Что делает |', '|---|---|---|');
plugins.forEach((p) => M.push(`| \`${p.name}\` | a:${p.a} s:${p.s} c:${p.c} | ${(p.desc || '').replace(/\|/g, '\\|').slice(0, 140)} |`));
M.push('', '_a = агенты · s = скиллы · c = команды, которые плагин добавляет при установке._', '');
M.push('## 🛠️ MCP-инструменты (' + mcpTotal + ', по группам)', '', '| Группа | Назначение |', '|---|---|');
mcpToolFiles.sort().forEach((g) => M.push(`| \`${g}\` | ${MCP_GROUPS[g] || '—'} |`));
M.push('', '## 🏗️ Пакеты движка v3 (' + v3pkgs.length + ')', '', '| Пакет | Назначение |', '|---|---|');
v3pkgs.forEach((p) => M.push(`| \`${p.name}\` | ${p.desc.replace(/\|/g, '\\|').slice(0, 110)} |`));
M.push('', '---', '', 'См. также: [`CONCEPTS.md`](CONCEPTS.md) · [`agent-catalog.html`](agent-catalog.html) · [`agent-report.html`](agent-report.html) · [`../README.md`](../README.md)', '');
fs.writeFileSync(OUT_MD, M.join('\n'));

// =================== HTML ===================
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stat = (n, l) => `<div class="card"><div class="n">${n}</div><div class="l">${l}</div></div>`;
const det = (title, inner, open) => `<details${open ? ' open' : ''}><summary>${title}</summary>${inner}</details>`;

const agentTbl = '<table><tbody>' + Object.entries(agentByCat).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<tr><td>${esc(c)}</td><td class="num">${n}</td></tr>`).join('') + '</tbody></table>';
const skillTbl = '<table><thead><tr><th>Скилл</th><th>Что делает</th></tr></thead><tbody>' + skills.map((s) => `<tr><td><code>${esc(s.dir)}</code></td><td>${esc(s.desc)}</td></tr>`).join('') + '</tbody></table>';
const cmdBlocks = Object.entries(cmdByGroup).sort((a, b) => b[1].length - a[1].length).map(([g, list]) =>
  `<p><b>${esc(g)}</b> <span class="mut">(${list.length})</span><br>` + list.map((c) => `<code>${esc(c)}</code>`).join(' ') + '</p>').join('');
const pluginTbl = '<table><thead><tr><th>Плагин</th><th>Привозит</th><th>Что делает</th></tr></thead><tbody>' +
  plugins.map((p) => `<tr><td><code>${esc(p.name)}</code></td><td class="mut">a:${p.a} s:${p.s} c:${p.c}</td><td>${esc(p.desc)}</td></tr>`).join('') + '</tbody></table>';
const mcpTbl = '<table><thead><tr><th>Группа</th><th>Назначение</th></tr></thead><tbody>' +
  mcpToolFiles.sort().map((g) => `<tr><td><code>${esc(g)}</code></td><td>${esc(MCP_GROUPS[g] || '—')}</td></tr>`).join('') + '</tbody></table>';
const v3Tbl = '<table><thead><tr><th>Пакет</th><th>Назначение</th></tr></thead><tbody>' +
  v3pkgs.map((p) => `<tr><td><code>${esc(p.name)}</code></td><td>${esc(p.desc)}</td></tr>`).join('') + '</tbody></table>';

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>my_agents — полный разбор проекта</title>
<style>
:root{--bg:#0d1117;--panel:#161b22;--line:#283040;--fg:#e6edf3;--mut:#9aa7b4;--ok:#3fb950;--accent:#6366f1}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:30px 20px 70px}
h1{font-size:27px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 18px}
.cards{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:96px;flex:1}
.card .n{font-size:22px;font-weight:700}.card .l{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.03em}
details{background:var(--panel);border:1px solid var(--line);border-radius:10px;margin:10px 0;padding:0 16px}
summary{cursor:pointer;font-size:17px;font-weight:600;padding:14px 0}
details[open] summary{border-bottom:1px solid var(--line);margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin:4px 0 12px}
th{text-align:left;color:var(--mut);font-weight:600;font-size:11.5px;text-transform:uppercase;padding:7px;border-bottom:1px solid var(--line)}
td{padding:7px;border-bottom:1px solid var(--line);vertical-align:top}td.num{text-align:right}
code{background:#1f2630;border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:12px;color:#cdd9e5;white-space:nowrap}
.mut{color:var(--mut)}a{color:#4493f8}.foot{color:var(--mut);font-size:12px;margin-top:26px}
p code{margin:1px 2px;display:inline-block}
</style></head><body><div class="wrap">
<h1>📚 my_agents — полный разбор проекта</h1>
<p class="sub">Исчерпывающий справочник всех слоёв. Новичкам — сначала <a href="concepts.html">concepts.html</a> (что есть что).</p>
<div class="cards">
${stat(totals.agents, 'агентов')}${stat(totals.skills, 'скиллов')}${stat(totals.commands, 'команд')}${stat(totals.plugins, 'плагинов')}${stat(totals.mcp, 'MCP-инстр.')}${stat(totals.v3, 'v3-пакетов')}
</div>
${det('🤖 Агенты (' + totals.agents + ') — по направлениям', agentTbl + '<p class="mut">Полный реестр с ролями и тирами → <a href="agent-catalog.html">agent-catalog.html</a> / <a href="AGENT-CATALOG.md">AGENT-CATALOG.md</a>.</p>', true)}
${det('🧩 Скиллы (' + skills.length + ') — рецепты процедур', skillTbl)}
${det('⌨️ Команды (' + cmdTotal + ') — слэш-ярлыки по группам', cmdBlocks)}
${det('🔌 Плагины (' + plugins.length + ') — что каждый привозит', pluginTbl + '<p class="mut">a = агенты · s = скиллы · c = команды, добавляемые при установке плагина.</p>')}
${det('🛠️ MCP-инструменты (' + mcpTotal + ') — реальные действия по группам', mcpTbl)}
${det('🏗️ Движок v3 (' + v3pkgs.length + ' пакетов) — что под капотом', v3Tbl)}
<p class="foot">Авто-генерируется: <code>node scripts/gen-full-breakdown.mjs</code>. См. также <a href="concepts.html">concepts.html</a> · <a href="agent-report.html">agent-report.html</a> · <a href="../README.md">README</a>.</p>
</div></body></html>`;
fs.writeFileSync(OUT_HTML, html);

console.log(`Wrote ${OUT_MD} and ${OUT_HTML}: ${totals.agents} agents, ${totals.skills} skills, ${totals.commands} commands, ${totals.plugins} plugins, ${mcpToolFiles.length} MCP groups, ${v3pkgs.length} v3 packages.`);
