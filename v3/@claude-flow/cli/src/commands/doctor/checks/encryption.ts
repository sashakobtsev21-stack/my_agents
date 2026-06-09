/**
 * Encryption-at-rest health check — see ../../encryption/vault for the
 * underlying key/blob plumbing. Gate is `CLAUDE_FLOW_ENCRYPT_AT_REST`.
 *
 * Pilot extraction (issue #7).
 */
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import type { HealthCheck } from '../utils.js';
import { decodeKey, isEncryptionEnabled, isEncryptedBlob } from '../../../encryption/vault.js';

export async function checkEncryptionAtRest(): Promise<HealthCheck> {
  if (!isEncryptionEnabled()) {
    return {
      name: 'Encryption at Rest',
      status: 'warn',
      message: 'Off — session/terminal/memory stores are plaintext (mode 0600 only)',
      fix: 'export CLAUDE_FLOW_ENCRYPT_AT_REST=1 && export CLAUDE_FLOW_ENCRYPTION_KEY=<64-char-hex>',
    };
  }

  // Gate is on — try to resolve the key. Fail-closed if missing or malformed.
  const rawKey = process.env.CLAUDE_FLOW_ENCRYPTION_KEY;
  if (!rawKey) {
    return {
      name: 'Encryption at Rest',
      status: 'fail',
      message: 'Gate is on but CLAUDE_FLOW_ENCRYPTION_KEY is unset (fail-closed)',
      fix: 'Generate a key: openssl rand -hex 32 → export CLAUDE_FLOW_ENCRYPTION_KEY=<value>',
    };
  }
  let keyFingerprint: string;
  try {
    const key = decodeKey(rawKey);
    keyFingerprint = createHash('sha256').update(key).digest('hex').slice(0, 16);
  } catch (err) {
    return {
      name: 'Encryption at Rest',
      status: 'fail',
      message: `CLAUDE_FLOW_ENCRYPTION_KEY invalid: ${err instanceof Error ? err.message : String(err)}`,
      fix: 'Provide a 64-char hex or 44-char base64 key (32 bytes)',
    };
  }

  // Check the three high-tier store paths for RFE1 magic
  const cwd = process.cwd();
  const stores: Array<{ label: string; path: string }> = [
    { label: 'sessions/', path: join(cwd, '.claude-flow', 'sessions') },
    { label: 'terminals', path: join(cwd, '.claude-flow', 'terminals', 'store.json') },
    { label: 'memory.db', path: join(cwd, '.swarm', 'memory.db') },
  ];
  const status: string[] = [];
  for (const s of stores) {
    if (!existsSync(s.path)) {
      status.push(`${s.label}=∅`);
      continue;
    }
    try {
      const stat = statSync(s.path);
      if (stat.isDirectory()) {
        // Sessions: probe the first .json file
        const { readdirSync } = await import('fs');
        const files = readdirSync(s.path).filter(f => f.endsWith('.json'));
        if (files.length === 0) { status.push(`${s.label}=∅`); continue; }
        const first = readFileSync(join(s.path, files[0]));
        status.push(`${s.label}=${isEncryptedBlob(first) ? 'enc' : 'plain'}`);
      } else {
        const buf = readFileSync(s.path);
        status.push(`${s.label}=${isEncryptedBlob(buf) ? 'enc' : 'plain'}`);
      }
    } catch {
      status.push(`${s.label}=err`);
    }
  }

  return {
    name: 'Encryption at Rest',
    status: 'pass',
    message: `On — key fp:${keyFingerprint}… (${status.join(' ')})`,
  };
}

// formatCheck() was duplicated here during the W10 split — the caller
// in doctor.ts already owns its own copy. Dropped.

// Main doctor command
