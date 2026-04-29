/**
 * FederationEnvelope Tests
 *
 * Validates envelope creation with required fields, unique nonce generation,
 * HMAC signature creation and verification, serialization/deserialization,
 * and ISO 8601 timestamps.
 *
 * London School TDD: all dependencies are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';

// --- Types expected from the not-yet-implemented FederationEnvelope ---

interface FederationEnvelope {
  id: string;
  nonce: string;
  timestamp: string;
  sourceNodeId: string;
  targetNodeId: string;
  sessionId: string;
  payload: unknown;
  signature: string;
  protocolVersion: string;
}

interface IEnvelopeFactory {
  create(params: {
    sourceNodeId: string;
    targetNodeId: string;
    sessionId: string;
    payload: unknown;
    signingKey: string;
  }): FederationEnvelope;

  verify(envelope: FederationEnvelope, key: string): boolean;
  serialize(envelope: FederationEnvelope): string;
  deserialize(data: string): FederationEnvelope;
}

// --- Mock implementation matching ADR-078 spec ---

function createEnvelopeFactory(): IEnvelopeFactory {
  let nonceCounter = 0;

  function generateNonce(): string {
    nonceCounter++;
    return `nonce_${Date.now()}_${nonceCounter}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function computeHmac(envelope: Omit<FederationEnvelope, 'signature'>, key: string): string {
    const data = `${envelope.id}:${envelope.nonce}:${envelope.timestamp}:${envelope.sourceNodeId}:${envelope.targetNodeId}:${envelope.sessionId}:${JSON.stringify(envelope.payload)}`;
    return createHmac('sha256', key).update(data).digest('hex');
  }

  return {
    create(params) {
      const id = `env_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const nonce = generateNonce();
      const timestamp = new Date().toISOString();
      const protocolVersion = '1.0';

      const partial = {
        id,
        nonce,
        timestamp,
        sourceNodeId: params.sourceNodeId,
        targetNodeId: params.targetNodeId,
        sessionId: params.sessionId,
        payload: params.payload,
        protocolVersion,
      };

      const signature = computeHmac(partial, params.signingKey);

      return { ...partial, signature };
    },

    verify(envelope: FederationEnvelope, key: string): boolean {
      const { signature, ...rest } = envelope;
      const expected = computeHmac(rest, key);
      return signature === expected;
    },

    serialize(envelope: FederationEnvelope): string {
      return JSON.stringify(envelope);
    },

    deserialize(data: string): FederationEnvelope {
      return JSON.parse(data) as FederationEnvelope;
    },
  };
}

describe('FederationEnvelope', () => {
  let factory: IEnvelopeFactory;
  const signingKey = 'test-secret-key-256bit';

  beforeEach(() => {
    factory = createEnvelopeFactory();
  });

  describe('create', () => {
    it('should create an envelope with all required fields', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: { action: 'ping' },
        signingKey,
      });

      expect(envelope.id).toBeDefined();
      expect(envelope.nonce).toBeDefined();
      expect(envelope.timestamp).toBeDefined();
      expect(envelope.sourceNodeId).toBe('node-A');
      expect(envelope.targetNodeId).toBe('node-B');
      expect(envelope.sessionId).toBe('session-1');
      expect(envelope.payload).toEqual({ action: 'ping' });
      expect(envelope.signature).toBeDefined();
      expect(envelope.protocolVersion).toBeDefined();
    });

    it('should generate a non-empty id', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      expect(envelope.id.length).toBeGreaterThan(0);
    });

    it('should generate a non-empty signature', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      expect(envelope.signature.length).toBeGreaterThan(0);
    });

    it('should set protocolVersion', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      expect(envelope.protocolVersion).toBe('1.0');
    });
  });

  describe('nonce uniqueness', () => {
    it('should generate unique nonces for consecutive envelopes', () => {
      const e1 = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      const e2 = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      expect(e1.nonce).not.toBe(e2.nonce);
    });

    it('should generate unique nonces across many envelopes', () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const env = factory.create({
          sourceNodeId: 'node-A',
          targetNodeId: 'node-B',
          sessionId: `session-${i}`,
          payload: { i },
          signingKey,
        });
        nonces.add(env.nonce);
      }
      expect(nonces.size).toBe(100);
    });

    it('should also generate unique ids for consecutive envelopes', () => {
      const e1 = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      const e2 = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      expect(e1.id).not.toBe(e2.id);
    });
  });

  describe('HMAC signature verification', () => {
    it('should verify envelope with the correct key', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: { data: 'hello' },
        signingKey,
      });
      expect(factory.verify(envelope, signingKey)).toBe(true);
    });

    it('should fail verification with a wrong key', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: { data: 'hello' },
        signingKey,
      });
      expect(factory.verify(envelope, 'wrong-key')).toBe(false);
    });

    it('should fail verification when payload is tampered', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: { data: 'original' },
        signingKey,
      });
      const tampered = { ...envelope, payload: { data: 'tampered' } };
      expect(factory.verify(tampered, signingKey)).toBe(false);
    });

    it('should fail verification when sourceNodeId is tampered', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      const tampered = { ...envelope, sourceNodeId: 'node-EVIL' };
      expect(factory.verify(tampered, signingKey)).toBe(false);
    });

    it('should fail verification when nonce is tampered', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      const tampered = { ...envelope, nonce: 'forged-nonce' };
      expect(factory.verify(tampered, signingKey)).toBe(false);
    });
  });

  describe('serialization and deserialization', () => {
    it('should serialize to a valid JSON string', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: { key: 'value' },
        signingKey,
      });
      const json = factory.serialize(envelope);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should preserve all fields through serialize/deserialize round-trip', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: { nested: { a: 1, b: [2, 3] } },
        signingKey,
      });
      const json = factory.serialize(envelope);
      const restored = factory.deserialize(json);

      expect(restored.id).toBe(envelope.id);
      expect(restored.nonce).toBe(envelope.nonce);
      expect(restored.timestamp).toBe(envelope.timestamp);
      expect(restored.sourceNodeId).toBe(envelope.sourceNodeId);
      expect(restored.targetNodeId).toBe(envelope.targetNodeId);
      expect(restored.sessionId).toBe(envelope.sessionId);
      expect(restored.payload).toEqual(envelope.payload);
      expect(restored.signature).toBe(envelope.signature);
      expect(restored.protocolVersion).toBe(envelope.protocolVersion);
    });

    it('should verify a deserialized envelope with the correct key', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: { test: true },
        signingKey,
      });
      const json = factory.serialize(envelope);
      const restored = factory.deserialize(json);
      expect(factory.verify(restored, signingKey)).toBe(true);
    });
  });

  describe('timestamp format', () => {
    it('should produce ISO 8601 formatted timestamps', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      // ISO 8601 regex: YYYY-MM-DDTHH:mm:ss.sssZ
      const iso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(envelope.timestamp).toMatch(iso8601);
    });

    it('should produce a timestamp parseable by Date constructor', () => {
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      const date = new Date(envelope.timestamp);
      expect(date.getTime()).not.toBeNaN();
    });

    it('should produce a recent timestamp (within 5 seconds)', () => {
      const before = Date.now();
      const envelope = factory.create({
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        sessionId: 'session-1',
        payload: {},
        signingKey,
      });
      const after = Date.now();
      const ts = new Date(envelope.timestamp).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after + 5000);
    });
  });
});
