/**
 * agentic-qe chaos-inject — core
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';

export const ChaosInjectInputSchema = z.object({
  target: z.string().describe('Target service/component for chaos injection'),
  failureType: z
    .enum([
      'network-latency',
      'network-partition',
      'cpu-stress',
      'memory-pressure',
      'disk-failure',
      'process-kill',
      'dns-failure',
      'dependency-failure',
      'clock-skew',
      'packet-loss',
    ])
    .describe('Type of failure to inject'),
  duration: z.number().min(1).max(3600).default(30).describe('Duration in seconds'),
  intensity: z.number().min(0).max(1).default(0.5).describe('Intensity 0-1'),
  dryRun: z.boolean().default(true).describe('If true, simulate without actual injection'),
  rollbackOnFailure: z.boolean().default(true).describe('Auto-rollback if issues detected'),
  monitorMetrics: z.boolean().default(true).describe('Monitor system metrics during chaos'),
  notifyChannels: z.array(z.string()).default([]).describe('Notification channels'),
  parameters: z
    .object({
      latencyMs: z.number().optional().describe('Latency to add in ms'),
      packetLossPercent: z.number().optional().describe('Packet loss percentage'),
      cpuCores: z.number().optional().describe('Number of CPU cores to stress'),
      memoryPercent: z.number().optional().describe('Memory pressure percentage'),
      targetProcesses: z.array(z.string()).optional().describe('Processes to target'),
    })
    .optional()
    .describe('Type-specific parameters'),
});

export type ChaosInjectInput = z.infer<typeof ChaosInjectInputSchema>;

// Output structures
export interface ChaosInjectOutput {
  success: boolean;
  experimentId: string;
  status: ExperimentStatus;
  injection: InjectionDetails;
  impact: ImpactAssessment;
  metrics: ChaosMetrics;
  timeline: TimelineEvent[];
  recommendations: ChaosRecommendation[];
  metadata: ChaosMetadata;
}

export interface ExperimentStatus {
  state: 'planned' | 'running' | 'completed' | 'aborted' | 'dry-run';
  progress: number;
  startTime: string | null;
  endTime: string | null;
  rollbackRequired: boolean;
  rollbackCompleted: boolean;
}

export interface InjectionDetails {
  type: string;
  target: string;
  intensity: number;
  duration: number;
  parameters: Record<string, unknown>;
  affectedComponents: string[];
}

export interface ImpactAssessment {
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  systemsAffected: string[];
  usersAffected: number;
  recoveryTime: number;
  dataLoss: boolean;
  serviceDisruption: ServiceDisruption;
}

export interface ServiceDisruption {
  totalRequests: number;
  failedRequests: number;
  errorRate: number;
  avgLatency: number;
  p99Latency: number;
}

export interface ChaosMetrics {
  baseline: MetricSnapshot;
  duringChaos: MetricSnapshot;
  afterChaos: MetricSnapshot;
  degradation: number;
  recoveryTime: number;
}

export interface MetricSnapshot {
  timestamp: string;
  cpu: number;
  memory: number;
  networkLatency: number;
  errorRate: number;
  requestsPerSecond: number;
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
  type: 'info' | 'warning' | 'error' | 'recovery';
  details: string;
}

export interface ChaosRecommendation {
  category: 'resilience' | 'recovery' | 'monitoring' | 'configuration';
  priority: 'high' | 'medium' | 'low';
  finding: string;
  recommendation: string;
  evidence: string;
}

export interface ChaosMetadata {
  experimentId: string;
  createdAt: string;
  completedAt: string | null;
  dryRun: boolean;
  version: string;
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

/**
 * MCP Tool Handler for chaos-inject
 */
