#!/usr/bin/env node
/**
 * Generates a roster of every agent in .claude/agents/:
 *   - docs/AGENT-CATALOG.md   (markdown, for GitHub)
 *   - docs/agent-catalog.html (standalone visual page: stats, leads, filters, search)
 *
 * Orchestrators/coordinators ("руководители") are pulled out so it's immediately
 * clear who to connect to a task. Modernized agents are flagged ✓.
 *
 * Run: node scripts/gen-agent-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '.claude/agents';
const OUT_MD = 'docs/AGENT-CATALOG.md';
const OUT_HTML = 'docs/agent-catalog.html';

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.md') && e.name !== 'CATALOG.md') out.push(p);
  }
  return out;
}

function frontmatter(text) {
  text = text.replace(/\r\n?/g, '\n'); // normalize CRLF
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return { name: '', description: '', model: '' };
  const lines = m[1].split('\n');
  const obj = {};
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2];
    if (/^[|>][-+]?\s*$/.test(val.trim())) {
      const buf = [];
      let j = i + 1;
      while (j < lines.length && (lines[j] === '' || /^\s/.test(lines[j]))) { buf.push(lines[j].trim()); j++; }
      val = buf.join(' ').trim();
      i = j - 1;
    } else {
      val = val.replace(/^["']|["']$/g, '').trim();
    }
    obj[key] = val.replace(/\s+/g, ' ').trim();
  }
  return { name: obj.name || '', description: obj.description || '', model: obj.model || '' };
}

const LEAD_RE = /coordinator|orchestrat|manager|queen|hierarchical|mesh|adaptive|consensus|synchroniz|raft|byzantine|gossip|quorum|crdt|sparc-coord|collective|director/i;
const LEAD_CATS = new Set(['swarm', 'hive-mind', 'consensus']);
const MODERN_RE = /^##\s*Model & cost/m; // marker of the modernized prompt standard
const PRIORITY = ['queen-coordinator', 'v3-queen-coordinator', 'collective-intelligence-coordinator',
  'project-coordinator', 'dual-orchestrator', 'task-orchestrator', 'sparc-coord',
  'adaptive-coordinator', 'hierarchical-coordinator', 'mesh-coordinator'];

const CAT_TITLES = {
  core: 'Core (разработка)', github: 'GitHub', consensus: 'Consensus / распределённые',
  'hive-mind': 'Hive-Mind', swarm: 'Swarm (топологии)', 'game-dev': 'Game Dev (Unity / 3D mobile)',
  sparc: 'SPARC', optimization: 'Optimization / Performance', 'flow-nexus': 'Flow-Nexus (облако)',
  'dual-mode': 'Dual-Mode (Claude + Codex)', sublinear: 'Sublinear', development: 'Development',
  devops: 'DevOps', data: 'Data', testing: 'Testing', analysis: 'Analysis', goal: 'Goal / GOAP',
  neural: 'Neural', reasoning: 'Reasoning', sona: 'SONA', documentation: 'Documentation',
  architecture: 'Architecture', payments: 'Payments', specialized: 'Specialized', custom: 'Custom',
  templates: 'Templates', v3: 'V3', '(root)': 'Прочие',
};
const TIER_MD = { opus: '🟣 opus', sonnet: '🔵 sonnet', haiku: '🟢 haiku' };

const rows = walk(ROOT).map((f) => {
  const text = fs.readFileSync(f, 'utf8');
  const fm = frontmatter(text);
  const cat = path.relative(ROOT, path.dirname(f)).split(path.sep)[0] || '(root)';
  return {
    cat,
    name: fm.name || path.basename(f, '.md'),
    model: fm.model || '—',
    desc: (fm.description || '').trim(),
    isLead: LEAD_RE.test(fm.name || '') || LEAD_CATS.has(cat),
    modernized: MODERN_RE.test(text.replace(/\r/g, '')),
    file: f.replace(/\\/g, '/'),
  };
}).sort((a, b) => a.name.localeCompare(b.name));

const leads = rows.filter((r) => r.isLead).sort((a, b) => {
  const pa = PRIORITY.indexOf(a.name), pb = PRIORITY.indexOf(b.name);
  return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || a.name.localeCompare(b.name);
});
const byCat = {};
for (const r of rows) (byCat[r.cat] ||= []).push(r);
const catOrder = Object.keys(byCat).sort((a, b) => byCat[b].length - byCat[a].length);
const modernCount = rows.filter((r) => r.modernized).length;
const tierCount = { opus: 0, sonnet: 0, haiku: 0 };
for (const r of rows) if (tierCount[r.model] !== undefined) tierCount[r.model]++;

// ---------- Markdown ----------
const M = [];
M.push('# 🧭 Каталог агентов — my_agents', '');
M.push(`> Авто-генерируется из \`${ROOT}/**/*.md\`. Не редактируй вручную — \`node scripts/gen-agent-catalog.mjs\`.`);
M.push(`> Агентов: **${rows.length}** · направлений: **${catOrder.length}** · руководителей: **${leads.length}** · модернизировано: **${modernCount}/${rows.length}**.`, '');
M.push('## Как выбрать агента', '');
M.push('- **Сложная многошаговая задача?** Подключи **руководителя** (оркестратор/координатор) — он соберёт команду и раздаст работу.');
M.push('- **Узкая задача?** Бери **специалиста** из направления.');
M.push('- **Тиры:** 🟣 opus — сложное/архитектура/безопасность · 🔵 sonnet — основное · 🟢 haiku — простое.', '', '---', '');
M.push('## 🎖 Оркестраторы, координаторы и руководители', '');
M.push('| Агент | Тир | Направление | Когда подключать |', '|---|---|---|---|');
for (const r of leads) M.push(`| [\`${r.name}\`](../${r.file}) | ${TIER_MD[r.model] || r.model} | ${CAT_TITLES[r.cat] || r.cat} | ${r.desc.replace(/\|/g, '\\|')} |`);
M.push('', '---', '', '## 👷 Специалисты по направлениям', '');
for (const cat of catOrder) {
  M.push(`### ${CAT_TITLES[cat] || cat} (${byCat[cat].length})`, '');
  M.push('| Агент | Тир | Описание |', '|---|---|---|');
  for (const r of byCat[cat]) M.push(`| [\`${r.name}\`](../${r.file})${r.isLead ? ' 🎖' : ''}${r.modernized ? ' ✓' : ''} | ${TIER_MD[r.model] || r.model} | ${r.desc.replace(/\|/g, '\\|')} |`);
  M.push('');
}
M.push('---', '', '_🎖 = руководитель · ✓ = промпт модернизирован. Каталог покрывает `.claude/agents/`; плагины несут собственных агентов в `plugins/*/agents/`._', '');
fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
fs.writeFileSync(OUT_MD, M.join('\n'));

