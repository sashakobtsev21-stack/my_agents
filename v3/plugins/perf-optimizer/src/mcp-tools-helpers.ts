/**
 * Perf Optimizer MCP Tools — analysis helpers
 *
 * Bottleneck/memory/query/bundle/config analysis helper functions.
 * These were module-private in the original mcp-tools.ts (P3.66, W187)
 * and are deliberately NOT re-exported by the mcp-tools.ts barrel —
 * public API unchanged.
 */

import type {
  Bottleneck,
  BundleOptimization,
  ConfigParameter,
  HeapObject,
  MemoryLeak,
  QueryPattern,
  TraceSpan,
} from './types.js';

// Helper Functions
// ============================================================================

export function analyzeBottlenecks(
  spans: TraceSpan[],
  scope: string[],
  threshold?: { latencyP95?: number; throughput?: number; errorRate?: number }
): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];
  const operationStats = new Map<string, { count: number; totalDuration: number; errors: number }>();

  // Aggregate stats by operation
  for (const span of spans) {
    const key = `${span.serviceName}:${span.operationName}`;
    const stats = operationStats.get(key) ?? { count: 0, totalDuration: 0, errors: 0 };
    stats.count++;
    stats.totalDuration += span.duration;
    if (span.status === 'error') stats.errors++;
    operationStats.set(key, stats);
  }

  // Find bottlenecks
  let idx = 0;
  for (const [operation, stats] of operationStats) {
    const avgDuration = stats.totalDuration / stats.count;
    const errorRate = stats.errors / stats.count;

    const shouldInclude = scope.includes('all') || scope.some(s =>
      operation.toLowerCase().includes(s) || s === 'all'
    );

    if (!shouldInclude) continue;

    // Check thresholds
    const latencyThreshold = threshold?.latencyP95 ?? 100;
    const errorThreshold = threshold?.errorRate ?? 0.01;

    if (avgDuration > latencyThreshold || errorRate > errorThreshold) {
      const severity = avgDuration > latencyThreshold * 5 || errorRate > 0.1
        ? 'critical'
        : avgDuration > latencyThreshold * 2 || errorRate > 0.05
          ? 'high'
          : avgDuration > latencyThreshold || errorRate > errorThreshold
            ? 'medium'
            : 'low';

      bottlenecks.push({
        id: `bn-${idx++}`,
        type: determineBottleneckType(operation, avgDuration),
        severity,
        location: operation,
        description: `${operation} has avg latency ${avgDuration.toFixed(0)}ms with ${(errorRate * 100).toFixed(1)}% error rate`,
        impact: {
          latencyMs: avgDuration,
          throughput: stats.count,
          errorRate,
        },
        suggestedFix: getSuggestedFix(operation, avgDuration, errorRate),
        relatedSpans: spans.filter(s => `${s.serviceName}:${s.operationName}` === operation).slice(0, 5).map(s => s.spanId),
      });
    }
  }

  return bottlenecks.sort((a, b) => b.impact.latencyMs - a.impact.latencyMs);
}

export function determineBottleneckType(operation: string, duration: number): Bottleneck['type'] {
  const opLower = operation.toLowerCase();

  if (opLower.includes('db') || opLower.includes('sql') || opLower.includes('query')) return 'database';
  if (opLower.includes('http') || opLower.includes('fetch') || opLower.includes('api')) return 'network';
  if (opLower.includes('render') || opLower.includes('paint')) return 'render';
  if (opLower.includes('io') || opLower.includes('file') || opLower.includes('disk')) return 'io';
  if (opLower.includes('gc') || opLower.includes('garbage')) return 'gc_pressure';
  if (opLower.includes('lock') || opLower.includes('mutex')) return 'lock_contention';
  if (duration > 500) return 'cpu';
  return 'cpu';
}

