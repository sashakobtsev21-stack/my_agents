/**
 * Browser MCP tools (part B) — JavaScript eval (with the dangerous-pattern
 * blocklist + length cap), storage, network, tab, settings, debug, and
 * find tool groups.
 *
 * Extracted from browser-tools.ts (W146, P3.27 cut #3 — final).
 */
import { type MCPTool, getAdapter } from './helpers.js';

// ============================================================================
// JavaScript Execution
// ============================================================================

// Defense-in-depth: pattern blocklist for eval scripts (CRIT-03)
// NOTE: This is a best-effort defense layer, not a sandbox. Determined attackers can bypass
// pattern matching via encoding/obfuscation. The primary defense is the browser sandbox itself.
// This blocklist catches accidental misuse and unsophisticated injection attempts.
const DANGEROUS_EVAL_PATTERNS = [
  /\bprocess\b/,           // Node.js process access
  /\brequire\b/,           // CommonJS require
  /\b__dirname\b/,         // Node path leaking
  /\b__filename\b/,        // Node path leaking
  /\bchild_process\b/,     // Command execution
  /\bglobal\b\s*\./,       // Global object mutation
  /\bglobalThis\b/,        // globalThis access (bypasses global. check)
  /\bFunction\s*\(/,       // Function constructor (eval-equivalent)
  /\.constructor\b/,       // Constructor access (e.g., "".constructor)
  /\bReflect\b/,           // Reflect API (can invoke constructors)
  /\bimport\s*\(/,         // Dynamic import
  /\beval\s*\(/,           // Direct eval calls
];

const DEFAULT_MAX_EVAL_SCRIPT_LENGTH = 20_000;
const MAX_EVAL_SCRIPT_LENGTH = parseInt(process.env.CLAUDE_FLOW_MAX_EVAL_SCRIPT_LENGTH || '', 10) || DEFAULT_MAX_EVAL_SCRIPT_LENGTH;

export const evalTools: MCPTool[] = [
  {
    name: 'browser/eval',
    description: 'Execute JavaScript in the page context (validated, length-limited)',
    category: 'browser-eval',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        script: {
          type: 'string',
          description: `JavaScript code to execute (max ${MAX_EVAL_SCRIPT_LENGTH} chars)`,
          maxLength: MAX_EVAL_SCRIPT_LENGTH,
        },
      },
      required: ['script'],
    },
    handler: async (input) => {
      const script = input.script as string;

      // Validate script length
      if (!script || script.length === 0) {
        throw new Error('browser/eval: script must not be empty');
      }
      if (script.length > MAX_EVAL_SCRIPT_LENGTH) {
        throw new Error(`browser/eval: script exceeds maximum length of ${MAX_EVAL_SCRIPT_LENGTH} characters`);
      }

      // Check for dangerous patterns
      for (const pattern of DANGEROUS_EVAL_PATTERNS) {
        if (pattern.test(script)) {
          throw new Error(`browser/eval: script contains disallowed pattern: ${pattern.source}`);
        }
      }

      // Audit log
      console.info(`[browser/eval] Executing script (${script.length} chars) in session ${input.session || 'default'}`);

      const adapter = getAdapter(input.session as string);
      return adapter.eval({ script });
    },
  },
];

// ============================================================================
// Storage Tools
// ============================================================================

export const storageTools: MCPTool[] = [
  {
    name: 'browser/cookies-get',
    description: 'Get all cookies for the current page',
    category: 'browser-storage',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.getCookies();
    },
  },
  {
    name: 'browser/cookies-set',
    description: 'Set a cookie',
    category: 'browser-storage',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Cookie name' },
        value: { type: 'string', description: 'Cookie value' },
      },
      required: ['name', 'value'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.setCookie(input.name as string, input.value as string);
    },
  },
  {
    name: 'browser/cookies-clear',
    description: 'Clear all cookies',
    category: 'browser-storage',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.clearCookies();
    },
  },
  {
    name: 'browser/localstorage-get',
    description: 'Get localStorage value (or all if no key)',
    category: 'browser-storage',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        key: { type: 'string', description: 'Key to get (omit for all)' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.getLocalStorage(input.key as string);
    },
  },
  {
    name: 'browser/localstorage-set',
    description: 'Set localStorage value',
    category: 'browser-storage',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        key: { type: 'string', description: 'Key to set' },
        value: { type: 'string', description: 'Value to set' },
      },
      required: ['key', 'value'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.setLocalStorage(input.key as string, input.value as string);
    },
  },
];

