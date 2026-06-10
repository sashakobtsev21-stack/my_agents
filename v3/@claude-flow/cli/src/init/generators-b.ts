/**
 * Init helper-file generators (part B) — the intelligence stub, the
 * auto-memory hook, the Windows daemon manager + batch wrapper, and the
 * cross-platform session manager.
 *
 * Extracted from helpers-generator.ts (W142, P3.24 cut #2).
 */

export function generateIntelligenceStub(): string {
  const lines = [
    '#!/usr/bin/env node',
    '/**',
    ' * Intelligence Layer Stub (ADR-050)',
    ' * Minimal fallback — full version is copied from package source.',
    ' * Provides: init, getContext, recordEdit, feedback, consolidate',
    ' */',
    "'use strict';",
    '',
    "const fs = require('fs');",
    "const path = require('path');",
    "const os = require('os');",
    '',
    "const DATA_DIR = path.join(process.cwd(), '.claude-flow', 'data');",
    "const STORE_PATH = path.join(DATA_DIR, 'auto-memory-store.json');",
    "const RANKED_PATH = path.join(DATA_DIR, 'ranked-context.json');",
    "const PENDING_PATH = path.join(DATA_DIR, 'pending-insights.jsonl');",
    "const SESSION_DIR = path.join(process.cwd(), '.claude-flow', 'sessions');",
    "const SESSION_FILE = path.join(SESSION_DIR, 'current.json');",
    '',
    'function ensureDir(dir) {',
    '  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });',
    '}',
    '',
    'function readJSON(p) {',
    '  try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null; }',
    '  catch { return null; }',
    '}',
    '',
    'function writeJSON(p, data) {',
    '  ensureDir(path.dirname(p));',
    '  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");',
    '}',
    '',
    '// Read session context key',
    'function sessionGet(key) {',
    '  var session = readJSON(SESSION_FILE);',
    '  if (!session) return null;',
    '  return key ? (session.context || {})[key] : session.context;',
    '}',
    '',
    '// Write session context key',
    'function sessionSet(key, value) {',
    '  var session = readJSON(SESSION_FILE);',
    '  if (!session) return;',
    '  if (!session.context) session.context = {};',
    '  session.context[key] = value;',
    '  writeJSON(SESSION_FILE, session);',
    '}',
    '',
    '// Tokenize text into words',
    'function tokenize(text) {',
    '  if (!text) return [];',
    '  return text.toLowerCase().replace(/[^a-z0-9\\s]/g, " ").split(/\\s+/).filter(function(w) { return w.length > 2; });',
    '}',
    '',
    '// Bootstrap entries from MEMORY.md files when store is empty',
    'function bootstrapFromMemoryFiles() {',
    '  var entries = [];',
    '  var candidates = [',
    '    path.join(os.homedir(), ".claude", "projects"),',
    '    path.join(process.cwd(), ".claude-flow", "memory"),',
    '    path.join(process.cwd(), ".claude", "memory"),',
    '  ];',
    '  for (var i = 0; i < candidates.length; i++) {',
    '    try {',
    '      if (!fs.existsSync(candidates[i])) continue;',
    '      var files = [];',
    '      try {',
    '        var items = fs.readdirSync(candidates[i], { withFileTypes: true, recursive: true });',
    '        for (var j = 0; j < items.length; j++) {',
    '          if (items[j].name === "MEMORY.md") {',
    '            var parentDir = items[j].parentPath || items[j].path || candidates[i];',
    '            var fp = path.join(parentDir, items[j].name);',
    '            files.push(fp);',
    '          }',
    '        }',
    '      } catch (e) { continue; }',
    '      for (var k = 0; k < files.length; k++) {',
    '        try {',
    '          var content = fs.readFileSync(files[k], "utf-8");',
    '          var sections = content.split(/^##\\s+/m).filter(function(s) { return s.trim().length > 20; });',
    '          for (var s = 0; s < sections.length; s++) {',
    '            var lines2 = sections[s].split("\\n");',
    '            var title = lines2[0] ? lines2[0].trim() : "section-" + s;',
    '            entries.push({',
    '              id: "mem-" + entries.length,',
    '              content: sections[s].substring(0, 500),',
    '              summary: title.substring(0, 100),',
    '              category: "memory",',
    '              confidence: 0.5,',
    '              sourceFile: files[k],',
    '              words: tokenize(sections[s].substring(0, 500)),',
    '            });',
    '          }',
    '        } catch (e) { /* skip */ }',
    '      }',
    '    } catch (e) { /* skip */ }',
    '  }',
    '  return entries;',
    '}',
    '',
    '// Load entries from auto-memory-store or bootstrap from MEMORY.md',
    'function loadEntries() {',
    '  var store = readJSON(STORE_PATH);',
    '  // Support both formats: flat array or { entries: [...] }',
    '  var entries = null;',
    '  if (store) {',
    '    if (Array.isArray(store) && store.length > 0) {',
    '      entries = store;',
    '    } else if (store.entries && store.entries.length > 0) {',
    '      entries = store.entries;',
    '    }',
    '  }',
    '  if (entries) {',
    '    return entries.map(function(e, i) {',
    '      return {',
    '        id: e.id || ("entry-" + i),',
    '        content: e.content || e.value || "",',
    '        summary: e.summary || e.key || "",',
    '        category: e.category || e.namespace || "default",',
    '        confidence: e.confidence || 0.5,',
    '        sourceFile: e.sourceFile || (e.metadata && e.metadata.sourceFile) || "",',
    '        words: tokenize((e.content || e.value || "") + " " + (e.summary || e.key || "")),',
    '      };',
    '    });',
    '  }',
    '  return bootstrapFromMemoryFiles();',
    '}',
    '',
    '// Simple keyword match score',
    'function matchScore(promptWords, entryWords) {',
    '  if (!promptWords.length || !entryWords.length) return 0;',
    '  var entrySet = {};',
    '  for (var i = 0; i < entryWords.length; i++) entrySet[entryWords[i]] = true;',
    '  var overlap = 0;',
    '  for (var j = 0; j < promptWords.length; j++) {',
    '    if (entrySet[promptWords[j]]) overlap++;',
    '  }',
    '  var union = Object.keys(entrySet).length + promptWords.length - overlap;',
    '  return union > 0 ? overlap / union : 0;',
    '}',
    '',
    'var cachedEntries = null;',
    '',
    'module.exports = {',
    '  init: function() {',
    '    cachedEntries = loadEntries();',
    '    var ranked = cachedEntries.map(function(e) {',
    '      return { id: e.id, content: e.content, summary: e.summary, category: e.category, confidence: e.confidence, words: e.words };',
    '    });',
    '    writeJSON(RANKED_PATH, { version: 1, computedAt: Date.now(), entries: ranked });',
    '    return { nodes: cachedEntries.length, edges: 0 };',
    '  },',
    '',
    '  getContext: function(prompt) {',
    '    if (!prompt) return null;',
    '    var ranked = readJSON(RANKED_PATH);',
    '    var entries = (ranked && ranked.entries) || (cachedEntries || []);',
    '    if (!entries.length) return null;',
    '    var promptWords = tokenize(prompt);',
    '    if (!promptWords.length) return null;',
    '    var scored = entries.map(function(e) {',
    '      return { entry: e, score: matchScore(promptWords, e.words || tokenize(e.content + " " + e.summary)) };',
    '    }).filter(function(s) { return s.score > 0.05; });',
    '    scored.sort(function(a, b) { return b.score - a.score; });',
    '    var top = scored.slice(0, 5);',
    '    if (!top.length) return null;',
    '    var prevMatched = sessionGet("lastMatchedPatterns");',
    '    var matchedIds = top.map(function(s) { return s.entry.id; });',
    '    sessionSet("lastMatchedPatterns", matchedIds);',
    '    if (prevMatched && Array.isArray(prevMatched)) {',
    '      var newSet = {};',
    '      for (var i = 0; i < matchedIds.length; i++) newSet[matchedIds[i]] = true;',
    '    }',
    '    var lines2 = ["[INTELLIGENCE] Relevant patterns for this task:"];',
    '    for (var j = 0; j < top.length; j++) {',
    '      var e = top[j];',
    '      var conf = e.entry.confidence || 0.5;',
    '      var summary = (e.entry.summary || e.entry.content || "").substring(0, 80);',
    '      lines2.push("  * (" + conf.toFixed(2) + ") " + summary);',
    '    }',
    '    return lines2.join("\\n");',
    '  },',
    '',
    '  recordEdit: function(file) {',
    '    if (!file) return;',
    '    ensureDir(DATA_DIR);',
    '    var line = JSON.stringify({ type: "edit", file: file, timestamp: Date.now() }) + "\\n";',
    '    fs.appendFileSync(PENDING_PATH, line, "utf-8");',
    '  },',
    '',
    '  feedback: function(success) {',
    '    // Stub: no-op in minimal version',
    '  },',
    '',
    '  consolidate: function() {',
    '    var count = 0;',
    '    if (fs.existsSync(PENDING_PATH)) {',
    '      try {',
    '        var content = fs.readFileSync(PENDING_PATH, "utf-8").trim();',
    '        count = content ? content.split("\\n").length : 0;',
    '        fs.writeFileSync(PENDING_PATH, "", "utf-8");',
    '      } catch (e) { /* skip */ }',
    '    }',
    '    return { entries: count, edges: 0, newEntries: 0 };',
    '  },',
    '};',
  ];
  return lines.join('\n') + '\n';
}

