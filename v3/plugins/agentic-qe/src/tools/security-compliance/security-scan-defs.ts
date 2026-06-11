/**
 * agentic-qe security-scan — core
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';

export const SecurityScanInputSchema = z.object({
  targetPath: z.string().describe('Path to file/directory to scan'),
  scanType: z
    .enum(['sast', 'dast', 'both'])
    .default('sast')
    .describe('Type of security scan'),
  compliance: z
    .array(z.enum(['owasp-top-10', 'sans-25', 'pci-dss', 'hipaa', 'gdpr', 'soc2']))
    .default(['owasp-top-10'])
    .describe('Compliance frameworks to check'),
  severity: z
    .enum(['all', 'critical', 'high', 'medium'])
    .default('all')
    .describe('Minimum severity to report'),
  includeRemediation: z.boolean().default(true).describe('Include remediation guidance'),
  scanDepth: z
    .enum(['quick', 'standard', 'deep'])
    .default('standard')
    .describe('Scan depth/thoroughness'),
  excludePatterns: z
    .array(z.string())
    .default(['node_modules', 'dist', '*.test.ts'])
    .describe('Patterns to exclude from scanning'),
  targetUrl: z.string().optional().describe('URL for DAST scanning'),
});

export type SecurityScanInput = z.infer<typeof SecurityScanInputSchema>;

// Output structures
export interface SecurityScanOutput {
  success: boolean;
  summary: ScanSummary;
  findings: SecurityFinding[];
  complianceResults: ComplianceResult[];
  metrics: SecurityMetrics;
  recommendations: SecurityRecommendation[];
  metadata: ScanMetadata;
}

export interface ScanSummary {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  passedChecks: number;
  failedChecks: number;
  riskScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  cweId?: string;
  cvss?: number;
  location: FindingLocation;
  evidence: string;
  remediation?: RemediationGuidance;
  compliance: string[];
  falsePositiveLikelihood: 'low' | 'medium' | 'high';
}

export interface FindingLocation {
  file: string;
  startLine: number;
  endLine: number;
  column?: number;
  codeSnippet?: string;
}

export interface RemediationGuidance {
  description: string;
  steps: string[];
  codeExample?: string;
  effort: 'low' | 'medium' | 'high';
  priority: number;
}

export interface ComplianceResult {
  framework: string;
  status: 'compliant' | 'partial' | 'non-compliant';
  score: number;
  passedRules: number;
  failedRules: number;
  findings: string[];
}

export interface SecurityMetrics {
  vulnerabilityDensity: number;
  avgSeverity: number;
  owaspCoverage: number;
  fixRate: number;
  mttr: string; // Mean time to remediate
}

export interface SecurityRecommendation {
  priority: number;
  category: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  affectedFindings: string[];
}

export interface ScanMetadata {
  scannedAt: string;
  durationMs: number;
  scanType: string;
  filesScanned: number;
  linesScanned: number;
  rulesExecuted: number;
  engineVersion: string;
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

/**
 * MCP Tool Handler for security-scan
 */
