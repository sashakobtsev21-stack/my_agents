/**
 * CLI Type Stubs for Claims Module
 *
 * Local type definitions to avoid cross-package imports.
 * These mirror the types from @claude-flow/cli for use in claims commands.
 */

// =============================================================================
// Command Types (mirrors @claude-flow/cli/src/types.ts)
// =============================================================================

export interface CommandContext {
  args: string[];
  flags: Record<string, string | boolean | number | undefined>;
  cwd: string;
  verbose: boolean;
  /** Whether the session is attached to an interactive TTY (cli-core parity, W203). */
  interactive?: boolean;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: Error;
  /** Process exit code override (cli-core parity, W203). */
  exitCode?: number;
}

export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
  /** cli-core parity (W203): examples may be strings or command/description pairs. */
  examples?: Array<string | { command: string; description: string }>;
  options?: CommandOption[];
  subcommands?: Command[];
  /** cli-core parity (W203): either execute or action drives the command. */
  execute?: (context: CommandContext) => Promise<CommandResult>;
  action?: (context: CommandContext) => Promise<CommandResult>;
}

export interface CommandOption {
  name: string;
  alias?: string;
  /** Single-letter flag (cli-core parity, W203). */
  short?: string;
  description: string;
  type: 'string' | 'boolean' | 'number';
  required?: boolean;
  default?: string | boolean | number;
  /** Enumerated values (cli-core parity, W203). */
  choices?: string[];
}

// =============================================================================
// Output Utilities (mirrors @claude-flow/cli/src/output.ts)
// =============================================================================

/** cli-core parity (W203): printTable column descriptor. */
export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: unknown) => string;
}

/** cli-core parity (W203): printTable options. */
export interface TableOptions {
  columns: TableColumn[];
  data?: Record<string, unknown>[];
  border?: boolean;
  padding?: number;
  maxWidth?: number;
}

export const output = {
  log: (message: string): void => {
    console.log(message);
  },
  // String-returning formatter — aligned with the authoritative
  // @claude-flow/cli-core OutputFormatter (its success/error/info all
  // return styled strings). The old void/console.log variants made the
  // formatClaim* helpers return undefined into templates (W200).
  error: (message: string): string => {
    return `✗ ${message}`;
  },
  warn: (message: string): void => {
    console.warn(`Warning: ${message}`);
  },
  warning: (message: string): string => {
    return `⚠ ${message}`;
  },
  success: (message: string): string => {
    return `✓ ${message}`;
  },
  info: (message: string): string => {
    return `ℹ ${message}`;
  },
  table: (data: Record<string, unknown>[]): void => {
    console.table(data);
  },
  json: (data: unknown): void => {
    console.log(JSON.stringify(data, null, 2));
  },
  // Console-printing family — cli-core OutputFormatter parity (W203)
  writeln: (message: string = ''): void => {
    console.log(message);
  },
  printSuccess: (message: string): void => {
    console.log(`✓ ${message}`);
  },
  printError: (message: string, details?: string): void => {
    console.error(`✗ ${message}`);
    if (details) console.error(details);
  },
  printWarning: (message: string): void => {
    console.warn(`⚠ ${message}`);
  },
  printInfo: (message: string): void => {
    console.log(`ℹ ${message}`);
  },
  printJson: (data: unknown): void => {
    console.log(JSON.stringify(data, null, 2));
  },
  progressBar: (current: number, total: number, width: number = 40): string => {
    const ratio = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;
    const filled = Math.round(ratio * width);
    return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}] ${Math.round(ratio * 100)}%`;
  },
  createSpinner: (options: { text: string; spinner?: string }): {
    start: () => void;
    succeed: (text?: string) => void;
    fail: (text?: string) => void;
    stop: () => void;
  } => {
    const label = options.text;
    return {
      start: () => console.log(`... ${label}`),
      succeed: (text?: string) => console.log(`✓ ${text ?? label}`),
      fail: (text?: string) => console.error(`✗ ${text ?? label}`),
      stop: () => {},
    };
  },
  printTable: (options: TableOptions): void => {
    const cols = options.columns;
    const rows = options.data ?? [];
    console.table(
      rows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const col of cols) out[col.header] = row[col.key];
        return out;
      }),
    );
  },
  printList: (items: string[], bullet: string = '-'): void => {
    for (const item of items) console.log(`${bullet} ${item}`);
  },
  printBox: (content: string, title?: string): void => {
    if (title) console.log(`== ${title} ==`);
    console.log(content);
  },
  // Formatting helpers that return strings for composition
  dim: (message: string): string => message,
  bold: (message: string): string => message,
  italic: (message: string): string => message,
  highlight: (message: string): string => message,
  code: (message: string): string => `\`${message}\``,
  link: (url: string, text?: string): string => text ? `${text} (${url})` : url,
  list: (items: string[]): string => items.map(i => `  • ${i}`).join('\n'),
  header: (message: string): string => `\n${message}\n${'─'.repeat(message.length)}`,
  // Colors
  red: (message: string): string => message,
  green: (message: string): string => message,
  yellow: (message: string): string => message,
  blue: (message: string): string => message,
  cyan: (message: string): string => message,
  magenta: (message: string): string => message,
  gray: (message: string): string => message,
  white: (message: string): string => message,
};

// =============================================================================
// Prompt Utilities (mirrors @claude-flow/cli/src/prompt.ts)
// =============================================================================

export interface SelectOption<T = string> {
  label: string;
  value: T;
  description?: string;
}

export async function select<T = string>(
  message: string,
  options: SelectOption<T>[]
): Promise<T> {
  // In a real implementation, this would use a terminal prompt library
  // For now, return the first option as a stub
  console.log(`[Prompt] ${message}`);
  options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt.label}`));
  return options[0]?.value as T;
}

export interface ConfirmOptions {
  message: string;
  default?: boolean;
}

export interface InputOptions {
  message: string;
  default?: string;
  validate?: (value: string) => true | string;
}

export async function confirm(message: string | ConfirmOptions, defaultValue = false): Promise<boolean> {
  if (typeof message === 'object') {
    return confirmImpl(message.message, message.default ?? false);
  }
  return confirmImpl(message, defaultValue);
}

async function confirmImpl(message: string, defaultValue: boolean): Promise<boolean> {
  console.log(`[Confirm] ${message} (default: ${defaultValue ? 'yes' : 'no'})`);
  return defaultValue;
}

export async function input(message: string | InputOptions, defaultValue = ''): Promise<string> {
  const msg = typeof message === 'object' ? message.message : message;
  const def = typeof message === 'object' ? (message.default ?? '') : defaultValue;
  console.log(`[Input] ${msg} (default: ${def})`);
  return def;
}

// =============================================================================
// MCP Client Utilities (mirrors @claude-flow/cli/src/mcp-client.ts)
// =============================================================================

export class MCPClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MCPClientError';
  }
}

export interface MCPToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Domain payload fields (claims/summary/status/...) — cli-core parity, W203. */
  [key: string]: unknown;
}

export async function callMCPTool<T = MCPToolResult>(
  toolName: string,
  params: Record<string, unknown>
): Promise<T> {
  // MCP tool call - delegates to active MCP server
  console.log(`[MCP] Calling tool: ${toolName}`, params);
  return { success: true, data: {} } as T;
}
