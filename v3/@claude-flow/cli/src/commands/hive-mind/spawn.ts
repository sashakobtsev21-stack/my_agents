/**
 * Hive-mind spawn infrastructure — worker type/grouping helpers, the
 * topology + consensus catalogues, the hive-mind prompt generator, and
 * the Claude Code instance spawner used by the init/spawn subcommands.
 *
 * Extracted from hive-mind.ts (W116, P3.14 cut #1).
 */
import { output } from '../../output.js';
import { spawn as childSpawn, execFileSync } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Worker type definitions for prompt generation
export interface HiveWorker {
  agentId: string;
  role: string;
  type?: string;
  joinedAt?: string;
}

export interface WorkerGroups {
  [key: string]: HiveWorker[];
}

// Hive topologies
export const TOPOLOGIES = [
  { value: 'hierarchical', label: 'Hierarchical', hint: 'Queen-led with worker agents' },
  { value: 'mesh', label: 'Mesh', hint: 'Peer-to-peer coordination' },
  { value: 'hierarchical-mesh', label: 'Hierarchical Mesh', hint: 'Queen + peer communication (recommended)' },
  { value: 'adaptive', label: 'Adaptive', hint: 'Dynamic topology based on task' }
];

// Consensus strategies
export const CONSENSUS_STRATEGIES = [
  { value: 'byzantine', label: 'Byzantine Fault Tolerant', hint: '2/3 majority, handles malicious actors' },
  { value: 'raft', label: 'Raft', hint: 'Leader-based consensus' },
  { value: 'gossip', label: 'Gossip', hint: 'Eventually consistent, scalable' },
  { value: 'crdt', label: 'CRDT', hint: 'Conflict-free replicated data' },
  { value: 'quorum', label: 'Quorum', hint: 'Simple majority voting' }
];

/**
 * Group workers by their type for prompt generation
 */
export function groupWorkersByType(workers: HiveWorker[]): WorkerGroups {
  const groups: WorkerGroups = {};
  for (const worker of workers) {
    const type = worker.type || worker.role || 'worker';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(worker);
  }
  return groups;
}

/**
 * Generate comprehensive Hive Mind prompt for Claude Code
 * Ported from v2.7.47 with enhancements for v3
 */