export function getSuggestedFix(operation: string, latency: number, errorRate: number): string {
  const opLower = operation.toLowerCase();

  if (opLower.includes('db') || opLower.includes('query')) {
    return 'Add database indexes, optimize query, or implement caching';
  }
  if (opLower.includes('http') || opLower.includes('api')) {
    return 'Implement connection pooling, add caching, or reduce payload size';
  }
  if (errorRate > 0.05) {
    return 'Investigate error patterns, add retry logic with backoff';
  }
  if (latency > 1000) {
    return 'Consider async processing, add timeout, or optimize algorithm';
  }
  return 'Profile operation for optimization opportunities';
}

export function extractCriticalPath(spans: TraceSpan[]): string[] {
  // Build span tree
  const spanMap = new Map<string, TraceSpan>();
  const children = new Map<string, TraceSpan[]>();

  for (const span of spans) {
    spanMap.set(span.spanId, span);
    if (span.parentSpanId) {
      const siblings = children.get(span.parentSpanId) ?? [];
      siblings.push(span);
      children.set(span.parentSpanId, siblings);
    }
  }

  // Find root spans
  const roots = spans.filter(s => !s.parentSpanId);
  if (roots.length === 0) return [];

  // Find longest path
  const path: string[] = [];
  let current: TraceSpan | undefined = roots.reduce((a, b) => a.duration > b.duration ? a : b);

  while (current) {
    path.push(`${current.serviceName}:${current.operationName}`);
    const childSpans = children.get(current.spanId);
    if (childSpans && childSpans.length > 0) {
      current = childSpans.reduce((a, b) => a.duration > b.duration ? a : b);
    } else {
      current = undefined;
    }
  }

  return path;
}

export function calculatePerformanceScore(bottlenecks: Bottleneck[], p95: number, errorRate: number): number {
  let score = 1;

  // Penalize for bottlenecks
  for (const bn of bottlenecks) {
    switch (bn.severity) {
      case 'critical':
        score -= 0.3;
        break;
      case 'high':
        score -= 0.2;
        break;
      case 'medium':
        score -= 0.1;
        break;
      case 'low':
        score -= 0.05;
        break;
    }
  }

  // Penalize for high latency
  if (p95 > 1000) score -= 0.2;
  else if (p95 > 500) score -= 0.1;
  else if (p95 > 200) score -= 0.05;

  // Penalize for errors
  score -= errorRate * 2;

  return Math.max(0, Math.min(1, score));
}

export function getBottleneckInterpretation(bottlenecks: Bottleneck[], score: number): string {
  const critical = bottlenecks.filter(b => b.severity === 'critical').length;
  const high = bottlenecks.filter(b => b.severity === 'high').length;

  if (score >= 0.9) {
    return 'Excellent performance with no significant bottlenecks';
  }
  if (score >= 0.7) {
    return `Good performance with ${bottlenecks.length} minor issues to address`;
  }
  if (score >= 0.5) {
    return `Moderate performance. ${high} high-severity bottlenecks need attention`;
  }
  return `Poor performance. ${critical} critical bottlenecks require immediate attention`;
}

export function generateMockMemoryLeaks(analysisTypes: string[]): MemoryLeak[] {
  const leaks: MemoryLeak[] = [];

  if (analysisTypes.includes('leak_detection')) {
    leaks.push({
      id: 'leak-1',
      type: 'event_listener',
      severity: 'high',
      object: 'HTMLDivElement',
      retainedSize: 5 * 1024 * 1024,
      growthRate: 100 * 1024,
      retainerPath: ['window', 'eventListeners', 'click', 'handler'],
      suggestedFix: 'Remove event listener in component cleanup',
    });
  }

  if (analysisTypes.includes('allocation_hotspots')) {
    leaks.push({
      id: 'leak-2',
      type: 'cache_unbounded',
      severity: 'medium',
      object: 'CacheMap',
      retainedSize: 10 * 1024 * 1024,
      growthRate: 50 * 1024,
      retainerPath: ['global', 'cache', 'entries'],
      suggestedFix: 'Implement LRU eviction policy for cache',
    });
  }

  return leaks;
}

