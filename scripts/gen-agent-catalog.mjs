#!/usr/bin/env node
/**
 * Generates docs/AGENT-CATALOG.md — a structured roster of every agent in
 * .claude/agents/, with orchestrators/coordinators ("руководители") pulled out
 * so it's immediately clear who to connect to a task.
 *
 * Run: node scripts/gen-agent-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '.claude/agents';
const OUT = 'docs/AGENT-CATALOG.md';

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
  if (!m) return {};
  const lines = m[1].split('\n');
  const obj = {};
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2];
    if (/^[|>][-+]?\s*$/.test(val.trim())) {
      // YAML block scalar: collect following blank/indented lines
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

const LEAD_RE = /coordinator|orchestrat|manager|queen|hierarchical|mesh|adaptive|consensus|synchroniz|raft|byzantine|gossip|quorum|crdt|sparc-coord|collective|load balanc/i;
const LEAD_CATS = new Set(['swarm', 'hive-mind', 'consensus']);
// Top-of-roster priority (most senior orchestrators first)
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
const TIER = { opus: '🟣 opus', sonnet: '🔵 sonnet', haiku: '🟢 haiku' };

const rows = walk(ROOT).map((f) => {
  const fm = frontmatter(fs.readFileSync(f, 'utf8'));
  const cat = path.relative(ROOT, path.dirname(f)).split(path.sep)[0] || '(root)';
  return {
    cat,
    name: fm.name || path.basename(f, '.md'),
    model: fm.model || '—',
    desc: (fm.description || '').replace(/\|/g, '\\|'),
    isLead: LEAD_RE.test(fm.name || '') || LEAD_CATS.has(cat),
    file: f.replace(/\\/g, '/'),
  };
}).sort((a, b) => a.name.localeCompare(b.name));

const leads = rows.filter((r) => r.isLead).sort((a, b) => {
  const pa = PRIORITY.indexOf(a.name), pb = PRIORITY.indexOf(b.name);
  return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || a.name.localeCompare(b.name);
});

const byCat = {};
for (const r of rows) (byCat[r.cat] ||= []).push(r);

const L = [];
L.push('# 🧭 Каталог агентов — my_agents');
L.push('');
L.push(`> Авто-генерируется из \`${ROOT}/**/*.md\`. Не редактируй вручную — запусти \`node scripts/gen-agent-catalog.mjs\`.`);
L.push(`> Всего агентов: **${rows.length}** в **${Object.keys(byCat).length}** направлениях · из них руководителей: **${leads.length}**.`);
L.push('');
L.push('## Как выбрать агента');
L.push('');
L.push('- **Сложная задача из нескольких шагов?** Подключи **руководителя** (оркестратор/координатор) из таблицы ниже — он соберёт команду и раздаст работу.');
L.push('- **Узкая конкретная задача?** Бери **специалиста** из нужного направления.');
L.push('- **Тиры модели:** 🟣 opus — сложное рассуждение/архитектура/безопасность · 🔵 sonnet — основная работа · 🟢 haiku — простое/механическое.');
L.push('');
L.push('---');
L.push('');
L.push('## 🎖 Оркестраторы, координаторы и руководители');
L.push('');
L.push('Эти агенты управляют другими — координируют swarm, держат консенсус, ведут пайплайны.');
L.push('');
L.push('| Агент | Тир | Направление | Когда подключать |');
L.push('|---|---|---|---|');
for (const r of leads) L.push(`| [\`${r.name}\`](../${r.file}) | ${TIER[r.model] || r.model} | ${CAT_TITLES[r.cat] || r.cat} | ${r.desc} |`);
L.push('');
L.push('---');
L.push('');
L.push('## 👷 Специалисты по направлениям');
L.push('');
const catOrder = Object.keys(byCat).sort((a, b) => byCat[b].length - byCat[a].length);
for (const cat of catOrder) {
  L.push(`### ${CAT_TITLES[cat] || cat} (${byCat[cat].length})`);
  L.push('');
  L.push('| Агент | Тир | Описание |');
  L.push('|---|---|---|');
  for (const r of byCat[cat]) L.push(`| [\`${r.name}\`](../${r.file})${r.isLead ? ' 🎖' : ''} | ${TIER[r.model] || r.model} | ${r.desc} |`);
  L.push('');
}
L.push('---');
L.push('');
L.push('_🎖 = руководитель/координатор. Каталог покрывает `.claude/agents/` (канон). Плагины в `plugins/*/agents/` несут собственных агентов._');
L.push('');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, L.join('\n'));
console.log(`Wrote ${OUT}: ${rows.length} agents, ${leads.length} leads, ${Object.keys(byCat).length} categories.`);
