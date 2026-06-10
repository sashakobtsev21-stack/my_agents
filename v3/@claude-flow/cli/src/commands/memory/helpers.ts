/**
 * Shared constants + helpers for the memory subcommands — the backend
 * catalogue, the shared --path option (#2105), and relative-time
 * formatting. Pure data + a pure formatter, no logic.
 *
 * Extracted from memory.ts (W99, P3.10 cut #1).
 */

// Memory backends
export const BACKENDS = [
  { value: 'agentdb', label: 'AgentDB', hint: 'Vector database with HNSW indexing (~1.9x-4.7x (measured))' },
  { value: 'sqlite', label: 'SQLite', hint: 'Lightweight local storage' },
  { value: 'hybrid', label: 'Hybrid', hint: 'SQLite + AgentDB (recommended)' },
  { value: 'memory', label: 'In-Memory', hint: 'Fast but non-persistent' }
];

// #2105: shared --path option for memory subcommands.
// Precedence: --path > CLAUDE_FLOW_DB_PATH env var > default root
export const DB_PATH_OPTION = {
  name: 'path',
  description:
    'Override DB file path (also: CLAUDE_FLOW_DB_PATH env var). ' +
    'Precedence: --path > CLAUDE_FLOW_DB_PATH > CLAUDE_FLOW_MEMORY_PATH/memory.db > cwd/.swarm/memory.db',
  type: 'string' as const,
};

export function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const date = new Date(isoDate).getTime();
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
