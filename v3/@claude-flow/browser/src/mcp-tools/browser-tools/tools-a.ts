/**
 * Browser MCP tools (part A) — navigation, snapshot, interaction, get-info,
 * state, and wait tool groups.
 *
 * Extracted from browser-tools.ts (W146, P3.27 cut #2).
 */
import type { Snapshot } from '../../domain/types.js';
import { type MCPTool, getAdapter, sessions } from './helpers.js';

export const navigationTools: MCPTool[] = [
  {
    name: 'browser/open',
    description: 'Navigate to a URL. Returns page title and final URL after redirects.',
    category: 'browser-navigation',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
        session: { type: 'string', description: 'Session ID for isolated browser instance' },
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle'],
          description: 'When to consider navigation complete',
        },
        headers: {
          type: 'object',
          description: 'HTTP headers to set (scoped to URL origin)',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['url'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.open({
        url: input.url as string,
        waitUntil: input.waitUntil as 'load' | 'domcontentloaded' | 'networkidle',
        headers: input.headers as Record<string, string>,
      });
    },
  },
  {
    name: 'browser/back',
    description: 'Navigate back in browser history',
    category: 'browser-navigation',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.back();
    },
  },
  {
    name: 'browser/forward',
    description: 'Navigate forward in browser history',
    category: 'browser-navigation',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.forward();
    },
  },
  {
    name: 'browser/reload',
    description: 'Reload the current page',
    category: 'browser-navigation',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.reload();
    },
  },
  {
    name: 'browser/close',
    description: 'Close the browser session',
    category: 'browser-navigation',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      const result = await adapter.close();
      sessions.delete(input.session as string || 'default');
      return result;
    },
  },
];

// ============================================================================
// Snapshot Tools (AI-Optimized)
// ============================================================================

export const snapshotTools: MCPTool[] = [
  {
    name: 'browser/snapshot',
    description: 'Get accessibility tree with element refs (@e1, @e2). Best for AI - use refs to interact with elements. Returns structured tree with interactive elements highlighted.',
    category: 'browser-snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        interactive: { type: 'boolean', description: 'Only show interactive elements (buttons, links, inputs)', default: true },
        compact: { type: 'boolean', description: 'Remove empty structural elements', default: true },
        depth: { type: 'number', description: 'Limit tree depth (e.g., 3 levels)' },
        selector: { type: 'string', description: 'Scope snapshot to CSS selector' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.snapshot({
        interactive: input.interactive !== false,
        compact: input.compact !== false,
        depth: input.depth as number,
        selector: input.selector as string,
      });
    },
  },
  {
    name: 'browser/screenshot',
    description: 'Capture screenshot. Returns base64 PNG if no path specified.',
    category: 'browser-snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        path: { type: 'string', description: 'File path to save (optional, returns base64 if omitted)' },
        fullPage: { type: 'boolean', description: 'Capture full scrollable page', default: false },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.screenshot({
        path: input.path as string,
        fullPage: input.fullPage as boolean,
      });
    },
  },
  {
    name: 'browser/pdf',
    description: 'Save page as PDF',
    category: 'browser-snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        path: { type: 'string', description: 'File path to save PDF' },
      },
      required: ['path'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.pdf(input.path as string);
    },
  },
];

// ============================================================================
// Interaction Tools
// ============================================================================

