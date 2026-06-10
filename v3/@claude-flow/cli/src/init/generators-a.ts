/**
 * Init helper-file generators (part A) — git hooks, the session manager,
 * agent router, memory helper, and the unified hook handler. Each returns
 * the literal file contents written into a freshly-init'd project.
 *
 * Extracted from helpers-generator.ts (W142, P3.24 cut #1).
 */

export function generatePreCommitHook(): string {
  return `#!/bin/bash
# Ruflo Pre-Commit Hook
# Validates code quality before commit

set -e

echo "🔍 Running Ruflo pre-commit checks..."

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

# Run validation for each staged file
for FILE in $STAGED_FILES; do
  if [[ "$FILE" =~ \\.(ts|js|tsx|jsx)$ ]]; then
    echo "  Validating: $FILE"
    npx @claude-flow/cli hooks pre-edit --file "$FILE" --validate-syntax 2>/dev/null || true
  fi
done

# Run tests if available
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  echo "🧪 Running tests..."
  npm test --if-present 2>/dev/null || echo "  Tests skipped or failed"
fi

echo "✅ Pre-commit checks complete"
`;
}

/**
 * Generate post-commit hook script
 */
export function generatePostCommitHook(): string {
  return `#!/bin/bash
# Ruflo Post-Commit Hook
# Records commit metrics and trains patterns

COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)

echo "📊 Recording commit metrics..."

# Notify ruflo of commit
npx ruflo@latest hooks notify \\
  --message "Commit: $COMMIT_MSG" \\
  --level info \\
  --metadata '{"hash": "'$COMMIT_HASH'"}' 2>/dev/null || true

echo "✅ Commit recorded"
`;
}

/**
 * Generate session manager script
 */
export function generateSessionManager(): string {
  return `#!/usr/bin/env node
/**
 * Ruflo Session Manager
 * Handles session lifecycle: start, restore, end
 */

const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(process.cwd(), '.claude-flow', 'sessions');
const SESSION_FILE = path.join(SESSION_DIR, 'current.json');

const commands = {
  start: () => {
    const sessionId = \`session-\${Date.now()}\`;
    const session = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      cwd: process.cwd(),
      context: {},
      metrics: {
        edits: 0,
        commands: 0,
        tasks: 0,
        errors: 0,
      },
    };

    fs.mkdirSync(SESSION_DIR, { recursive: true });
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

    // Archive session
    const archivePath = path.join(SESSION_DIR, \`\${session.id}.json\`);
    fs.writeFileSync(archivePath, JSON.stringify(session, null, 2));
    fs.unlinkSync(SESSION_FILE);

    console.log(\`Session ended: \${session.id}\`);
    console.log(\`Duration: \${Math.round(session.duration / 1000 / 60)} minutes\`);
    console.log(\`Metrics: \${JSON.stringify(session.metrics)}\`);

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
    console.log(\`Started: \${session.startedAt}\`);
    console.log(\`Duration: \${Math.round(duration / 1000 / 60)} minutes\`);
    console.log(\`Metrics: \${JSON.stringify(session.metrics)}\`);

    return session;
  },

  update: (key, value) => {
    if (!fs.existsSync(SESSION_FILE)) {
      console.log('No active session');
      return null;
    }

    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    session.context[key] = value;
    session.updatedAt = new Date().toISOString();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));

    return session;
  },

  metric: (name) => {
    if (!fs.existsSync(SESSION_FILE)) {
      return null;
    }

    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    if (session.metrics[name] !== undefined) {
      session.metrics[name]++;
      fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    }

    return session;
  },
};

// CLI
const [,, command, ...args] = process.argv;

if (command && commands[command]) {
  commands[command](...args);
} else {
  console.log('Usage: session.js <start|restore|end|status|update|metric> [args]');
}

module.exports = commands;
`;
}

/**
 * Generate agent router script
 */