// ---------- HTML ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tierBadge = (m) => `<span class="tier ${m}">${esc(m)}</span>`;
function agentRow(r) {
  return `<tr class="agent" data-name="${esc(r.name.toLowerCase())}" data-desc="${esc(r.desc.toLowerCase())}" data-cat="${esc((CAT_TITLES[r.cat] || r.cat).toLowerCase())}" data-tier="${esc(r.model)}" data-lead="${r.isLead ? 1 : 0}" data-modern="${r.modernized ? 1 : 0}">`
    + `<td class="nm"><code>${esc(r.name)}</code>${r.isLead ? ' <span title="руководитель">🎖</span>' : ''}${r.modernized ? ' <span class="ok" title="модернизирован">✓</span>' : ''}</td>`
    + `<td>${tierBadge(r.model)}</td><td class="area">${esc(CAT_TITLES[r.cat] || r.cat)}</td><td class="desc">${esc(r.desc)}</td></tr>`;
}
const leadRows = leads.map(agentRow).join('\n');
let allGroups = '';
for (const cat of catOrder) {
  allGroups += `<tbody class="catgroup"><tr class="cathead"><td colspan="4">${esc(CAT_TITLES[cat] || cat)} <span class="cnt">${byCat[cat].length}</span></td></tr>\n`
    + byCat[cat].map(agentRow).join('\n') + '</tbody>\n';
}
const stat = (n, l) => `<div class="card"><div class="n">${n}</div><div class="l">${l}</div></div>`;
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>my_agents — реестр агентов</title>
<style>
:root{--bg:#0d1117;--panel:#161b22;--line:#283040;--fg:#e6edf3;--mut:#9aa7b4;--gold:#e3b341;--opus:#a371f7;--sonnet:#4493f8;--haiku:#3fb950}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:28px 20px 60px}
h1{font-size:26px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 20px}
.cards{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:96px}
.card .n{font-size:24px;font-weight:700}.card .l{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.controls{position:sticky;top:0;background:var(--bg);padding:12px 0;display:flex;flex-wrap:wrap;gap:10px;align-items:center;border-bottom:1px solid var(--line);z-index:5}
input#q{flex:1;min-width:220px;background:var(--panel);border:1px solid var(--line);color:var(--fg);border-radius:8px;padding:9px 12px;font-size:14px}
.btn{background:var(--panel);border:1px solid var(--line);color:var(--fg);border-radius:8px;padding:7px 11px;cursor:pointer;font-size:13px}
.btn.on{border-color:var(--sonnet);color:#fff;background:#1c2c44}
label.tog{display:flex;gap:6px;align-items:center;color:var(--mut);font-size:13px;cursor:pointer}
h2{font-size:18px;margin:26px 0 10px;border-left:3px solid var(--gold);padding-left:10px}
h2.all{border-left-color:var(--sonnet)}
table{width:100%;border-collapse:collapse;font-size:14px}
th{ text-align:left;color:var(--mut);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em;padding:8px 8px;border-bottom:1px solid var(--line)}
td{padding:8px 8px;border-bottom:1px solid var(--line);vertical-align:top}
tr.agent:hover{background:#11161d}
code{background:#1f2630;border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:13px;color:#cdd9e5}
.tier{font-size:12px;border-radius:20px;padding:2px 9px;border:1px solid}
.tier.opus{color:var(--opus);border-color:var(--opus)}.tier.sonnet{color:var(--sonnet);border-color:var(--sonnet)}.tier.haiku{color:var(--haiku);border-color:var(--haiku)}
.tier.—{color:var(--mut);border-color:var(--line)}
.area{color:var(--mut);white-space:nowrap}.desc{color:#c9d4df}.nm{white-space:nowrap}.ok{color:var(--haiku);font-weight:700}
tr.cathead td{background:#11161d;font-weight:700;color:#fff;border-top:1px solid var(--line)}
.cnt{color:var(--mut);font-weight:400;font-size:12px}
.lead-tbl{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.foot{color:var(--mut);font-size:12px;margin-top:24px}
</style></head><body><div class="wrap">
<h1>🧭 my_agents — реестр агентов</h1>
<p class="sub">Сразу видно структуру команды: кто <b>руководит</b> (оркестраторы/координаторы) и кто <b>исполняет</b>. 🎖 руководитель · <span class="ok">✓</span> промпт модернизирован.</p>
<div class="cards">${stat(rows.length, 'агентов')}${stat(leads.length, 'руководителей')}${stat(catOrder.length, 'направлений')}${stat(modernCount + ' / ' + rows.length, 'модернизировано')}${stat('<span class="tier opus">' + tierCount.opus + '</span> <span class="tier sonnet">' + tierCount.sonnet + '</span> <span class="tier haiku">' + tierCount.haiku + '</span>', 'opus / sonnet / haiku')}</div>
<div class="controls">
<input id="q" placeholder="Поиск по имени, описанию, направлению…" autocomplete="off">
<button class="btn on" data-tier-btn="all">все</button>
<button class="btn" data-tier-btn="opus">opus</button>
<button class="btn" data-tier-btn="sonnet">sonnet</button>
<button class="btn" data-tier-btn="haiku">haiku</button>
<label class="tog"><input type="checkbox" id="leadOnly"> только руководители</label>
<label class="tog"><input type="checkbox" id="modOnly"> только модернизированные</label>
</div>
<h2>🎖 Оркестраторы, координаторы и руководители</h2>
<div class="lead-tbl"><table class="agents"><thead><tr><th>Агент</th><th>Тир</th><th>Направление</th><th>Когда подключать</th></tr></thead><tbody>${leadRows}</tbody></table></div>
<h2 class="all">👷 Все агенты по направлениям</h2>
<table class="agents"><thead><tr><th>Агент</th><th>Тир</th><th>Направление</th><th>Описание</th></tr></thead>
${allGroups}</table>
<p class="foot">Авто-генерируется из <code>.claude/agents/**/*.md</code> — <code>node scripts/gen-agent-catalog.mjs</code>. Плагины несут собственных агентов в <code>plugins/*/agents/</code>.</p>
</div>
<script>
(function(){
  var q=document.getElementById('q'),tier='all',leadOnly=false,modOnly=false;
  function apply(){
    var t=(q.value||'').toLowerCase();
    document.querySelectorAll('table.agents tr.agent').forEach(function(tr){
      var ok=(tr.dataset.name.indexOf(t)>=0||tr.dataset.desc.indexOf(t)>=0||tr.dataset.cat.indexOf(t)>=0);
      if(tier!=='all'&&tr.dataset.tier!==tier)ok=false;
      if(leadOnly&&tr.dataset.lead!=='1')ok=false;
      if(modOnly&&tr.dataset.modern!=='1')ok=false;
      tr.style.display=ok?'':'none';
    });
    document.querySelectorAll('tbody.catgroup').forEach(function(tb){
      var any=Array.prototype.some.call(tb.querySelectorAll('tr.agent'),function(x){return x.style.display!=='none';});
      tb.style.display=any?'':'none';
    });
  }
  q.addEventListener('input',apply);
  document.querySelectorAll('[data-tier-btn]').forEach(function(b){b.addEventListener('click',function(){tier=b.getAttribute('data-tier-btn');document.querySelectorAll('[data-tier-btn]').forEach(function(x){x.classList.remove('on');});b.classList.add('on');apply();});});
  document.getElementById('leadOnly').addEventListener('change',function(e){leadOnly=e.target.checked;apply();});
  document.getElementById('modOnly').addEventListener('change',function(e){modOnly=e.target.checked;apply();});
})();
</script>
</body></html>`;
fs.writeFileSync(OUT_HTML, html);

console.log(`Wrote ${OUT_MD} and ${OUT_HTML}: ${rows.length} agents, ${leads.length} leads, ${catOrder.length} categories, ${modernCount} modernized.`);