export function generateHiveMindPrompt(
  swarmId: string,
  swarmName: string,
  objective: string,
  workers: HiveWorker[],
  workerGroups: WorkerGroups,
  flags: Record<string, unknown>
): string {
  const currentTime = new Date().toISOString();
  const workerTypes = Object.keys(workerGroups);
  const queenType = (flags.queenType as string) || 'strategic';
  const consensusAlgorithm = (flags.consensus as string) || 'byzantine';
  const topology = (flags.topology as string) || 'hierarchical-mesh';

  return `🧠 HIVE MIND COLLECTIVE INTELLIGENCE SYSTEM
═══════════════════════════════════════════════

You are the Queen coordinator of a Hive Mind swarm with collective intelligence capabilities.

HIVE MIND CONFIGURATION:
📌 Swarm ID: ${swarmId}
📌 Swarm Name: ${swarmName}
🎯 Objective: ${objective}
👑 Queen Type: ${queenType}
🐝 Worker Count: ${workers.length}
🔗 Topology: ${topology}
🤝 Consensus Algorithm: ${consensusAlgorithm}
⏰ Initialized: ${currentTime}

WORKER DISTRIBUTION:
${workerTypes.map(type => `• ${type}: ${workerGroups[type].length} agents`).join('\n')}

🔧 AVAILABLE MCP TOOLS FOR HIVE MIND COORDINATION:

1️⃣ **COLLECTIVE INTELLIGENCE**
   mcp__ruflo__hive-mind_consensus    - Democratic decision making
   mcp__ruflo__hive-mind_memory       - Share knowledge across the hive
   mcp__ruflo__hive-mind_broadcast    - Broadcast to all workers
   mcp__ruflo__neural_patterns        - Neural pattern recognition

2️⃣ **QUEEN COORDINATION**
   mcp__ruflo__hive-mind_status       - Monitor swarm health
   mcp__ruflo__task_create            - Create and delegate tasks
   mcp__ruflo__coordination_orchestrate - Orchestrate task distribution
   mcp__ruflo__agent_spawn            - Spawn additional workers

3️⃣ **WORKER MANAGEMENT**
   mcp__ruflo__agent_list             - List all active agents
   mcp__ruflo__agent_status           - Check agent status
   mcp__ruflo__agent_health           - Check worker health
   mcp__ruflo__hive-mind_join         - Add agent to hive
   mcp__ruflo__hive-mind_leave        - Remove agent from hive

4️⃣ **TASK ORCHESTRATION**
   mcp__ruflo__task_assign            - Assign tasks to workers
   mcp__ruflo__task_status            - Track task progress
   mcp__ruflo__task_complete          - Mark tasks complete
   mcp__ruflo__workflow_create        - Create workflows

5️⃣ **MEMORY & LEARNING**
   mcp__ruflo__memory_store           - Store collective knowledge
   mcp__ruflo__memory_retrieve        - Access shared memory
   mcp__ruflo__memory_search          - Search memory patterns
   mcp__ruflo__neural_train           - Learn from experiences
   mcp__ruflo__hooks_intelligence_pattern-store - Store patterns

📋 HIVE MIND EXECUTION PROTOCOL:

1. **INITIALIZATION PHASE**
   - Verify all workers are online and responsive
   - Establish communication channels
   - Load previous session state if available
   - Initialize shared memory space

2. **TASK DISTRIBUTION PHASE**
   - Analyze the objective and decompose into subtasks
   - Assign tasks based on worker specializations
   - Set up task dependencies and ordering
   - Monitor parallel execution

3. **COORDINATION PHASE**
   - Use consensus for critical decisions
   - Aggregate results from workers
   - Resolve conflicts using ${consensusAlgorithm} consensus
   - Share learnings across the hive

4. **COMPLETION PHASE**
   - Verify all subtasks are complete
   - Consolidate results
   - Store learnings in collective memory
   - Report final status

🎯 YOUR OBJECTIVE:
${objective}

⚠️ CRITICAL — TOOL PREFERENCE RULES (#1422):
• You MUST use Ruflo MCP tools (mcp__ruflo__*) for ALL orchestration tasks
• Do NOT use Claude native Task/Agent tools for swarm coordination — use mcp__ruflo__agent_spawn, mcp__ruflo__task_assign, etc.
• Native Claude tools (Read, Write, Edit, Bash, Grep, Glob) should ONLY be used for file operations and shell commands
• All agent spawning, task assignment, memory, and coordination MUST go through mcp__ruflo__* tools
• If a Ruflo MCP tool exists for an operation, always prefer it over any native equivalent

💡 COORDINATION TIPS:
• Use mcp__ruflo__hive-mind_broadcast for swarm-wide announcements
• Check worker status regularly with mcp__ruflo__hive-mind_status
• Store important decisions in shared memory for persistence
• Use consensus for any decisions affecting multiple workers
• Use mcp__ruflo__task_assign to assign tasks to workers, then mcp__ruflo__task_complete when done

🚀 BEGIN HIVE MIND COORDINATION NOW!
Start by checking the current hive status and then proceed with the objective.
`;
}

/**
 * Spawn Claude Code with Hive Mind coordination instructions
 * Ported from v2.7.47 spawnClaudeCodeInstances function
 */