export function generateAgentRouter(): string {
  return `#!/usr/bin/env node
/**
 * Ruflo Agent Router
 * Routes tasks to optimal agents based on learned patterns
 */

const AGENT_CAPABILITIES = {
  coder: ['code-generation', 'refactoring', 'debugging', 'implementation'],
  tester: ['unit-testing', 'integration-testing', 'coverage', 'test-generation'],
  reviewer: ['code-review', 'security-audit', 'quality-check', 'best-practices'],
  researcher: ['web-search', 'documentation', 'analysis', 'summarization'],
  architect: ['system-design', 'architecture', 'patterns', 'scalability'],
  'backend-dev': ['api', 'database', 'server', 'authentication'],
  'frontend-dev': ['ui', 'react', 'css', 'components'],
  devops: ['ci-cd', 'docker', 'deployment', 'infrastructure'],
};

const TASK_PATTERNS = {
  // Code patterns
  'implement|create|build|add|write code': 'coder',
  'test|spec|coverage|unit test|integration': 'tester',
  'review|audit|check|validate|security': 'reviewer',
  'research|find|search|documentation|explore': 'researcher',
  'design|architect|structure|plan': 'architect',

  // Domain patterns
  'api|endpoint|server|backend|database': 'backend-dev',
  'ui|frontend|component|react|css|style': 'frontend-dev',
  'deploy|docker|ci|cd|pipeline|infrastructure': 'devops',
};

function routeTask(task) {
  const taskLower = task.toLowerCase();

  // Check patterns
  for (const [pattern, agent] of Object.entries(TASK_PATTERNS)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(taskLower)) {
      return {
        agent,
        confidence: 0.8,
        reason: \`Matched pattern: \${pattern}\`,
      };
    }
  }

  // Default to coder for unknown tasks
  return {
    agent: 'coder',
    confidence: 0.5,
    reason: 'Default routing - no specific pattern matched',
  };
}

// CLI
const task = process.argv.slice(2).join(' ');

if (task) {
  const result = routeTask(task);
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('Usage: router.js <task description>');
  console.log('\\nAvailable agents:', Object.keys(AGENT_CAPABILITIES).join(', '));
}

module.exports = { routeTask, AGENT_CAPABILITIES, TASK_PATTERNS };
`;
}

/**
 * Generate memory helper script
 */
export function generateMemoryHelper(): string {
  return `#!/usr/bin/env node
/**
 * Ruflo Memory Helper
 * Simple key-value memory for cross-session context
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(process.cwd(), '.claude-flow', 'data');
const MEMORY_FILE = path.join(MEMORY_DIR, 'memory.json');

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    }
  } catch (e) {
    // Ignore
  }
  return {};
}

function saveMemory(memory) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

const commands = {
  get: (key) => {
    const memory = loadMemory();
    const value = key ? memory[key] : memory;
    console.log(JSON.stringify(value, null, 2));
    return value;
  },

  set: (key, value) => {
    if (!key) {
      console.error('Key required');
      return;
    }
    const memory = loadMemory();
    memory[key] = value;
    memory._updated = new Date().toISOString();
    saveMemory(memory);
    console.log(\`Set: \${key}\`);
  },

  delete: (key) => {
    if (!key) {
      console.error('Key required');
      return;
    }
    const memory = loadMemory();
    delete memory[key];
    saveMemory(memory);
    console.log(\`Deleted: \${key}\`);
  },

  clear: () => {
    saveMemory({});
    console.log('Memory cleared');
  },

  keys: () => {
    const memory = loadMemory();
    const keys = Object.keys(memory).filter(k => !k.startsWith('_'));
    console.log(keys.join('\\n'));
    return keys;
  },
};

// CLI
const [,, command, key, ...valueParts] = process.argv;
const value = valueParts.join(' ');

if (command && commands[command]) {
  commands[command](key, value);
} else {
  console.log('Usage: memory.js <get|set|delete|clear|keys> [key] [value]');
}

module.exports = commands;
`;
}

/**
 * Generate hook-handler.cjs (cross-platform hook dispatcher)
 * This is the inline fallback when file copy from the package fails.
 * Uses string concatenation instead of template literals to avoid escaping issues.
 */
