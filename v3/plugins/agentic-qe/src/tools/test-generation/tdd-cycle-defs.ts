/**
 * agentic-qe tdd-cycle — core
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';

export const TDDCycleInputSchema = z.object({
  requirement: z.string().min(1).describe('Requirement/story to implement'),
  targetPath: z.string().describe('Path to implement in'),
  style: z
    .enum(['london', 'chicago'])
    .default('london')
    .describe('TDD style - London (outside-in, mocks) or Chicago (inside-out, real objects)'),
  maxCycles: z.number().min(1).max(50).default(10).describe('Maximum TDD cycles to execute'),
  framework: z
    .enum(['vitest', 'jest', 'mocha', 'pytest', 'junit'])
    .default('vitest')
    .describe('Test framework'),
  coverageTarget: z.number().min(0).max(100).default(80).describe('Target coverage percentage'),
  autoRefactor: z.boolean().default(true).describe('Automatically apply refactoring suggestions'),
  stopOnGreen: z
    .boolean()
    .default(false)
    .describe('Stop immediately when tests pass (skip refactor phase)'),
});

export type TDDCycleInput = z.infer<typeof TDDCycleInputSchema>;

// TDD Cycle phases
export type TDDPhase = 'red' | 'green' | 'refactor' | 'complete';

// Output structures
export interface TDDCycleOutput {
  success: boolean;
  cycles: TDDCycleResult[];
  finalCoverage: number;
  totalCycles: number;
  implementation: ImplementationSummary;
  agents: AgentContribution[];
  metadata: TDDMetadata;
}

export interface TDDCycleResult {
  cycleNumber: number;
  phase: TDDPhase;
  test: TestCase | null;
  implementation: string | null;
  refactoring: RefactoringSuggestion[];
  passed: boolean;
  coverage: number;
  durationMs: number;
}

export interface TestCase {
  name: string;
  description: string;
  code: string;
  assertions: string[];
}

export interface RefactoringSuggestion {
  type: 'extract-method' | 'rename' | 'simplify' | 'inline' | 'extract-class' | 'other';
  description: string;
  location: string;
  applied: boolean;
}

export interface ImplementationSummary {
  filesCreated: string[];
  filesModified: string[];
  linesOfCode: number;
  testCount: number;
  coverage: number;
}

export interface AgentContribution {
  agentId: string;
  agentType: string;
  tasksCompleted: number;
  contributions: string[];
}

export interface TDDMetadata {
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  style: 'london' | 'chicago';
  framework: string;
  requirement: string;
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

// TDD Subagent definitions
const TDD_SUBAGENTS = [
  'requirement-analyzer',
  'test-designer',
  'red-phase-executor',
  'green-phase-implementer',
  'refactor-advisor',
  'coverage-verifier',
  'cycle-coordinator',
] as const;

/**
 * MCP Tool Handler for tdd-cycle
 */
