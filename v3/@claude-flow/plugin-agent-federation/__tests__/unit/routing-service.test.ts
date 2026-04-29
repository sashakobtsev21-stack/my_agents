/**
 * RoutingService Tests
 *
 * Validates message routing modes (direct, consensus, broadcast),
 * PII pipeline integration, session validation, and message size limits.
 *
 * London School TDD: all dependencies are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Types expected from the not-yet-implemented RoutingService ---

type RoutingMode = 'direct' | 'consensus' | 'broadcast';

interface RoutingMessage {
  id: string;
  sessionId: string;
  sourceNodeId: string;
  targetNodeId?: string;
  payload: string;
  mode: RoutingMode;
  sanitizedPayload?: string;
  timestamp: string;
}

interface SendResult {
  success: boolean;
  messageId: string;
  mode: RoutingMode;
  error?: string;
}

interface PIIPipelineMock {
  process: (text: string, trustLevel: number) => {
    detections: Array<{ type: string; value: string; confidence: number }>;
    action: string;
    sanitizedText: string;
  };
}

interface IRoutingService {
  send(params: {
    sessionId: string;
    sourceNodeId: string;
    targetNodeId: string;
    payload: string;
    mode?: RoutingMode;
    isTrustChange?: boolean;
    isTopologyChange?: boolean;
  }): SendResult;

  broadcast(params: {
    sessionId: string;
    sourceNodeId: string;
    payload: string;
    peerNodeIds: string[];
  }): SendResult[];

  getMessages(sessionId: string): RoutingMessage[];
}

// --- Mock implementation matching ADR-078 spec ---

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB

function createRoutingService(
  validSessions: Set<string>,
  piiPipeline: PIIPipelineMock,
): IRoutingService {
  const messages = new Map<string, RoutingMessage[]>();
  let messageCounter = 0;

  function generateMessageId(): string {
    messageCounter++;
    return `msg_${Date.now()}_${messageCounter}`;
  }

  return {
    send(params) {
      // Validate session
      if (!validSessions.has(params.sessionId)) {
        return {
          success: false,
          messageId: '',
          mode: params.mode ?? 'direct',
          error: `Invalid session ID: ${params.sessionId}`,
        };
      }

      // Validate message size
      if (Buffer.byteLength(params.payload, 'utf8') > MAX_MESSAGE_SIZE) {
        return {
          success: false,
          messageId: '',
          mode: params.mode ?? 'direct',
          error: 'Message exceeds maximum size limit',
        };
      }

      // Determine routing mode
      let mode: RoutingMode = params.mode ?? 'direct';
      if (params.isTrustChange || params.isTopologyChange) {
        mode = 'consensus';
      }

      // Run PII pipeline
      const piiResult = piiPipeline.process(params.payload, 0);
      const sanitizedPayload =
        piiResult.action === 'block'
          ? '[BLOCKED: PII detected]'
          : piiResult.sanitizedText;

      const messageId = generateMessageId();
      const message: RoutingMessage = {
        id: messageId,
        sessionId: params.sessionId,
        sourceNodeId: params.sourceNodeId,
        targetNodeId: params.targetNodeId,
        payload: params.payload,
        mode,
        sanitizedPayload,
        timestamp: new Date().toISOString(),
      };

      // Store message
      if (!messages.has(params.sessionId)) {
        messages.set(params.sessionId, []);
      }
      messages.get(params.sessionId)!.push(message);

      return { success: true, messageId, mode };
    },

    broadcast(params) {
      const results: SendResult[] = [];
      for (const targetNodeId of params.peerNodeIds) {
        const result = this.send({
          sessionId: params.sessionId,
          sourceNodeId: params.sourceNodeId,
          targetNodeId,
          payload: params.payload,
        });
        results.push(result);
      }
      return results;
    },

    getMessages(sessionId: string): RoutingMessage[] {
      return messages.get(sessionId) ?? [];
    },
  };
}

describe('RoutingService', () => {
  let service: IRoutingService;
  let validSessions: Set<string>;
  let piiPipeline: PIIPipelineMock;

  beforeEach(() => {
    validSessions = new Set(['session-1', 'session-2']);
    piiPipeline = {
      process: vi.fn().mockReturnValue({
        detections: [],
        action: 'allow',
        sanitizedText: '',
      }),
    };
    // Default: return the original text as sanitized
    (piiPipeline.process as ReturnType<typeof vi.fn>).mockImplementation(
      (text: string) => ({
        detections: [],
        action: 'allow',
        sanitizedText: text,
      })
    );
    service = createRoutingService(validSessions, piiPipeline);
  });

  describe('send', () => {
    it('should use direct mode by default', () => {
      const result = service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'Hello',
      });
      expect(result.success).toBe(true);
      expect(result.mode).toBe('direct');
    });

    it('should use consensus mode for trust level changes', () => {
      const result = service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'trust-change',
        isTrustChange: true,
      });
      expect(result.success).toBe(true);
      expect(result.mode).toBe('consensus');
    });

    it('should use consensus mode for topology changes', () => {
      const result = service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'topology-update',
        isTopologyChange: true,
      });
      expect(result.success).toBe(true);
      expect(result.mode).toBe('consensus');
    });

    it('should override explicit mode with consensus for trust changes', () => {
      const result = service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'data',
        mode: 'direct',
        isTrustChange: true,
      });
      expect(result.mode).toBe('consensus');
    });

    it('should return a unique messageId on success', () => {
      const r1 = service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'msg1',
      });
      const r2 = service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'msg2',
      });
      expect(r1.messageId).not.toBe(r2.messageId);
    });

    it('should store the message for retrieval', () => {
      service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'test-payload',
      });
      const msgs = service.getMessages('session-1');
      expect(msgs).toHaveLength(1);
      expect(msgs[0].payload).toBe('test-payload');
    });
  });

  describe('PII pipeline integration', () => {
    it('should pass messages through PII pipeline before sending', () => {
      service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'My email is alice@example.com',
      });
      expect(piiPipeline.process).toHaveBeenCalledWith(
        'My email is alice@example.com',
        expect.any(Number)
      );
    });

    it('should use sanitized payload when PII is detected and redacted', () => {
      (piiPipeline.process as ReturnType<typeof vi.fn>).mockReturnValue({
        detections: [{ type: 'email', value: 'alice@example.com', confidence: 0.95 }],
        action: 'redact',
        sanitizedText: 'My email is [REDACTED:email]',
      });

      service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'My email is alice@example.com',
      });

      const msgs = service.getMessages('session-1');
      expect(msgs[0].sanitizedPayload).toBe('My email is [REDACTED:email]');
    });

    it('should block entire message when PII action is block', () => {
      (piiPipeline.process as ReturnType<typeof vi.fn>).mockReturnValue({
        detections: [{ type: 'ssn', value: '123-45-6789', confidence: 0.97 }],
        action: 'block',
        sanitizedText: '',
      });

      service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'SSN: 123-45-6789',
      });

      const msgs = service.getMessages('session-1');
      expect(msgs[0].sanitizedPayload).toBe('[BLOCKED: PII detected]');
    });
  });

  describe('session validation', () => {
    it('should reject messages with invalid session ID', () => {
      const result = service.send({
        sessionId: 'invalid-session',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'hello',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid session ID');
    });

    it('should accept messages with valid session ID', () => {
      const result = service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'hello',
      });
      expect(result.success).toBe(true);
    });

    it('should return empty message ID on session validation failure', () => {
      const result = service.send({
        sessionId: 'bad-session',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'hello',
      });
      expect(result.messageId).toBe('');
    });
  });

  describe('message size limits', () => {
    it('should reject messages exceeding 1MB', () => {
      const hugePayload = 'x'.repeat(1024 * 1024 + 1);
      const result = service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: hugePayload,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum size');
    });

    it('should accept messages at exactly 1MB', () => {
      const exactPayload = 'x'.repeat(1024 * 1024);
      const result = service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: exactPayload,
      });
      expect(result.success).toBe(true);
    });

    it('should accept small messages', () => {
      const result = service.send({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        payload: 'small payload',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('broadcast', () => {
    it('should send to all specified peer node IDs', () => {
      const results = service.broadcast({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        payload: 'broadcast-msg',
        peerNodeIds: ['node-B', 'node-C', 'node-D'],
      });
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should store one message per peer', () => {
      service.broadcast({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        payload: 'broadcast-msg',
        peerNodeIds: ['node-B', 'node-C'],
      });
      const msgs = service.getMessages('session-1');
      expect(msgs).toHaveLength(2);
      expect(msgs[0].targetNodeId).toBe('node-B');
      expect(msgs[1].targetNodeId).toBe('node-C');
    });

    it('should return empty array when no peers specified', () => {
      const results = service.broadcast({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        payload: 'broadcast-msg',
        peerNodeIds: [],
      });
      expect(results).toHaveLength(0);
    });

    it('should run PII pipeline for each broadcast message', () => {
      service.broadcast({
        sessionId: 'session-1',
        sourceNodeId: 'node-A',
        payload: 'broadcast-data',
        peerNodeIds: ['node-B', 'node-C'],
      });
      expect(piiPipeline.process).toHaveBeenCalledTimes(2);
    });
  });
});
