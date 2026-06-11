/**
 * WASM Agent MCP Tools — tool definitions
 *
 * Extracted verbatim from wasm-agent-tools.ts (lines 100-755) during
 * campaign-2 wave 77 (W283); module-private group const, spread back by
 * the barrel.
 */

import type { MCPTool } from './types.js';
import { validateIdentifier, validateText } from './validate-input.js';
import {
  isDestructiveTool,
  SAFE_MCP_TOOLS,
  loadPluginManifest,
  extractPluginSkills,
} from './wasm-agent-tools-helpers.js';

async function loadAgentWasm() {
  const mod = await import('../ruvector/agent-wasm.js');
  return mod;
}

export const wasmAgentToolDefs: MCPTool[] = [
  {
    name: 'wasm_agent_create',
    description: 'Create a sandboxed WASM agent with virtual filesystem (no OS access). Optionally use a gallery template. Use when native Task is wrong because the workload needs sandboxed isolation — untrusted code execution, browser-side run, deterministic replay. Pair with wasm_gallery_search to find a published agent, or wasm_agent_create to scaffold a fresh one. For trusted in-process work, native Task is fine.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        template: { type: 'string', description: 'Gallery template name (coder, researcher, tester, reviewer, security, swarm)' },
        model: { type: 'string', description: 'Model identifier (default: anthropic:claude-sonnet-4-6)' },
        instructions: { type: 'string', description: 'System instructions for the agent' },
        maxTurns: { type: 'number', description: 'Max conversation turns (default: 50)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      if (args.template) { const v = validateIdentifier(args.template, 'template'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      if (args.model) { const v = validateIdentifier(args.model, 'model'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      if (args.instructions) { const v = validateText(args.instructions, 'instructions'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        if (args.template) {
          const info = await wasm.createAgentFromTemplate(args.template as string);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, agent: info, source: 'gallery' }, null, 2) }] };
        }
        const info = await wasm.createWasmAgent({
          model: args.model as string,
          instructions: args.instructions as string,
          maxTurns: args.maxTurns as number,
        });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, agent: info }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_prompt',
    description: 'Send a prompt to a WASM agent and get a response. Use when native Task is wrong because the workload needs sandboxed isolation — untrusted code execution, browser-side run, deterministic replay. Pair with wasm_gallery_search to find a published agent, or wasm_agent_create to scaffold a fresh one. For trusted in-process work, native Task is fine.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: { type: 'string', description: 'WASM agent ID' },
        input: { type: 'string', description: 'User prompt to send' },
      },
      required: ['agentId', 'input'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      { const v = validateText(args.input, 'input'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const result = await wasm.promptWasmAgent(args.agentId as string, args.input as string);
        return { content: [{ type: 'text', text: result }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_tool',
    description: 'Execute a tool on a WASM agent sandbox. Tools: read_file, write_file, edit_file, write_todos, list_files. Use flat format: {tool, path, content, ...}. Use when native Task is wrong because the workload needs sandboxed isolation — untrusted code execution, browser-side run, deterministic replay. Pair with wasm_gallery_search to find a published agent, or wasm_agent_create to scaffold a fresh one. For trusted in-process work, native Task is fine.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: { type: 'string', description: 'WASM agent ID' },
        toolName: { type: 'string', description: 'Tool name (read_file, write_file, edit_file, write_todos, list_files)' },
        toolInput: { type: 'object', description: 'Tool parameters (flat: {path, content, old_string, new_string, todos})' },
      },
      required: ['agentId', 'toolName'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      { const v = validateIdentifier(args.toolName, 'toolName'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        // Flat format: {tool: 'write_file', path: '...', content: '...'}
        const toolCall = {
          tool: args.toolName as string,
          ...((args.toolInput as Record<string, unknown>) ?? {}),
        };
        const result = await wasm.executeWasmTool(args.agentId as string, toolCall);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_list',
    description: 'List all active WASM agents. Use when native Task is wrong because the workload needs sandboxed isolation — untrusted code execution, browser-side run, deterministic replay. Pair with wasm_gallery_search to find a published agent, or wasm_agent_create to scaffold a fresh one. For trusted in-process work, native Task is fine.',
    inputSchema: { type: 'object' as const, properties: {} },
    handler: async () => {
      try {
        const wasm = await loadAgentWasm();
        const agents = wasm.listWasmAgents();
        return { content: [{ type: 'text', text: JSON.stringify({ agents, count: agents.length }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_terminate',
    description: 'Terminate a WASM agent and free resources. Use when native Task is wrong because the workload needs sandboxed isolation — untrusted code execution, browser-side run, deterministic replay. Pair with wasm_gallery_search to find a published agent, or wasm_agent_create to scaffold a fresh one. For trusted in-process work, native Task is fine.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: { type: 'string', description: 'WASM agent ID' },
      },
      required: ['agentId'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const ok = wasm.terminateWasmAgent(args.agentId as string);
        return { content: [{ type: 'text', text: JSON.stringify({ success: ok }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_files',
    description: 'Get a WASM agent\'s available tools and info. Use when native Task is wrong because the workload needs sandboxed isolation — untrusted code execution, browser-side run, deterministic replay. Pair with wasm_gallery_search to find a published agent, or wasm_agent_create to scaffold a fresh one. For trusted in-process work, native Task is fine.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: { type: 'string', description: 'WASM agent ID' },
      },
      required: ['agentId'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const tools = wasm.getWasmAgentTools(args.agentId as string);
        const info = wasm.getWasmAgent(args.agentId as string);
        return { content: [{ type: 'text', text: JSON.stringify({ tools, fileCount: info?.fileCount ?? 0, turnCount: info?.turnCount ?? 0 }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_export',
    description: 'Export a WASM agent\'s full state (config, filesystem, conversation) as JSON. Use when native Task is wrong because the workload needs sandboxed isolation — untrusted code execution, browser-side run, deterministic replay. Pair with wasm_gallery_search to find a published agent, or wasm_agent_create to scaffold a fresh one. For trusted in-process work, native Task is fine.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: { type: 'string', description: 'WASM agent ID' },
      },
      required: ['agentId'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const state = wasm.exportWasmState(args.agentId as string);
        return { content: [{ type: 'text', text: state }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_list',
    description: 'List all available WASM agent gallery templates (Coder, Researcher, Tester, Reviewer, Security, Swarm). Use when native Task is wrong because the workload needs sandboxed isolation — untrusted code execution, browser-side run, deterministic replay. Pair with wasm_gallery_search to find a published agent, or wasm_agent_create to scaffold a fresh one. For trusted in-process work, native Task is fine.',
    inputSchema: { type: 'object' as const, properties: {} },
    handler: async () => {
      try {
        const wasm = await loadAgentWasm();
        const templates = await wasm.listGalleryTemplates();
        return { content: [{ type: 'text', text: JSON.stringify({ templates, count: templates.length }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_search',
    description: 'Search WASM agent gallery templates by query. Use when native Task is wrong because the workload needs sandboxed isolation — untrusted code execution, browser-side run, deterministic replay. Pair with wasm_gallery_search to find a published agent, or wasm_agent_create to scaffold a fresh one. For trusted in-process work, native Task is fine.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateText(args.query, 'query'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const results = await wasm.searchGalleryTemplates(args.query as string);
        return { content: [{ type: 'text', text: JSON.stringify({ results, count: results.length }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_create',
    description: 'Create a WASM agent from a gallery template. Use when native Task is wrong because the workload needs sandboxed isolation — untrusted code execution, browser-side run, deterministic replay. Pair with wasm_gallery_search to find a published agent, or wasm_agent_create to scaffold a fresh one. For trusted in-process work, native Task is fine.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        template: { type: 'string', description: 'Template name (coder, researcher, tester, reviewer, security, swarm)' },
      },
      required: ['template'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.template, 'template'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const info = await wasm.createAgentFromTemplate(args.template as string);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, agent: info, template: args.template }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },

  // ── ADR-129 P2 — wasm_agent_compose ────────────────────────────────────────

  {
    name: 'wasm_agent_compose',
    description: [
      'Compose an RVF container with explicit skills, MCP tool descriptors, prompts, and tools.',
      'Returns base64-encoded RVF bytes + a manifest of what was packed.',
      'SECURITY: mcpTools accepts only an explicit allowlist — never pass "*".',
      'Destructive tools (memory_delete, *_shutdown, federation_*, etc.) require',
      'mcpToolsAllowDestructive: true.',
      'Use includePlugins to auto-wire skills from plugins that declare rvagent.exposeSkillsAsTools.',
    ].join(' '),
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Optional name for the composed agent' },
        model: { type: 'string', description: 'Model identifier (default: anthropic:claude-sonnet-4-6)' },
        skills: { type: 'array', items: { type: 'string' }, description: 'Skill names to include' },
        mcpTools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Explicit allowlist of MCP tool names to embed (principle of least privilege)',
        },
        mcpToolsAllowDestructive: {
          type: 'boolean',
          description: 'Set true to allow destructive tools (*_delete, *_shutdown, federation_*, etc.)',
        },
        prompts: { type: 'array', items: { type: 'object' }, description: 'Prompt objects to embed' },
        tools: { type: 'array', items: { type: 'object' }, description: 'Tool definitions to embed' },
        includePlugins: {
          type: 'array',
          items: { type: 'string' },
          description: 'Plugin names whose rvagent.exposeSkillsAsTools skills should be included',
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      try {
        const wasm = await loadAgentWasm();
        const allowDestructive = args.mcpToolsAllowDestructive === true;
        const requestedTools = (args.mcpTools as string[] | undefined) ?? [];

        // Validate: reject destructive tools unless explicitly opted in
        const blockedTools = requestedTools.filter(n => isDestructiveTool(n) && !allowDestructive);
        if (blockedTools.length > 0) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              error: `Destructive tools blocked: ${blockedTools.join(', ')}. Set mcpToolsAllowDestructive: true to allow.`,
              blockedTools,
            }) }],
            isError: true,
          };
        }

        // Build MCP tool descriptors from the allowlist
        const mcpToolDescriptors = requestedTools.map(name => ({
          name,
          description: SAFE_MCP_TOOLS.has(name) ? `Ruflo MCP tool: ${name}` : `MCP tool: ${name}`,
          input_schema: {},
          group: 'ruflo',
        }));

        // ADR-129 P4: auto-wire plugin skills
        const pluginSkills: Array<{ name: string; description: string; trigger: string; content: string }> = [];
        const pluginWarnings: string[] = [];
        const includePlugins = (args.includePlugins as string[] | undefined) ?? [];
        for (const pluginName of includePlugins) {
          const manifest = loadPluginManifest(pluginName);
          if (!manifest) {
            pluginWarnings.push(`Plugin not found: ${pluginName} (skipped)`);
            continue;
          }
          const skills = extractPluginSkills(manifest, pluginName);
          pluginSkills.push(...skills);
        }

        // Merge explicit skills with plugin skills
        const explicitSkillNames = (args.skills as string[] | undefined) ?? [];
        const explicitSkills = explicitSkillNames.map(name => ({
          name,
          description: `Skill: ${name}`,
          trigger: name,
          content: name,
        }));

        const allSkills = [...explicitSkills, ...pluginSkills];

        const rvfBytes = await wasm.buildRvfContainer({
          prompts: (args.prompts as Array<{ name: string; system_prompt: string; version: string }> | undefined) ?? [],
          tools: (args.tools as Array<{ name: string; description: string; parameters: unknown[]; returns: string }> | undefined) ?? [],
          skills: allSkills,
          mcpTools: mcpToolDescriptors,
        });

        const { Buffer } = await import('node:buffer');
        const rvfBase64 = Buffer.from(rvfBytes).toString('base64');

        const manifest = {
          skills: allSkills.map(s => s.name),
          mcpTools: requestedTools,
          prompts: ((args.prompts as unknown[]) ?? []).length,
          tools: ((args.tools as unknown[]) ?? []).length,
          rvfSizeBytes: rvfBytes.length,
          pluginWarnings: pluginWarnings.length > 0 ? pluginWarnings : undefined,
        };

        return { content: [{ type: 'text', text: JSON.stringify({ success: true, rvfBase64, manifest }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },

  // ── ADR-129 P3 — Agent introspection tools ──────────────────────────────────

  {
    name: 'wasm_agent_state',
    description: 'Read the full internal state of a WASM agent (messages, turn count, config, stop status). Use when native Task is wrong because the agent runs in a sandboxed WASM runtime whose internal conversation history is not directly accessible from the host process.',
    inputSchema: {
      type: 'object' as const,
      properties: { agentId: { type: 'string', description: 'WASM agent ID' } },
      required: ['agentId'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const state = wasm.getWasmAgentState(args.agentId as string);
        return { content: [{ type: 'text', text: JSON.stringify({ agentId: args.agentId, state }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_todos',
    description: 'Get the structured todo list of a WASM agent as JSON. Use when native Task is wrong because the todo state lives inside the sandboxed WASM runtime and is not visible to the host process.',
    inputSchema: {
      type: 'object' as const,
      properties: { agentId: { type: 'string', description: 'WASM agent ID' } },
      required: ['agentId'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const todos = wasm.getWasmAgentTodos(args.agentId as string);
        return { content: [{ type: 'text', text: JSON.stringify({ agentId: args.agentId, todos }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_tools',
    description: 'List the tools registered on a WASM agent sandbox. Use when native Task is wrong because the tool registry lives inside the WASM runtime and cannot be inspected from the host via standard reflection.',
    inputSchema: {
      type: 'object' as const,
      properties: { agentId: { type: 'string', description: 'WASM agent ID' } },
      required: ['agentId'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const tools = wasm.getWasmAgentTools(args.agentId as string);
        return { content: [{ type: 'text', text: JSON.stringify({ agentId: args.agentId, tools }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_turn_count',
    description: 'Return the current turn count of a WASM agent. Use when native Task is wrong because turn-limit enforcement and progress tracking must be polled from inside the sandboxed WASM runtime rather than inferred externally.',
    inputSchema: {
      type: 'object' as const,
      properties: { agentId: { type: 'string', description: 'WASM agent ID' } },
      required: ['agentId'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const info = wasm.getWasmAgent(args.agentId as string);
        if (!info) return { content: [{ type: 'text', text: JSON.stringify({ error: `Agent not found: ${args.agentId}` }) }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify({ agentId: args.agentId, turnCount: info.turnCount }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_is_stopped',
    description: 'Check whether a WASM agent has reached its stop condition (max turns or explicit stop). Use when native Task is wrong because the stop condition is evaluated inside the WASM runtime and not observable from the host without an explicit query.',
    inputSchema: {
      type: 'object' as const,
      properties: { agentId: { type: 'string', description: 'WASM agent ID' } },
      required: ['agentId'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const info = wasm.getWasmAgent(args.agentId as string);
        if (!info) return { content: [{ type: 'text', text: JSON.stringify({ error: `Agent not found: ${args.agentId}` }) }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify({ agentId: args.agentId, isStopped: info.isStopped }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_agent_reset',
    description: 'Reset a WASM agent — clears messages and turn count so it can be reused across tasks. Use when native Task is wrong because the agent lives in a sandboxed WASM runtime that must be explicitly reset rather than simply re-spawned.',
    inputSchema: {
      type: 'object' as const,
      properties: { agentId: { type: 'string', description: 'WASM agent ID' } },
      required: ['agentId'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.agentId, 'agentId'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const ok = wasm.resetWasmAgent(args.agentId as string);
        return { content: [{ type: 'text', text: JSON.stringify({ success: ok, agentId: args.agentId }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },

  // ── ADR-129 P3 — Gallery CRUD tools ─────────────────────────────────────────

  {
    name: 'wasm_gallery_load_rvf',
    description: 'Load a named gallery template as a base64-encoded RVF container. Use when native Read is wrong because RVF containers are packed inside the WASM gallery store and are not accessible as plain filesystem files.',
    inputSchema: {
      type: 'object' as const,
      properties: { id: { type: 'string', description: 'Gallery template ID' } },
      required: ['id'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.id, 'id'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const bytes = await wasm.galleryLoadRvf(args.id as string);
        const { Buffer } = await import('node:buffer');
        return { content: [{ type: 'text', text: JSON.stringify({ id: args.id, rvfBase64: Buffer.from(bytes).toString('base64'), sizeBytes: bytes.length }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_configure',
    description: 'Apply runtime configuration overrides (e.g. maxTurns, model) to the active WASM gallery template. Use when native Edit is wrong because gallery configuration lives inside the WASM runtime state and cannot be changed via filesystem writes.',
    inputSchema: {
      type: 'object' as const,
      properties: { config: { type: 'object', description: 'Configuration overrides (e.g. {maxTurns: 100})' } },
      required: ['config'],
    },
    handler: async (args: Record<string, unknown>) => {
      try {
        const wasm = await loadAgentWasm();
        await wasm.galleryConfigure(JSON.stringify(args.config));
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_categories',
    description: 'Return all WASM gallery template categories with per-category template counts. Use when native Bash/ls is wrong because gallery category metadata is indexed inside the WASM runtime, not on the filesystem.',
    inputSchema: { type: 'object' as const, properties: {} },
    handler: async () => {
      try {
        const wasm = await loadAgentWasm();
        const categories = await wasm.getGalleryCategories();
        return { content: [{ type: 'text', text: JSON.stringify({ categories }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_list_by_category',
    description: 'List WASM gallery templates filtered to a specific category. Use when native Glob is wrong because gallery templates are stored in the WASM runtime registry, not as individual filesystem files.',
    inputSchema: {
      type: 'object' as const,
      properties: { category: { type: 'string', description: 'Category name' } },
      required: ['category'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.category, 'category'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        const templates = await wasm.galleryListByCategory(args.category as string);
        return { content: [{ type: 'text', text: JSON.stringify({ category: args.category, templates }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_add_custom',
    description: 'Add a custom agent template to the WASM gallery registry. Use when native Write is wrong because custom templates must be registered inside the WASM runtime store, not written as plain files.',
    inputSchema: {
      type: 'object' as const,
      properties: { template: { type: 'object', description: 'Template object to add' } },
      required: ['template'],
    },
    handler: async (args: Record<string, unknown>) => {
      try {
        const wasm = await loadAgentWasm();
        await wasm.galleryAddCustom(JSON.stringify(args.template));
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_remove_custom',
    description: 'Remove a custom template from the WASM gallery by ID. Use when native Bash rm is wrong because custom templates exist only inside the WASM runtime registry and cannot be deleted via filesystem operations.',
    inputSchema: {
      type: 'object' as const,
      properties: { id: { type: 'string', description: 'Custom template ID to remove' } },
      required: ['id'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateIdentifier(args.id, 'id'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        const wasm = await loadAgentWasm();
        await wasm.galleryRemoveCustom(args.id as string);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id: args.id }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_import',
    description: [
      'HIGH RISK: Import custom templates from JSON into the gallery.',
      'The payload is deserialized inside the WASM runtime — a malicious system_prompt',
      'in an imported template can direct agents toward harmful behavior.',
      'Input is scanned by AIDefence when available.',
      'Requires explicit confirmation of the source before use.',
    ].join(' '),
    inputSchema: {
      type: 'object' as const,
      properties: {
        templatesJson: { type: 'string', description: 'JSON string of template array to import' },
      },
      required: ['templatesJson'],
    },
    handler: async (args: Record<string, unknown>) => {
      { const v = validateText(args.templatesJson, 'templatesJson'); if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify({ error: v.error }) }], isError: true }; }
      try {
        // ADR-129 P3 AIDefence gate — scan for prompt injection before WASM deserialization.
        // ADR-118 pattern: lazy import @claude-flow/aidefence; warn and continue if unavailable.
        let aiDefenceWarning: string | undefined;
        try {
          const aidefenceMod = await import('@claude-flow/aidefence');
          const defence = aidefenceMod.createAIDefence({ enableLearning: false });
          if (defence) {
            const scanResult = await defence.scan(args.templatesJson as string);
            if (scanResult && (scanResult as any).isThreat) {
              return {
                content: [{ type: 'text', text: JSON.stringify({
                  error: 'AIDefence blocked import: potential prompt injection detected in template payload',
                  HIGH_RISK: true,
                }) }],
                isError: true,
              };
            }
          }
        } catch {
          aiDefenceWarning = 'AIDefence not available — import proceeded without prompt-injection scan';
          console.warn(`[wasm_gallery_import] HIGH_RISK: ${aiDefenceWarning}`);
        }

        const wasm = await loadAgentWasm();
        const count = await wasm.galleryImportCustom(args.templatesJson as string);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, importedCount: count, warning: aiDefenceWarning }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_export',
    description: 'Export all custom WASM gallery templates as a JSON snapshot. Use when native Read/cat is wrong because custom templates live inside the WASM runtime store and are not persisted as individual files on disk.',
    inputSchema: { type: 'object' as const, properties: {} },
    handler: async () => {
      try {
        const wasm = await loadAgentWasm();
        const exported = await wasm.galleryExportCustom();
        return { content: [{ type: 'text', text: JSON.stringify({ exported }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_active',
    description: 'Return the ID of the currently active WASM gallery template. Use when native Bash is wrong because the active-template cursor is tracked inside the WASM runtime state, not in a file you can read directly.',
    inputSchema: { type: 'object' as const, properties: {} },
    handler: async () => {
      try {
        const wasm = await loadAgentWasm();
        const activeId = await wasm.galleryGetActive();
        return { content: [{ type: 'text', text: JSON.stringify({ activeId: activeId ?? null }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
  {
    name: 'wasm_gallery_config',
    description: 'Get the runtime configuration overrides applied to the active WASM gallery template. Use when native Read is wrong because gallery config overrides are stored in the WASM runtime state rather than as an editable config file.',
    inputSchema: { type: 'object' as const, properties: {} },
    handler: async () => {
      try {
        const wasm = await loadAgentWasm();
        const config = await wasm.galleryGetConfig();
        return { content: [{ type: 'text', text: JSON.stringify({ config }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }], isError: true };
      }
    },
  },
];