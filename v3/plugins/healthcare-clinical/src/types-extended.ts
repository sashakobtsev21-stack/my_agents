/**
 * healthcare-clinical types — extended
 *
 * Extracted verbatim during campaign-2 wave W304. Barrel stays.
 */
import { z } from 'zod';
import type {
  HealthcareRole,
  MCPToolResult,
} from './types-core.js';

export interface HealthcareAuditLog {
  timestamp: string;
  userId: string;
  toolName: string;
  action: 'query' | 'view' | 'export';
  patientIdentifiers: string[];
  queryHash: string;
  resultCount: number;
  ipAddress: string;
  success: boolean;
  errorCode?: string;
  durationMs: number;
}

/**
 * Audit logger interface
 */
export interface AuditLogger {
  log: (entry: HealthcareAuditLog) => Promise<void>;
  query: (filter: Partial<HealthcareAuditLog>) => Promise<HealthcareAuditLog[]>;
}

/**
 * Role-based access control mapping
 */
export const HealthcareRolePermissions: Record<HealthcareRole, string[]> = {
  PHYSICIAN: ['patient-similarity', 'drug-interactions', 'clinical-pathways', 'literature-search', 'ontology-navigate'],
  NURSE: ['drug-interactions', 'ontology-navigate'],
  PHARMACIST: ['drug-interactions', 'literature-search'],
  RESEARCHER: ['literature-search', 'ontology-navigate'],
  CODER: ['ontology-navigate'],
  ADMIN: ['patient-similarity', 'drug-interactions', 'clinical-pathways', 'literature-search', 'ontology-navigate'],
};

// ============================================================================
// Bridge Types (WASM Integration)
// ============================================================================

/**
 * HNSW Bridge interface for patient similarity
 */
export interface HNSWBridge {
  initialized: boolean;
  addVector: (id: string, vector: Float32Array, metadata?: Record<string, unknown>) => Promise<void>;
  search: (query: Float32Array, topK: number, filter?: Record<string, unknown>) => Promise<Array<{ id: string; distance: number }>>;
  delete: (id: string) => Promise<boolean>;
  count: () => Promise<number>;
  initialize: (config?: HNSWConfig) => Promise<void>;
}

/**
 * HNSW configuration
 */
export interface HNSWConfig {
  dimensions: number;
  maxElements?: number;
  efConstruction?: number;
  M?: number;
  efSearch?: number;
}

/**
 * GNN Bridge interface for clinical pathways
 */
export interface GNNBridge {
  initialized: boolean;
  loadGraph: (nodes: GNNNode[], edges: GNNEdge[]) => Promise<void>;
  predictPathway: (startNode: string, endNode: string, constraints?: Record<string, unknown>) => Promise<GNNPathResult>;
  analyzeInteractions: (nodeIds: string[]) => Promise<GNNInteractionResult>;
  initialize: (config?: GNNConfig) => Promise<void>;
}

/**
 * GNN node
 */
export interface GNNNode {
  id: string;
  type: string;
  features: number[];
  metadata?: Record<string, unknown>;
}

/**
 * GNN edge
 */