export function generateMockHotspots(): HeapObject[] {
  return [
    {
      name: 'strings',
      type: 'String',
      size: 50 * 1024 * 1024,
      count: 500000,
      shallowSize: 50 * 1024 * 1024,
      retainedSize: 50 * 1024 * 1024,
    },
    {
      name: 'arrays',
      type: 'Array',
      size: 30 * 1024 * 1024,
      count: 100000,
      shallowSize: 10 * 1024 * 1024,
      retainedSize: 30 * 1024 * 1024,
    },
  ];
}

export function calculateGcPressure(timeline: Array<{ timestamp: number; heapUsed: number }> | undefined): number {
  if (!timeline || timeline.length < 2) return 0.15;

  let gcEvents = 0;
  for (let i = 1; i < timeline.length; i++) {
    if (timeline[i].heapUsed < timeline[i - 1].heapUsed * 0.8) {
      gcEvents++;
    }
  }

  return Math.min(1, gcEvents / timeline.length);
}

export function getMemoryInterpretation(leaks: MemoryLeak[], gcPressure: number): string {
  const critical = leaks.filter(l => l.severity === 'critical').length;

  if (leaks.length === 0 && gcPressure < 0.2) {
    return 'Healthy memory usage with no detected leaks';
  }
  if (critical > 0) {
    return `Critical memory issues detected. ${critical} leak(s) require immediate attention`;
  }
  if (gcPressure > 0.5) {
    return 'High GC pressure detected. Consider reducing allocations';
  }
  return `${leaks.length} potential memory issues detected. Review and address`;
}

export function analyzeQueryPatterns(
  queries: Array<{ sql: string; duration: number; stackTrace?: string; resultSize?: number }>,
  requestedPatterns?: string[]
): QueryPattern[] {
  const patterns: QueryPattern[] = [];
  const queryGroups = new Map<string, typeof queries>();

  // Group similar queries
  for (const query of queries) {
    const normalized = normalizeQuery(query.sql);
    const group = queryGroups.get(normalized) ?? [];
    group.push(query);
    queryGroups.set(normalized, group);
  }

  let idx = 0;
  for (const [normalized, group] of queryGroups) {
    // Detect N+1
    if (group.length > 10 && normalized.toLowerCase().includes('where')) {
      if (!requestedPatterns || requestedPatterns.includes('n_plus_1')) {
        patterns.push({
          id: `qp-${idx++}`,
          type: 'n_plus_1',
          severity: group.length > 50 ? 'critical' : group.length > 20 ? 'high' : 'medium',
          queries: group.slice(0, 5).map(q => q.sql),
          count: group.length,
          totalDuration: group.reduce((s, q) => s + q.duration, 0),
          suggestedFix: 'Batch queries or use eager loading',
        });
      }
    }

    // Detect slow queries (missing index)
    const avgDuration = group.reduce((s, q) => s + q.duration, 0) / group.length;
    if (avgDuration > 100 && normalized.toLowerCase().includes('where')) {
      if (!requestedPatterns || requestedPatterns.includes('missing_index')) {
        const columns = extractWhereColumns(normalized);
        patterns.push({
          id: `qp-${idx++}`,
          type: 'missing_index',
          severity: avgDuration > 500 ? 'critical' : avgDuration > 200 ? 'high' : 'medium',
          queries: group.slice(0, 3).map(q => q.sql),
          count: group.length,
          totalDuration: group.reduce((s, q) => s + q.duration, 0),
          suggestedFix: `Add index on columns: ${columns.join(', ')}`,
          suggestedIndex: columns.length > 0 ? {
            table: extractTableName(normalized),
            columns,
            type: 'btree',
            estimatedImprovement: 0.7,
            createStatement: `CREATE INDEX idx_${extractTableName(normalized)}_${columns.join('_')} ON ${extractTableName(normalized)} (${columns.join(', ')})`,
          } : undefined,
        });
      }
    }

    // Detect full scans
    const hasLargeResults = group.some(q => (q.resultSize ?? 0) > 1000);
    if (hasLargeResults && !normalized.toLowerCase().includes('limit')) {
      if (!requestedPatterns || requestedPatterns.includes('full_scan')) {
        patterns.push({
          id: `qp-${idx++}`,
          type: 'full_scan',
          severity: 'medium',
          queries: group.slice(0, 3).map(q => q.sql),
          count: group.length,
          totalDuration: group.reduce((s, q) => s + q.duration, 0),
          suggestedFix: 'Add LIMIT clause or filter conditions',
        });
      }
    }
  }

  return patterns;
}

