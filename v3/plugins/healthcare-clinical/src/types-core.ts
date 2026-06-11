/**
 * healthcare-clinical types — core
 *
 * Extracted verbatim during campaign-2 wave W304. Barrel stays.
 */
import type {
  AuditLogger,
  HealthcareBridge,
  HealthcareConfig,
} from './types-extended.js';

// ============================================================================
// MCP Tool Types
// ============================================================================

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  category: string;
  version: string;
  tags: string[];
  cacheable: boolean;
  cacheTTL: number;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  handler: (input: Record<string, unknown>, context?: ToolContext) => Promise<MCPToolResult>;
}

/**
 * MCP Tool result
 */
export interface MCPToolResult {
  isError?: boolean;
  content: Array<{ type: 'text'; text: string }>;
  metadata?: {
    durationMs?: number;
    cached?: boolean;
    wasmUsed?: boolean;
  };
}

/**
 * Tool execution context
 */
export interface ToolContext {
  logger?: Logger;
  config?: HealthcareConfig;
  bridge?: HealthcareBridge;
  userId?: string;
  userRoles?: HealthcareRole[];
  auditLogger?: AuditLogger;
}

/**
 * Simple logger interface
 */
export interface Logger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

// ============================================================================
// Patient Data Types
// ============================================================================

/**
 * Patient clinical features for similarity matching
 */
export interface PatientFeatures {
  diagnoses: string[];
  labResults?: Record<string, number>;
  vitals?: Record<string, number>;
  medications?: string[];
  demographics?: PatientDemographics;
  procedures?: string[];
  allergies?: string[];
}

/**
 * Patient demographics (anonymized)
 */
export interface PatientDemographics {
  ageRange?: string;
  gender?: string;
  ethnicity?: string;
}

/**
 * Similar patient result
 */
export interface SimilarPatient {
  patientId: string;
  similarity: number;
  matchingDiagnoses: string[];
  matchingMedications: string[];
  treatmentOutcome?: string;
  embedding?: Float32Array;
}

/**
 * Patient similarity search result
 */
export interface PatientSimilarityResult {
  query: PatientFeatures;
  similarPatients: SimilarPatient[];
  searchTime: number;
  cohortSize: number;
  confidence: number;
}

// ============================================================================
// Drug Interaction Types
// ============================================================================

/**
 * Drug interaction severity levels
 */
export type InteractionSeverity = 'major' | 'moderate' | 'minor' | 'contraindicated';

/**
 * Drug-drug interaction
 */
export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: InteractionSeverity;
  description: string;
  mechanism?: string;
  clinicalEffect?: string;
  management?: string;
  references?: string[];
}

/**
 * Drug-condition interaction
 */
export interface DrugConditionInteraction {
  drug: string;
  condition: string;
  severity: InteractionSeverity;
  description: string;
  recommendation?: string;
}

/**
 * Drug interactions analysis result
 */
export interface DrugInteractionsResult {
  medications: string[];
  drugDrugInteractions: DrugInteraction[];
  drugConditionInteractions: DrugConditionInteraction[];
  riskScore: number;
  recommendations: string[];
  analysisTime: number;
}

// ============================================================================
// Clinical Pathway Types
// ============================================================================

/**
 * Clinical pathway step
 */
export interface PathwayStep {
  id: string;
  name: string;
  description: string;
  type: 'assessment' | 'intervention' | 'monitoring' | 'decision' | 'outcome';
  timing?: string;
  responsible?: string;
  prerequisites?: string[];
  outcomes?: string[];
}

/**
 * Clinical pathway
 */
export interface ClinicalPathway {
  id: string;
  name: string;
  diagnosis: string;
  version: string;
  steps: PathwayStep[];
  expectedDuration?: string;
  evidenceLevel?: EvidenceLevel;
  source?: string;
  lastUpdated?: string;
}

/**
 * Pathway constraints
 */
export interface PathwayConstraints {
  excludeMedications?: string[];
  costSensitive?: boolean;
  outpatientOnly?: boolean;
  ageRestrictions?: string;
  comorbidityConsiderations?: string[];
}

/**
 * Clinical pathway recommendation result
 */
export interface ClinicalPathwayResult {
  primaryDiagnosis: string;
  recommendedPathways: ClinicalPathway[];
  alternativePathways: ClinicalPathway[];
  contraindicated: string[];
  constraints: PathwayConstraints;
  confidence: number;
  analysisTime: number;
}

// ============================================================================
// Literature Search Types
// ============================================================================

/**
 * Evidence level for medical literature
 */
export type EvidenceLevel = 'systematic-review' | 'rct' | 'cohort' | 'case-control' | 'case-series' | 'expert-opinion' | 'any';

/**
 * Literature source
 */
export type LiteratureSource = 'pubmed' | 'cochrane' | 'uptodate' | 'local';

/**
 * Literature search result
 */
export interface LiteratureArticle {
  id: string;
  title: string;
  authors: string[];
  abstract?: string;
  source: LiteratureSource;
  publicationDate?: string;
  evidenceLevel?: EvidenceLevel;
  relevanceScore: number;
  doi?: string;
  pmid?: string;
  meshTerms?: string[];
}

/**
 * Literature search result
 */
export interface LiteratureSearchResult {
  query: string;
  articles: LiteratureArticle[];
  totalResults: number;
  searchTime: number;
  sources: LiteratureSource[];
  filters: {
    dateRange?: { from?: string; to?: string };
    evidenceLevel?: EvidenceLevel;
  };
}

// ============================================================================
// Ontology Navigation Types
// ============================================================================

/**
 * Medical ontology types
 */
export type MedicalOntology = 'icd10' | 'snomed' | 'loinc' | 'rxnorm';

/**
 * Navigation direction in ontology
 */
export type OntologyDirection = 'ancestors' | 'descendants' | 'siblings' | 'related';

/**
 * Ontology node
 */
export interface OntologyNode {
  code: string;
  display: string;
  ontology: MedicalOntology;
  definition?: string;
  synonyms?: string[];
  parentCodes?: string[];
  childCodes?: string[];
  depth?: number;
}

/**
 * Ontology navigation result
 */
export interface OntologyNavigationResult {
  sourceCode: string;
  sourceNode: OntologyNode;
  direction: OntologyDirection;
  results: OntologyNode[];
  depth: number;
  totalNodes: number;
  navigationTime: number;
}

// ============================================================================
// Security & Compliance Types
// ============================================================================

/**
 * Healthcare roles for RBAC
 */
export type HealthcareRole = 'PHYSICIAN' | 'NURSE' | 'PHARMACIST' | 'RESEARCHER' | 'CODER' | 'ADMIN';

/**
 * HIPAA audit log entry
 */