export interface GNNEdge {
  source: string;
  target: string;
  type: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

/**
 * GNN path prediction result
 */
export interface GNNPathResult {
  path: string[];
  confidence: number;
  alternativePaths: string[][];
  riskScore: number;
}

/**
 * GNN interaction analysis result
 */
export interface GNNInteractionResult {
  interactions: Array<{
    nodes: string[];
    type: string;
    strength: number;
    direction: string;
  }>;
  riskFactors: string[];
  recommendations: string[];
}

/**
 * GNN configuration
 */
export interface GNNConfig {
  hiddenDimensions?: number;
  numLayers?: number;
  dropout?: number;
  aggregationType?: 'mean' | 'sum' | 'max';
}

/**
 * Combined healthcare bridge interface
 */
export interface HealthcareBridge {
  hnsw?: HNSWBridge;
  gnn?: GNNBridge;
  initialized: boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Healthcare plugin configuration
 */
export interface HealthcareConfig {
  hipaa: {
    auditEnabled: boolean;
    encryptionRequired: boolean;
    minimumNecessary: boolean;
    retentionYears: number;
  };
  hnsw: HNSWConfig;
  gnn: GNNConfig;
  search: {
    defaultTopK: number;
    maxTopK: number;
    similarityThreshold: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_HEALTHCARE_CONFIG: HealthcareConfig = {
  hipaa: {
    auditEnabled: true,
    encryptionRequired: true,
    minimumNecessary: true,
    retentionYears: 6,
  },
  hnsw: {
    dimensions: 768,
    maxElements: 100000,
    efConstruction: 200,
    M: 16,
    efSearch: 100,
  },
  gnn: {
    hiddenDimensions: 256,
    numLayers: 3,
    dropout: 0.1,
    aggregationType: 'mean',
  },
  search: {
    defaultTopK: 5,
    maxTopK: 100,
    similarityThreshold: 0.7,
  },
  cache: {
    enabled: true,
    ttl: 300000,
    maxSize: 1000,
  },
};

// ============================================================================
// Zod Schemas for Input Validation
// ============================================================================

/**
 * ICD-10 code format validation
 */
const ICD10CodeSchema = z.string().regex(/^[A-Z]\d{2}(\.\d{1,2})?$/, 'Invalid ICD-10 code format');

/**
 * Patient similarity input schema
 */
export const PatientSimilarityInputSchema = z.object({
  patientFeatures: z.object({
    diagnoses: z.array(ICD10CodeSchema).max(100),
    labResults: z.record(z.string(), z.number()).optional(),
    vitals: z.record(z.string(), z.number()).optional(),
    medications: z.array(z.string().max(200)).max(50).optional(),
    demographics: z.object({
      ageRange: z.string().optional(),
      gender: z.string().optional(),
      ethnicity: z.string().optional(),
    }).optional(),
    procedures: z.array(z.string().max(200)).max(100).optional(),
    allergies: z.array(z.string().max(200)).max(50).optional(),
  }),
  topK: z.number().int().min(1).max(100).default(5),
  cohortFilter: z.string().max(500).optional(),
});

/**
 * Drug interactions input schema
 */
export const DrugInteractionsInputSchema = z.object({
  medications: z.array(z.string().max(200)).min(1).max(50),
  conditions: z.array(z.string().max(200)).max(100).optional(),
  severity: z.enum(['all', 'major', 'moderate', 'minor']).default('all'),
});

/**
 * Clinical pathways input schema
 */
export const ClinicalPathwaysInputSchema = z.object({
  primaryDiagnosis: z.string().max(100),
  patientHistory: z.record(z.string(), z.unknown()).optional(),
  constraints: z.object({
    excludeMedications: z.array(z.string()).optional(),
    costSensitive: z.boolean().optional(),
    outpatientOnly: z.boolean().optional(),
    ageRestrictions: z.string().optional(),
    comorbidityConsiderations: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * Literature search input schema
 */
export const LiteratureSearchInputSchema = z.object({
  query: z.string().min(3).max(1000),
  sources: z.array(z.enum(['pubmed', 'cochrane', 'uptodate', 'local'])).optional(),
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),
  evidenceLevel: z.enum(['any', 'systematic-review', 'rct', 'cohort', 'case-control', 'case-series', 'expert-opinion']).optional(),
  maxResults: z.number().int().min(1).max(100).default(20),
});

/**
 * Ontology navigation input schema
 */
export const OntologyNavigationInputSchema = z.object({
  code: z.string().max(50),
  ontology: z.enum(['icd10', 'snomed', 'loinc', 'rxnorm']),
  direction: z.enum(['ancestors', 'descendants', 'siblings', 'related']).default('descendants'),
  depth: z.number().int().min(1).max(10).default(2),
});

// ============================================================================
// Result Helpers
// ============================================================================

/**
 * Create a success result
 */
export function successResult<T>(data: T, metadata?: MCPToolResult['metadata']): MCPToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    metadata,
  };
}

/**
 * Create an error result
 */
export function errorResult(error: string | Error, metadata?: MCPToolResult['metadata']): MCPToolResult {
  const message = error instanceof Error ? error.message : error;
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: message, timestamp: new Date().toISOString() }) }],
    metadata,
  };
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Healthcare plugin error codes
 */
export const HealthcareErrorCodes = {
  HIPAA_VIOLATION: 'HC_HIPAA_VIOLATION',
  UNAUTHORIZED_ACCESS: 'HC_UNAUTHORIZED_ACCESS',
  INVALID_ICD10_CODE: 'HC_INVALID_ICD10_CODE',
  INVALID_SNOMED_CODE: 'HC_INVALID_SNOMED_CODE',
  PATIENT_NOT_FOUND: 'HC_PATIENT_NOT_FOUND',
  DRUG_NOT_FOUND: 'HC_DRUG_NOT_FOUND',
  ONTOLOGY_NOT_AVAILABLE: 'HC_ONTOLOGY_NOT_AVAILABLE',
  WASM_NOT_INITIALIZED: 'HC_WASM_NOT_INITIALIZED',
  SEARCH_FAILED: 'HC_SEARCH_FAILED',
  AUDIT_FAILED: 'HC_AUDIT_FAILED',
} as const;

export type HealthcareErrorCode = (typeof HealthcareErrorCodes)[keyof typeof HealthcareErrorCodes];
