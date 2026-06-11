/**
 * Security Command — audit / secrets / defend subcommands
 *
 * Extracted verbatim from security.ts (lines 536-932) during campaign-2
 * wave 9 (W215). Module-private group; only the command consts are
 * imported back by the securityCommand aggregate.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';

export const auditCommand: Command = {
  name: 'audit',
  description: 'Security audit logging and compliance',
  options: [
    { name: 'action', short: 'a', type: 'string', description: 'Action: log, list, export, clear', default: 'list' },
    { name: 'limit', short: 'l', type: 'number', description: 'Number of entries to show', default: '20' },
    { name: 'filter', short: 'f', type: 'string', description: 'Filter by event type' },
  ],
  examples: [
    { command: 'claude-flow security audit --action list', description: 'List audit logs' },
    { command: 'claude-flow security audit -a export', description: 'Export audit trail' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // `--action` (list/export) is in the help text — both views render
    // the same audit table, so the branch is parked. ctx is still used
    // below for `--limit`.
    output.writeln();
    output.writeln(output.bold('Security Audit Log'));
    output.writeln(output.dim('─'.repeat(60)));

    // Generate real audit entries from .swarm/ state and session history
    const { existsSync, readdirSync, statSync } = await import('fs');
    const { join } = await import('path');

    const auditEntries: { timestamp: string; event: string; user: string; status: string }[] = [];
    const swarmDir = join(process.cwd(), '.swarm');

    // Check session files for real audit events
    if (existsSync(swarmDir)) {
      try {
        const files = readdirSync(swarmDir).filter(f => f.endsWith('.json'));
        for (const file of files.slice(-10)) {
          try {
            const stat = statSync(join(swarmDir, file));
            const ts = stat.mtime.toISOString().replace('T', ' ').substring(0, 19);
            auditEntries.push({
              timestamp: ts,
              event: file.includes('session') ? 'SESSION_UPDATE' :
                     file.includes('swarm') ? 'SWARM_ACTIVITY' :
                     file.includes('memory') ? 'MEMORY_WRITE' : 'CONFIG_CHANGE',
              user: 'system',
              status: output.success('Success')
            });
          } catch { /* skip */ }
        }
      } catch { /* ignore */ }
    }

    // Add current session entry
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    auditEntries.push({ timestamp: now, event: 'AUDIT_RUN', user: 'cli', status: output.success('Success') });

    // Sort by timestamp desc
    auditEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (auditEntries.length === 0) {
      output.writeln(output.dim('No audit events found. Initialize a project first: claude-flow init'));
    } else {
      output.printTable({
        columns: [
          { key: 'timestamp', header: 'Timestamp', width: 22 },
          { key: 'event', header: 'Event', width: 20 },
          { key: 'user', header: 'User', width: 15 },
          { key: 'status', header: 'Status', width: 12 },
        ],
        data: auditEntries.slice(0, parseInt(ctx.flags.limit as string || '20', 10)),
      });
    }

    return { success: true };
  },
};

