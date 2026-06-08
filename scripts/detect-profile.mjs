#!/usr/bin/env node
/**
 * detect-profile.mjs — figure out WHAT KIND of project this is, so the toolkit
 * adapts instead of being universal. Reads dependency + file markers and prints
 * the best-matching profile(s) plus the recommended agent pack.
 *
 * Usage:  node scripts/detect-profile.mjs [path]   (default: cwd)
 *         node scripts/detect-profile.mjs [path] --json
 *
 * Profiles + packs are the machine-readable twin of docs/PROJECT-PROFILES.md and
 * the "Tailored to your projects" section of docs/CORE-AGENTS.md.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) || process.cwd();
const asJson = process.argv.includes('--json');

function read(p) { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return ''; } }
function exists(p) { try { return fs.existsSync(path.join(root, p)); } catch { return false; } }
function lsShallow() {
  try { return fs.readdirSync(root).join('\n'); } catch { return ''; }
}

// Dependency surface (npm + python + name)
const pkg = (() => { try { return JSON.parse(read('package.json') || '{}'); } catch { return {}; } })();
const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }).join(' ').toLowerCase();
const pyDeps = (read('requirements.txt') + read('pyproject.toml') + read('Pipfile')).toLowerCase();
const name = String(pkg.name || path.basename(root)).toLowerCase();
const files = lsShallow().toLowerCase();
const hay = `${deps} ${pyDeps} ${name}`;

const PROFILES = [
  {
    id: 'android-game', label: '🎮 Android / Unity game',
    test: () => (exists('ProjectSettings') && exists('Assets')) || /\bunity\b/.test(hay) || (exists('build.gradle') && /android/.test(read('build.gradle').toLowerCase() + files)) || exists('AndroidManifest.xml'),
    pack: ['game-director', 'game-designer', 'unity-engine-architect', 'gameplay-programmer', 'physics-programmer', 'rendering-engineer', 'vfx-artist', '3d-artist', 'character-animator', 'audio-designer', 'mobile-performance-engineer', 'build-release-engineer', 'game-qa-engineer', 'ui-ux-designer'],
  },
  {
    id: 'web-scraping', label: '🕷️ Web scraping / crawler service',
    test: () => /playwright|puppeteer|cheerio|scrapy|beautifulsoup|bs4|selenium|crawlee|jsdom/.test(hay) || /scrap|crawl|spider/.test(name),
    pack: ['web-scraping-specialist', 'backend-dev', 'data-engineer', 'database-specialist', 'data-analyst', 'debugger', 'incident-responder', 'devops-engineer'],
    plugins: ['ruflo-browser'],
  },
  {
    id: 'web-backend', label: '🔌 Web backend / API',
    test: () => /express|fastify|nestjs|koa|hapi|django|flask|fastapi|gin|actix|spring-boot/.test(hay),
    pack: ['backend-dev', 'database-specialist', 'security-auditor', 'devops-engineer', 'cicd-engineer', 'tester', 'observability-engineer'],
  },
  {
    id: 'web-frontend', label: '🖥️ Web frontend / SPA',
    test: () => /(^|\s)(react|vue|svelte|next|nuxt|angular|solid-js|astro)(\s|$)/.test(' ' + deps + ' '),
    pack: ['frontend-specialist', 'accessibility-specialist', 'ui-ux-designer', 'tester', 'perf-analyzer'],
  },
  {
    id: 'mobile-app', label: '📱 Mobile app (RN / Flutter / native)',
    test: () => /react-native|expo|flutter/.test(hay) || exists('ios') && exists('android') && !exists('Assets'),
    pack: ['mobile-dev', 'mobile-performance-engineer', 'frontend-specialist', 'tester', 'build-release-engineer'],
  },
  {
    id: 'data-ml', label: '📊 Data / ML',
    test: () => /pandas|numpy|scikit|pytorch|tensorflow|jupyter|polars|dask/.test(hay),
    pack: ['ml-developer', 'data-engineer', 'data-analyst', 'database-specialist', 'python-specialist'],
  },
  {
    id: 'cli-library', label: '📦 CLI / library',
    test: () => (pkg.bin || /commander|yargs|clap|cobra|click/.test(hay) || (!!pkg.main && !deps.match(/react|express|next/))),
    pack: ['coder', 'system-architect', 'tester', 'technical-writer', 'reviewer'],
  },
];

const matched = PROFILES.filter((p) => { try { return p.test(); } catch { return false; } });
const core = ['coder', 'reviewer', 'tester', 'planner', 'researcher', 'debugger', 'security-auditor'];

const result = {
  path: root,
  detected: matched.map((m) => ({ id: m.id, label: m.label })),
  primary: matched[0] ? matched[0].label : '❓ generic (no strong signal)',
  recommendedAgents: matched.length ? [...new Set([...core, ...matched.flatMap((m) => m.pack)])] : core,
  recommendedPlugins: [...new Set(matched.flatMap((m) => m.plugins || []))],
  note: matched.length ? 'Use the recommended pack; ignore the Advanced agents (consensus/sublinear/flow-nexus).' : 'No strong signal — ask the user what kind of project this is before picking a pack.',
};

if (asJson) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }

console.log(`\nProject profile for: ${result.path}`);
console.log(`  Primary:   ${result.primary}`);
if (result.detected.length > 1) console.log(`  Also:      ${result.detected.slice(1).map((d) => d.label).join(', ')}`);
console.log(`  Agents:    ${result.recommendedAgents.join(', ')}`);
if (result.recommendedPlugins.length) console.log(`  Plugins:   ${result.recommendedPlugins.join(', ')}`);
console.log(`  Note:      ${result.note}\n`);