export function normalizeQuery(sql: string): string {
  return sql
    .replace(/\s+/g, ' ')
    .replace(/= \d+/g, '= ?')
    .replace(/= '[^']*'/g, "= '?'")
    .replace(/IN \([^)]+\)/gi, 'IN (?)')
    .trim()
    .toLowerCase();
}

export function extractWhereColumns(sql: string): string[] {
  const columns: string[] = [];
  const whereMatch = sql.match(/where\s+(.+?)(?:order|group|limit|$)/i);
  if (whereMatch) {
    const conditions = whereMatch[1].split(/\s+and\s+/i);
    for (const condition of conditions) {
      const colMatch = condition.match(/(\w+)\s*[=<>]/);
      if (colMatch) {
        columns.push(colMatch[1]);
      }
    }
  }
  return columns;
}

export function extractTableName(sql: string): string {
  const match = sql.match(/from\s+(\w+)/i);
  return match ? match[1] : 'unknown';
}

export function calculateQueryImprovement(patterns: QueryPattern[]): number {
  let improvement = 0;
  for (const pattern of patterns) {
    switch (pattern.type) {
      case 'n_plus_1':
        improvement += 50;
        break;
      case 'missing_index':
        improvement += 40;
        break;
      case 'full_scan':
        improvement += 20;
        break;
      default:
        improvement += 10;
    }
  }
  return Math.min(90, improvement);
}

export function getQueryInterpretation(patterns: QueryPattern[], slowQueries: number): string {
  const nPlus1 = patterns.filter(p => p.type === 'n_plus_1').length;

  if (patterns.length === 0) {
    return 'No problematic query patterns detected';
  }
  if (nPlus1 > 0) {
    return `${nPlus1} N+1 query pattern(s) detected. This is a common performance killer - prioritize fixing`;
  }
  if (slowQueries > 10) {
    return `${slowQueries} slow queries found. Consider adding indexes or optimizing`;
  }
  return `${patterns.length} query optimization opportunities identified`;
}

export function generateMockBundleOptimizations(
  analysis?: string[],
  _targets?: { maxSize?: number; maxChunks?: number }
): BundleOptimization[] {
  // targets can be used for target-aware optimization in future
  void _targets;

  const optimizations: BundleOptimization[] = [];
  const analysisTypes = analysis ?? ['tree_shaking', 'duplicate_deps', 'large_modules'];

  if (analysisTypes.includes('duplicate_deps')) {
    optimizations.push({
      id: 'bo-1',
      type: 'duplicate_deps',
      severity: 'high',
      target: 'lodash',
      currentSize: 70 * 1024,
      potentialSavings: 50 * 1024,
      description: 'Multiple versions of lodash detected',
      suggestedFix: 'Use npm dedupe or specify a single version in package.json resolutions',
    });
  }

  if (analysisTypes.includes('large_modules')) {
    optimizations.push({
      id: 'bo-2',
      type: 'large_modules',
      severity: 'medium',
      target: 'moment',
      currentSize: 290 * 1024,
      potentialSavings: 250 * 1024,
      description: 'moment.js includes all locales by default',
      suggestedFix: 'Switch to date-fns or dayjs, or exclude unused locales',
    });
  }

  if (analysisTypes.includes('code_splitting')) {
    optimizations.push({
      id: 'bo-3',
      type: 'code_splitting',
      severity: 'medium',
      target: 'chart.js',
      currentSize: 200 * 1024,
      potentialSavings: 150 * 1024,
      description: 'Large module loaded synchronously',
      suggestedFix: 'Use dynamic import() for lazy loading',
    });
  }

  if (analysisTypes.includes('tree_shaking')) {
    optimizations.push({
      id: 'bo-4',
      type: 'tree_shaking',
      severity: 'low',
      target: 'src/utils',
      currentSize: 50 * 1024,
      potentialSavings: 30 * 1024,
      description: 'Unused exports detected',
      suggestedFix: 'Enable sideEffects: false in package.json or remove unused code',
    });
  }

  return optimizations;
}