// ============================================================================
// Network Tools
// ============================================================================

export const networkTools: MCPTool[] = [
  {
    name: 'browser/network-route',
    description: 'Intercept, block, or mock network requests',
    category: 'browser-network',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        urlPattern: { type: 'string', description: 'URL pattern to match (glob)' },
        abort: { type: 'boolean', description: 'Block matching requests' },
        body: { type: 'string', description: 'Mock response body (JSON string)' },
        status: { type: 'number', description: 'Mock response status code' },
      },
      required: ['urlPattern'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.networkRoute({
        urlPattern: input.urlPattern as string,
        abort: input.abort as boolean,
        body: input.body as string,
        status: input.status as number,
      });
    },
  },
  {
    name: 'browser/network-unroute',
    description: 'Remove network route',
    category: 'browser-network',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        urlPattern: { type: 'string', description: 'URL pattern to remove (omit for all)' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.networkUnroute(input.urlPattern as string);
    },
  },
  {
    name: 'browser/network-requests',
    description: 'Get tracked network requests',
    category: 'browser-network',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        filter: { type: 'string', description: 'Filter by URL substring' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.networkRequests(input.filter as string);
    },
  },
];

// ============================================================================
// Tab & Session Tools
// ============================================================================

export const tabTools: MCPTool[] = [
  {
    name: 'browser/tab-list',
    description: 'List all open tabs',
    category: 'browser-tabs',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.listTabs();
    },
  },
  {
    name: 'browser/tab-new',
    description: 'Open a new tab',
    category: 'browser-tabs',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        url: { type: 'string', description: 'URL to open in new tab' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.newTab(input.url as string);
    },
  },
  {
    name: 'browser/tab-switch',
    description: 'Switch to a specific tab',
    category: 'browser-tabs',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        index: { type: 'number', description: 'Tab index (0-based)' },
      },
      required: ['index'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.switchTab(input.index as number);
    },
  },
  {
    name: 'browser/tab-close',
    description: 'Close a tab',
    category: 'browser-tabs',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        index: { type: 'number', description: 'Tab index to close (current if omitted)' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.closeTab(input.index as number);
    },
  },
  {
    name: 'browser/session-list',
    description: 'List all active browser sessions',
    category: 'browser-session',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const adapter = getAdapter();
      return adapter.listSessions();
    },
  },
];

// ============================================================================
// Settings Tools
// ============================================================================

export const settingsTools: MCPTool[] = [
  {
    name: 'browser/set-viewport',
    description: 'Set browser viewport size',
    category: 'browser-settings',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        width: { type: 'number', description: 'Viewport width' },
        height: { type: 'number', description: 'Viewport height' },
      },
      required: ['width', 'height'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.setViewport(input.width as number, input.height as number);
    },
  },
  {
    name: 'browser/set-device',
    description: 'Emulate a device (iPhone 14, Pixel 5, etc.)',
    category: 'browser-settings',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        device: { type: 'string', description: 'Device name (e.g., "iPhone 14", "Pixel 5")' },
      },
      required: ['device'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.setDevice(input.device as string);
    },
  },
  {
    name: 'browser/set-geolocation',
    description: 'Set geolocation',
    category: 'browser-settings',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        latitude: { type: 'number', description: 'Latitude' },
        longitude: { type: 'number', description: 'Longitude' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.setGeolocation(input.latitude as number, input.longitude as number);
    },
  },
  {
    name: 'browser/set-offline',
    description: 'Toggle offline mode',
    category: 'browser-settings',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        enabled: { type: 'boolean', description: 'Enable offline mode' },
      },
      required: ['enabled'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.setOffline(input.enabled as boolean);
    },
  },
  {
    name: 'browser/set-media',
    description: 'Emulate color scheme (dark/light mode)',
    category: 'browser-settings',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        scheme: { type: 'string', enum: ['dark', 'light'], description: 'Color scheme' },
      },
      required: ['scheme'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.setMedia(input.scheme as 'dark' | 'light');
    },
  },
];

