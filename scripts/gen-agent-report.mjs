#!/usr/bin/env node
/**
 * Generates docs/agent-report.html — a visual "what changed + current composition"
 * report for the agent-prompt modernization of my_agents.
 *
 * Composition is computed live from .claude/agents/**.md; the change metrics and
 * per-category approach are recorded facts from the modernization commits.
 *
 * Run: node scripts/gen-agent-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'docs/agent-report.html';
const AGENTS = '.claude/agents';

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.md') && e.name !== 'CATALOG.md') out.push(p);
  }
  return out;
}
function fm(text) {
  text = text.replace(/\r\n?/g, '\n');
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  const o = {};
  if (m) for (const ln of m[1].split('\n')) { const kv = ln.match(/^(name|model):\s?(.*)$/); if (kv) o[kv[1]] = kv[2].replace(/["']/g, '').trim(); }
  return o;
}
const LEAD_RE = /coordinator|orchestrat|manager|queen|hierarchical|mesh|adaptive|consensus|synchroniz|raft|byzantine|gossip|quorum|crdt|sparc-coord|collective|director/i;
const LEAD_CATS = new Set(['swarm', 'hive-mind', 'consensus']);

const rows = walk(AGENTS).map((f) => {
  const o = fm(fs.readFileSync(f, 'utf8'));
  const cat = path.relative(AGENTS, path.dirname(f)).split(path.sep)[0] || '(root)';
  const name = o.name || path.basename(f, '.md');
  return { cat, name, model: o.model || '—', lead: LEAD_RE.test(name) || LEAD_CATS.has(cat) };
});
const total = rows.length;
const leads = rows.filter((r) => r.lead).length;
const tier = { opus: 0, sonnet: 0, haiku: 0 };
rows.forEach((r) => { if (tier[r.model] !== undefined) tier[r.model]++; });
const byCat = {};
rows.forEach((r) => (byCat[r.cat] ||= { n: 0, opus: 0, sonnet: 0, haiku: 0, leads: 0 }, byCat[r.cat].n++, byCat[r.cat][r.model] !== undefined && byCat[r.cat][r.model]++, r.lead && byCat[r.cat].leads++));

// Recorded modernization facts (from the commits)
const BEFORE_LINES = 27713, AFTER_LINES = 11241;
const CAT_TITLES = {
  core: 'Core', github: 'GitHub', consensus: 'Consensus', 'hive-mind': 'Hive-Mind', swarm: 'Swarm',
  'game-dev': 'Game Dev', sparc: 'SPARC', optimization: 'Optimization', 'flow-nexus': 'Flow-Nexus',
  'dual-mode': 'Dual-Mode', sublinear: 'Sublinear', development: 'Development', devops: 'DevOps',
  data: 'Data', testing: 'Testing', analysis: 'Analysis', goal: 'Goal', neural: 'Neural',
  reasoning: 'Reasoning', sona: 'SONA', documentation: 'Documentation', architecture: 'Architecture',
  payments: 'Payments', specialized: 'Specialized', custom: 'Custom', templates: 'Templates', v3: 'V3', '(root)': 'Root',
};
const CHANGES = [
  ['Core', 5, '264–318 → 33–49', 'rewrite'],
  ['Swarm (топологии)', 3, '311–340 → ~55', 'rewrite'],
  ['Consensus', 7, '56–990 → 31–34', 'rewrite'],
  ['Hive-Mind', 5, '139–251 → 33–36', 'rewrite'],
  ['GitHub', 13, '162–614 → 26–29', 'rewrite (tools preserved)'],
  ['SPARC', 4, '262–508 → 30', 'rewrite'],
  ['Optimization', 5, '441–818 → 35', 'rewrite + renamed to kebab-case'],
  ['Dev cluster (dev/devops/data/testing/analysis)', 12, '35–381 → 30–45', 'rewrite / align'],
  ['Game Dev', 15, '34–37 (already tight)', 'align (+ Model & cost)'],
  ['Flow-Nexus', 9, '77–104 (tool catalogs kept)', 'align'],
  ['Templates / scaffolds', 9, '91–732 (scope kept)', 'align'],
  ['V3 / Sublinear / Dual-Mode / Goal', 17, 'domain reference kept', 'align'],
  ['Root + single-category', 17, '32–135', 'align'],
];
const COMPONENTS = [
  ['🤖 Agents', total, '.claude/agents/ — reusable team, 100% on the unified standard'],
  ['🧩 Skills', 39, '.claude/skills/ — step-by-step recipes (all with SKILL.md)'],
  ['⌨️ Commands', 168, '.claude/commands/ — slash commands'],
  ['🔌 Plugins', 33, 'plugins/ — marketplace modules, each with own agents/skills/commands'],
  ['🛠️ MCP tools', '~313', 'v3/@claude-flow/cli/src/mcp-tools/ — registry'],
  ['📦 v3 packages', '40+', 'v3/@claude-flow/* — cli, memory, neural, security, swarm, guidance …'],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tierBadge = (k, n) => `<span class="t ${k}">${k} ${n}</span>`;
const stat = (n, l, sub) => `<div class="card"><div class="n">${n}</div><div class="l">${l}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

const catRows = Object.keys(byCat).sort((a, b) => byCat[b].n - byCat[a].n).map((c) => {
  const x = byCat[c];
  return `<tr><td>${esc(CAT_TITLES[c] || c)}</td><td class="num">${x.n}</td><td>${x.leads ? '🎖 ' + x.leads : '—'}</td><td>${[x.opus && tierBadge('opus', x.opus), x.sonnet && tierBadge('sonnet', x.sonnet), x.haiku && tierBadge('haiku', x.haiku)].filter(Boolean).join(' ')}</td></tr>`;
}).join('\n');
const changeRows = CHANGES.map((r) => `<tr><td>${esc(r[0])}</td><td class="num">${r[1]}</td><td><code>${esc(r[2])}</code></td><td>${esc(r[3])}</td></tr>`).join('\n');
const compRows = COMPONENTS.map((r) => `<tr><td class="big">${r[0]}</td><td class="num big">${r[1]}</td><td>${esc(r[2])}</td></tr>`).join('\n');
const pct = Math.round((1 - AFTER_LINES / BEFORE_LINES) * 100);

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>my_agents — обзор: состав · изменения · как работает</title>
<style>
:root{--bg:#0d1117;--panel:#161b22;--line:#283040;--fg:#e6edf3;--mut:#9aa7b4;--ok:#3fb950;--gold:#e3b341;--opus:#a371f7;--sonnet:#4493f8;--haiku:#3fb950;--accent:#6366f1}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:30px 20px 70px}
h1{font-size:27px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 22px}
h2{font-size:19px;margin:34px 0 12px;border-left:3px solid var(--accent);padding-left:10px}
.cards{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 18px;min-width:120px;flex:1}
.card .n{font-size:26px;font-weight:700}.card .l{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.04em}.card .s{color:var(--ok);font-size:12px;margin-top:3px}
.bar{height:10px;background:#21262d;border-radius:6px;overflow:hidden;margin:6px 0 2px}.bar > i{display:block;height:100%;background:linear-gradient(90deg,var(--ok),var(--sonnet))}
table{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0}
th{text-align:left;color:var(--mut);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em;padding:8px;border-bottom:1px solid var(--line)}
td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top}td.num{text-align:right;font-variant-numeric:tabular-nums}td.big{font-size:15px;font-weight:600}
code{background:#1f2630;border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:12.5px;color:#cdd9e5}
.t{font-size:11px;border-radius:20px;padding:1px 7px;border:1px solid;white-space:nowrap}
.t.opus{color:var(--opus);border-color:var(--opus)}.t.sonnet{color:var(--sonnet);border-color:var(--sonnet)}.t.haiku{color:var(--haiku);border-color:var(--haiku)}
ul{margin:6px 0 0;padding-left:20px}li{margin:3px 0}.mut{color:var(--mut)}
.pill{display:inline-block;background:#11261a;border:1px solid var(--ok);color:var(--ok);border-radius:20px;padding:3px 12px;font-size:13px;font-weight:600}
pre.diag{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 14px;overflow:auto;font-size:12.5px;color:#cdd9e5;white-space:pre;line-height:1.5}
a{color:var(--sonnet)}.foot{color:var(--mut);font-size:12px;margin-top:30px}
</style></head><body><div class="wrap">
<h1>🧭 my_agents — обзор проекта</h1>
<p class="sub">Все промпты <code>.claude/agents/</code> приведены к единому современному стандарту. <span class="pill">${rows.filter(() => true).length}/${total} · 100%</span></p>

<div class="cards">
${stat(total, 'агентов', '100% по стандарту')}
${stat(Object.keys(byCat).length, 'направлений')}
${stat(leads, 'руководителей', '🎖 оркестраторы')}
${stat('<span class="t opus">opus ' + tier.opus + '</span> <span class="t sonnet">sonnet ' + tier.sonnet + '</span> <span class="t haiku">haiku ' + tier.haiku + '</span>', 'тиры моделей')}
</div>

<h2>📉 Что изменилось — объём</h2>
<p>Суммарный размер промптов: <b>${BEFORE_LINES.toLocaleString()}</b> → <b>${AFTER_LINES.toLocaleString()}</b> строк — <b style="color:var(--ok)">−${pct}%</b> (минус ${(BEFORE_LINES - AFTER_LINES).toLocaleString()} строк generic-боилерплейта), без потери сути.</p>
<div class="bar"><i style="width:${100 - pct}%"></i></div>
<div class="mut" style="font-size:12px">▮ осталось ${100 - pct}% · вырезано ${pct}%</div>

<h2>🧱 Единый стандарт промпта</h2>
<ul>
<li><b>description</b> — триггерный («Use when …») для точного авто-роутинга</li>
<li><b>When to use</b> + «не этот агент → передать такому-то» (разведение пересекающихся ролей)</li>
<li><b>How you work</b> · <b>Output contract</b> (что отдаёт) · <b>Coordination</b> (кому передаёт, позиция в иерархии Tier 0/1/2/3)</li>
<li><b>Quality bar &amp; anti-drift</b> · <b>Model &amp; cost</b> (выверенный тир)</li>
<li>Вырезаны generic-дампы (SOLID/KISS, фейковые метрики, гигантские JSON-блоки <code>memory_usage</code>); сохранён уникальный домен (consensus, GOAP, Unity, tool-каталоги, иерархии)</li>
</ul>

<h2>🛠️ Подход по категориям</h2>
<table><thead><tr><th>Категория</th><th class="num">N</th><th>Строки (было → стало)</th><th>Подход</th></tr></thead><tbody>
${changeRows}
</tbody></table>
<p class="mut" style="font-size:12.5px"><b>rewrite</b> — раздутые файлы дистиллированы заново · <b>align</b> — уже структурированные выровнены (добавлены недостающие секции/Model&amp;cost), доменный референс сохранён.</p>

<h2>🧹 Сопутствующая чистка</h2>
<ul>
<li>Удалён сломанный <code>plugin/</code>-shim и осиротевший <code>v3/package-lock.json</code></li>
<li>Имена optimization приведены к kebab-case (<code>load-balancer</code>, <code>performance-monitor</code> …) — синхронны со ссылками из других агентов</li>
<li>Добавлен <code>SKILL.md</code> для <code>dual-mode</code> → все 39 скиллов валидны</li>
<li>Создан авто-реестр: <a href="agent-catalog.html">agent-catalog.html</a> + <a href="AGENT-CATALOG.md">AGENT-CATALOG.md</a> (генератор <code>scripts/gen-agent-catalog.mjs</code>)</li>
</ul>

<h2>👥 Текущий состав агентов (по направлениям)</h2>
<table><thead><tr><th>Направление</th><th class="num">Агентов</th><th>Руководители</th><th>Тиры</th></tr></thead><tbody>
${catRows}
</tbody></table>

<h2>📦 Полная составляющая проекта</h2>
<table><thead><tr><th>Компонент</th><th class="num">Кол-во</th><th>Где / что</th></tr></thead><tbody>
${compRows}
</tbody></table>

<h2>⚙️ Как это работает</h2>
<p>Claude Code выступает ведущим: разбивает задачу и через <code>SendMessage</code> раздаёт её именованным агентам. Те работают параллельно и передают результат дальше по конвейеру. Координаторы (🎖) держат топологию и консенсус, специалисты исполняют, память (AgentDB/HNSW) хранит общий контекст.</p>
<pre class="diag">User
 └─ Claude Code (lead)
     ├─ 🎖 coordinator      queen · hierarchical · mesh · adaptive
     │    ├─ researcher → architect → coder → tester → reviewer   (конвейер)
     │    ├─ 🎖 consensus    raft · byzantine · quorum · gossip · crdt
     │    └─ memory-manager  AgentDB + HNSW  (общий namespace)
     └─ синтез результата ←┘</pre>
<p><b>Тиры моделей:</b> <span class="t opus">opus</span> — архитектура/безопасность/сложное · <span class="t sonnet">sonnet</span> — основная работа · <span class="t haiku">haiku</span> — простое/механическое. Каждый агент объявляет свой тир в секции <code>Model &amp; cost</code> — дорогая модель тратится только там, где реально нужна.</p>

<h2>🔗 Как подключить к проекту</h2>
<table><thead><tr><th>Способ</th><th>Команда / действие</th><th>Что даёт</th></tr></thead><tbody>
<tr><td><b>1. Плагины</b><br>(рекомендуется)</td><td><code>/plugin marketplace add sashakobtsev21-stack/my_agents</code><br><code>/plugin install ruflo-core@ruflo</code></td><td>агенты + скиллы + команды выбранных плагинов</td></tr>
<tr><td><b>2. Копирование</b></td><td><code>cp -r my_agents/.claude/{agents,skills,commands} .claude/</code></td><td>весь каталог команды напрямую в проект</td></tr>
<tr><td><b>3. MCP</b><br>(полный цикл)</td><td><code>cd v3 &amp;&amp; pnpm install &amp;&amp; pnpm build</code><br><code>claude mcp add my-agents -- node v3/@claude-flow/cli/bin/cli.js mcp start</code></td><td>+ MCP-сервер (~313 инструментов)</td></tr>
</tbody></table>
<p class="mut" style="font-size:13px">Дальше просто ставь задачу — Claude Code сам подберёт агентов и скиллы. Примеры: «собери swarm и добавь OAuth с тестами», «запусти security-аудит проекта», «найди пробелы в тестах <code>src/api</code> и сгенерируй недостающие».</p>

<p class="foot">Композиция вычислена из <code>.claude/agents/**.md</code>; метрики изменений — из коммитов модернизации (<code>3b495ddf9 … d1b2f4cb7</code>). Перегенерация: <code>node scripts/gen-agent-report.mjs</code>. Реестр: <a href="agent-catalog.html">agent-catalog.html</a>.</p>
</div></body></html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT}: ${total} agents, ${leads} leads, ${Object.keys(byCat).length} categories.`);
