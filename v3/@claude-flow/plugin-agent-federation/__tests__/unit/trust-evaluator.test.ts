/**
 * TrustEvaluator Tests
 *
 * Validates trust score computation using the formula:
 *   score = 0.4*success_rate + 0.2*uptime + 0.2*(1-threat_penalty) + 0.2*data_integrity_score
 *
 * Also tests trust level transitions with hysteresis, minimum interaction
 * requirements, and automatic downgrades on security events.
 *
 * London School TDD: all dependencies are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrustLevel } from '../../src/domain/entities/trust-level.js';

// --- Types expected from the not-yet-implemented TrustEvaluator ---

interface TrustMetrics {
  successRate: number;
  uptime: number;
  threatPenalty: number;
  dataIntegrityScore: number;
}

interface PeerRecord {
  peerId: string;
  trustLevel: TrustLevel;
  interactionCount: number;
  lastThreatTimestamps: number[];
  hmacFailures: number;
}

interface ITrustEvaluator {
  computeScore(metrics: TrustMetrics): number;
  evaluateTransition(peer: PeerRecord, score: number): TrustLevel;
  shouldDowngradeOnThreat(peer: PeerRecord, now?: number): boolean;
  shouldDowngradeOnHmacFailure(peer: PeerRecord): boolean;
}

// --- Mock implementation matching ADR-078 spec ---

function createTrustEvaluator(): ITrustEvaluator {
  return {
    computeScore(metrics: TrustMetrics): number {
      const { successRate, uptime, threatPenalty, dataIntegrityScore } = metrics;
      return (
        0.4 * successRate +
        0.2 * uptime +
        0.2 * (1 - threatPenalty) +
        0.2 * dataIntegrityScore
      );
    },

    evaluateTransition(peer: PeerRecord, score: number): TrustLevel {
      // Check for automatic downgrades first
      if (this.shouldDowngradeOnHmacFailure(peer)) {
        return TrustLevel.UNTRUSTED;
      }
      if (this.shouldDowngradeOnThreat(peer)) {
        return Math.max(0, peer.trustLevel - 1) as TrustLevel;
      }

      const currentLevel = peer.trustLevel;

      // Try upgrade
      if (currentLevel < TrustLevel.PRIVILEGED) {
        const transitionKey = `${currentLevel}->${currentLevel + 1}`;
        const thresholds: Record<string, { upgradeScore: number; downgradeScore: number; minInteractions: number }> = {
          '1->2': { upgradeScore: 0.7, downgradeScore: 0.5, minInteractions: 50 },
          '2->3': { upgradeScore: 0.85, downgradeScore: 0.65, minInteractions: 500 },
          '3->4': { upgradeScore: 0.95, downgradeScore: 0.8, minInteractions: 5000 },
        };
        const threshold = thresholds[transitionKey];
        if (threshold && score >= threshold.upgradeScore && peer.interactionCount >= threshold.minInteractions) {
          return (currentLevel + 1) as TrustLevel;
        }
      }

      // Try downgrade
      if (currentLevel > TrustLevel.UNTRUSTED) {
        const transitionKey = `${currentLevel - 1}->${currentLevel}`;
        const thresholds: Record<string, { upgradeScore: number; downgradeScore: number; minInteractions: number }> = {
          '1->2': { upgradeScore: 0.7, downgradeScore: 0.5, minInteractions: 50 },
          '2->3': { upgradeScore: 0.85, downgradeScore: 0.65, minInteractions: 500 },
          '3->4': { upgradeScore: 0.95, downgradeScore: 0.8, minInteractions: 5000 },
        };
        const threshold = thresholds[transitionKey];
        if (threshold && score < threshold.downgradeScore) {
          return (currentLevel - 1) as TrustLevel;
        }
      }

      return currentLevel;
    },

    shouldDowngradeOnThreat(peer: PeerRecord, now?: number): boolean {
      const currentTime = now ?? Date.now();
      const oneHourAgo = currentTime - 60 * 60 * 1000;
      const recentThreats = peer.lastThreatTimestamps.filter((ts) => ts > oneHourAgo);
      return recentThreats.length >= 2;
    },

    shouldDowngradeOnHmacFailure(peer: PeerRecord): boolean {
      return peer.hmacFailures > 0;
    },
  };
}

describe('TrustEvaluator', () => {
  let evaluator: ITrustEvaluator;

  beforeEach(() => {
    evaluator = createTrustEvaluator();
  });

  describe('computeScore', () => {
    it('should return 1.0 for perfect metrics', () => {
      const score = evaluator.computeScore({
        successRate: 1.0,
        uptime: 1.0,
        threatPenalty: 0,
        dataIntegrityScore: 1.0,
      });
      expect(score).toBeCloseTo(1.0, 5);
    });

    it('should return 0.0 for worst-case metrics', () => {
      const score = evaluator.computeScore({
        successRate: 0,
        uptime: 0,
        threatPenalty: 1.0,
        dataIntegrityScore: 0,
      });
      expect(score).toBeCloseTo(0.0, 5);
    });

    it('should compute 0.68 for mixed metrics', () => {
      // 0.4*0.5 + 0.2*0.8 + 0.2*(1-0.3) + 0.2*0.9
      // = 0.20 + 0.16 + 0.14 + 0.18 = 0.68
      const score = evaluator.computeScore({
        successRate: 0.5,
        uptime: 0.8,
        threatPenalty: 0.3,
        dataIntegrityScore: 0.9,
      });
      expect(score).toBeCloseTo(0.68, 5);
    });

    it('should weight success_rate most heavily at 40%', () => {
      const base = evaluator.computeScore({
        successRate: 0.5,
        uptime: 0.5,
        threatPenalty: 0.5,
        dataIntegrityScore: 0.5,
      });
      const withHigherSuccess = evaluator.computeScore({
        successRate: 1.0,
        uptime: 0.5,
        threatPenalty: 0.5,
        dataIntegrityScore: 0.5,
      });
      // Increasing success_rate by 0.5 should add 0.4*0.5 = 0.2
      expect(withHigherSuccess - base).toBeCloseTo(0.2, 5);
    });

    it('should inversely weight threat_penalty', () => {
      const noThreat = evaluator.computeScore({
        successRate: 0.5,
        uptime: 0.5,
        threatPenalty: 0,
        dataIntegrityScore: 0.5,
      });
      const fullThreat = evaluator.computeScore({
        successRate: 0.5,
        uptime: 0.5,
        threatPenalty: 1.0,
        dataIntegrityScore: 0.5,
      });
      expect(noThreat).toBeGreaterThan(fullThreat);
      expect(noThreat - fullThreat).toBeCloseTo(0.2, 5);
    });

    it('should handle boundary values at 0', () => {
      const score = evaluator.computeScore({
        successRate: 0,
        uptime: 0,
        threatPenalty: 0,
        dataIntegrityScore: 0,
      });
      // 0 + 0 + 0.2*(1-0) + 0 = 0.2
      expect(score).toBeCloseTo(0.2, 5);
    });

    it('should produce values in [0, 1] range for valid inputs', () => {
      for (let i = 0; i <= 10; i++) {
        const v = i / 10;
        const score = evaluator.computeScore({
          successRate: v,
          uptime: v,
          threatPenalty: 1 - v,
          dataIntegrityScore: v,
        });
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('evaluateTransition', () => {
    it('should upgrade from VERIFIED to ATTESTED when score >= 0.7 and interactions >= 50', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.VERIFIED,
        interactionCount: 50,
        lastThreatTimestamps: [],
        hmacFailures: 0,
      };
      const result = evaluator.evaluateTransition(peer, 0.7);
      expect(result).toBe(TrustLevel.ATTESTED);
    });

    it('should not upgrade when interaction count is below minimum', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.VERIFIED,
        interactionCount: 49,
        lastThreatTimestamps: [],
        hmacFailures: 0,
      };
      const result = evaluator.evaluateTransition(peer, 0.9);
      expect(result).toBe(TrustLevel.VERIFIED);
    });

    it('should not upgrade when score is below upgrade threshold', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.VERIFIED,
        interactionCount: 100,
        lastThreatTimestamps: [],
        hmacFailures: 0,
      };
      const result = evaluator.evaluateTransition(peer, 0.69);
      expect(result).toBe(TrustLevel.VERIFIED);
    });

    it('should downgrade from ATTESTED to VERIFIED when score < 0.5', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.ATTESTED,
        interactionCount: 100,
        lastThreatTimestamps: [],
        hmacFailures: 0,
      };
      const result = evaluator.evaluateTransition(peer, 0.49);
      expect(result).toBe(TrustLevel.VERIFIED);
    });

    it('should keep level when score is between downgrade and upgrade thresholds (hysteresis)', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.ATTESTED,
        interactionCount: 100,
        lastThreatTimestamps: [],
        hmacFailures: 0,
      };
      // Score 0.6 is above downgrade (0.5) but below upgrade for next level (0.85)
      const result = evaluator.evaluateTransition(peer, 0.6);
      expect(result).toBe(TrustLevel.ATTESTED);
    });

    it('should upgrade from ATTESTED to TRUSTED when score >= 0.85 and interactions >= 500', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.ATTESTED,
        interactionCount: 500,
        lastThreatTimestamps: [],
        hmacFailures: 0,
      };
      const result = evaluator.evaluateTransition(peer, 0.85);
      expect(result).toBe(TrustLevel.TRUSTED);
    });

    it('should upgrade from TRUSTED to PRIVILEGED when score >= 0.95 and interactions >= 5000', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.TRUSTED,
        interactionCount: 5000,
        lastThreatTimestamps: [],
        hmacFailures: 0,
      };
      const result = evaluator.evaluateTransition(peer, 0.95);
      expect(result).toBe(TrustLevel.PRIVILEGED);
    });

    it('should not upgrade past PRIVILEGED', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.PRIVILEGED,
        interactionCount: 100_000,
        lastThreatTimestamps: [],
        hmacFailures: 0,
      };
      const result = evaluator.evaluateTransition(peer, 1.0);
      expect(result).toBe(TrustLevel.PRIVILEGED);
    });
  });

  describe('automatic downgrade on threat detection', () => {
    it('should downgrade when 2+ threats detected within 1 hour', () => {
      const now = Date.now();
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.ATTESTED,
        interactionCount: 100,
        lastThreatTimestamps: [now - 1000, now - 500],
        hmacFailures: 0,
      };
      expect(evaluator.shouldDowngradeOnThreat(peer, now)).toBe(true);
    });

    it('should not downgrade when only 1 threat in past hour', () => {
      const now = Date.now();
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.ATTESTED,
        interactionCount: 100,
        lastThreatTimestamps: [now - 1000],
        hmacFailures: 0,
      };
      expect(evaluator.shouldDowngradeOnThreat(peer, now)).toBe(false);
    });

    it('should not count threats older than 1 hour', () => {
      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.ATTESTED,
        interactionCount: 100,
        lastThreatTimestamps: [twoHoursAgo, twoHoursAgo + 100],
        hmacFailures: 0,
      };
      expect(evaluator.shouldDowngradeOnThreat(peer, now)).toBe(false);
    });

    it('should cause evaluateTransition to return lower level on 2+ threats', () => {
      const now = Date.now();
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.TRUSTED,
        interactionCount: 1000,
        lastThreatTimestamps: [now - 500, now - 200],
        hmacFailures: 0,
      };
      const result = evaluator.evaluateTransition(peer, 0.9);
      expect(result).toBeLessThan(TrustLevel.TRUSTED);
    });
  });

  describe('automatic downgrade on HMAC failure', () => {
    it('should downgrade to UNTRUSTED on any HMAC failure', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.PRIVILEGED,
        interactionCount: 10000,
        lastThreatTimestamps: [],
        hmacFailures: 1,
      };
      expect(evaluator.shouldDowngradeOnHmacFailure(peer)).toBe(true);
    });

    it('should not downgrade when no HMAC failures', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.TRUSTED,
        interactionCount: 1000,
        lastThreatTimestamps: [],
        hmacFailures: 0,
      };
      expect(evaluator.shouldDowngradeOnHmacFailure(peer)).toBe(false);
    });

    it('should cause evaluateTransition to return UNTRUSTED on HMAC failure', () => {
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.PRIVILEGED,
        interactionCount: 10000,
        lastThreatTimestamps: [],
        hmacFailures: 1,
      };
      const result = evaluator.evaluateTransition(peer, 1.0);
      expect(result).toBe(TrustLevel.UNTRUSTED);
    });

    it('should prioritize HMAC failure over threat detection', () => {
      const now = Date.now();
      const peer: PeerRecord = {
        peerId: 'peer-1',
        trustLevel: TrustLevel.TRUSTED,
        interactionCount: 1000,
        lastThreatTimestamps: [now - 500, now - 200],
        hmacFailures: 1,
      };
      const result = evaluator.evaluateTransition(peer, 0.9);
      // HMAC failure -> UNTRUSTED, not just one level down from threat
      expect(result).toBe(TrustLevel.UNTRUSTED);
    });
  });
});
