/**
 * Pure agent-routing + command-risk helpers extracted from `mcp-tools/hooks-tools.ts`
 * (#code-quality: keep files under 500 lines). No I/O — just pattern data and
 * deterministic matching, so this is independently unit-testable.
 */

// Agent routing configuration - maps file types to recommended agents
export const AGENT_PATTERNS: Record<string, string[]> = {
  '.ts': ['coder', 'architect', 'tester'],
  '.tsx': ['coder', 'architect', 'reviewer'],
  '.test.ts': ['tester', 'reviewer'],
  '.spec.ts': ['tester', 'reviewer'],
  '.md': ['researcher', 'documenter'],
  '.json': ['coder', 'architect'],
  '.yaml': ['coder', 'devops'],
  '.yml': ['coder', 'devops'],
  '.sh': ['devops', 'coder'],
  '.py': ['coder', 'ml-developer', 'researcher'],
  '.sql': ['coder', 'architect'],
  '.css': ['coder', 'designer'],
  '.scss': ['coder', 'designer'],
};

// Keyword patterns for fallback routing (when semantic routing doesn't match)
export const KEYWORD_PATTERNS: Record<string, { agents: string[]; confidence: number }> = {
  'authentication': { agents: ['security-architect', 'coder', 'tester'], confidence: 0.9 },
  'auth': { agents: ['security-architect', 'coder', 'tester'], confidence: 0.85 },
  'api': { agents: ['architect', 'coder', 'tester'], confidence: 0.85 },
  'test': { agents: ['tester', 'reviewer'], confidence: 0.95 },
  'refactor': { agents: ['architect', 'coder', 'reviewer'], confidence: 0.9 },
  'performance': { agents: ['performance-engineer', 'coder', 'tester'], confidence: 0.88 },
  'security': { agents: ['security-architect', 'security-auditor', 'reviewer'], confidence: 0.92 },
  'database': { agents: ['architect', 'coder', 'tester'], confidence: 0.85 },
  'frontend': { agents: ['coder', 'designer', 'tester'], confidence: 0.82 },
  'backend': { agents: ['architect', 'coder', 'tester'], confidence: 0.85 },
  'bug': { agents: ['coder', 'tester', 'reviewer'], confidence: 0.88 },
  'fix': { agents: ['coder', 'tester', 'reviewer'], confidence: 0.85 },
  'feature': { agents: ['architect', 'coder', 'tester'], confidence: 0.8 },
  'swarm': { agents: ['swarm-specialist', 'coordinator', 'architect'], confidence: 0.9 },
  'memory': { agents: ['memory-specialist', 'architect', 'coder'], confidence: 0.88 },
  'deploy': { agents: ['devops', 'coder', 'tester'], confidence: 0.85 },
  'ci/cd': { agents: ['devops', 'coder'], confidence: 0.9 },
};

export function getFileExtension(filePath: string): string {
  const match = filePath.match(/\.[a-zA-Z0-9]+$/);
  return match ? match[0] : '';
}

export function suggestAgentsForFile(filePath: string): string[] {
  const ext = getFileExtension(filePath);

  // Check for test files first
  if (filePath.includes('.test.') || filePath.includes('.spec.')) {
    return AGENT_PATTERNS['.test.ts'] || ['tester', 'reviewer'];
  }

  return AGENT_PATTERNS[ext] || ['coder', 'architect'];
}

export function assessCommandRisk(command: string): { risk: string; level: number; warnings: string[] } {
  const warnings: string[] = [];
  let level = 0;

  // High risk commands
  if (command.includes('rm -rf') || command.includes('rm -r')) {
    level = Math.max(level, 0.9);
    warnings.push('Recursive deletion detected - verify target path');
  }
  if (command.includes('sudo')) {
    level = Math.max(level, 0.7);
    warnings.push('Elevated privileges requested');
  }
  if (command.includes('> /') || command.includes('>> /')) {
    level = Math.max(level, 0.6);
    warnings.push('Writing to system path');
  }
  if (command.includes('chmod') || command.includes('chown')) {
    level = Math.max(level, 0.5);
    warnings.push('Permission modification');
  }
  if (command.includes('curl') && command.includes('|')) {
    level = Math.max(level, 0.8);
    warnings.push('Piping remote content to shell');
  }

  // Safe commands
  if (command.startsWith('npm ') || command.startsWith('npx ')) {
    level = Math.min(level, 0.3);
  }
  if (command.startsWith('git ')) {
    level = Math.min(level, 0.2);
  }
  if (command.startsWith('ls ') || command.startsWith('cat ') || command.startsWith('echo ')) {
    level = Math.min(level, 0.1);
  }

  const risk = level >= 0.7 ? 'high' : level >= 0.4 ? 'medium' : 'low';

  return { risk, level, warnings };
}
