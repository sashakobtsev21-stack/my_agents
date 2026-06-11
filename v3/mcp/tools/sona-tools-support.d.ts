/**
 * V3 MCP SONA Tools — types & schemas
 *
 * The trajectory/pattern/profile shapes and the zod input schemas.
 * Module-private in the original sona-tools.ts (P3.62, W183); NOT
 * re-exported by the barrel — public API unchanged.
 */
import { z } from 'zod';
export interface Trajectory {
    id: string;
    sessionId: string;
    startedAt: Date;
    endedAt?: Date;
    steps: TrajectoryStep[];
    context: Record<string, unknown>;
    verdict?: 'success' | 'failure' | 'partial';
    metrics?: TrajectoryMetrics;
}
export interface TrajectoryStep {
    id: string;
    action: string;
    observation?: string;
    reward?: number;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}
export interface TrajectoryMetrics {
    totalSteps: number;
    duration: number;
    avgStepDuration: number;
    tokensUsed?: number;
    learningTriggered: boolean;
}
export interface Pattern {
    id: string;
    embedding: number[];
    content: string;
    category: string;
    confidence: number;
    usageCount: number;
    createdAt: Date;
    lastUsed: Date;
}
export interface SONAProfile {
    id: string;
    name: string;
    mode: 'default' | 'fast' | 'accurate' | 'memory-efficient';
    settings: {
        learningRate: number;
        batchSize: number;
        microLoraEnabled: boolean;
        hnswEfSearch: number;
        patternThreshold: number;
    };
}
export interface SONAStats {
    enabled: boolean;
    activeProfile: string;
    trajectories: {
        total: number;
        successful: number;
        failed: number;
        avgDuration: number;
    };
    patterns: {
        stored: number;
        searchesPerformed: number;
        avgSearchLatency: number;
    };
    learning: {
        cyclesCompleted: number;
        lastCycle: string | null;
        avgCycleDuration: number;
    };
    performance: {
        microLoraLatency: number;
        hnswSpeedup: number;
    };
}
export declare const trajectoryBeginSchema: z.ZodObject<{
    sessionId: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    context?: Record<string, unknown> | undefined;
    sessionId?: string | undefined;
}, {
    context?: Record<string, unknown> | undefined;
    sessionId?: string | undefined;
}>;
export declare const trajectoryStepSchema: z.ZodObject<{
    trajectoryId: z.ZodString;
    action: z.ZodString;
    observation: z.ZodOptional<z.ZodString>;
    reward: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    trajectoryId: string;
    action: string;
    metadata?: Record<string, unknown> | undefined;
    observation?: string | undefined;
    reward?: number | undefined;
}, {
    trajectoryId: string;
    action: string;
    metadata?: Record<string, unknown> | undefined;
    observation?: string | undefined;
    reward?: number | undefined;
}>;
export declare const trajectoryContextSchema: z.ZodObject<{
    trajectoryId: z.ZodString;
    context: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    trajectoryId: string;
    context: Record<string, unknown>;
}, {
    trajectoryId: string;
    context: Record<string, unknown>;
}>;
export declare const trajectoryEndSchema: z.ZodObject<{
    trajectoryId: z.ZodString;
    verdict: z.ZodEnum<["success", "failure", "partial"]>;
    triggerLearning: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    trajectoryId: string;
    verdict: "success" | "failure" | "partial";
    triggerLearning: boolean;
}, {
    trajectoryId: string;
    verdict: "success" | "failure" | "partial";
    triggerLearning?: boolean | undefined;
}>;
export declare const trajectoryListSchema: z.ZodObject<{
    sessionId: z.ZodOptional<z.ZodString>;
    verdict: z.ZodOptional<z.ZodEnum<["success", "failure", "partial"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    sessionId?: string | undefined;
    verdict?: "success" | "failure" | "partial" | undefined;
}, {
    limit?: number | undefined;
    sessionId?: string | undefined;
    verdict?: "success" | "failure" | "partial" | undefined;
}>;
export declare const patternFindSchema: z.ZodObject<{
    query: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    topK: z.ZodDefault<z.ZodNumber>;
    threshold: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    topK: number;
    query: string;
    threshold: number;
    category?: string | undefined;
}, {
    query: string;
    topK?: number | undefined;
    category?: string | undefined;
    threshold?: number | undefined;
}>;
export declare const loraApplySchema: z.ZodObject<{
    adapterId: z.ZodOptional<z.ZodString>;
    input: z.ZodString;
    strength: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    input: string;
    strength: number;
    adapterId?: string | undefined;
}, {
    input: string;
    adapterId?: string | undefined;
    strength?: number | undefined;
}>;
export declare const profileGetSchema: z.ZodObject<{
    profileId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    profileId?: string | undefined;
}, {
    profileId?: string | undefined;
}>;
export declare const setEnabledSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
}, {
    enabled: boolean;
}>;
