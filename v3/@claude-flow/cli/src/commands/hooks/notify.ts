/**
 * `claude-flow hooks notify` — emit a notification to the session log.
 *
 * Pilot extraction from the 5071-line hooks.ts (issue #7). Single-command
 * file: no shared state with the rest of hooks.ts, no helpers needed
 * besides the Command/output contract. Pattern to copy for the other
 * 37 sub-commands when whoever owns this carves them out.
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';

export const notifyCommand: Command = {
  name: 'notify',
  description: 'Send a notification message (logged to session)',
  options: [
    { name: 'message', short: 'm', type: 'string', description: 'Notification message', required: true },
    { name: 'level', short: 'l', type: 'string', description: 'Level: info, warn, error', default: 'info' },
    { name: 'channel', short: 'c', type: 'string', description: 'Notification channel', default: 'console' },
  ],
  examples: [
    { command: 'claude-flow hooks notify -m "Build complete"', description: 'Send info notification' },
    { command: 'claude-flow hooks notify -m "Test failed" -l error', description: 'Send error notification' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const message = (ctx.flags.message as string) || ctx.args[0];
    const level = (ctx.flags.level as string) || 'info';

    if (!message) {
      output.printError('Message is required: --message "your message"');
      return { success: false, exitCode: 1 };
    }

    const timestamp = new Date().toISOString();

    if (level === 'error') {
      output.printError(`[${timestamp}] ${message}`);
    } else if (level === 'warn') {
      output.writeln(output.warning(`[${timestamp}] ${message}`));
    } else {
      output.printInfo(`[${timestamp}] ${message}`);
    }

    // Store notification in memory if available.
    try {
      const { storeEntry } = await import('../../memory/memory-initializer.js');
      await storeEntry({ key: `notify-${Date.now()}`, value: `[${level}] ${message}`, namespace: 'notifications' });
    } catch { /* memory not available */ }

    return { success: true, data: { timestamp, level, message } };
  },
};