export function getBundleInterpretation(totalSize: number, savings: number, maxSize?: number): string {
  const sizeKb = totalSize / 1024;
  const savingsKb = savings / 1024;

  if (maxSize && sizeKb > maxSize) {
    return `Bundle size ${sizeKb.toFixed(0)}KB exceeds target ${maxSize}KB. ${savingsKb.toFixed(0)}KB can be saved`;
  }
  if (savings > 0) {
    return `Bundle size ${sizeKb.toFixed(0)}KB with ${savingsKb.toFixed(0)}KB optimization potential (${(savings / totalSize * 100).toFixed(0)}% reduction)`;
  }
  return `Bundle size ${sizeKb.toFixed(0)}KB is well optimized`;
}

export function generateMockConfigOptimization(
  workload: Record<string, unknown>,
  configSpace: Record<string, unknown>,
  objective: string
): { recommendations: ConfigParameter[]; predictedImprovement: { latency: number; throughput: number; cost: number } } {
  const recommendations: ConfigParameter[] = [];
  // Extract workload type for future workload-specific optimization
  const _workloadType = (workload as { type?: string }).type ?? 'web';
  void _workloadType;

  for (const [name, spec] of Object.entries(configSpace)) {
    const paramSpec = spec as { type: string; range?: unknown[]; current: unknown };

    let suggested = paramSpec.current;
    let impact = 0.2;

    if (paramSpec.type === 'number' && paramSpec.range) {
      const [min, max] = paramSpec.range as number[];
      const current = paramSpec.current as number;

      // Optimize based on objective
      if (objective === 'latency') {
        suggested = Math.min(max, current * 1.5);
      } else if (objective === 'throughput') {
        suggested = max * 0.8;
      } else if (objective === 'cost') {
        suggested = (min + max) / 2;
      } else {
        suggested = (current + max) / 2;
      }

      impact = Math.abs((suggested as number) - current) / (max - min);
    }

    recommendations.push({
      name,
      type: paramSpec.type as 'number' | 'boolean' | 'string' | 'enum',
      current: paramSpec.current,
      suggested,
      range: paramSpec.type === 'number' ? paramSpec.range as [number, number] : undefined,
      impact: Math.min(1, impact),
      confidence: 0.7 + Math.random() * 0.2,
    });
  }

  return {
    recommendations,
    predictedImprovement: {
      latency: objective === 'latency' || objective === 'balanced' ? 25 : 10,
      throughput: objective === 'throughput' || objective === 'balanced' ? 30 : 15,
      cost: objective === 'cost' || objective === 'balanced' ? 20 : 5,
    },
  };
}

export function getConfigInterpretation(
  improvement: { latency: number; throughput: number; cost: number },
  objective: string
): string {
  const primary = objective === 'latency' ? improvement.latency
    : objective === 'throughput' ? improvement.throughput
      : objective === 'cost' ? improvement.cost
        : (improvement.latency + improvement.throughput) / 2;

  if (primary > 30) {
    return `Significant ${objective} improvement of ~${primary.toFixed(0)}% predicted with recommended changes`;
  }
  if (primary > 15) {
    return `Moderate ${objective} improvement of ~${primary.toFixed(0)}% expected`;
  }
  return `Minor ${objective} improvement of ~${primary.toFixed(0)}% possible. Configuration is already well-tuned`;
}

// ============================================================================
