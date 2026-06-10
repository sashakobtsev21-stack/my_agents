/**
 * Daemon OS-supervisor subcommands — install/uninstall the daemon under
 * the platform service manager (launchd / systemd / Windows) via execFile.
 *
 * Extracted from daemon.ts (W134, P3.19 cut #3 — final).
 */
import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import * as fs from 'fs';

export const installSupervisorCommand: Command = {
  name: 'install-supervisor',
  description: 'Install OS-level auto-restart supervisor (launchd on macOS, systemd-user on Linux)',
  options: [
    { name: 'force', short: 'f', type: 'boolean', description: 'Overwrite existing unit file', default: 'false' },
    { name: 'load', type: 'boolean', description: 'Load/enable the unit immediately', default: 'true' },
    { name: 'dry-run', type: 'boolean', description: 'Print the unit file content without writing', default: 'false' },
  ],
  examples: [
    { command: 'claude-flow daemon install-supervisor', description: 'Install + load (auto-restart enabled)' },
    { command: 'claude-flow daemon install-supervisor --no-load', description: 'Write unit file but do not enable yet' },
    { command: 'claude-flow daemon install-supervisor --dry-run', description: 'Preview the unit file' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const force = ctx.flags.force === true;
    const load = ctx.flags.load !== false;
    const dryRun = ctx.flags['dry-run'] === true || ctx.flags.dryRun === true;
    const projectRoot = process.cwd();
    const platform = process.platform;

    if (platform === 'win32') {
      output.printError('Windows scheduled-task installer is not yet implemented.');
      output.printInfo('Use Task Scheduler manually, or follow this issue: https://github.com/ruvnet/ruflo/issues/1565');
      return { success: false, exitCode: 1 };
    }
    if (platform !== 'darwin' && platform !== 'linux') {
      output.printError(`Unsupported platform: ${platform}. Supported: darwin (launchd), linux (systemd-user).`);
      return { success: false, exitCode: 1 };
    }

    // Resolve absolute paths the unit file will reference.
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
    if (!home) {
      output.printError('HOME/USERPROFILE not set; cannot resolve user unit path.');
      return { success: false, exitCode: 1 };
    }
    const nodeBin = process.execPath;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const cliJs = resolve(join(__dirname, '..', '..', '..', 'bin', 'cli.js'));
    if (!fs.existsSync(cliJs)) {
      output.printError(`CLI not found at: ${cliJs}`);
      return { success: false, exitCode: 1 };
    }

    if (platform === 'darwin') {
      const plistDir = join(home, 'Library', 'LaunchAgents');
      const plistPath = join(plistDir, 'io.ruv.ruflo.daemon.plist');
      const logDir = join(projectRoot, '.claude-flow', 'logs');
      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>io.ruv.ruflo.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodeBin}</string>
        <string>${cliJs}</string>
        <string>daemon</string><string>start</string><string>--foreground</string><string>--quiet</string>
    </array>
    <key>WorkingDirectory</key><string>${projectRoot}</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key><false/>
        <key>Crashed</key><true/>
    </dict>
    <key>ThrottleInterval</key><integer>10</integer>
    <key>StandardOutPath</key><string>${logDir}/supervisor.out.log</string>
    <key>StandardErrorPath</key><string>${logDir}/supervisor.err.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>CLAUDE_FLOW_DAEMON</key><string>1</string>
    </dict>
</dict>
</plist>
`;

      if (dryRun) {
        output.writeln(plist);
        return { success: true };
      }
      if (fs.existsSync(plistPath) && !force) {
        output.printWarning(`Already installed: ${plistPath}`);
        output.printInfo('Use --force to overwrite.');
        return { success: false, exitCode: 1 };
      }
      if (!fs.existsSync(plistDir)) fs.mkdirSync(plistDir, { recursive: true });
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(plistPath, plist, 'utf-8');
      output.printSuccess(`Wrote ${plistPath}`);

      if (load) {
        try {
          const { execFileSync } = await import('child_process');
          // unload first in case a previous version is loaded
          try { execFileSync('launchctl', ['unload', plistPath], { encoding: 'utf-8', timeout: 5000 }); } catch { /* ok */ }
          execFileSync('launchctl', ['load', '-w', plistPath], { encoding: 'utf-8', timeout: 5000 });
          output.printSuccess('Supervisor loaded — daemon will auto-restart on crash and survive reboot.');
        } catch (err) {
          output.printWarning(`launchctl load failed: ${err instanceof Error ? err.message : String(err)}`);
          output.printInfo(`Run manually: launchctl load -w ${plistPath}`);
        }
      } else {
        output.printInfo(`Run when ready:  launchctl load -w ${plistPath}`);
      }
      return { success: true };
    }

    // Linux: systemd-user
    const unitDir = join(home, '.config', 'systemd', 'user');
    const unitPath = join(unitDir, 'ruflo-daemon.service');
    const unit = `[Unit]
Description=AlexKo background worker daemon
After=default.target

[Service]
Type=simple
WorkingDirectory=${projectRoot}
Environment=CLAUDE_FLOW_DAEMON=1
ExecStart=${nodeBin} ${cliJs} daemon start --foreground --quiet
Restart=on-failure
RestartSec=10
# Restart on Crashed (signal) too
StartLimitIntervalSec=300
StartLimitBurst=5

[Install]
WantedBy=default.target
`;

    if (dryRun) {
      output.writeln(unit);
      return { success: true };
    }
    if (fs.existsSync(unitPath) && !force) {
      output.printWarning(`Already installed: ${unitPath}`);
      output.printInfo('Use --force to overwrite.');
      return { success: false, exitCode: 1 };
    }
    if (!fs.existsSync(unitDir)) fs.mkdirSync(unitDir, { recursive: true });
    fs.writeFileSync(unitPath, unit, 'utf-8');
    output.printSuccess(`Wrote ${unitPath}`);

    if (load) {
      try {
        const { execFileSync } = await import('child_process');
        execFileSync('systemctl', ['--user', 'daemon-reload'], { encoding: 'utf-8', timeout: 5000 });
        execFileSync('systemctl', ['--user', 'enable', '--now', 'ruflo-daemon.service'], { encoding: 'utf-8', timeout: 10000 });
        output.printSuccess('Supervisor enabled — daemon will auto-restart on crash and survive reboot.');
        output.printInfo('Note: requires `loginctl enable-linger $USER` for restart-after-logout on some distros.');
      } catch (err) {
        output.printWarning(`systemctl --user enable failed: ${err instanceof Error ? err.message : String(err)}`);
        output.printInfo(`Run manually: systemctl --user daemon-reload && systemctl --user enable --now ruflo-daemon.service`);
      }
    } else {
      output.printInfo(`Run when ready:  systemctl --user daemon-reload && systemctl --user enable --now ruflo-daemon.service`);
    }
    return { success: true };
  },
};

export const uninstallSupervisorCommand: Command = {
  name: 'uninstall-supervisor',
  description: 'Remove the auto-restart supervisor unit (launchd on macOS, systemd-user on Linux)',
  options: [],
  action: async (): Promise<CommandResult> => {
    const platform = process.platform;
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '';

    if (platform === 'darwin') {
      const plistPath = join(home, 'Library', 'LaunchAgents', 'io.ruv.ruflo.daemon.plist');
      try {
        const { execFileSync } = await import('child_process');
        try { execFileSync('launchctl', ['unload', plistPath], { encoding: 'utf-8', timeout: 5000 }); } catch { /* ok */ }
      } catch { /* ignore */ }
      if (fs.existsSync(plistPath)) {
        fs.unlinkSync(plistPath);
        output.printSuccess(`Removed ${plistPath}`);
      } else {
        output.printInfo(`Not installed: ${plistPath}`);
      }
      return { success: true };
    }
    if (platform === 'linux') {
      const unitPath = join(home, '.config', 'systemd', 'user', 'ruflo-daemon.service');
      try {
        const { execFileSync } = await import('child_process');
        try { execFileSync('systemctl', ['--user', 'disable', '--now', 'ruflo-daemon.service'], { encoding: 'utf-8', timeout: 5000 }); } catch { /* ok */ }
      } catch { /* ignore */ }
      if (fs.existsSync(unitPath)) {
        fs.unlinkSync(unitPath);
        output.printSuccess(`Removed ${unitPath}`);
      } else {
        output.printInfo(`Not installed: ${unitPath}`);
      }
      return { success: true };
    }
    output.printError(`Unsupported platform: ${platform}`);
    return { success: false, exitCode: 1 };
  },
};

// Main daemon command