// ============================================================================
// Debug Tools
// ============================================================================

export const debugTools: MCPTool[] = [
  {
    name: 'browser/trace-start',
    description: 'Start recording a trace for debugging',
    category: 'browser-debug',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        path: { type: 'string', description: 'Path to save trace' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.traceStart(input.path as string);
    },
  },
  {
    name: 'browser/trace-stop',
    description: 'Stop recording trace and save',
    category: 'browser-debug',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        path: { type: 'string', description: 'Path to save trace' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.traceStop(input.path as string);
    },
  },
  {
    name: 'browser/console',
    description: 'Get console messages',
    category: 'browser-debug',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        clear: { type: 'boolean', description: 'Clear console after getting messages' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      if (input.clear) {
        return adapter.clearConsole();
      }
      return adapter.getConsole();
    },
  },
  {
    name: 'browser/errors',
    description: 'Get page errors',
    category: 'browser-debug',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        clear: { type: 'boolean', description: 'Clear errors after getting' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      if (input.clear) {
        return adapter.clearErrors();
      }
      return adapter.getErrors();
    },
  },
  {
    name: 'browser/highlight',
    description: 'Highlight an element on the page (for visual debugging)',
    category: 'browser-debug',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        target: { type: 'string', description: 'Element ref (@e1) or CSS selector' },
      },
      required: ['target'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.highlight(input.target as string);
    },
  },
  {
    name: 'browser/state-save',
    description: 'Save authentication state (cookies, localStorage) to file',
    category: 'browser-debug',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        path: { type: 'string', description: 'Path to save state file' },
      },
      required: ['path'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.saveState(input.path as string);
    },
  },
  {
    name: 'browser/state-load',
    description: 'Load authentication state from file',
    category: 'browser-debug',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        path: { type: 'string', description: 'Path to state file' },
      },
      required: ['path'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.loadState(input.path as string);
    },
  },
];

// ============================================================================
// Semantic Locator Tools (Find Commands)
// ============================================================================

export const findTools: MCPTool[] = [
  {
    name: 'browser/find-role',
    description: 'Find element by ARIA role and perform action',
    category: 'browser-find',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        role: { type: 'string', description: 'ARIA role (button, link, textbox, etc.)' },
        action: { type: 'string', enum: ['click', 'fill', 'check', 'hover', 'text'], description: 'Action to perform' },
        name: { type: 'string', description: 'Accessible name to match' },
        value: { type: 'string', description: 'Value for fill action' },
        exact: { type: 'boolean', description: 'Exact text match' },
      },
      required: ['role', 'action'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.findByRole(input.role as string, input.action as string, {
        name: input.name as string,
        exact: input.exact as boolean,
      });
    },
  },
  {
    name: 'browser/find-text',
    description: 'Find element by text content and perform action',
    category: 'browser-find',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        text: { type: 'string', description: 'Text to find' },
        action: { type: 'string', enum: ['click', 'hover', 'text'], description: 'Action to perform' },
      },
      required: ['text', 'action'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.findByText(input.text as string, input.action as string);
    },
  },
  {
    name: 'browser/find-label',
    description: 'Find input by label and perform action',
    category: 'browser-find',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        label: { type: 'string', description: 'Label text' },
        action: { type: 'string', enum: ['click', 'fill', 'check', 'hover', 'text'], description: 'Action to perform' },
        value: { type: 'string', description: 'Value for fill action' },
      },
      required: ['label', 'action'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.findByLabel(input.label as string, input.action as string, input.value as string);
    },
  },
  {
    name: 'browser/find-testid',
    description: 'Find element by data-testid and perform action',
    category: 'browser-find',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        testId: { type: 'string', description: 'data-testid value' },
        action: { type: 'string', enum: ['click', 'fill', 'check', 'hover', 'text'], description: 'Action to perform' },
        value: { type: 'string', description: 'Value for fill action' },
      },
      required: ['testId', 'action'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.findByTestId(input.testId as string, input.action as string, input.value as string);
    },
  },
];