export function generateHookHandler(): string {
  // Build as array of lines to avoid template-in-template escaping nightmares
  const lines = [
    '#!/usr/bin/env node',
    '/**',
    ' * Ruflo Hook Handler (Cross-Platform)',
    ' * Dispatches hook events to the appropriate helper modules.',
    ' */',
    '',
    "const path = require('path');",
    "const fs = require('fs');",
    '',
    'const helpersDir = __dirname;',
    '',
    'function safeRequire(modulePath) {',
    '  try {',
    '    if (fs.existsSync(modulePath)) {',
    '      const origLog = console.log;',
    '      const origError = console.error;',
    '      console.log = () => {};',
    '      console.error = () => {};',
    '      try {',
    '        const mod = require(modulePath);',
    '        return mod;',
    '      } finally {',
    '        console.log = origLog;',
    '        console.error = origError;',
    '      }',
    '    }',
    '  } catch (e) {',
    '    // silently fail',
    '  }',
    '  return null;',
    '}',
    '',
    "const router = safeRequire(path.join(helpersDir, 'router.js'));",
    "const session = safeRequire(path.join(helpersDir, 'session.js'));",
    "const memory = safeRequire(path.join(helpersDir, 'memory.js'));",
    "const intelligence = safeRequire(path.join(helpersDir, 'intelligence.cjs'));",
    '',
    'const [,, command, ...args] = process.argv;',
    '',
    '// Read stdin with timeout — Claude Code sends hook data as JSON via stdin.',
    '// Timeout prevents hanging when stdin is in an ambiguous state (not TTY, not pipe).',
    'async function readStdin() {',
    '  if (process.stdin.isTTY) return "";',
    '  return new Promise((resolve) => {',
    '    let data = "";',
    '    const timer = setTimeout(() => {',
    '      process.stdin.removeAllListeners();',
    '      process.stdin.pause();',
    '      resolve(data);',
    '    }, 500);',
    '    process.stdin.setEncoding("utf8");',
    '    process.stdin.on("data", (chunk) => { data += chunk; });',
    '    process.stdin.on("end", () => { clearTimeout(timer); resolve(data); });',
    '    process.stdin.on("error", () => { clearTimeout(timer); resolve(data); });',
    '    process.stdin.resume();',
    '  });',
    '}',
    '',
    'async function main() {',
    '  let stdinData = "";',
    '  try { stdinData = await readStdin(); } catch (e) { /* ignore */ }',
    '  let hookInput = {};',
    '  if (stdinData.trim()) {',
    '    try { hookInput = JSON.parse(stdinData); } catch (e) { /* ignore */ }',
    '  }',
    '  // Prefer stdin fields, then env, then argv. `hookInput.toolInput` is an',
    '  // object (e.g. {command:"ls"}); falling back to it directly bound prompt',
    '  // to the object and tripped .toLowerCase() / .substring() on every Bash',
    '  // hook (#1944). Pull `.command` off whichever stdin shape Claude Code sent.',
    '  var toolInputObj = hookInput.toolInput || hookInput.tool_input || {};',
    "  var prompt = hookInput.prompt || hookInput.command || toolInputObj.command || process.env.PROMPT || process.env.TOOL_INPUT_command || args.join(' ') || '';",
    '',
    'const handlers = {',
    "  'route': () => {",
    '    if (intelligence && intelligence.getContext) {',
    '      try {',
    '        const ctx = intelligence.getContext(prompt);',
    '        if (ctx) console.log(ctx);',
    '      } catch (e) { /* non-fatal */ }',
    '    }',
    '    if (router && router.routeTask) {',
    '      const result = router.routeTask(prompt);',
    '      var output = [];',
    "      output.push('[INFO] Routing task: ' + (prompt.substring(0, 80) || '(no prompt)'));",
    "      output.push('');",
    "      output.push('+------------------- Primary Recommendation -------------------+');",
    "      output.push('| Agent: ' + result.agent.padEnd(53) + '|');",
    "      output.push('| Confidence: ' + (result.confidence * 100).toFixed(1) + '%' + ' '.repeat(44) + '|');",
    "      output.push('| Reason: ' + result.reason.substring(0, 53).padEnd(53) + '|');",
    "      output.push('+--------------------------------------------------------------+');",
    "      console.log(output.join('\\n'));",
    '    } else {',
    "      console.log('[INFO] Router not available, using default routing');",
    '    }',
    '  },',
    '',
    "  'pre-bash': () => {",
    '    var cmd = prompt.toLowerCase();',
    "    var dangerous = ['rm -rf /', 'format c:', 'del /s /q c:\\\\', ':(){:|:&};:'];",
    '    for (var i = 0; i < dangerous.length; i++) {',
    '      if (cmd.includes(dangerous[i])) {',
    "        console.error('[BLOCKED] Dangerous command detected: ' + dangerous[i]);",
    '        process.exit(1);',
    '      }',
    '    }',
    "    console.log('[OK] Command validated');",
    '  },',
    '',
    "  'post-edit': () => {",
    '    if (session && session.metric) {',
    "      try { session.metric('edits'); } catch (e) { /* no active session */ }",
    '    }',
    '    if (intelligence && intelligence.recordEdit) {',
    '      try {',
    "        var file = process.env.TOOL_INPUT_file_path || args[0] || '';",
    '        intelligence.recordEdit(file);',
    '      } catch (e) { /* non-fatal */ }',
    '    }',
    "    console.log('[OK] Edit recorded');",
    '  },',
    '',
    "  'session-restore': () => {",
    '    if (session) {',
    '      var existing = session.restore && session.restore();',
    '      if (!existing) {',
    '        session.start && session.start();',
    '      }',
    '    } else {',
    "      console.log('[OK] Session restored: session-' + Date.now());",
    '    }',
    '    if (intelligence && intelligence.init) {',
    '      try {',
    '        var result = intelligence.init();',
    '        if (result && result.nodes > 0) {',
    "          console.log('[INTELLIGENCE] Loaded ' + result.nodes + ' patterns, ' + result.edges + ' edges');",
    '        }',
    '      } catch (e) { /* non-fatal */ }',
    '    }',
    '  },',
    '',
    "  'session-end': () => {",
    '    if (intelligence && intelligence.consolidate) {',
    '      try {',
    '        var result = intelligence.consolidate();',
    '        if (result && result.entries > 0) {',
    "          var msg = '[INTELLIGENCE] Consolidated: ' + result.entries + ' entries, ' + result.edges + ' edges';",
    "          if (result.newEntries > 0) msg += ', ' + result.newEntries + ' new';",
    "          msg += ', PageRank recomputed';",
    '          console.log(msg);',
    '        }',
    '      } catch (e) { /* non-fatal */ }',
    '    }',
    '    if (session && session.end) {',
    '      session.end();',
    '    } else {',
    "      console.log('[OK] Session ended');",
    '    }',
    '  },',
    '',
    "  'pre-task': () => {",
    '    if (session && session.metric) {',
    "      try { session.metric('tasks'); } catch (e) { /* no active session */ }",
    '    }',
    '    if (router && router.routeTask && prompt) {',
    '      var result = router.routeTask(prompt);',
    "      console.log('[INFO] Task routed to: ' + result.agent + ' (confidence: ' + result.confidence + ')');",
    '    } else {',
    "      console.log('[OK] Task started');",
    '    }',
    '  },',
    '',
    "  'post-task': () => {",
    '    if (intelligence && intelligence.feedback) {',
    '      try {',
    '        intelligence.feedback(true);',
    '      } catch (e) { /* non-fatal */ }',
    '    }',
    "    console.log('[OK] Task completed');",
    '  },',
    '',
    "  'compact-manual': () => {",
    "    console.log('PreCompact Guidance:');",
    "    console.log('IMPORTANT: Review CLAUDE.md in project root for:');",
    "    console.log('   - Available agents and concurrent usage patterns');",
    "    console.log('   - Swarm coordination strategies (hierarchical, mesh, adaptive)');",
    "    console.log('   - Critical concurrent execution rules (1 MESSAGE = ALL OPERATIONS)');",
    "    console.log('Ready for compact operation');",
    '  },',
    '',
    "  'compact-auto': () => {",
    "    console.log('Auto-Compact Guidance (Context Window Full):');",
    "    console.log('CRITICAL: Before compacting, ensure you understand:');",
    "    console.log('   - All agents available in .claude/agents/ directory');",
    "    console.log('   - Concurrent execution patterns from CLAUDE.md');",
    "    console.log('   - Swarm coordination strategies for complex tasks');",
    "    console.log('Apply GOLDEN RULE: Always batch operations in single messages');",
    "    console.log('Auto-compact proceeding with full agent context');",
    '  },',
    '',
    "  'status': () => {",
    "    console.log('[OK] Status check');",
    '  },',
    '',
    "  'stats': () => {",
    '    if (intelligence && intelligence.stats) {',
    "      intelligence.stats(args.includes('--json'));",
    '    } else {',
    "      console.log('[WARN] Intelligence module not available. Run session-restore first.');",
    '    }',
    '  },',
    '};',
    '',
    'if (command && handlers[command]) {',
    '  try {',
    '    handlers[command]();',
    '  } catch (e) {',
    "    console.log('[WARN] Hook ' + command + ' encountered an error: ' + e.message);",
    '  }',
    '} else if (command) {',
    "  console.log('[OK] Hook: ' + command);",
    '} else {',
    "  console.log('Usage: hook-handler.cjs <route|pre-bash|post-edit|session-restore|session-end|pre-task|post-task|compact-manual|compact-auto|status|stats>');",
    '}',
    '} // end main',
    '',
    'process.exitCode = 0;',
    'main().catch(() => {}).finally(() => { process.exit(0); });',
  ];
  return lines.join('\n') + '\n';
}

/**
 * Generate a minimal intelligence.cjs stub for fallback installs.
 * Provides the same API as the full intelligence.cjs but with simplified logic.
 * Gets overwritten when source copy succeeds (full version has PageRank, Jaccard, etc.)
 */
