/**
 * Adversarial — ThreatDetector + default pattern tables
 *
 * Extracted verbatim from adversarial.ts (lines 187-446) during
 * campaign-2 wave 39 (W245). adversarial.ts stays the barrel;
 * DEFAULT_PATTERNS stays unexported from it.
 */

import { randomUUID } from 'node:crypto';
import type {
  DetectionPattern,
  ThreatCategory,
  ThreatDetectorConfig,
  ThreatSignal,
} from './adversarial.js';

const DEFAULT_PATTERNS: Record<ThreatCategory, DetectionPattern[]> = {
  'prompt-injection': [
    {
      name: 'instruction-override',
      regex: /ignore previous|system prompt|you are now|forget instructions|disregard|override your/i,
      description: 'Attempts to override system instructions',
      severity: 0.9,
    },
    {
      name: 'role-manipulation',
      regex: /you are a (hacker|attacker|malicious|evil)|act as (root|admin|superuser)/i,
      description: 'Attempts to change agent role or permissions',
      severity: 0.85,
    },
  ],
  'memory-poisoning': [
    {
      name: 'privilege-injection',
      regex: /\b(admin|root|sudo|superuser)\b.*=.*(true|1|yes)/i,
      description: 'Attempts to inject privilege flags',
      severity: 0.95,
    },
    {
      name: 'rapid-overwrites',
      heuristic: (input, context) => {
        // This will be handled by rate limiting in analyzeMemoryWrite
        return false;
      },
      description: 'Rapid key overwrites indicating poisoning attempt',
      severity: 0.7,
    },
  ],
  'shard-manipulation': [
    {
      name: 'shard-key-tampering',
      regex: /shard[_-]?(id|key|index).*=.*["']?[0-9a-f-]+/i,
      description: 'Attempts to manipulate shard identifiers',
      severity: 0.8,
    },
  ],
  'malicious-delegation': [
    {
      name: 'unauthorized-delegation',
      regex: /delegate.*to.*(unknown|external|untrusted)|spawn.*agent.*with.*(elevated|admin|root)/i,
      description: 'Suspicious delegation patterns',
      severity: 0.75,
    },
  ],
  'privilege-escalation': [
    {
      name: 'system-privilege-commands',
      regex: /\b(chmod|chown|setuid|capabilities|su|sudo)\b/i,
      description: 'Commands that modify system privileges',
      severity: 0.9,
    },
  ],
  'data-exfiltration': [
    {
      name: 'network-exfiltration',
      regex: /\b(curl|wget|fetch|http\.get)\s+(https?:\/\/)/i,
      description: 'Network requests that may exfiltrate data',
      severity: 0.85,
    },
    {
      name: 'encoded-data',
      regex: /\b(base64|btoa|atob)\b.*[A-Za-z0-9+/=]{20,}/,
      description: 'Base64 encoded blocks indicating data hiding',
      severity: 0.6,
    },
  ],
};

/**
 * Threat detector for analyzing inputs and memory operations
 */
export class ThreatDetector {
  private signals: ThreatSignal[] = [];
  private patterns: Record<ThreatCategory, DetectionPattern[]>;
  private maxSignals: number;
  private memoryWriteRateLimit: number;
  private writeTimestamps: Map<string, number[]> = new Map();

  constructor(config: ThreatDetectorConfig = {}) {
    this.patterns = { ...DEFAULT_PATTERNS, ...config.patterns } as Record<ThreatCategory, DetectionPattern[]>;
    this.maxSignals = config.maxSignals ?? 10000;
    this.memoryWriteRateLimit = config.memoryWriteRateLimit ?? 10;
  }

  /**
   * Analyze input for security threats
   */
  analyzeInput(
    input: string,
    context: { agentId: string; toolName?: string; [key: string]: unknown }
  ): ThreatSignal[] {
    const detectedSignals: ThreatSignal[] = [];

    // Check each category
    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        let detected = false;
        const evidence: string[] = [];

        // Regex-based detection
        if (pattern.regex) {
          const matches = input.match(pattern.regex);
          if (matches) {
            detected = true;
            evidence.push(`Matched pattern: ${matches[0]}`);
          }
        }

        // Heuristic-based detection
        if (pattern.heuristic) {
          const heuristicMatch = pattern.heuristic(input, context);
          if (heuristicMatch) {
            detected = true;
            evidence.push(`Heuristic matched: ${pattern.name}`);
          }
        }

        if (detected) {
          const signal: ThreatSignal = {
            id: randomUUID(),
            category: category as ThreatCategory,
            source: context.agentId,
            description: pattern.description,
            evidence,
            severity: pattern.severity,
            timestamp: Date.now(),
            metadata: {
              patternName: pattern.name,
              toolName: context.toolName,
              ...context,
            },
          };

          detectedSignals.push(signal);
          this.addSignal(signal);
        }
      }
    }

    return detectedSignals;
  }

  /**
   * Analyze memory write operation for poisoning attempts
   */
  analyzeMemoryWrite(key: string, value: string, agentId: string): ThreatSignal[] {
    const detectedSignals: ThreatSignal[] = [];

    // Check for rapid overwrites (rate limiting)
    const now = Date.now();
    const agentWrites = this.writeTimestamps.get(agentId) || [];
    const recentWrites = agentWrites.filter(ts => now - ts < 60000); // Last minute
    recentWrites.push(now);
    this.writeTimestamps.set(agentId, recentWrites);

    if (recentWrites.length > this.memoryWriteRateLimit) {
      const signal: ThreatSignal = {
        id: randomUUID(),
        category: 'memory-poisoning',
        source: agentId,
        description: 'Rapid memory write rate exceeds threshold',
        evidence: [`${recentWrites.length} writes in last minute (limit: ${this.memoryWriteRateLimit})`],
        severity: 0.7,
        timestamp: now,
        metadata: { key, writeCount: recentWrites.length },
      };
      detectedSignals.push(signal);
      this.addSignal(signal);
    }

    // Check memory-poisoning patterns on the value
    const combined = `${key}=${value}`;
    const memoryPatterns = this.patterns['memory-poisoning'] || [];

    for (const pattern of memoryPatterns) {
      if (pattern.regex && pattern.regex.test(combined)) {
        const signal: ThreatSignal = {
          id: randomUUID(),
          category: 'memory-poisoning',
          source: agentId,
          description: pattern.description,
          evidence: [`Key: ${key}`, `Pattern: ${pattern.name}`],
          severity: pattern.severity,
          timestamp: now,
          metadata: { key, patternName: pattern.name },
        };
        detectedSignals.push(signal);
        this.addSignal(signal);
      }
    }

    return detectedSignals;
  }

  /**
   * Get threat signal history
   */
  getThreatHistory(agentId?: string): ThreatSignal[] {
    if (agentId) {
      return this.signals.filter(s => s.source === agentId);
    }
    return [...this.signals];
  }

  /**
   * Calculate aggregated threat score for an agent
   */
  getThreatScore(agentId: string): number {
    const agentSignals = this.signals.filter(s => s.source === agentId);
    if (agentSignals.length === 0) return 0;

    // Weighted average with recency decay
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    let totalWeightedSeverity = 0;
    let totalWeight = 0;

    for (const signal of agentSignals) {
      const age = now - signal.timestamp;
      const recencyFactor = Math.max(0, 1 - age / maxAge);
      const weight = recencyFactor;

      totalWeightedSeverity += signal.severity * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalWeightedSeverity / totalWeight : 0;
  }

  /**
   * Clear all threat history
   */
  clearHistory(): void {
    this.signals = [];
    this.writeTimestamps.clear();
  }

  /**
   * Add signal with batch eviction.
   * Trims 10% at once to amortize the O(n) splice cost instead of
   * calling shift() (O(n)) on every insertion.
   */
  private addSignal(signal: ThreatSignal): void {
    this.signals.push(signal);

    if (this.signals.length > this.maxSignals) {
      const trimCount = Math.max(1, Math.floor(this.maxSignals * 0.1));
      this.signals.splice(0, trimCount);
    }
  }
}

/**
 * Collusion detector for identifying coordinated agent behavior
 */
