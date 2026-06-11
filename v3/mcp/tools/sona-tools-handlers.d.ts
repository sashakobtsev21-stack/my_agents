/**
 * V3 MCP SONA Tools — state & handlers
 *
 * The SONAState singleton (static-instance class moves intact) and the
 * handler implementations. Module-private in the original sona-tools.ts
 * (P3.62, W183); NOT re-exported by the barrel.
 */
import { z } from 'zod';
import type { ToolContext } from '../types.js';
import { trajectoryBeginSchema, trajectoryStepSchema, trajectoryContextSchema, trajectoryEndSchema, trajectoryListSchema, patternFindSchema, loraApplySchema, profileGetSchema, setEnabledSchema } from './sona-tools-support.js';
import type { TrajectoryMetrics, SONAProfile, SONAStats } from './sona-tools-support.js';
export declare function handleTrajectoryBegin(input: z.infer<typeof trajectoryBeginSchema>, context?: ToolContext): Promise<{
    trajectoryId: string;
    sessionId: string;
    startedAt: string;
}>;
export declare function handleTrajectoryStep(input: z.infer<typeof trajectoryStepSchema>, context?: ToolContext): Promise<{
    stepId: string;
    stepNumber: number;
    recorded: boolean;
}>;
export declare function handleTrajectoryContext(input: z.infer<typeof trajectoryContextSchema>, context?: ToolContext): Promise<{
    updated: boolean;
    contextKeys: string[];
}>;
export declare function handleTrajectoryEnd(input: z.infer<typeof trajectoryEndSchema>, context?: ToolContext): Promise<{
    completed: boolean;
    trajectoryId: string;
    verdict: string;
    metrics: TrajectoryMetrics;
    learningTriggered: boolean;
}>;
export declare function handleTrajectoryList(input: z.infer<typeof trajectoryListSchema>, context?: ToolContext): Promise<{
    trajectories: Array<{
        id: string;
        sessionId: string;
        startedAt: string;
        endedAt?: string;
        verdict?: string;
        stepCount: number;
    }>;
    total: number;
}>;
export declare function handlePatternFind(input: z.infer<typeof patternFindSchema>, context?: ToolContext): Promise<{
    patterns: Array<{
        id: string;
        content: string;
        category: string;
        similarity: number;
    }>;
    searchLatency: string;
    hnswSpeedup: string;
}>;
export declare function handleMicroLoraApply(input: z.infer<typeof loraApplySchema>, context?: ToolContext): Promise<{
    adapted: boolean;
    adapterId: string;
    latency: string;
    output: string;
}>;
export declare function handleBaseLoraApply(input: z.infer<typeof loraApplySchema>, context?: ToolContext): Promise<{
    adapted: boolean;
    adapterId: string;
    latency: string;
    output: string;
}>;
export declare function handleForceLearn(input: Record<string, never>, context?: ToolContext): Promise<{
    triggered: boolean;
    cycleId: string;
    startedAt: string;
}>;
export declare function handleGetStats(input: Record<string, never>, context?: ToolContext): Promise<SONAStats>;
export declare function handleProfileGet(input: z.infer<typeof profileGetSchema>, context?: ToolContext): Promise<{
    profile: SONAProfile;
    isActive: boolean;
}>;
export declare function handleProfileList(input: Record<string, never>, context?: ToolContext): Promise<{
    profiles: Array<{
        id: string;
        name: string;
        mode: string;
        isActive: boolean;
    }>;
}>;
export declare function handleSetEnabled(input: z.infer<typeof setEnabledSchema>, context?: ToolContext): Promise<{
    enabled: boolean;
    previousState: boolean;
}>;
export declare function handleBenchmark(input: Record<string, never>, context?: ToolContext): Promise<{
    microLoraLatency: {
        avg: string;
        p95: string;
        p99: string;
    };
    hnswSearch: {
        avg: string;
        speedup: string;
    };
    trajectoryOverhead: {
        avg: string;
    };
    memoryUsage: {
        current: string;
    };
}>;
