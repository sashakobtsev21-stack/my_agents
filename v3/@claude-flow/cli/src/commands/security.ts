/**
 * V3 CLI Security Command
 * Security scanning, CVE detection, threat modeling, vulnerability management
 *
 * Created with ❤️ by ruv.io
 */


import type { Command, CommandResult } from '../types.js';
import { output } from '../output.js';
// The six subcommands were extracted into ./security-scan.ts and
// ./security-audit.ts during campaign-2 wave 9 (W215); all were
// module-private. The public surface (securityCommand) stays here.
import { cveCommand, scanCommand, threatsCommand } from './security-scan.js';
import { auditCommand, defendCommand, secretsCommand } from './security-audit.js';

export const securityCommand: Command = {
  name: 'security',
  description: 'Security scanning, CVE detection, threat modeling, AI defense',
  subcommands: [scanCommand, cveCommand, threatsCommand, auditCommand, secretsCommand, defendCommand],
  examples: [
    { command: 'claude-flow security scan', description: 'Run security scan' },
    { command: 'claude-flow security cve --list', description: 'List known CVEs' },
    { command: 'claude-flow security threats', description: 'Run threat analysis' },
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('AlexKo Security Suite'));
    output.writeln(output.dim('Comprehensive security scanning and vulnerability management'));
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      'scan     - Run security scans on code, deps, containers',
      'cve      - Check and manage CVE vulnerabilities',
      'threats  - Threat modeling (STRIDE, DREAD, PASTA)',
      'audit    - Security audit logging and compliance',
      'secrets  - Detect and manage secrets in codebase',
      'defend   - AI manipulation defense (prompt injection, jailbreaks, PII)',
    ]);
    output.writeln();
    output.writeln('Use --help with subcommands for more info');
    output.writeln();
    output.writeln(output.dim('Created with ❤️ by ruv.io'));
    return { success: true };
  },
};

export default securityCommand;
