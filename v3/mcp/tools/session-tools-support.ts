/**
 * V3 MCP Session Tools — schemas, types, store & helpers
 *
 * Module-private in the original session-tools.ts (campaign-2 W248);
 * NOT re-exported by the barrel.
 */

import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';


// Secure ID generation helper
export function generateSecureSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(12).toString('hex');
  return `session-${timestamp}-${random}`;
}

// Default session directory
export const DEFAULT_SESSION_DIR = '.claude-flow/sessions';


// Input Schemas
// ============================================================================

export const saveSessionSchema = z.object({
  name: z.string().min(1).max(100).optional()
    .describe('Session name (auto-generated if not provided)'),
  description: z.string().max(500).optional()
    .describe('Session description'),
  includeAgents: z.boolean().default(true)
    .describe('Include agent states in the session'),
  includeTasks: z.boolean().default(true)
    .describe('Include task queue in the session'),
  includeMemory: z.boolean().default(true)
    .describe('Include memory entries in the session'),
  includeSwarmState: z.boolean().default(true)
    .describe('Include swarm coordination state'),
  tags: z.array(z.string()).optional()
    .describe('Tags for categorizing the session'),
  metadata: z.record(z.unknown()).optional()
    .describe('Additional metadata'),
});

export const restoreSessionSchema = z.object({
  sessionId: z.string().describe('ID of the session to restore'),
  restoreAgents: z.boolean().default(true)
    .describe('Restore agent states'),
  restoreTasks: z.boolean().default(true)
    .describe('Restore task queue'),
  restoreMemory: z.boolean().default(true)
    .describe('Restore memory entries'),
  restoreSwarmState: z.boolean().default(true)
    .describe('Restore swarm coordination state'),
  clearExisting: z.boolean().default(false)
    .describe('Clear existing state before restore'),
});

export const listSessionsSchema = z.object({
  limit: z.number().int().positive().max(1000).default(50)
    .describe('Maximum number of sessions to return'),
  offset: z.number().int().nonnegative().default(0)
    .describe('Offset for pagination'),
  tags: z.array(z.string()).optional()
    .describe('Filter by tags'),
  sortBy: z.enum(['created', 'name', 'size']).default('created')
    .describe('Sort order'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
    .describe('Sort direction'),
  includeMetadata: z.boolean().default(true)
    .describe('Include session metadata'),
});

// ============================================================================
// Type Definitions
// ============================================================================

export interface SessionAgent {
  id: string;
  type: string;
  status: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SessionTask {
  id: string;
  type: string;
  description: string;
  status: string;
  priority: number;
  dependencies: string[];
  assignedTo?: string;
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SessionMemoryEntry {
  id: string;
  content: string;
  type: string;
  category?: string;
  tags?: string[];
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface SessionSwarmState {
  topology: string;
  agents: number;
  connections: Array<{ from: string; to: string }>;
  consensus?: Record<string, unknown>;
}

export interface SessionData {
  id: string;
  name: string;
  description?: string;
  version: string;
  createdAt: string;
  agents?: SessionAgent[];
  tasks?: SessionTask[];
  memory?: SessionMemoryEntry[];
  swarmState?: SessionSwarmState;
  tags?: string[];
  metadata?: Record<string, unknown>;
  checksum?: string;
}

export interface SaveSessionResult {
  sessionId: string;
  name: string;
  savedAt: string;
  size: number;
  agentCount?: number;
  taskCount?: number;
  memoryCount?: number;
  path?: string;
}

export interface RestoreSessionResult {
  sessionId: string;
  restoredAt: string;
  success: boolean;
  restored: {
    agents: number;
    tasks: number;
    memory: number;
    swarmState: boolean;
  };
  errors?: string[];
}

export interface SessionSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  size: number;
  agentCount: number;
  taskCount: number;
  memoryCount: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ListSessionsResult {
  sessions: SessionSummary[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// In-memory session store (for simple implementation)
// ============================================================================

export const sessionStore = new Map<string, SessionData>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate secure checksum for session data using SHA-256
 */
export function calculateChecksum(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Validate session ID to prevent path traversal attacks
 * Only allows alphanumeric characters, hyphens, and underscores
 */
export function validateSessionId(sessionId: string): boolean {
  // Must be non-empty and match safe pattern
  const safePattern = /^[a-zA-Z0-9_-]+$/;
  if (!sessionId || !safePattern.test(sessionId)) {
    return false;
  }
  // Additional checks for path traversal patterns
  if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
    return false;
  }
  // Limit length to prevent excessive file names
  if (sessionId.length > 128) {
    return false;
  }
  return true;
}

/**
 * Get session file path with security validation
 */
export function getSessionPath(sessionId: string): string {
  if (!validateSessionId(sessionId)) {
    throw new Error('Invalid session ID: must contain only alphanumeric characters, hyphens, and underscores');
  }
  const sessionDir = path.join(process.cwd(), DEFAULT_SESSION_DIR);
  const sessionPath = path.join(sessionDir, `${sessionId}.json`);

  // Ensure the resolved path is within the session directory (defense in depth)
  const resolvedPath = path.resolve(sessionPath);
  const resolvedDir = path.resolve(sessionDir);
  if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
    throw new Error('Invalid session ID: path traversal detected');
  }

  return sessionPath;
}

/**
 * Ensure session directory exists
 */
export async function ensureSessionDir(): Promise<void> {
  const dir = path.join(process.cwd(), DEFAULT_SESSION_DIR);
  await fs.mkdir(dir, { recursive: true });
}

// ============================================================================