/**
 * Generate a minimal auto-memory-hook.mjs fallback for fresh installs.
 * This ESM script handles import/sync/status commands gracefully when
 * @claude-flow/memory is not installed. Gets overwritten when source copy succeeds.
 */
export function generateAutoMemoryHook(): string {
  return `#!/usr/bin/env node
/**
 * Auto Memory Bridge Hook (ADR-048/049) — Minimal Fallback
 * Full version is copied from package source when available.
 *
 * Usage:
 *   node auto-memory-hook.mjs import   # SessionStart
 *   node auto-memory-hook.mjs sync     # SessionEnd / Stop
 *   node auto-memory-hook.mjs status   # Show bridge status
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const DATA_DIR = join(PROJECT_ROOT, '.claude-flow', 'data');
const STORE_PATH = join(DATA_DIR, 'auto-memory-store.json');

const DIM = '\\x1b[2m';
const RESET = '\\x1b[0m';
const dim = (msg) => console.log(\`  \${DIM}\${msg}\${RESET}\`);

// Ensure data dir
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

async function loadMemoryPackage() {
  // Strategy 1: Use createRequire for CJS-style resolution (handles nested node_modules
  // when installed as a transitive dependency via npx ruflo / npx claude-flow)
  try {
    const { createRequire } = await import('module');
    const require = createRequire(join(PROJECT_ROOT, 'package.json'));
    return require('@claude-flow/memory');
  } catch { /* fall through */ }

  // Strategy 2: ESM import (works when @claude-flow/memory is a direct dependency)
  try { return await import('@claude-flow/memory'); } catch { /* fall through */ }

  // Strategy 3: Walk up from PROJECT_ROOT looking for the package in any node_modules
  let searchDir = PROJECT_ROOT;
  const { parse } = await import('path');
  while (searchDir !== parse(searchDir).root) {
    const candidate = join(searchDir, 'node_modules', '@claude-flow', 'memory', 'dist', 'index.js');
    if (existsSync(candidate)) {
      try { return await import(\`file://\${candidate}\`); } catch { /* fall through */ }
    }
    searchDir = dirname(searchDir);
  }

  return null;
}

async function doImport() {
  const memPkg = await loadMemoryPackage();

  if (!memPkg || !memPkg.AutoMemoryBridge) {
    dim('Memory package not available — auto memory import skipped (non-critical)');
    return;
  }

  // Full implementation deferred to copied version
  dim('Auto memory import available — run init --upgrade for full support');
}

async function doSync() {
  if (!existsSync(STORE_PATH)) {
    dim('No entries to sync');
    return;
  }

  const memPkg = await loadMemoryPackage();

  if (!memPkg || !memPkg.AutoMemoryBridge) {
    dim('Memory package not available — sync skipped (non-critical)');
    return;
  }

  dim('Auto memory sync available — run init --upgrade for full support');
}

function doStatus() {
  console.log('\\n=== Auto Memory Bridge Status ===\\n');
  console.log('  Package:        Fallback mode (run init --upgrade for full)');
  console.log(\`  Store:          \${existsSync(STORE_PATH) ? 'Initialized' : 'Not initialized'}\`);
  console.log('');
}

// Suppress unhandled rejection warnings from dynamic import() failures
process.on('unhandledRejection', () => {});

const command = process.argv[2] || 'status';

try {
  switch (command) {
    case 'import': await doImport(); break;
    case 'sync': await doSync(); break;
    case 'status': doStatus(); break;
    default:
      console.log('Usage: auto-memory-hook.mjs <import|sync|status>');
      process.exit(1);
  }
} catch (err) {
  // Hooks must never crash Claude Code - fail silently
  dim(\`Error (non-critical): \${err.message}\`);
}
// Ensure clean exit for Claude Code hooks (exit 0 = success)
process.exit(0);
`;
}

