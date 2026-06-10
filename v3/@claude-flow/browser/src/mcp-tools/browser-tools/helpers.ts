/**
 * Shared infra for the browser MCP tools — the MCPTool interface, the
 * per-session AgentBrowserAdapter registry, and the getAdapter accessor.
 *
 * Extracted from browser-tools.ts (W146, P3.27 cut #1).
 */
import { AgentBrowserAdapter } from '../../infrastructure/agent-browser-adapter.js';

// Session registry for multi-agent coordination
export const sessions = new Map<string, AgentBrowserAdapter>();

export function getAdapter(sessionId?: string): AgentBrowserAdapter {
  const id = sessionId || 'default';
  if (!sessions.has(id)) {
    sessions.set(id, new AgentBrowserAdapter({ session: id }));
  }
  return sessions.get(id)!;
}

export interface MCPTool {
  name: string;
  description: string;
  category: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}