export const interactionTools: MCPTool[] = [
  {
    name: 'browser/click',
    description: 'Click an element. Use @e1 refs from snapshot or CSS selectors.',
    category: 'browser-interaction',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        target: { type: 'string', description: 'Element ref (@e1) or CSS selector' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], default: 'left' },
        clickCount: { type: 'number', description: 'Number of clicks (2 for double-click)' },
        force: { type: 'boolean', description: 'Force click even if element is not visible' },
      },
      required: ['target'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.click({
        target: input.target as string,
        button: input.button as 'left' | 'right' | 'middle',
        clickCount: input.clickCount as number,
        force: input.force as boolean,
      });
    },
  },
  {
    name: 'browser/fill',
    description: 'Clear and fill an input field. Use @e1 refs from snapshot.',
    category: 'browser-interaction',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        target: { type: 'string', description: 'Element ref (@e1) or CSS selector' },
        value: { type: 'string', description: 'Text to fill' },
        force: { type: 'boolean', description: 'Force fill even if element is not visible' },
      },
      required: ['target', 'value'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.fill({
        target: input.target as string,
        value: input.value as string,
        force: input.force as boolean,
      });
    },
  },
  {
    name: 'browser/type',
    description: 'Type text character by character (with key events). Slower than fill but simulates real typing.',
    category: 'browser-interaction',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        target: { type: 'string', description: 'Element ref (@e1) or CSS selector' },
        text: { type: 'string', description: 'Text to type' },
        delay: { type: 'number', description: 'Delay between keystrokes in ms' },
      },
      required: ['target', 'text'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.type({
        target: input.target as string,
        text: input.text as string,
        delay: input.delay as number,
      });
    },
  },
  {
    name: 'browser/press',
    description: 'Press a keyboard key (Enter, Tab, Escape, Control+a, etc.)',
    category: 'browser-interaction',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        key: { type: 'string', description: 'Key to press (Enter, Tab, Control+a, etc.)' },
        delay: { type: 'number', description: 'Key hold duration in ms' },
      },
      required: ['key'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.press(input.key as string, input.delay as number);
    },
  },
  {
    name: 'browser/hover',
    description: 'Hover over an element',
    category: 'browser-interaction',
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
      return adapter.hover(input.target as string);
    },
  },
  {
    name: 'browser/select',
    description: 'Select dropdown option by value',
    category: 'browser-interaction',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        target: { type: 'string', description: 'Element ref (@e1) or CSS selector' },
        value: { type: 'string', description: 'Option value to select' },
      },
      required: ['target', 'value'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.select(input.target as string, input.value as string);
    },
  },
  {
    name: 'browser/check',
    description: 'Check a checkbox',
    category: 'browser-interaction',
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
      return adapter.check(input.target as string);
    },
  },
  {
    name: 'browser/uncheck',
    description: 'Uncheck a checkbox',
    category: 'browser-interaction',
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
      return adapter.uncheck(input.target as string);
    },
  },
  {
    name: 'browser/scroll',
    description: 'Scroll the page or element',
    category: 'browser-interaction',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Scroll direction' },
        pixels: { type: 'number', description: 'Pixels to scroll (default: viewport height)' },
      },
      required: ['direction'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.scroll(
        input.direction as 'up' | 'down' | 'left' | 'right',
        input.pixels as number
      );
    },
  },
  {
    name: 'browser/upload',
    description: 'Upload files to a file input',
    category: 'browser-interaction',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        target: { type: 'string', description: 'Element ref (@e1) or CSS selector' },
        files: { type: 'array', items: { type: 'string' }, description: 'File paths to upload' },
      },
      required: ['target', 'files'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.upload(input.target as string, input.files as string[]);
    },
  },
];

// ============================================================================
// Get Info Tools
// ============================================================================

export const getInfoTools: MCPTool[] = [
  {
    name: 'browser/get-text',
    description: 'Get text content of an element',
    category: 'browser-info',
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
      return adapter.getText(input.target as string);
    },
  },
  {
    name: 'browser/get-html',
    description: 'Get innerHTML of an element',
    category: 'browser-info',
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
      return adapter.getHtml(input.target as string);
    },
  },
  {
    name: 'browser/get-value',
    description: 'Get value of an input element',
    category: 'browser-info',
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
      return adapter.getValue(input.target as string);
    },
  },
  {
    name: 'browser/get-attr',
    description: 'Get an attribute value from an element',
    category: 'browser-info',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        target: { type: 'string', description: 'Element ref (@e1) or CSS selector' },
        attribute: { type: 'string', description: 'Attribute name (href, src, data-*, etc.)' },
      },
      required: ['target', 'attribute'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.getAttr(input.target as string, input.attribute as string);
    },
  },
  {
    name: 'browser/get-title',
    description: 'Get the page title',
    category: 'browser-info',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.getTitle();
    },
  },
  {
    name: 'browser/get-url',
    description: 'Get the current page URL',
    category: 'browser-info',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.getUrl();
    },
  },
  {
    name: 'browser/get-count',
    description: 'Count elements matching a selector',
    category: 'browser-info',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        selector: { type: 'string', description: 'CSS selector to count' },
      },
      required: ['selector'],
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.getCount(input.selector as string);
    },
  },
];

// ============================================================================
// State Check Tools
// ============================================================================

export const stateTools: MCPTool[] = [
  {
    name: 'browser/is-visible',
    description: 'Check if an element is visible',
    category: 'browser-state',
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
      return adapter.isVisible(input.target as string);
    },
  },
  {
    name: 'browser/is-enabled',
    description: 'Check if an element is enabled',
    category: 'browser-state',
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
      return adapter.isEnabled(input.target as string);
    },
  },
  {
    name: 'browser/is-checked',
    description: 'Check if a checkbox is checked',
    category: 'browser-state',
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
      return adapter.isChecked(input.target as string);
    },
  },
];

// ============================================================================
// Wait Tools
// ============================================================================

export const waitTools: MCPTool[] = [
  {
    name: 'browser/wait',
    description: 'Wait for element, time, text, URL, or load state',
    category: 'browser-wait',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: 'Session ID' },
        selector: { type: 'string', description: 'Wait for element to be visible' },
        timeout: { type: 'number', description: 'Wait for milliseconds' },
        text: { type: 'string', description: 'Wait for text to appear on page' },
        url: { type: 'string', description: 'Wait for URL pattern (glob)' },
        load: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'], description: 'Wait for load state' },
        fn: { type: 'string', description: 'Wait for JavaScript condition to be true' },
      },
    },
    handler: async (input) => {
      const adapter = getAdapter(input.session as string);
      return adapter.wait({
        selector: input.selector as string,
        timeout: input.timeout as number,
        text: input.text as string,
        url: input.url as string,
        load: input.load as 'load' | 'domcontentloaded' | 'networkidle',
        fn: input.fn as string,
      });
    },
  },
];
