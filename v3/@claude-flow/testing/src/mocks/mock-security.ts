/**
 * Mock Services — security service
 *
 * Extracted verbatim from mock-services.ts (lines 545-627) during
 * campaign-2 wave 57 (W263). mock-services.ts stays the barrel.
 */

import { vi } from 'vitest';
import type {
  ExecuteOptions,
  InputValidationOptions,
} from './mock-service-types.js';

export class MockSecurityService {
  private blockedPaths = ['../', '~/', '/etc/', '/tmp/', '/var/', '/root/'];
  private allowedCommands = ['npm', 'npx', 'node', 'git'];
  private tokens = new Map<string, { payload: Record<string, unknown>; expiresAt: Date }>();

  validatePath = vi.fn((path: string) => {
    return !this.blockedPaths.some(blocked => path.includes(blocked));
  });

  validateInput = vi.fn((input: string, options?: InputValidationOptions) => {
    const errors: string[] = [];

    if (options?.maxLength && input.length > options.maxLength) {
      errors.push(`Input exceeds maximum length of ${options.maxLength}`);
    }

    if (options?.allowedChars && !options.allowedChars.test(input)) {
      errors.push('Input contains disallowed characters');
    }

    return {
      valid: errors.length === 0,
      sanitized: options?.sanitize ? this.sanitize(input) : input,
      errors: errors.length > 0 ? errors : undefined,
    };
  });

  hashPassword = vi.fn(async (password: string) => {
    // Simulate argon2 hash format
    return `$argon2id$v=19$m=65536,t=3,p=4$${Buffer.from(password).toString('base64')}`;
  });

  verifyPassword = vi.fn(async (password: string, hash: string) => {
    const parts = hash.split('$');
    if (parts.length < 5) return false;
    return Buffer.from(parts[4], 'base64').toString() === password;
  });

  generateToken = vi.fn(async (payload: Record<string, unknown>, expiresIn: number = 3600000) => {
    const token = `token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.tokens.set(token, {
      payload,
      expiresAt: new Date(Date.now() + expiresIn),
    });
    return token;
  });

  verifyToken = vi.fn(async (token: string) => {
    const entry = this.tokens.get(token);
    if (!entry) {
      throw new Error('Invalid token');
    }
    if (entry.expiresAt < new Date()) {
      this.tokens.delete(token);
      throw new Error('Token expired');
    }
    return entry.payload;
  });

  executeSecurely = vi.fn(async (command: string, options?: ExecuteOptions) => {
    const [cmd] = command.split(' ');

    if (!this.allowedCommands.includes(cmd)) {
      throw new Error(`Command not allowed: ${cmd}`);
    }

    return {
      stdout: '',
      stderr: '',
      exitCode: 0,
      duration: Math.random() * 100,
    };
  });

  private sanitize(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  reset(): void {
    this.tokens.clear();
    vi.clearAllMocks();
  }
}