/**
 * Generate Windows PowerShell daemon manager
 */
export function generateWindowsDaemonManager(): string {
  return `# AlexKo V3 Daemon Manager for Windows
# PowerShell script for managing background processes

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'status', 'restart')]
    [string]$Action = 'status'
)

$ErrorActionPreference = 'SilentlyContinue'
$ClaudeFlowDir = Join-Path $PWD '.claude-flow'
$PidDir = Join-Path $ClaudeFlowDir 'pids'

# Ensure directories exist
if (-not (Test-Path $PidDir)) {
    New-Item -ItemType Directory -Path $PidDir -Force | Out-Null
}

function Get-DaemonStatus {
    param([string]$Name, [string]$PidFile)

    if (Test-Path $PidFile) {
        $pid = Get-Content $PidFile
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            return @{ Running = $true; Pid = $pid }
        }
    }
    return @{ Running = $false; Pid = $null }
}

function Start-SwarmMonitor {
    $pidFile = Join-Path $PidDir 'swarm-monitor.pid'
    $status = Get-DaemonStatus -Name 'swarm-monitor' -PidFile $pidFile

    if ($status.Running) {
        Write-Host "Swarm monitor already running (PID: $($status.Pid))" -ForegroundColor Yellow
        return
    }

    Write-Host "Starting swarm monitor..." -ForegroundColor Cyan
    $process = Start-Process -FilePath 'node' -ArgumentList @(
        '-e',
        'setInterval(() => { require("fs").writeFileSync(".claude-flow/metrics/swarm-activity.json", JSON.stringify({swarm:{active:true,agent_count:0},timestamp:Date.now()})) }, 5000)'
    ) -PassThru -WindowStyle Hidden

    $process.Id | Out-File $pidFile
    Write-Host "Swarm monitor started (PID: $($process.Id))" -ForegroundColor Green
}

function Stop-SwarmMonitor {
    $pidFile = Join-Path $PidDir 'swarm-monitor.pid'
    $status = Get-DaemonStatus -Name 'swarm-monitor' -PidFile $pidFile

    if (-not $status.Running) {
        Write-Host "Swarm monitor not running" -ForegroundColor Yellow
        return
    }

    Stop-Process -Id $status.Pid -Force
    Remove-Item $pidFile -Force
    Write-Host "Swarm monitor stopped" -ForegroundColor Green
}

function Show-Status {
    Write-Host ""
    Write-Host "AlexKo V3 Daemon Status" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan

    $swarmPid = Join-Path $PidDir 'swarm-monitor.pid'
    $swarmStatus = Get-DaemonStatus -Name 'swarm-monitor' -PidFile $swarmPid

    if ($swarmStatus.Running) {
        Write-Host "  Swarm Monitor: RUNNING (PID: $($swarmStatus.Pid))" -ForegroundColor Green
    } else {
        Write-Host "  Swarm Monitor: STOPPED" -ForegroundColor Red
    }
    Write-Host ""
}

switch ($Action) {
    'start' {
        Start-SwarmMonitor
        Show-Status
    }
    'stop' {
        Stop-SwarmMonitor
        Show-Status
    }
    'restart' {
        Stop-SwarmMonitor
        Start-Sleep -Seconds 1
        Start-SwarmMonitor
        Show-Status
    }
    'status' {
        Show-Status
    }
}
`;
}

