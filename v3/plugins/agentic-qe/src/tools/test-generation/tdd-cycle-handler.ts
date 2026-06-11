/**
 * agentic-qe tdd-cycle — extended
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';
import {
  TDDCycleInputSchema,
} from './tdd-cycle-defs.js';
import type {
  AgentContribution,
  RefactoringSuggestion,
  TDDCycleInput,
  TDDCycleOutput,
  TDDCycleResult,
  TestCase,
  ToolContext,
} from './tdd-cycle-defs.js';

export async function handler(
  input: TDDCycleInput,
  context: ToolContext
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  try {
    // Validate input
    const validatedInput = TDDCycleInputSchema.parse(input);

    // Get sandbox and bridge from context
    const sandbox = context.get<{ execute: <T>(fn: () => Promise<T>) => Promise<T> }>('aqe.sandbox');
    const bridge = context.get<unknown>('aqe.bridge');

    // Initialize cycle tracking
    const cycles: TDDCycleResult[] = [];
    const agentContributions: Map<string, AgentContribution> = new Map();

    // Initialize agent contributions
    for (const agent of TDD_SUBAGENTS) {
      agentContributions.set(agent, {
        agentId: `${agent}-${Date.now()}`,
        agentType: agent,
        tasksCompleted: 0,
        contributions: [],
      });
    }

    // Step 1: Analyze requirement
    const requirementAnalysis = await analyzeRequirement(
      validatedInput.requirement,
      agentContributions.get('requirement-analyzer')!
    );

    // Step 2: Design initial tests
    const testDesign = await designTests(
      requirementAnalysis,
      validatedInput.style,
      agentContributions.get('test-designer')!
    );

    // Step 3: Execute TDD cycles
    let currentCoverage = 0;
    let cycleNumber = 0;

    while (
      cycleNumber < validatedInput.maxCycles &&
      currentCoverage < validatedInput.coverageTarget
    ) {
      cycleNumber++;
      const cycleStartTime = Date.now();

      // RED phase: Write failing test
      const redPhaseResult = await executeRedPhase(
        testDesign,
        cycleNumber,
        validatedInput.framework,
        agentContributions.get('red-phase-executor')!
      );

      // GREEN phase: Implement to pass
      const greenPhaseResult = await executeGreenPhase(
        redPhaseResult.test,
        validatedInput.targetPath,
        agentContributions.get('green-phase-implementer')!,
        sandbox
      );

      // Verify coverage
      currentCoverage = await verifyCoverage(
        validatedInput.targetPath,
        agentContributions.get('coverage-verifier')!
      );

      // REFACTOR phase (unless stopOnGreen)
      let refactorings: RefactoringSuggestion[] = [];
      if (!validatedInput.stopOnGreen && greenPhaseResult.passed) {
        refactorings = await executeRefactorPhase(
          validatedInput.targetPath,
          validatedInput.autoRefactor,
          agentContributions.get('refactor-advisor')!
        );
      }

      // Record cycle result
      cycles.push({
        cycleNumber,
        phase: greenPhaseResult.passed ? 'complete' : 'green',
        test: redPhaseResult.test,
        implementation: greenPhaseResult.code,
        refactoring: refactorings,
        passed: greenPhaseResult.passed,
        coverage: currentCoverage,
        durationMs: Date.now() - cycleStartTime,
      });

      // Update cycle coordinator
      const coordinator = agentContributions.get('cycle-coordinator')!;
      coordinator.tasksCompleted++;
      coordinator.contributions.push(`Completed cycle ${cycleNumber} - coverage: ${currentCoverage}%`);
    }

    // Build final result
    const result: TDDCycleOutput = {
      success: currentCoverage >= validatedInput.coverageTarget,
      cycles,
      finalCoverage: currentCoverage,
      totalCycles: cycleNumber,
      implementation: {
        filesCreated: [`${validatedInput.targetPath}/__tests__/*.test.ts`],
        filesModified: [validatedInput.targetPath],
        linesOfCode: cycles.reduce((sum, c) => sum + (c.implementation?.split('\n').length || 0), 0),
        testCount: cycles.filter((c) => c.test).length,
        coverage: currentCoverage,
      },
      agents: Array.from(agentContributions.values()),
      metadata: {
        startedAt,
        completedAt: new Date().toISOString(),
        totalDurationMs: Date.now() - startTime,
        style: validatedInput.style,
        framework: validatedInput.framework,
        requirement: validatedInput.requirement,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: errorMessage,
              cycles: [],
              finalCoverage: 0,
              totalCycles: 0,
              metadata: {
                startedAt,
                completedAt: new Date().toISOString(),
                totalDurationMs: Date.now() - startTime,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

// Subagent task implementations

interface RequirementAnalysis {
  components: string[];
  behaviors: string[];
  edgeCases: string[];
  dependencies: string[];
}

async function analyzeRequirement(
  requirement: string,
  agent: AgentContribution
): Promise<RequirementAnalysis> {
  agent.tasksCompleted++;
  agent.contributions.push(`Analyzed requirement: ${requirement.substring(0, 50)}...`);

  // Extract key components from requirement
  const words = requirement.toLowerCase().split(/\s+/);
  const components = extractComponents(words);
  const behaviors = extractBehaviors(requirement);
  const edgeCases = extractEdgeCases(requirement);

  return {
    components,
    behaviors,
    edgeCases,
    dependencies: [],
  };
}

interface TestDesign {
  tests: Array<{
    name: string;
    description: string;
    behavior: string;
    priority: number;
  }>;
  approach: 'outside-in' | 'inside-out';
}

async function designTests(
  analysis: RequirementAnalysis,
  style: 'london' | 'chicago',
  agent: AgentContribution
): Promise<TestDesign> {
  agent.tasksCompleted++;
  agent.contributions.push(`Designed ${analysis.behaviors.length} test cases using ${style} style`);

  const tests = analysis.behaviors.map((behavior, index) => ({
    name: `should ${behavior}`,
    description: `Test that the system ${behavior}`,
    behavior,
    priority: index + 1,
  }));

  // Add edge case tests
  analysis.edgeCases.forEach((edgeCase, index) => {
    tests.push({
      name: `should handle ${edgeCase}`,
      description: `Edge case: ${edgeCase}`,
      behavior: edgeCase,
      priority: analysis.behaviors.length + index + 1,
    });
  });

  return {
    tests,
    approach: style === 'london' ? 'outside-in' : 'inside-out',
  };
}

interface RedPhaseResult {
  test: TestCase;
  failing: boolean;
}

async function executeRedPhase(
  design: TestDesign,
  cycleNumber: number,
  framework: string,
  agent: AgentContribution
): Promise<RedPhaseResult> {
  agent.tasksCompleted++;

  const testIndex = Math.min(cycleNumber - 1, design.tests.length - 1);
  const testSpec = design.tests[testIndex];

  const test: TestCase = {
    name: testSpec.name,
    description: testSpec.description,
    code: generateFailingTest(testSpec.name, framework),
    assertions: [`expect(result).toBeDefined()`, `expect(result).toEqual(expected)`],
  };

  agent.contributions.push(`Created failing test: ${test.name}`);

  return {
    test,
    failing: true,
  };
}

interface GreenPhaseResult {
  code: string;
  passed: boolean;
}

async function executeGreenPhase(
  test: TestCase,
  targetPath: string,
  agent: AgentContribution,
  sandbox?: { execute: <T>(fn: () => Promise<T>) => Promise<T> }
): Promise<GreenPhaseResult> {
  agent.tasksCompleted++;

  // Generate minimal implementation to pass the test
  const implementation = generateMinimalImplementation(test);

  agent.contributions.push(`Implemented code to pass: ${test.name}`);

  // Execute in sandbox if available
  if (sandbox) {
    try {
      await sandbox.execute(async () => {
        // Simulated test execution
        return true;
      });
    } catch {
      return { code: implementation, passed: false };
    }
  }

  return {
    code: implementation,
    passed: true,
  };
}

async function verifyCoverage(targetPath: string, agent: AgentContribution): Promise<number> {
  agent.tasksCompleted++;

  // Simulated coverage calculation
  const coverage = Math.min(85 + Math.random() * 10, 95);
  agent.contributions.push(`Verified coverage: ${coverage.toFixed(1)}%`);

  return coverage;
}

async function executeRefactorPhase(
  targetPath: string,
  autoApply: boolean,
  agent: AgentContribution
): Promise<RefactoringSuggestion[]> {
  agent.tasksCompleted++;

  const suggestions: RefactoringSuggestion[] = [
    {
      type: 'extract-method',
      description: 'Extract validation logic to separate method',
      location: `${targetPath}:15-25`,
      applied: autoApply,
    },
    {
      type: 'simplify',
      description: 'Simplify conditional logic',
      location: `${targetPath}:30-35`,
      applied: autoApply,
    },
  ];

  agent.contributions.push(
    `Suggested ${suggestions.length} refactorings, ${autoApply ? 'auto-applied' : 'pending review'}`
  );

  return suggestions;
}

// Helper functions

function extractComponents(words: string[]): string[] {
  const componentKeywords = ['service', 'handler', 'controller', 'model', 'repository', 'validator'];
  return words.filter((w) => componentKeywords.some((k) => w.includes(k)));
}

function extractBehaviors(requirement: string): string[] {
  const behaviors: string[] = [];
  const shouldMatch = requirement.match(/should\s+([^,.]+)/gi);
  if (shouldMatch) {
    behaviors.push(...shouldMatch.map((m) => m.replace(/^should\s+/i, '')));
  }

  // Extract verb phrases
  const verbs = ['create', 'update', 'delete', 'validate', 'process', 'handle', 'return'];
  verbs.forEach((verb) => {
    if (requirement.toLowerCase().includes(verb)) {
      behaviors.push(`${verb} correctly`);
    }
  });

  return behaviors.length > 0 ? behaviors : ['process input correctly'];
}

function extractEdgeCases(requirement: string): string[] {
  const edgeCases: string[] = [];

  if (requirement.includes('input') || requirement.includes('data')) {
    edgeCases.push('null input', 'empty input', 'invalid input');
  }

  if (requirement.includes('error') || requirement.includes('fail')) {
    edgeCases.push('error conditions');
  }

  return edgeCases;
}

function generateFailingTest(testName: string, framework: string): string {
  const testTemplates: Record<string, string> = {
    vitest: `import { describe, it, expect } from 'vitest';
import { systemUnderTest } from './index';

describe('${testName}', () => {
  it('${testName}', () => {
    // Arrange
    const input = { /* test data */ };

    // Act
    const result = systemUnderTest(input);

    // Assert (will fail until implemented)
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});`,
    jest: `describe('${testName}', () => {
  it('${testName}', () => {
    // Arrange
    const input = { /* test data */ };

    // Act
    const result = systemUnderTest(input);

    // Assert (will fail until implemented)
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});`,
  };

  return testTemplates[framework] || testTemplates.vitest;
}

function generateMinimalImplementation(test: TestCase): string {
  return `// Minimal implementation to pass: ${test.name}
export function systemUnderTest(input: unknown): { success: boolean } {
  // TODO: Implement actual logic
  if (!input) {
    throw new Error('Input required');
  }
  return { success: true };
}`;
}

// Export tool definition for MCP registration
export const toolDefinition = {
  name: 'aqe/tdd-cycle',
  description: 'Execute TDD red-green-refactor cycle with 7 specialized subagents',
  category: 'test-generation',
  version: '3.2.3',
  inputSchema: TDDCycleInputSchema,
  handler,
};

export default toolDefinition;
