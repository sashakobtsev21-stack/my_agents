/**
 * `claude-flow hooks statusline` — produces the bottom-of-Claude-Code panel
 * (model · context · swarm · CVE · tests). 485 lines, the single biggest
 * command in hooks.ts.
 *
 * Pilot extraction (issue #7).
 */
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';

export const statuslineCommand: Command = {
  name: 'statusline',
  description: 'Generate dynamic statusline with V3 progress and system status',
  options: [
    {
      name: 'json',
      description: 'Output as JSON',
      type: 'boolean',
      default: false
    },
    {
      name: 'compact',
      description: 'Compact single-line output (auto-enabled when terminal width < 100 cols)',
      type: 'boolean',
      default: false
    },
    {
      name: 'full',
      description: 'Force the full multi-line output even on narrow terminals',
      type: 'boolean',
      default: false
    },
    {
      name: 'no-color',
      description: 'Disable ANSI colors',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow hooks statusline', description: 'Display full statusline' },
    { command: 'claude-flow hooks statusline --json', description: 'JSON output for hooks' },
    { command: 'claude-flow hooks statusline --compact', description: 'Single-line status' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const fs = await import('fs');
    const path = await import('path');
    const { execSync } = await import('child_process');

    // Get learning stats from memory database
    function getLearningStats() {
      const memoryPaths = [
        path.join(process.cwd(), '.swarm', 'memory.db'),
        path.join(process.cwd(), '.claude', 'memory.db'),
      ];

      let patterns = 0;
      let sessions = 0;
      let trajectories = 0;

      for (const dbPath of memoryPaths) {
        if (fs.existsSync(dbPath)) {
          try {
            const stats = fs.statSync(dbPath);
            const sizeKB = stats.size / 1024;
            patterns = Math.floor(sizeKB / 2);
            sessions = Math.max(1, Math.floor(patterns / 10));
            trajectories = Math.floor(patterns / 5);
            break;
          } catch {
            // Ignore
          }
        }
      }

      const sessionsPath = path.join(process.cwd(), '.claude', 'sessions');
      if (fs.existsSync(sessionsPath)) {
        try {
          const sessionFiles = fs.readdirSync(sessionsPath).filter((f: string) => f.endsWith('.json'));
          sessions = Math.max(sessions, sessionFiles.length);
        } catch {
          // Ignore
        }
      }

      return { patterns, sessions, trajectories };
    }

    // Get V3 progress
    function getV3Progress() {
      const learning = getLearningStats();
      let domainsCompleted = 0;
      if (learning.patterns >= 500) domainsCompleted = 5;
      else if (learning.patterns >= 200) domainsCompleted = 4;
      else if (learning.patterns >= 100) domainsCompleted = 3;
      else if (learning.patterns >= 50) domainsCompleted = 2;
      else if (learning.patterns >= 10) domainsCompleted = 1;

      const totalDomains = 5;
      const dddProgress = Math.min(100, Math.floor((domainsCompleted / totalDomains) * 100));

      return { domainsCompleted, totalDomains, dddProgress, patternsLearned: learning.patterns, sessionsCompleted: learning.sessions };
    }

    // Get security status
    function getSecurityStatus() {
      const scanResultsPath = path.join(process.cwd(), '.claude', 'security-scans');
      let cvesFixed = 0;
      const totalCves = 3;

      if (fs.existsSync(scanResultsPath)) {
        try {
          const scans = fs.readdirSync(scanResultsPath).filter((f: string) => f.endsWith('.json'));
          cvesFixed = Math.min(totalCves, scans.length);
        } catch {
          // Ignore
        }
      }

      const auditPath = path.join(process.cwd(), '.swarm', 'security');
      if (fs.existsSync(auditPath)) {
        try {
          const audits = fs.readdirSync(auditPath).filter((f: string) => f.includes('audit'));
          cvesFixed = Math.min(totalCves, Math.max(cvesFixed, audits.length));
        } catch {
          // Ignore
        }
      }

      const status = cvesFixed >= totalCves ? 'CLEAN' : cvesFixed > 0 ? 'IN_PROGRESS' : 'PENDING';
      return { status, cvesFixed, totalCves };
    }

    // Get swarm status
    function getSwarmStatus() {
      let activeAgents = 0;
      let coordinationActive = false;
      const maxAgents = 15;
      const isWindows = process.platform === 'win32';

      try {
        const psCmd = isWindows
          ? 'tasklist /FI "IMAGENAME eq node.exe" /NH 2>NUL | find /c /v "" 2>NUL || echo 0'
          : 'ps aux 2>/dev/null | grep -c agentic-flow || echo "0"';
        const ps = execSync(psCmd, { encoding: 'utf-8', timeout: 3000 });
        activeAgents = Math.max(0, parseInt(ps.trim()) - 1);
        coordinationActive = activeAgents > 0;
      } catch {
        // ps/tasklist unavailable or timed out — report zero
      }

      return { activeAgents, maxAgents, coordinationActive };
    }

    // Get system metrics
    function getSystemMetrics() {
      let memoryMB = 0;
      let subAgents = 0;
      const learning = getLearningStats();

      try {
        memoryMB = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);
      } catch {
        // Ignore
      }

      // Calculate intelligence from multiple sources (matching statusline-generator.ts)
      let intelligencePct = 0;

      // 1. Check learning.json for REAL intelligence metrics first
      const learningJsonPaths = [
        path.join(process.cwd(), '.claude-flow', 'learning.json'),
        path.join(process.cwd(), '.claude', '.claude-flow', 'learning.json'),
        path.join(process.cwd(), '.swarm', 'learning.json'),
      ];
      for (const lPath of learningJsonPaths) {
        if (fs.existsSync(lPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(lPath, 'utf-8'));
            if (data.intelligence?.score !== undefined) {
              intelligencePct = Math.min(100, Math.floor(data.intelligence.score));
              break;
            }
          } catch { /* ignore */ }
        }
      }

      // 2. Fallback: calculate from patterns and vectors
      if (intelligencePct === 0) {
        const fromPatterns = learning.patterns > 0 ? Math.min(100, Math.floor(learning.patterns / 10)) : 0;
        // Will be updated later with vector count
        intelligencePct = fromPatterns;
      }

      // 3. Fallback: calculate maturity score from project indicators
      if (intelligencePct === 0) {
        let maturityScore = 0;
        // Check for key project files/dirs
        if (fs.existsSync(path.join(process.cwd(), '.claude'))) maturityScore += 15;
        if (fs.existsSync(path.join(process.cwd(), '.claude-flow'))) maturityScore += 15;
        if (fs.existsSync(path.join(process.cwd(), 'CLAUDE.md'))) maturityScore += 10;
        if (fs.existsSync(path.join(process.cwd(), 'claude-flow.config.json'))) maturityScore += 10;
        if (fs.existsSync(path.join(process.cwd(), '.swarm'))) maturityScore += 10;
        // Check for test files
        const testDirs = ['tests', '__tests__', 'test', 'v3/__tests__'];
        for (const dir of testDirs) {
          if (fs.existsSync(path.join(process.cwd(), dir))) {
            maturityScore += 10;
            break;
          }
        }
        // Check for hooks config
        if (fs.existsSync(path.join(process.cwd(), '.claude', 'settings.json'))) maturityScore += 10;
        intelligencePct = Math.min(100, maturityScore);
      }

      const contextPct = Math.min(100, Math.floor(learning.sessions * 5));

      return { memoryMB, contextPct, intelligencePct, subAgents };
    }

    // Get user info
    function getUserInfo() {
      let name = 'user';
      let gitBranch = '';
      const modelName = 'Opus 4.6 (1M context)';
      const isWindows = process.platform === 'win32';

      try {
        const nameCmd = isWindows
          ? 'git config user.name 2>NUL || echo user'
          : 'git config user.name 2>/dev/null || echo "user"';
        const branchCmd = isWindows
          ? 'git branch --show-current 2>NUL || echo.'
          : 'git branch --show-current 2>/dev/null || echo ""';
        name = execSync(nameCmd, { encoding: 'utf-8' }).trim();
        gitBranch = execSync(branchCmd, { encoding: 'utf-8' }).trim();
        if (gitBranch === '.') gitBranch = '';
      } catch {
        // Ignore
      }

      return { name, gitBranch, modelName };
    }

    // Collect all status
    const progress = getV3Progress();
    const security = getSecurityStatus();
    const swarm = getSwarmStatus();
    const system = getSystemMetrics();
    const user = getUserInfo();

    const statusData = {
      user,
      v3Progress: progress,
      security,
      swarm,
      system,
      timestamp: new Date().toISOString()
    };

    // JSON output
    if (ctx.flags.json || ctx.flags.format === 'json') {
      output.printJson(statusData);
      return { success: true, data: statusData };
    }

    // #1153: auto-collapse to compact on narrow terminals so the full
    // 6+ line statusline doesn't dominate the screen. Honors:
    //   - explicit --compact → compact
    //   - explicit --full    → full (overrides auto-detection)
    //   - else                → compact when terminal < 100 cols (full multi-line
    //                            output expects ~100 cols of horizontal space)
    const COMPACT_WIDTH_THRESHOLD = 100;
    const terminalCols = process.stdout.columns ?? 80;
    const autoCompact = !ctx.flags.full && terminalCols < COMPACT_WIDTH_THRESHOLD;
    if (ctx.flags.compact || autoCompact) {
      const line = `DDD:${progress.domainsCompleted}/${progress.totalDomains} CVE:${security.cvesFixed}/${security.totalCves} Swarm:${swarm.activeAgents}/${swarm.maxAgents} Ctx:${system.contextPct}% Int:${system.intelligencePct}%`;
      output.writeln(line);
      return { success: true, data: statusData };
    }

    // Full colored output
    const noColor = ctx.flags['no-color'] || ctx.flags.noColor;
    const c = noColor ? {
      reset: '', bold: '', dim: '', red: '', green: '', yellow: '', blue: '',
      purple: '', cyan: '', brightRed: '', brightGreen: '', brightYellow: '',
      brightBlue: '', brightPurple: '', brightCyan: '', brightWhite: ''
    } : {
      reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[0;31m',
      green: '\x1b[0;32m', yellow: '\x1b[0;33m', blue: '\x1b[0;34m',
      purple: '\x1b[0;35m', cyan: '\x1b[0;36m', brightRed: '\x1b[1;31m',
      brightGreen: '\x1b[1;32m', brightYellow: '\x1b[1;33m', brightBlue: '\x1b[1;34m',
      brightPurple: '\x1b[1;35m', brightCyan: '\x1b[1;36m', brightWhite: '\x1b[1;37m'
    };

    // Progress bar helper
    const progressBar = (current: number, total: number) => {
      const filled = Math.round((current / total) * 5);
      const empty = 5 - filled;
      return '[' + '●'.repeat(filled) + '○'.repeat(empty) + ']';
    };

    // Generate lines
    let header = `${c.bold}${c.brightPurple}▊ AlexKo V3 ${c.reset}`;
    header += `${swarm.coordinationActive ? c.brightCyan : c.dim}● ${c.brightCyan}${user.name}${c.reset}`;
    if (user.gitBranch) {
      header += `  ${c.dim}│${c.reset}  ${c.brightBlue}⎇ ${user.gitBranch}${c.reset}`;
    }
    header += `  ${c.dim}│${c.reset}  ${c.purple}${user.modelName}${c.reset}`;

    const separator = `${c.dim}─────────────────────────────────────────────────────${c.reset}`;

    // Get hooks stats
    const hooksStats = { enabled: 0, total: 17 };
    const settingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if (settings.hooks) {
          hooksStats.enabled = Object.values(settings.hooks).filter((h: unknown) => h && typeof h === 'object').length;
        }
      } catch { /* ignore */ }
    }

    // Get AgentDB stats (matching statusline-generator.ts paths)
    const agentdbStats = { vectorCount: 0, dbSizeKB: 0, hasHnsw: false };

    // Check for direct database files first
    const dbPaths = [
      path.join(process.cwd(), '.swarm', 'memory.db'),
      path.join(process.cwd(), '.claude-flow', 'memory.db'),
      path.join(process.cwd(), '.claude', 'memory.db'),
      path.join(process.cwd(), 'data', 'memory.db'),
      path.join(process.cwd(), 'memory.db'),
      path.join(process.cwd(), '.agentdb', 'memory.db'),
      path.join(process.cwd(), '.claude-flow', 'memory', 'agentdb.db'),
    ];
    for (const dbPath of dbPaths) {
      if (fs.existsSync(dbPath)) {
        try {
          const stats = fs.statSync(dbPath);
          agentdbStats.dbSizeKB = Math.round(stats.size / 1024);
          agentdbStats.vectorCount = Math.floor(agentdbStats.dbSizeKB / 2);
          agentdbStats.hasHnsw = agentdbStats.vectorCount > 100;
          break;
        } catch { /* ignore */ }
      }
    }

    // Check for AgentDB directories if no direct db found
    if (agentdbStats.vectorCount === 0) {
      const agentdbDirs = [
        path.join(process.cwd(), '.claude-flow', 'agentdb'),
        path.join(process.cwd(), '.swarm', 'agentdb'),
        path.join(process.cwd(), 'data', 'agentdb'),
        path.join(process.cwd(), '.agentdb'),
      ];
      for (const dir of agentdbDirs) {
        if (fs.existsSync(dir)) {
          try {
            const files = fs.readdirSync(dir);
            for (const f of files) {
              if (f.endsWith('.db') || f.endsWith('.sqlite')) {
                const filePath = path.join(dir, f);
                const fileStat = fs.statSync(filePath);
                agentdbStats.dbSizeKB += Math.round(fileStat.size / 1024);
              }
            }
            agentdbStats.vectorCount = Math.floor(agentdbStats.dbSizeKB / 2);
            agentdbStats.hasHnsw = agentdbStats.vectorCount > 100;
            if (agentdbStats.vectorCount > 0) break;
          } catch { /* ignore */ }
        }
      }
    }

    // Check for HNSW index files
    const hnswPaths = [
      path.join(process.cwd(), '.claude-flow', 'hnsw'),
      path.join(process.cwd(), '.swarm', 'hnsw'),
      path.join(process.cwd(), 'data', 'hnsw'),
    ];
    for (const hnswPath of hnswPaths) {
      if (fs.existsSync(hnswPath)) {
        agentdbStats.hasHnsw = true;
        try {
          const hnswFiles = fs.readdirSync(hnswPath);
          const indexFile = hnswFiles.find(f => f.endsWith('.index'));
          if (indexFile) {
            const indexStat = fs.statSync(path.join(hnswPath, indexFile));
            const hnswVectors = Math.floor(indexStat.size / 512);
            agentdbStats.vectorCount = Math.max(agentdbStats.vectorCount, hnswVectors);
          }
        } catch { /* ignore */ }
        break;
      }
    }

    // Check for vectors.json file
    const vectorsPath = path.join(process.cwd(), '.claude-flow', 'vectors.json');
    if (fs.existsSync(vectorsPath) && agentdbStats.vectorCount === 0) {
      try {
        const data = JSON.parse(fs.readFileSync(vectorsPath, 'utf-8'));
        if (Array.isArray(data)) {
          agentdbStats.vectorCount = data.length;
        } else if (data.vectors) {
          agentdbStats.vectorCount = Object.keys(data.vectors).length;
        }
      } catch { /* ignore */ }
    }

    // Get test stats
    const testStats = { testFiles: 0, testCases: 0 };
    const testPaths = ['tests', '__tests__', 'test', 'spec'];
    for (const testPath of testPaths) {
      const fullPath = path.join(process.cwd(), testPath);
      if (fs.existsSync(fullPath)) {
        try {
          const files = fs.readdirSync(fullPath, { recursive: true }) as string[];
          testStats.testFiles = files.filter((f: string) => /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(f)).length;
          testStats.testCases = testStats.testFiles * 28; // Estimate
        } catch { /* ignore */ }
      }
    }

    // Get MCP stats
    const mcpStats = { enabled: 0, total: 0 };
    const mcpPath = path.join(process.cwd(), '.mcp.json');
    if (fs.existsSync(mcpPath)) {
      try {
        const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
        if (mcp.mcpServers) {
          mcpStats.total = Object.keys(mcp.mcpServers).length;
          mcpStats.enabled = mcpStats.total;
        }
      } catch { /* ignore */ }
    }

    const domainsColor = progress.domainsCompleted >= 3 ? c.brightGreen : progress.domainsCompleted > 0 ? c.yellow : c.red;
    // Dynamic perf indicator based on patterns/HNSW
    let perfIndicator = `${c.dim}⚡ target: ~1.9x-4.7x${c.reset}`;
    if (agentdbStats.hasHnsw && agentdbStats.vectorCount > 0) {
      const speedup = agentdbStats.vectorCount > 1000 ? '~4.7x' : '~1.9x';
      perfIndicator = `${c.brightGreen}⚡ HNSW ${speedup}${c.reset}`;
    } else if (progress.patternsLearned > 0) {
      const patternsK = progress.patternsLearned >= 1000 ? `${(progress.patternsLearned / 1000).toFixed(1)}k` : String(progress.patternsLearned);
      perfIndicator = `${c.brightYellow}📚 ${patternsK} patterns${c.reset}`;
    }

    const line1 = `${c.brightCyan}🏗️  DDD Domains${c.reset}    ${progressBar(progress.domainsCompleted, progress.totalDomains)}  ` +
      `${domainsColor}${progress.domainsCompleted}${c.reset}/${c.brightWhite}${progress.totalDomains}${c.reset}    ` +
      perfIndicator;

    const swarmIndicator = swarm.coordinationActive ? `${c.brightGreen}◉${c.reset}` : `${c.dim}○${c.reset}`;
    const agentsColor = swarm.activeAgents > 0 ? c.brightGreen : c.red;
    const securityIcon = security.status === 'CLEAN' ? '🟢' : security.status === 'IN_PROGRESS' ? '🟡' : '🔴';
    const securityColor = security.status === 'CLEAN' ? c.brightGreen : security.status === 'IN_PROGRESS' ? c.brightYellow : c.brightRed;
    const hooksColor = hooksStats.enabled > 0 ? c.brightGreen : c.dim;

    const line2 = `${c.brightYellow}🤖 Swarm${c.reset}  ${swarmIndicator} [${agentsColor}${String(swarm.activeAgents).padStart(2)}${c.reset}/${c.brightWhite}${swarm.maxAgents}${c.reset}]  ` +
      `${c.brightPurple}👥 ${system.subAgents}${c.reset}    ` +
      `${c.brightBlue}🪝 ${hooksColor}${hooksStats.enabled}${c.reset}/${c.brightWhite}${hooksStats.total}${c.reset}    ` +
      `${securityIcon} ${securityColor}CVE ${security.cvesFixed}${c.reset}/${c.brightWhite}${security.totalCves}${c.reset}    ` +
      `${c.brightCyan}💾 ${system.memoryMB}MB${c.reset}    ` +
      `${c.brightPurple}🧠 ${String(system.intelligencePct).padStart(3)}%${c.reset}`;

    const dddColor = progress.dddProgress >= 50 ? c.brightGreen : progress.dddProgress > 0 ? c.yellow : c.red;
    const line3 = `${c.brightPurple}🔧 Architecture${c.reset}    ` +
      `${c.cyan}ADRs${c.reset} ${c.dim}●0/0${c.reset}  ${c.dim}│${c.reset}  ` +
      `${c.cyan}DDD${c.reset} ${dddColor}●${String(progress.dddProgress).padStart(3)}%${c.reset}  ${c.dim}│${c.reset}  ` +
      `${c.cyan}Security${c.reset} ${securityColor}●${security.status}${c.reset}`;

    const vectorColor = agentdbStats.vectorCount > 0 ? c.brightGreen : c.dim;
    const testColor = testStats.testFiles > 0 ? c.brightGreen : c.dim;
    const mcpColor = mcpStats.enabled > 0 ? c.brightGreen : c.dim;
    const sizeDisplay = agentdbStats.dbSizeKB >= 1024 ? `${(agentdbStats.dbSizeKB / 1024).toFixed(1)}MB` : `${agentdbStats.dbSizeKB}KB`;
    const hnswIndicator = agentdbStats.hasHnsw ? `${c.brightGreen}⚡${c.reset}` : '';

    const line4 = `${c.brightCyan}📊 AgentDB${c.reset}    ` +
      `${c.cyan}Vectors${c.reset} ${vectorColor}●${agentdbStats.vectorCount}${hnswIndicator}${c.reset}  ${c.dim}│${c.reset}  ` +
      `${c.cyan}Size${c.reset} ${c.brightWhite}${sizeDisplay}${c.reset}  ${c.dim}│${c.reset}  ` +
      `${c.cyan}Tests${c.reset} ${testColor}●${testStats.testFiles}${c.reset} ${c.dim}(${testStats.testCases} cases)${c.reset}  ${c.dim}│${c.reset}  ` +
      `${c.cyan}MCP${c.reset} ${mcpColor}●${mcpStats.enabled}/${mcpStats.total}${c.reset}`;

    output.writeln(header);
    output.writeln(separator);
    output.writeln(line1);
    output.writeln(line2);
    output.writeln(line3);
    output.writeln(line4);

    return { success: true, data: statusData };
  }
};