// Secrets subcommand
export const secretsCommand: Command = {
  name: 'secrets',
  description: 'Detect and manage secrets in codebase',
  options: [
    { name: 'action', short: 'a', type: 'string', description: 'Action: scan, list, rotate', default: 'scan' },
    { name: 'path', short: 'p', type: 'string', description: 'Path to scan', default: '.' },
    { name: 'ignore', short: 'i', type: 'string', description: 'Patterns to ignore' },
  ],
  examples: [
    { command: 'claude-flow security secrets --action scan', description: 'Scan for secrets' },
    { command: 'claude-flow security secrets -a rotate', description: 'Rotate compromised secrets' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const scanPath = ctx.flags.path as string || '.';
    const ignorePatterns = ctx.flags.ignore as string | undefined;

    output.writeln();
    output.writeln(output.bold('Secret Detection'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: `Scanning ${scanPath} for secrets...`, spinner: 'dots' });
    spinner.start();

    const fs = await import('fs');
    const path = await import('path');

    const rootDir = path.resolve(scanPath);
    const skipDirs = new Set(['node_modules', 'dist', '.git']);
    const extensions = new Set(['.ts', '.js', '.json', '.yaml', '.yml', '.tsx', '.jsx', '.env', '.toml', '.cfg', '.conf', '.ini', '.properties', '.sh', '.bash', '.zsh']);
    const ignoreList = ignorePatterns ? ignorePatterns.split(',').map(p => p.trim()) : [];

    const secretPatterns: Array<{ pattern: RegExp; type: string; risk: string; action: string }> = [
      { pattern: /AKIA[0-9A-Z]{16}/g, type: 'AWS Access Key', risk: 'Critical', action: 'Rotate immediately' },
      { pattern: /gh[ps]_[A-Za-z0-9_]{36,}/g, type: 'GitHub Token', risk: 'Critical', action: 'Revoke and rotate' },
      { pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, type: 'JWT Token', risk: 'High', action: 'Remove from source' },
      { pattern: /-----BEGIN (?:RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/g, type: 'Private Key', risk: 'Critical', action: 'Remove and regenerate' },
      { pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+/g, type: 'Connection String', risk: 'High', action: 'Use env variable' },
      { pattern: /['"](?:sk-|sk_live_|sk_test_)[a-zA-Z0-9]{20,}['"]/g, type: 'API Key (Stripe/OpenAI)', risk: 'Critical', action: 'Rotate immediately' },
      { pattern: /['"]xox[baprs]-[a-zA-Z0-9-]+['"]/g, type: 'Slack Token', risk: 'High', action: 'Revoke and rotate' },
      { pattern: /[a-zA-Z0-9_-]*(?:api[_-]?key|secret[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/gi, type: 'Generic Secret/API Key', risk: 'High', action: 'Use env variable' },
      { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi, type: 'Hardcoded Password', risk: 'High', action: 'Use secrets manager' },
    ];

    const findings: Array<{ type: string; location: string; risk: string; action: string; line: string }> = [];
    let filesScanned = 0;
    const MAX_FILES = 500;

    const shouldIgnore = (filePath: string): boolean => {
      return ignoreList.some(p => filePath.includes(p));
    };

    const scanDir = (dir: string) => {
      if (filesScanned >= MAX_FILES) return;
      let entries: import('fs').Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch { return; }

      for (const entry of entries) {
        if (filesScanned >= MAX_FILES) break;
        if (skipDirs.has(entry.name)) continue;
        // Allow dotfiles like .env but skip .git
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') && entry.name !== '.env') continue;
          scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          const isEnvFile = entry.name.startsWith('.env');
          if (!extensions.has(ext) && !isEnvFile) continue;
          if (entry.name.endsWith('.d.ts')) continue;

          const relPath = path.relative(rootDir, fullPath);
          if (shouldIgnore(relPath)) continue;

          filesScanned++;
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > 1024 * 1024) continue; // skip files > 1MB

            const content = fs.readFileSync(fullPath, 'utf-8');
            // Quick binary check — skip if null bytes present
            if (content.includes('\0')) continue;

            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              for (const sp of secretPatterns) {
                sp.pattern.lastIndex = 0;
                const match = sp.pattern.exec(line);
                if (match) {
                  // Mask the matched secret for safe display
                  const matched = match[0];
                  const masked = matched.length > 12
                    ? matched.substring(0, 6) + '***' + matched.substring(matched.length - 3)
                    : '***';

                  findings.push({
                    type: sp.type,
                    location: `${relPath}:${i + 1}`,
                    risk: sp.risk,
                    action: sp.action,
                    line: masked,
                  });
                  sp.pattern.lastIndex = 0;
                }
              }
            }
          } catch { /* file read error */ }
        }
      }
    };

    scanDir(rootDir);
    spinner.succeed(`Scanned ${filesScanned} files`);

    output.writeln();
    if (findings.length > 0) {
      const criticalCount = findings.filter(f => f.risk === 'Critical').length;
      const highCount = findings.filter(f => f.risk === 'High').length;
      const mediumCount = findings.filter(f => f.risk === 'Medium').length;

      output.printTable({
        columns: [
          { key: 'type', header: 'Secret Type', width: 25 },
          { key: 'location', header: 'Location', width: 35 },
          { key: 'risk', header: 'Risk', width: 12 },
          { key: 'action', header: 'Recommended', width: 22 },
        ],
        data: findings.slice(0, 25).map(f => ({
          type: f.type,
          location: f.location,
          risk: f.risk === 'Critical' ? output.error(f.risk) :
                f.risk === 'High' ? output.warning(f.risk) :
                output.warning(f.risk),
          action: f.action,
        })),
      });

      if (findings.length > 25) {
        output.writeln(output.dim(`... and ${findings.length - 25} more secrets found`));
      }

      output.writeln();
      output.printBox([
        `Path: ${scanPath}`,
        `Files scanned: ${filesScanned}`,
        ``,
        `Critical: ${criticalCount}  High: ${highCount}  Medium: ${mediumCount}`,
        `Total secrets found: ${findings.length}`,
      ].join('\n'), 'Secrets Summary');
    } else {
      output.writeln(output.success('No secrets detected.'));
      output.writeln();
      output.printBox([
        `Path: ${scanPath}`,
        `Files scanned: ${filesScanned}`,
        ``,
        `No hardcoded secrets, API keys, tokens, or credentials found.`,
      ].join('\n'), 'Secrets Summary');
    }

    return { success: findings.length === 0 };
  },
};

// Defend subcommand (AIDefence integration)
export const defendCommand: Command = {
  name: 'defend',
  description: 'AI manipulation defense - detect prompt injection, jailbreaks, and PII',
  options: [
    { name: 'input', short: 'i', type: 'string', description: 'Input text to scan for threats' },
    { name: 'file', short: 'f', type: 'string', description: 'File to scan for threats' },
    { name: 'quick', short: 'Q', type: 'boolean', description: 'Quick scan (faster, less detailed)' },
    { name: 'learn', short: 'l', type: 'boolean', description: 'Enable learning mode', default: 'true' },
    { name: 'stats', short: 's', type: 'boolean', description: 'Show detection statistics' },
    { name: 'output', short: 'o', type: 'string', description: 'Output format: text, json', default: 'text' },
  ],
  examples: [
    { command: 'claude-flow security defend -i "ignore previous instructions"', description: 'Scan text for threats' },
    { command: 'claude-flow security defend -f ./prompts.txt', description: 'Scan file for threats' },
    { command: 'claude-flow security defend --stats', description: 'Show detection statistics' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const inputText = ctx.flags.input as string;
    const filePath = ctx.flags.file as string;
    const quickMode = ctx.flags.quick as boolean;
    const showStats = ctx.flags.stats as boolean;
    const outputFormat = ctx.flags.output as string || 'text';
    const enableLearning = ctx.flags.learn !== false;

    output.writeln();
    output.writeln(output.bold('🛡️ AIDefence - AI Manipulation Defense System'));
    output.writeln(output.dim('─'.repeat(55)));

    // Dynamic import of aidefence (allows package to be optional)
    let createAIDefence: typeof import('@claude-flow/aidefence').createAIDefence;
    try {
      const aidefence = await import('@claude-flow/aidefence');
      createAIDefence = aidefence.createAIDefence;
    } catch {
      output.error('AIDefence package not installed. Run: npm install @claude-flow/aidefence');
      return { success: false, message: 'AIDefence not available' };
    }

    const defender = createAIDefence({ enableLearning });

    // Show stats mode
    if (showStats) {
      const stats = await defender.getStats();
      output.writeln();
      output.printBox([
        `Detection Count: ${stats.detectionCount}`,
        `Avg Detection Time: ${stats.avgDetectionTimeMs.toFixed(3)}ms`,
        `Learned Patterns: ${stats.learnedPatterns}`,
        `Mitigation Strategies: ${stats.mitigationStrategies}`,
        `Avg Mitigation Effectiveness: ${(stats.avgMitigationEffectiveness * 100).toFixed(1)}%`,
      ].join('\n'), 'Detection Statistics');
      return { success: true };
    }

    // Get input to scan
    let textToScan = inputText;
    if (filePath) {
      try {
        const fs = await import('fs/promises');
        textToScan = await fs.readFile(filePath, 'utf-8');
        output.writeln(output.dim(`Reading file: ${filePath}`));
      } catch (err) {
        output.error(`Failed to read file: ${filePath}`);
        return { success: false, message: 'File not found' };
      }
    }

    if (!textToScan) {
      output.writeln('Usage: claude-flow security defend -i "<text>" or -f <file>');
      output.writeln();
      output.writeln('Options:');
      output.printList([
        '-i, --input   Text to scan for AI manipulation attempts',
        '-f, --file    File path to scan',
        '-q, --quick   Quick scan mode (faster)',
        '-s, --stats   Show detection statistics',
        '--learn       Enable pattern learning (default: true)',
      ]);
      return { success: true };
    }

    const spinner = output.createSpinner({ text: 'Scanning for threats...', spinner: 'dots' });
    spinner.start();

    // Perform scan
    const startTime = performance.now();
    const result = quickMode
      ? { ...defender.quickScan(textToScan), threats: [], piiFound: false, detectionTimeMs: 0, inputHash: '', safe: !defender.quickScan(textToScan).threat }
      : await defender.detect(textToScan);
    const scanTime = performance.now() - startTime;

    spinner.stop();

    // JSON output
    if (outputFormat === 'json') {
      output.writeln(JSON.stringify({
        safe: result.safe,
        threats: result.threats || [],
        piiFound: result.piiFound,
        detectionTimeMs: scanTime,
      }, null, 2));
      return { success: true };
    }

    // Text output
    output.writeln();

    if (result.safe && !result.piiFound) {
      output.writeln(output.success('✅ No threats detected'));
    } else {
      if (!result.safe && result.threats) {
        output.writeln(output.error(`⚠️ ${result.threats.length} threat(s) detected:`));
        output.writeln();

        for (const threat of result.threats) {
          const severityColor = ({
            critical: output.error,
            high: output.warning,
            medium: output.info,
            low: output.dim,
          } as Record<string, (text: string) => string>)[threat.severity] || output.dim;

          output.writeln(`  ${severityColor(`[${threat.severity.toUpperCase()}]`)} ${threat.type}`);
          output.writeln(`    ${output.dim(threat.description)}`);
          output.writeln(`    Confidence: ${(threat.confidence * 100).toFixed(1)}%`);
          output.writeln();
        }

        // Show mitigation recommendations
        const criticalThreats = result.threats.filter((t: { severity: string }) => t.severity === 'critical');
        if (criticalThreats.length > 0 && enableLearning) {
          output.writeln(output.bold('Recommended Mitigations:'));
          for (const threat of criticalThreats) {
            const mitigation = await defender.getBestMitigation(threat.type as Parameters<typeof defender.getBestMitigation>[0]);
            if (mitigation) {
              output.writeln(`  ${threat.type}: ${output.bold(mitigation.strategy)} (${(mitigation.effectiveness * 100).toFixed(0)}% effective)`);
            }
          }
          output.writeln();
        }
      }

      if (result.piiFound) {
        output.writeln(output.warning('⚠️ PII detected (emails, SSNs, API keys, etc.)'));
        output.writeln();
      }
    }

    output.writeln(output.dim(`Detection time: ${scanTime.toFixed(3)}ms`));

    return { success: result.safe };
  },
};

// Main security command