/**
 * Generate Windows batch file wrapper
 */
export function generateWindowsBatchWrapper(): string {
  return `@echo off
REM AlexKo V3 - Windows Batch Wrapper
REM Routes to PowerShell daemon manager

PowerShell -ExecutionPolicy Bypass -File "%~dp0daemon-manager.ps1" %*
`;
}

/**
 * Generate cross-platform session manager
 */
export function generateCrossPlatformSessionManager(): string {
  return `#!/usr/bin/env node
/**
 * Ruflo Cross-Platform Session Manager
 * Works on Windows, macOS, and Linux
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Platform-specific paths
const platform = os.platform();
const homeDir = os.homedir();

// Get data directory based on platform
function getDataDir() {
  const localDir = path.join(process.cwd(), '.claude-flow', 'sessions');
  if (fs.existsSync(path.dirname(localDir))) {
    return localDir;
  }

  switch (platform) {
    case 'win32':
      return path.join(process.env.APPDATA || homeDir, 'claude-flow', 'sessions');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'claude-flow', 'sessions');
    default:
      return path.join(homeDir, '.claude-flow', 'sessions');
  }
}

const SESSION_DIR = getDataDir();
const SESSION_FILE = path.join(SESSION_DIR, 'current.json');

// Ensure directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const commands = {
  start: () => {
    ensureDir(SESSION_DIR);
    const sessionId = \`session-\${Date.now()}\`;
    const session = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      platform: platform,
      cwd: process.cwd(),
      context: {},
      metrics: { edits: 0, commands: 0, tasks: 0, errors: 0 }
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log(\`Session started: \${sessionId}\`);
    return session;
  },

  restore: () => {
    if (!fs.existsSync(SESSION_FILE)) {
      console.log('No session to restore');
      return null;
    }
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    session.restoredAt = new Date().toISOString();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log(\`Session restored: \${session.id}\`);
    return session;
  },

  end: () => {
    if (!fs.existsSync(SESSION_FILE)) {
      console.log('No active session');
      return null;
    }
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    session.endedAt = new Date().toISOString();
    session.duration = Date.now() - new Date(session.startedAt).getTime();

    const archivePath = path.join(SESSION_DIR, \`\${session.id}.json\`);
    fs.writeFileSync(archivePath, JSON.stringify(session, null, 2));
    fs.unlinkSync(SESSION_FILE);

    console.log(\`Session ended: \${session.id}\`);
    console.log(\`Duration: \${Math.round(session.duration / 1000 / 60)} minutes\`);
    return session;
  },

  status: () => {
    if (!fs.existsSync(SESSION_FILE)) {
      console.log('No active session');
      return null;
    }
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    const duration = Date.now() - new Date(session.startedAt).getTime();
    console.log(\`Session: \${session.id}\`);
    console.log(\`Platform: \${session.platform}\`);
    console.log(\`Started: \${session.startedAt}\`);
    console.log(\`Duration: \${Math.round(duration / 1000 / 60)} minutes\`);
    return session;
  }
};

// CLI
const [,, command, ...args] = process.argv;
if (command && commands[command]) {
  commands[command](...args);
} else {
  console.log('Usage: session.js <start|restore|end|status>');
  console.log(\`Platform: \${platform}\`);
  console.log(\`Data dir: \${SESSION_DIR}\`);
}

module.exports = commands;
`;
}

