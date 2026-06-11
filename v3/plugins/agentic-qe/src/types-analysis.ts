/**
 * Agentic QE — analysis & security types
 *
 * Coverage, quality, defect-intelligence, security-compliance,
 * contract-testing, and chaos-engineering shapes. Extracted verbatim
 * from types.ts (lines 346-883) during the P3.58 god-file decomposition
 * (W179). types.ts stays the barrel.
 */

import type {
  ChaosFailureType,
  ComplianceStandard,
  ContractType,
  CoverageAlgorithm,
  CoverageGapType,
  QualityGateOperator,
  SecurityScanType,
  Severity,
  TestType,
} from './types-core.js';

// Coverage Analysis Types

// Split into ./types-analysis-core.ts + ./types-analysis-extended.ts during campaign-2 wave W307.
export * from './types-analysis-core.js';
export * from './types-analysis-extended.js';
