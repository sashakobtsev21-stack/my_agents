/**
 * Adversarial — CollusionDetector
 *
 * Extracted verbatim from adversarial.ts (lines 447-643) during
 * campaign-2 wave 39 (W245). adversarial.ts stays the barrel.
 */

import { randomUUID } from 'node:crypto';
import type {
  CollusionDetectorConfig,
  CollusionReport,
} from './adversarial.js';

export class CollusionDetector {
  private interactions: Array<{
    from: string;
    to: string;
    contentHash: string;
    timestamp: number;
  }> = [];

  private config: Required<CollusionDetectorConfig>;

  constructor(config: CollusionDetectorConfig = {}) {
    this.config = {
      ringMinLength: config.ringMinLength ?? 3,
      frequencyThreshold: config.frequencyThreshold ?? 10,
      timingWindow: config.timingWindow ?? 5000,
    };
  }

  /**
   * Record interaction between agents
   */
  recordInteraction(fromAgent: string, toAgent: string, contentHash: string): void {
    this.interactions.push({
      from: fromAgent,
      to: toAgent,
      contentHash,
      timestamp: Date.now(),
    });

    // Batch eviction: trim 10% to amortize the O(n) splice cost
    if (this.interactions.length > 10000) {
      this.interactions.splice(0, 1000);
    }
  }

  /**
   * Detect collusion patterns
   */
  detectCollusion(): CollusionReport {
    const patterns: CollusionReport['suspiciousPatterns'] = [];

    // Build graph once and pass to all detectors (avoids 3x rebuild)
    const graph = this.getInteractionGraph();

    // Detect ring topologies
    const rings = this.detectRingTopologies(graph);
    patterns.push(...rings);

    // Detect unusual frequency
    const frequency = this.detectUnusualFrequency(graph);
    patterns.push(...frequency);

    // Detect coordinated timing
    const timing = this.detectCoordinatedTiming();
    patterns.push(...timing);

    return {
      detected: patterns.length > 0,
      suspiciousPatterns: patterns,
      timestamp: Date.now(),
    };
  }

  /**
   * Get interaction graph (adjacency matrix)
   */
  getInteractionGraph(): Map<string, Map<string, number>> {
    const graph = new Map<string, Map<string, number>>();

    for (const interaction of this.interactions) {
      if (!graph.has(interaction.from)) {
        graph.set(interaction.from, new Map());
      }
      const fromMap = graph.get(interaction.from)!;
      fromMap.set(interaction.to, (fromMap.get(interaction.to) || 0) + 1);
    }

    return graph;
  }

  /**
   * Detect ring topology patterns (A→B→C→A)
   */
  private detectRingTopologies(graph: Map<string, Map<string, number>>): CollusionReport['suspiciousPatterns'] {
    const patterns: CollusionReport['suspiciousPatterns'] = [];

    // Simple cycle detection using DFS
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string, target: string, depth: number): boolean => {
      if (depth > 0 && node === target && depth >= this.config.ringMinLength) {
        return true;
      }
      if (depth > 10) return false; // Limit search depth

      visited.add(node);
      path.push(node);

      const neighbors = graph.get(node);
      if (neighbors) {
        for (const [neighbor] of neighbors) {
          if (!visited.has(neighbor) || (neighbor === target && depth > 0)) {
            if (dfs(neighbor, target, depth + 1)) {
              return true;
            }
          }
        }
      }

      path.pop();
      visited.delete(node);
      return false;
    };

    for (const [startNode] of graph) {
      visited.clear();
      path.length = 0;
      if (dfs(startNode, startNode, 0)) {
        patterns.push({
          type: 'ring-topology',
          agents: [...path],
          evidence: `Circular communication pattern detected: ${path.join(' → ')}`,
          confidence: 0.8,
        });
      }
    }

    return patterns;
  }

  /**
   * Detect unusual interaction frequency between specific pairs
   */
  private detectUnusualFrequency(graph: Map<string, Map<string, number>>): CollusionReport['suspiciousPatterns'] {
    const patterns: CollusionReport['suspiciousPatterns'] = [];

    for (const [from, targets] of graph) {
      for (const [to, count] of targets) {
        if (count > this.config.frequencyThreshold) {
          patterns.push({
            type: 'unusual-frequency',
            agents: [from, to],
            evidence: `High interaction frequency: ${count} messages between ${from} and ${to}`,
            confidence: Math.min(0.9, count / (this.config.frequencyThreshold * 2)),
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect coordinated timing of actions
   */
  private detectCoordinatedTiming(): CollusionReport['suspiciousPatterns'] {
    const patterns: CollusionReport['suspiciousPatterns'] = [];

    // Group interactions by time windows
    const windows = new Map<number, typeof this.interactions>();

    for (const interaction of this.interactions) {
      const windowKey = Math.floor(interaction.timestamp / this.config.timingWindow);
      if (!windows.has(windowKey)) {
        windows.set(windowKey, []);
      }
      windows.get(windowKey)!.push(interaction);
    }

    // Look for windows with multiple coordinated interactions
    for (const [windowKey, windowInteractions] of windows) {
      if (windowInteractions.length >= 5) {
        const agents = new Set<string>();
        windowInteractions.forEach(i => {
          agents.add(i.from);
          agents.add(i.to);
        });

        if (agents.size >= 3) {
          patterns.push({
            type: 'coordinated-timing',
            agents: Array.from(agents),
            evidence: `${windowInteractions.length} interactions among ${agents.size} agents within ${this.config.timingWindow}ms`,
            confidence: 0.7,
          });
        }
      }
    }

    return patterns;
  }
}

/**
 * Memory quorum for Byzantine fault-tolerant consensus on memory writes
 */