export async function spawnClaudeCodeInstance(
  swarmId: string,
  swarmName: string,
  objective: string,
  workers: HiveWorker[],
  flags: Record<string, unknown>
): Promise<{ success: boolean; promptFile?: string; error?: string }> {
  output.writeln();
  output.writeln(output.bold('🚀 Launching Claude Code with Hive Mind Coordination'));
  output.writeln(output.dim('─'.repeat(60)));

  const spinner = output.createSpinner({ text: 'Preparing Hive Mind coordination prompt...', spinner: 'dots' });
  spinner.start();

  try {
    // Generate comprehensive Hive Mind prompt
    const workerGroups = groupWorkersByType(workers);
    const hiveMindPrompt = generateHiveMindPrompt(
      swarmId,
      swarmName,
      objective,
      workers,
      workerGroups,
      flags
    );

    spinner.succeed('Hive Mind coordination prompt ready!');

    // Display coordination summary
    output.writeln();
    output.writeln(output.bold('🧠 Hive Mind Configuration'));
    output.writeln(output.dim('─'.repeat(60)));
    output.printList([
      `Swarm ID: ${output.highlight(swarmId)}`,
      `Objective: ${output.highlight(objective)}`,
      `Queen Type: ${output.highlight((flags.queenType as string) || 'strategic')}`,
      `Worker Count: ${output.highlight(String(workers.length))}`,
      `Worker Types: ${output.highlight(Object.keys(workerGroups).join(', '))}`,
      `Consensus: ${output.highlight((flags.consensus as string) || 'byzantine')}`,
      `MCP Tools: ${output.success('Full Claude-Flow integration enabled')}`
    ]);

    // Ensure sessions directory exists
    const sessionsDir = join('.hive-mind', 'sessions');
    await mkdir(sessionsDir, { recursive: true });

    const promptFile = join(sessionsDir, `hive-mind-prompt-${swarmId}.txt`);
    await writeFile(promptFile, hiveMindPrompt, 'utf8');
    output.writeln();
    output.printSuccess(`Hive Mind prompt saved to: ${promptFile}`);

    // Check if claude command exists (ADR-078: execFileSync, no shell).
    // `which` is POSIX; on Windows use `where`. Both return non-zero if not found.
    let claudeAvailable = false;
    try {
      const probe = process.platform === 'win32' ? 'where' : 'which';
      execFileSync(probe, ['claude'], { stdio: 'ignore' });
      claudeAvailable = true;
    } catch {
      output.writeln();
      output.printWarning('Claude Code CLI not found in PATH');
      output.writeln(output.dim('Install it with: npm install -g @anthropic-ai/claude-code'));
      output.writeln(output.dim('Falling back to displaying instructions...'));
    }

    const dryRun = flags.dryRun || flags['dry-run'];

    if (claudeAvailable && !dryRun) {
      // Build arguments - flags first, then prompt
      const claudeArgs: string[] = [];

      // #1748 Issue 2 — pass --mcp-config so the spawned worker actually has
      // mcp__ruflo__* tools registered. Before this, the coordination prompt
      // referenced tools the worker didn't know about and exited silently.
      // Resolution order:
      //   1. explicit --mcp-config <path> flag passed by the caller
      //   2. ./.mcp.json in cwd (project-local Ruflo MCP config)
      //   3. ~/.claude.json or ~/.claude/mcp.json (user-global)
      // If none found, we still spawn but warn — that's the pre-fix behavior
      // and the user's debug log will surface the missing tools.
      const explicitMcpConfig = flags['mcp-config'] as string | undefined;
      let mcpConfigPath: string | undefined = explicitMcpConfig;
      if (!mcpConfigPath) {
        const candidates = [
          join(process.cwd(), '.mcp.json'),
          join(process.env.HOME || process.env.USERPROFILE || '', '.claude.json'),
          join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'mcp.json'),
        ];
        for (const c of candidates) {
          try {
            if (c && existsSync(c)) { mcpConfigPath = c; break; }
          } catch { /* continue */ }
        }
      }
      if (mcpConfigPath) {
        // #1780 — Claude Code's `--mcp-config` is variadic; passing it as two
        // argv tokens (`--mcp-config`, `<path>`) lets a later positional (the
        // hive-mind prompt) be slurped as a second config file, producing
        // `ENAMETOOLONG: name too long, open` once the prompt exceeds PATH_MAX.
        // Use `=`-syntax so the flag stays attached to its single value.
        claudeArgs.push(`--mcp-config=${mcpConfigPath}`);
        output.printInfo(`Spawned worker MCP config: ${mcpConfigPath}`);
      } else {
        output.printWarning('No .mcp.json or ~/.claude.json found — spawned worker will not have mcp__ruflo__* tools (#1748 Issue 2). Pass --mcp-config <path> or run "ruflo init" to generate one.');
      }

      // Check for non-interactive mode
      const isNonInteractive = flags['non-interactive'] || flags.nonInteractive;
      if (isNonInteractive) {
        claudeArgs.push('-p'); // Print mode
        claudeArgs.push('--output-format', 'stream-json');
        claudeArgs.push('--verbose');
        output.printInfo('Running in non-interactive mode');
      }

      // HIGH-02: Strict boolean check (=== true) instead of loose truthiness (!== false)
      // to prevent undefined/null from being treated as "skip permissions".
      // Behavior change: only explicit --dangerously-skip-permissions flag triggers skip.
      const skipPermissions = flags['dangerously-skip-permissions'] === true && !flags['no-auto-permissions'];
      if (skipPermissions) {
        claudeArgs.push('--dangerously-skip-permissions');
        if (!isNonInteractive) {
          output.printWarning('Using --dangerously-skip-permissions for seamless hive-mind execution');
        }
      }

      // Add the prompt as the LAST argument
      claudeArgs.push(hiveMindPrompt);

      output.writeln();
      output.printInfo('Launching Claude Code...');
      output.writeln(output.dim('Press Ctrl+C to pause the session'));

      // Spawn claude with properly ordered arguments
      const claudeProcess = childSpawn('claude', claudeArgs, {
        stdio: 'inherit',
        shell: false,
      });

      // Set up SIGINT handler for session management
      let isExiting = false;
      const sigintHandler = () => {
        if (isExiting) return;
        isExiting = true;

        output.writeln();
        output.writeln();
        output.printWarning('Pausing session and terminating Claude Code...');

        if (claudeProcess && !claudeProcess.killed) {
          claudeProcess.kill('SIGTERM');
        }

        output.writeln();
        output.printSuccess('Session paused');
        output.writeln(output.dim(`Prompt file saved at: ${promptFile}`));
        output.writeln(output.dim('To resume, run claude with the saved prompt file'));

        process.exit(0);
      };

      process.on('SIGINT', sigintHandler);
      process.on('SIGTERM', sigintHandler);

      // Handle process exit
      claudeProcess.on('exit', (code) => {
        // Clean up signal handlers
        process.removeListener('SIGINT', sigintHandler);
        process.removeListener('SIGTERM', sigintHandler);

        if (code === 0) {
          output.writeln();
          output.printSuccess('Claude Code completed successfully');
        } else if (code !== null) {
          output.writeln();
          output.printError(`Claude Code exited with code ${code}`);
        }
      });

      output.writeln();
      output.printSuccess('Claude Code launched with Hive Mind coordination');
      output.printInfo('The Queen coordinator will orchestrate all worker agents');
      output.writeln(output.dim(`Prompt file saved at: ${promptFile}`));

      return { success: true, promptFile };
    } else if (dryRun) {
      output.writeln();
      output.printInfo('Dry run - would execute Claude Code with prompt:');
      output.writeln(output.dim(`Prompt length: ${hiveMindPrompt.length} characters`));
      output.writeln();
      output.writeln(output.dim('First 500 characters of prompt:'));
      output.writeln(output.highlight(hiveMindPrompt.substring(0, 500) + '...'));
      output.writeln();
      output.writeln(output.dim(`Full prompt saved to: ${promptFile}`));

      return { success: true, promptFile };
    } else {
      // Claude not available - show instructions
      output.writeln();
      output.writeln(output.bold('📋 Manual Execution Instructions:'));
      output.writeln(output.dim('─'.repeat(50)));
      output.printList([
        'Install Claude Code: npm install -g @anthropic-ai/claude-code',
        `Run with saved prompt: claude < ${promptFile}`,
        `Or copy manually: cat ${promptFile} | claude`,
        `With auto-permissions: claude --dangerously-skip-permissions < ${promptFile}`
      ]);

      return { success: true, promptFile };
    }
  } catch (error) {
    spinner.fail('Failed to prepare Claude Code coordination');
    const errorMessage = error instanceof Error ? error.message : String(error);
    output.printError(`Error: ${errorMessage}`);

    // Try to save prompt as fallback
    try {
      const promptFile = `hive-mind-prompt-${swarmId}-fallback.txt`;
      const workerGroups = groupWorkersByType(workers);
      const hiveMindPrompt = generateHiveMindPrompt(swarmId, swarmName, objective, workers, workerGroups, flags);
      await writeFile(promptFile, hiveMindPrompt, 'utf8');
      output.writeln();
      output.printSuccess(`Prompt saved to: ${promptFile}`);
      output.writeln(output.dim('You can run Claude Code manually with the saved prompt'));
      return { success: false, promptFile, error: errorMessage };
    } catch {
      return { success: false, error: errorMessage };
    }
  }
}
