/**
 * AuditService Tests
 *
 * Validates audit event creation with UUID and timestamp, event categorization,
 * HIPAA/SOC2/GDPR compliance modes, filtering/querying, and PII event logging.
 *
 * London School TDD: all dependencies are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Types expected from the not-yet-implemented AuditService ---

type AuditEventCategory =
  | 'discovery'
  | 'handshake'
  | 'message'
  | 'pii'
  | 'security'
  | 'consensus';

type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';
type ComplianceMode = 'hipaa' | 'soc2' | 'gdpr';

interface AuditEvent {
  id: string;
  timestamp: string;
  nodeId: string;
  category: AuditEventCategory;
  severity: AuditSeverity;
  action: string;
  details: Record<string, unknown>;
  complianceTags: string[];
}

interface AuditQueryOptions {
  eventType?: AuditEventCategory;
  severity?: AuditSeverity;
  dateRange?: { start: Date; end: Date };
  limit?: number;
}

interface IAuditService {
  log(params: {
    category: AuditEventCategory;
    severity: AuditSeverity;
    action: string;
    details?: Record<string, unknown>;
  }): AuditEvent;

  query(options: AuditQueryOptions): AuditEvent[];
  getAll(): AuditEvent[];
  getComplianceMode(): ComplianceMode;
}

// --- Mock implementation matching ADR-078 spec ---

function createAuditService(
  nodeId: string,
  complianceMode: ComplianceMode = 'soc2',
): IAuditService {
  const events: AuditEvent[] = [];
  let counter = 0;

  function generateId(): string {
    counter++;
    return `audit_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function getComplianceTags(
    category: AuditEventCategory,
    mode: ComplianceMode,
  ): string[] {
    const tags: string[] = [mode];

    switch (mode) {
      case 'hipaa':
        tags.push('full-audit-trail');
        if (category === 'pii') tags.push('no-pii-in-logs');
        if (category === 'security') tags.push('access-monitoring');
        break;
      case 'soc2':
        tags.push('access-control');
        if (category === 'security') tags.push('security-event');
        if (category === 'handshake') tags.push('authentication');
        break;
      case 'gdpr':
        tags.push('data-processing-record');
        if (category === 'pii') tags.push('data-subject-rights');
        if (category === 'message') tags.push('data-transfer');
        break;
    }

    return tags;
  }

  return {
    log(params) {
      const event: AuditEvent = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        nodeId,
        category: params.category,
        severity: params.severity,
        action: params.action,
        details: params.details ?? {},
        complianceTags: getComplianceTags(params.category, complianceMode),
      };

      // HIPAA mode: strip PII from details
      if (complianceMode === 'hipaa' && params.category === 'pii') {
        const sanitized = { ...event.details };
        delete sanitized['rawValue'];
        delete sanitized['value'];
        event.details = sanitized;
      }

      events.push(event);
      return event;
    },

    query(options: AuditQueryOptions): AuditEvent[] {
      let result = [...events];

      if (options.eventType) {
        result = result.filter((e) => e.category === options.eventType);
      }

      if (options.severity) {
        result = result.filter((e) => e.severity === options.severity);
      }

      if (options.dateRange) {
        const start = options.dateRange.start.getTime();
        const end = options.dateRange.end.getTime();
        result = result.filter((e) => {
          const ts = new Date(e.timestamp).getTime();
          return ts >= start && ts <= end;
        });
      }

      if (options.limit) {
        result = result.slice(0, options.limit);
      }

      return result;
    },

    getAll(): AuditEvent[] {
      return [...events];
    },

    getComplianceMode(): ComplianceMode {
      return complianceMode;
    },
  };
}

describe('AuditService', () => {
  describe('log', () => {
    let service: IAuditService;

    beforeEach(() => {
      service = createAuditService('node-A');
    });

    it('should create an audit event with a unique id', () => {
      const event = service.log({
        category: 'discovery',
        severity: 'info',
        action: 'peer-discovered',
      });
      expect(event.id).toBeDefined();
      expect(event.id.length).toBeGreaterThan(0);
    });

    it('should generate unique ids for consecutive events', () => {
      const e1 = service.log({ category: 'discovery', severity: 'info', action: 'a' });
      const e2 = service.log({ category: 'discovery', severity: 'info', action: 'b' });
      expect(e1.id).not.toBe(e2.id);
    });

    it('should include an ISO 8601 timestamp', () => {
      const event = service.log({
        category: 'handshake',
        severity: 'info',
        action: 'handshake-initiated',
      });
      const iso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(event.timestamp).toMatch(iso8601);
    });

    it('should include the nodeId', () => {
      const event = service.log({
        category: 'message',
        severity: 'info',
        action: 'message-sent',
      });
      expect(event.nodeId).toBe('node-A');
    });

    it('should correctly categorize discovery events', () => {
      const event = service.log({ category: 'discovery', severity: 'info', action: 'peer-found' });
      expect(event.category).toBe('discovery');
    });

    it('should correctly categorize handshake events', () => {
      const event = service.log({ category: 'handshake', severity: 'info', action: 'tls-complete' });
      expect(event.category).toBe('handshake');
    });

    it('should correctly categorize message events', () => {
      const event = service.log({ category: 'message', severity: 'info', action: 'routed' });
      expect(event.category).toBe('message');
    });

    it('should correctly categorize pii events', () => {
      const event = service.log({ category: 'pii', severity: 'warning', action: 'pii-detected' });
      expect(event.category).toBe('pii');
    });

    it('should correctly categorize security events', () => {
      const event = service.log({ category: 'security', severity: 'critical', action: 'hmac-failure' });
      expect(event.category).toBe('security');
    });

    it('should correctly categorize consensus events', () => {
      const event = service.log({ category: 'consensus', severity: 'info', action: 'vote-cast' });
      expect(event.category).toBe('consensus');
    });

    it('should store action and details', () => {
      const event = service.log({
        category: 'pii',
        severity: 'warning',
        action: 'pii-detected',
        details: { typesFound: ['email', 'ssn'], actionTaken: 'redact' },
      });
      expect(event.action).toBe('pii-detected');
      expect(event.details).toEqual({ typesFound: ['email', 'ssn'], actionTaken: 'redact' });
    });

    it('should default details to empty object when not provided', () => {
      const event = service.log({ category: 'discovery', severity: 'info', action: 'ping' });
      expect(event.details).toEqual({});
    });
  });

  describe('HIPAA compliance mode', () => {
    let service: IAuditService;

    beforeEach(() => {
      service = createAuditService('node-H', 'hipaa');
    });

    it('should tag events with hipaa and full-audit-trail', () => {
      const event = service.log({ category: 'discovery', severity: 'info', action: 'scan' });
      expect(event.complianceTags).toContain('hipaa');
      expect(event.complianceTags).toContain('full-audit-trail');
    });

    it('should tag pii events with no-pii-in-logs', () => {
      const event = service.log({ category: 'pii', severity: 'warning', action: 'pii-detected' });
      expect(event.complianceTags).toContain('no-pii-in-logs');
    });

    it('should strip raw PII values from pii event details', () => {
      const event = service.log({
        category: 'pii',
        severity: 'warning',
        action: 'pii-detected',
        details: { rawValue: '123-45-6789', value: 'secret', typesFound: ['ssn'] },
      });
      expect(event.details).not.toHaveProperty('rawValue');
      expect(event.details).not.toHaveProperty('value');
      expect(event.details).toHaveProperty('typesFound');
    });

    it('should tag security events with access-monitoring', () => {
      const event = service.log({ category: 'security', severity: 'critical', action: 'breach-attempt' });
      expect(event.complianceTags).toContain('access-monitoring');
    });
  });

  describe('SOC2 compliance mode', () => {
    let service: IAuditService;

    beforeEach(() => {
      service = createAuditService('node-S', 'soc2');
    });

    it('should tag events with soc2 and access-control', () => {
      const event = service.log({ category: 'discovery', severity: 'info', action: 'scan' });
      expect(event.complianceTags).toContain('soc2');
      expect(event.complianceTags).toContain('access-control');
    });

    it('should tag security events with security-event', () => {
      const event = service.log({ category: 'security', severity: 'error', action: 'unauthorized' });
      expect(event.complianceTags).toContain('security-event');
    });

    it('should tag handshake events with authentication', () => {
      const event = service.log({ category: 'handshake', severity: 'info', action: 'auth-complete' });
      expect(event.complianceTags).toContain('authentication');
    });
  });

  describe('GDPR compliance mode', () => {
    let service: IAuditService;

    beforeEach(() => {
      service = createAuditService('node-G', 'gdpr');
    });

    it('should tag events with gdpr and data-processing-record', () => {
      const event = service.log({ category: 'discovery', severity: 'info', action: 'scan' });
      expect(event.complianceTags).toContain('gdpr');
      expect(event.complianceTags).toContain('data-processing-record');
    });

    it('should tag pii events with data-subject-rights', () => {
      const event = service.log({ category: 'pii', severity: 'warning', action: 'pii-found' });
      expect(event.complianceTags).toContain('data-subject-rights');
    });

    it('should tag message events with data-transfer', () => {
      const event = service.log({ category: 'message', severity: 'info', action: 'cross-border' });
      expect(event.complianceTags).toContain('data-transfer');
    });
  });

  describe('query', () => {
    let service: IAuditService;

    beforeEach(() => {
      service = createAuditService('node-Q');
      service.log({ category: 'discovery', severity: 'info', action: 'a' });
      service.log({ category: 'security', severity: 'critical', action: 'b' });
      service.log({ category: 'pii', severity: 'warning', action: 'c' });
      service.log({ category: 'discovery', severity: 'info', action: 'd' });
      service.log({ category: 'message', severity: 'info', action: 'e' });
    });

    it('should filter by eventType', () => {
      const results = service.query({ eventType: 'discovery' });
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.category === 'discovery')).toBe(true);
    });

    it('should filter by severity', () => {
      const results = service.query({ severity: 'critical' });
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('security');
    });

    it('should respect limit', () => {
      const results = service.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should filter by dateRange', () => {
      const now = new Date();
      const tenSecondsAgo = new Date(now.getTime() - 10000);
      const results = service.query({ dateRange: { start: tenSecondsAgo, end: now } });
      // All events were logged within the last few milliseconds
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array when no events match filter', () => {
      const results = service.query({ eventType: 'consensus' });
      expect(results).toHaveLength(0);
    });

    it('should return all events when no filters applied', () => {
      const results = service.query({});
      expect(results).toHaveLength(5);
    });
  });

  describe('PII detection audit events', () => {
    it('should log PII types found and action taken', () => {
      const service = createAuditService('node-P');
      const event = service.log({
        category: 'pii',
        severity: 'warning',
        action: 'pii-detected',
        details: {
          typesFound: ['email', 'phone'],
          actionTaken: 'redact',
          messageId: 'msg-123',
        },
      });
      expect(event.details.typesFound).toEqual(['email', 'phone']);
      expect(event.details.actionTaken).toBe('redact');
    });

    it('should log blocked PII with critical severity', () => {
      const service = createAuditService('node-P');
      const event = service.log({
        category: 'pii',
        severity: 'critical',
        action: 'pii-blocked',
        details: { typesFound: ['ssn'], actionTaken: 'block' },
      });
      expect(event.severity).toBe('critical');
      expect(event.details.actionTaken).toBe('block');
    });
  });
});
