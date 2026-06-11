/**
 * SKILL.md Generator — built-in skill catalog
 *
 * generateBuiltInSkill: the inline SKILL.md templates for the bundled
 * skills. Extracted verbatim from skill-md.ts (lines 152-720) during
 * campaign-2 wave 2 (W208). skill-md.ts stays the barrel.
 */

import type { SkillMdOptions } from '../types.js';
import { generateSkillMd } from './skill-md.js';
import { generateHelperScript } from './skill-md-scripts.js';

export async function generateBuiltInSkill(
  skillName: string
): Promise<{ skillMd: string; scripts: Record<string, string>; references: Record<string, string> }> {
  const skillTemplates: Record<string, SkillMdOptions> = {
    'swarm-orchestration': {
      name: 'swarm-orchestration',
      description: 'Multi-agent swarm coordination for complex tasks. Uses hierarchical topology with specialized agents to break down and execute complex work across multiple files and modules.',
      triggers: [
        '3+ files need changes',
        'new feature implementation',
        'cross-module refactoring',
        'API changes with tests',
        'security-related changes',
        'performance optimization across codebase',
        'database schema changes',
      ],
      skipWhen: [
        'single file edits',
        'simple bug fixes (1-2 lines)',
        'documentation updates',
        'configuration changes',
        'quick exploration',
      ],
      commands: [
        {
          name: 'Initialize Swarm',
          description: 'Start a new swarm with hierarchical topology (anti-drift)',
          command: 'npx ruflo swarm init --topology hierarchical --max-agents 8 --strategy specialized',
          example: 'npx ruflo swarm init --topology hierarchical --max-agents 6 --strategy specialized',
        },
        {
          name: 'Route Task',
          description: 'Route a task to the appropriate agents based on task type',
          command: 'npx @claude-flow/cli hooks route --task "[task description]"',
          example: 'npx @claude-flow/cli hooks route --task "implement OAuth2 authentication flow"',
        },
        {
          name: 'Spawn Agent',
          description: 'Spawn a specific agent type',
          command: 'npx @claude-flow/cli agent spawn --type [type] --name [name]',
          example: 'npx @claude-flow/cli agent spawn --type coder --name impl-auth',
        },
        {
          name: 'Monitor Status',
          description: 'Check the current swarm status',
          command: 'npx @claude-flow/cli swarm status --verbose',
        },
        {
          name: 'Orchestrate Task',
          description: 'Orchestrate a task across multiple agents',
          command: 'npx @claude-flow/cli task orchestrate --task "[task]" --strategy adaptive',
          example: 'npx @claude-flow/cli task orchestrate --task "refactor auth module" --strategy parallel --max-agents 4',
        },
        {
          name: 'List Agents',
          description: 'List all active agents',
          command: 'npx @claude-flow/cli agent list --filter active',
        },
      ],
      scripts: [
        {
          name: 'swarm-start',
          path: '.agents/scripts/swarm-start.sh',
          description: 'Initialize swarm with default settings',
        },
        {
          name: 'swarm-monitor',
          path: '.agents/scripts/swarm-monitor.sh',
          description: 'Real-time swarm monitoring dashboard',
        },
      ],
      references: [
        {
          name: 'Agent Types',
          path: 'docs/agents.md',
          description: 'Complete list of agent types and capabilities',
        },
        {
          name: 'Topology Guide',
          path: 'docs/topology.md',
          description: 'Swarm topology configuration guide',
        },
      ],
    },
    'memory-management': {
      name: 'memory-management',
      description: 'AgentDB memory system with HNSW vector search. Provides ~1.9x-4.7x pattern retrieval (measured), persistent storage, and semantic search capabilities for learning and knowledge management.',
      triggers: [
        'need to store successful patterns',
        'searching for similar solutions',
        'semantic lookup of past work',
        'learning from previous tasks',
        'sharing knowledge between agents',
        'building knowledge base',
      ],
      skipWhen: [
        'no learning needed',
        'ephemeral one-off tasks',
        'external data sources available',
        'read-only exploration',
      ],
      commands: [
        {
          name: 'Store Pattern',
          description: 'Store a pattern or knowledge item in memory',
          command: 'npx @claude-flow/cli memory store --key "[key]" --value "[value]" --namespace patterns',
          example: 'npx @claude-flow/cli memory store --key "auth-jwt-pattern" --value "JWT validation with refresh tokens" --namespace patterns',
        },
        {
          name: 'Semantic Search',
          description: 'Search memory using semantic similarity',
          command: 'npx @claude-flow/cli memory search --query "[search terms]" --limit 10',
          example: 'npx @claude-flow/cli memory search --query "authentication best practices" --limit 5',
        },
        {
          name: 'Retrieve Entry',
          description: 'Retrieve a specific memory entry by key',
          command: 'npx @claude-flow/cli memory get --key "[key]" --namespace [namespace]',
          example: 'npx @claude-flow/cli memory get --key "auth-jwt-pattern" --namespace patterns',
        },
        {
          name: 'List Entries',
          description: 'List all entries in a namespace',
          command: 'npx @claude-flow/cli memory list --namespace [namespace]',
          example: 'npx @claude-flow/cli memory list --namespace patterns --limit 20',
        },
        {
          name: 'Delete Entry',
          description: 'Delete a memory entry',
          command: 'npx @claude-flow/cli memory delete --key "[key]" --namespace [namespace]',
        },
        {
          name: 'Initialize HNSW Index',
          description: 'Initialize HNSW vector search index',
          command: 'npx @claude-flow/cli memory init --enable-hnsw',
        },
        {
          name: 'Memory Stats',
          description: 'Show memory usage statistics',
          command: 'npx @claude-flow/cli memory stats',
        },
        {
          name: 'Export Memory',
          description: 'Export memory to JSON',
          command: 'npx @claude-flow/cli memory export --output memory-backup.json',
        },
      ],
      scripts: [
        {
          name: 'memory-backup',
          path: '.agents/scripts/memory-backup.sh',
          description: 'Backup memory to external storage',
        },
        {
          name: 'memory-consolidate',
          path: '.agents/scripts/memory-consolidate.sh',
          description: 'Consolidate and optimize memory',
        },
      ],
      references: [
        {
          name: 'HNSW Guide',
          path: 'docs/hnsw.md',
          description: 'HNSW vector search configuration',
        },
        {
          name: 'Memory Schema',
          path: 'docs/memory-schema.md',
          description: 'Memory namespace and schema reference',
        },
      ],
    },
    'sparc-methodology': {
      name: 'sparc-methodology',
      description: 'SPARC development workflow: Specification, Pseudocode, Architecture, Refinement, Completion. A structured approach for complex implementations that ensures thorough planning before coding.',
      triggers: [
        'new feature implementation',
        'complex implementations',
        'architectural changes',
        'system redesign',
        'integration work',
        'unclear requirements',
      ],
      skipWhen: [
        'simple bug fixes',
        'documentation updates',
        'configuration changes',
        'well-defined small tasks',
        'routine maintenance',
      ],
      commands: [
        {
          name: 'Specification Phase',
          description: 'Define requirements, acceptance criteria, and constraints',
          command: 'npx @claude-flow/cli hooks route --task "specification: [requirements]"',
          example: 'npx @claude-flow/cli hooks route --task "specification: user authentication with OAuth2, MFA, and session management"',
        },
        {
          name: 'Pseudocode Phase',
          description: 'Write high-level pseudocode for the implementation',
          command: 'npx @claude-flow/cli hooks route --task "pseudocode: [feature]"',
          example: 'npx @claude-flow/cli hooks route --task "pseudocode: OAuth2 login flow with token refresh"',
        },
        {
          name: 'Architecture Phase',
          description: 'Design system structure, interfaces, and dependencies',
          command: 'npx @claude-flow/cli hooks route --task "architecture: [design]"',
          example: 'npx @claude-flow/cli hooks route --task "architecture: auth module with service layer, repository, and API endpoints"',
        },
        {
          name: 'Refinement Phase',
          description: 'Iterate on the design based on feedback',
          command: 'npx @claude-flow/cli hooks route --task "refinement: [feedback]"',
          example: 'npx @claude-flow/cli hooks route --task "refinement: add rate limiting and brute force protection"',
        },
        {
          name: 'Completion Phase',
          description: 'Finalize implementation with tests and documentation',
          command: 'npx @claude-flow/cli hooks route --task "completion: [final checks]"',
          example: 'npx @claude-flow/cli hooks route --task "completion: verify all tests pass, update API docs, security review"',
        },
        {
          name: 'SPARC Coordinator',
          description: 'Spawn SPARC coordinator agent',
          command: 'npx @claude-flow/cli agent spawn --type sparc-coord --name sparc-lead',
        },
      ],
      scripts: [
        {
          name: 'sparc-init',
          path: '.agents/scripts/sparc-init.sh',
          description: 'Initialize SPARC workflow for a new feature',
        },
        {
          name: 'sparc-review',
          path: '.agents/scripts/sparc-review.sh',
          description: 'Run SPARC phase review checklist',
        },
      ],
      references: [
        {
          name: 'SPARC Overview',
          path: 'docs/sparc.md',
          description: 'Complete SPARC methodology guide',
        },
        {
          name: 'Phase Templates',
          path: 'docs/sparc-templates.md',
          description: 'Templates for each SPARC phase',
        },
      ],
    },
    'security-audit': {
      name: 'security-audit',
      description: 'Comprehensive security scanning and vulnerability detection. Includes input validation, path traversal prevention, CVE detection, and secure coding pattern enforcement.',
      triggers: [
        'authentication implementation',
        'authorization logic',
        'payment processing',
        'user data handling',
        'API endpoint creation',
        'file upload handling',
        'database queries',
        'external API integration',
      ],
      skipWhen: [
        'read-only operations on public data',
        'internal development tooling',
        'static documentation',
        'styling changes',
      ],
      commands: [
        {
          name: 'Full Security Scan',
          description: 'Run comprehensive security analysis on the codebase',
          command: 'npx @claude-flow/cli security scan --depth full',
          example: 'npx @claude-flow/cli security scan --depth full --output security-report.json',
        },
        {
          name: 'Input Validation Check',
          description: 'Check for input validation issues',
          command: 'npx @claude-flow/cli security scan --check input-validation',
          example: 'npx @claude-flow/cli security scan --check input-validation --path ./src/api',
        },
        {
          name: 'Path Traversal Check',
          description: 'Check for path traversal vulnerabilities',
          command: 'npx @claude-flow/cli security scan --check path-traversal',
        },
        {
          name: 'SQL Injection Check',
          description: 'Check for SQL injection vulnerabilities',
          command: 'npx @claude-flow/cli security scan --check sql-injection',
        },
        {
          name: 'XSS Check',
          description: 'Check for cross-site scripting vulnerabilities',
          command: 'npx @claude-flow/cli security scan --check xss',
        },
        {
          name: 'CVE Scan',
          description: 'Scan dependencies for known CVEs',
          command: 'npx @claude-flow/cli security cve --scan',
          example: 'npx @claude-flow/cli security cve --scan --severity high',
        },
        {
          name: 'Security Audit Report',
          description: 'Generate full security audit report',
          command: 'npx @claude-flow/cli security audit --report',
          example: 'npx @claude-flow/cli security audit --report --format markdown --output SECURITY.md',
        },
        {
          name: 'Threat Modeling',
          description: 'Run threat modeling analysis',
          command: 'npx @claude-flow/cli security threats --analyze',
        },
        {
          name: 'Validate Secrets',
          description: 'Check for hardcoded secrets',
          command: 'npx @claude-flow/cli security validate --check secrets',
        },
      ],
      scripts: [
        {
          name: 'security-scan',
          path: '.agents/scripts/security-scan.sh',
          description: 'Run full security scan pipeline',
        },
        {
          name: 'cve-remediate',
          path: '.agents/scripts/cve-remediate.sh',
          description: 'Auto-remediate known CVEs',
        },
      ],
      references: [
        {
          name: 'Security Checklist',
          path: 'docs/security-checklist.md',
          description: 'Security review checklist',
        },
        {
          name: 'OWASP Guide',
          path: 'docs/owasp-top10.md',
          description: 'OWASP Top 10 mitigation guide',
        },
      ],
    },
    'performance-analysis': {
      name: 'performance-analysis',
      description: 'Performance profiling, benchmarking, and optimization. Includes CPU profiling, memory analysis, latency measurement, and automated optimization suggestions.',
      triggers: [
        'slow operations detected',
        'memory usage issues',
        'optimization needed',
        'pre-release performance validation',
        'database query optimization',
        'API latency concerns',
        'bundle size analysis',
      ],
      skipWhen: [
        'early feature development',
        'documentation updates',
        'prototyping phase',
        'configuration changes',
      ],
      commands: [
        {
          name: 'Run Benchmark Suite',
          description: 'Execute all performance benchmarks',
          command: 'npx @claude-flow/cli performance benchmark --suite all',
          example: 'npx @claude-flow/cli performance benchmark --suite all --iterations 100 --output bench-results.json',
        },
        {
          name: 'Profile Code',
          description: 'Profile code execution for CPU and memory',
          command: 'npx @claude-flow/cli performance profile --target ./src',
          example: 'npx @claude-flow/cli performance profile --target ./src/api --duration 60s',
        },
        {
          name: 'Memory Analysis',
          description: 'Analyze memory usage patterns',
          command: 'npx @claude-flow/cli performance metrics --metric memory',
          example: 'npx @claude-flow/cli performance metrics --metric memory --threshold 100MB',
        },
        {
          name: 'Latency Analysis',
          description: 'Measure and analyze latency',
          command: 'npx @claude-flow/cli performance metrics --metric latency',
        },
        {
          name: 'Optimize Suggestions',
          description: 'Get automated optimization suggestions',
          command: 'npx @claude-flow/cli performance optimize --analyze',
          example: 'npx @claude-flow/cli performance optimize --analyze --apply-safe',
        },
        {
          name: 'Performance Report',
          description: 'Generate performance report',
          command: 'npx @claude-flow/cli performance report',
          example: 'npx @claude-flow/cli performance report --format html --output perf-report.html',
        },
        {
          name: 'Compare Benchmarks',
          description: 'Compare benchmark results',
          command: 'npx @claude-flow/cli performance benchmark --compare baseline.json current.json',
        },
        {
          name: 'WASM Benchmark',
          description: 'Run WASM-specific benchmarks',
          command: 'npx @claude-flow/cli performance benchmark --suite wasm',
        },
      ],
      scripts: [
        {
          name: 'perf-baseline',
          path: '.agents/scripts/perf-baseline.sh',
          description: 'Capture performance baseline',
        },
        {
          name: 'perf-regression',
          path: '.agents/scripts/perf-regression.sh',
          description: 'Check for performance regressions',
        },
      ],
      references: [
        {
          name: 'Performance Guide',
          path: 'docs/performance.md',
          description: 'Performance optimization guide',
        },
        {
          name: 'Benchmark Reference',
          path: 'docs/benchmarks.md',
          description: 'Benchmark configuration reference',
        },
      ],
    },
    'github-automation': {
      name: 'github-automation',
      description: 'GitHub workflow automation including PR management, CI/CD, issue tracking, and release management. Integrates with GitHub CLI for seamless automation.',
      triggers: [
        'creating pull requests',
        'setting up CI/CD pipelines',
        'release management',
        'issue tracking automation',
        'branch management',
        'code review workflows',
        'repository maintenance',
      ],
      skipWhen: [
        'local-only development',
        'prototyping without commits',
        'non-GitHub repositories',
        'offline work',
      ],
      commands: [
        {
          name: 'Create Pull Request',
          description: 'Create a new pull request with summary',
          command: 'gh pr create --title "[title]" --body "[description]"',
          example: 'gh pr create --title "feat: add OAuth2 authentication" --body "## Summary\\n- Implemented OAuth2 flow\\n- Added token refresh\\n\\n## Test Plan\\n- Run auth tests"',
        },
        {
          name: 'View PR',
          description: 'View pull request details',
          command: 'gh pr view [number]',
          example: 'gh pr view 123 --comments',
        },
        {
          name: 'Merge PR',
          description: 'Merge a pull request',
          command: 'gh pr merge [number] --squash',
          example: 'gh pr merge 123 --squash --delete-branch',
        },
        {
          name: 'Run Workflow',
          description: 'Trigger a GitHub Actions workflow',
          command: 'gh workflow run [workflow]',
          example: 'gh workflow run ci.yml --ref feature-branch',
        },
        {
          name: 'View Workflow Runs',
          description: 'List recent workflow runs',
          command: 'gh run list --limit 10',
        },
        {
          name: 'Create Issue',
          description: 'Create a new issue',
          command: 'gh issue create --title "[title]" --body "[body]"',
          example: 'gh issue create --title "Bug: login fails on mobile" --body "## Description\\n..." --label bug',
        },
        {
          name: 'Create Release',
          description: 'Create a new release',
          command: 'gh release create [tag] --notes "[notes]"',
          example: 'gh release create v1.0.0 --notes "Initial release" --generate-notes',
        },
        {
          name: 'View Checks',
          description: 'View PR check status',
          command: 'gh pr checks [number]',
          example: 'gh pr checks 123 --watch',
        },
        {
          name: 'Review PR',
          description: 'Submit a PR review',
          command: 'gh pr review [number] --approve --body "[comment]"',
          example: 'gh pr review 123 --approve --body "LGTM! Great work on the tests."',
        },
      ],
      scripts: [
        {
          name: 'pr-template',
          path: '.agents/scripts/pr-template.sh',
          description: 'Generate PR from template',
        },
        {
          name: 'release-prep',
          path: '.agents/scripts/release-prep.sh',
          description: 'Prepare release with changelog',
        },
      ],
      references: [
        {
          name: 'GitHub CLI Reference',
          path: 'docs/gh-cli.md',
          description: 'GitHub CLI command reference',
        },
        {
          name: 'PR Guidelines',
          path: 'docs/pr-guidelines.md',
          description: 'Pull request best practices',
        },
        {
          name: 'CI/CD Setup',
          path: 'docs/ci-cd.md',
          description: 'CI/CD pipeline configuration',
        },
      ],
    },
  };

  const template = skillTemplates[skillName];
  if (!template) {
    throw new Error(`Unknown built-in skill: ${skillName}`);
  }

  const skillMd = await generateSkillMd(template);

  // Generate helper scripts
  const scripts: Record<string, string> = {};
  if (template.scripts) {
    for (const script of template.scripts) {
      // Use just the script filename, not the full path
      const scriptFilename = `${script.name}.sh`;
      scripts[scriptFilename] = generateHelperScript(skillName, script.name);
    }
  }

  return {
    skillMd,
    scripts,
    references: {},
  };
}

/**
 * Generate a helper script for a skill
 */
