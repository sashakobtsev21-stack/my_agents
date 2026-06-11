/**
 * V3 MCP SONA Tools — types & schemas
 *
 * The trajectory/pattern/profile shapes and the zod input schemas.
 * Module-private in the original sona-tools.ts (P3.62, W183); NOT
 * re-exported by the barrel — public API unchanged.
 */
import { z } from 'zod';
// ============================================================================
// Input Schemas
// ============================================================================
export const trajectoryBeginSchema = z.object({
    sessionId: z.string().optional()
        .describe('Session identifier'),
    context: z.record(z.unknown()).optional()
        .describe('Initial context for the trajectory'),
});
export const trajectoryStepSchema = z.object({
    trajectoryId: z.string()
        .describe('Trajectory ID'),
    action: z.string()
        .describe('Action taken'),
    observation: z.string().optional()
        .describe('Observation from action'),
    reward: z.number().optional()
        .describe('Reward signal (-1 to 1)'),
    metadata: z.record(z.unknown()).optional()
        .describe('Additional step metadata'),
});
export const trajectoryContextSchema = z.object({
    trajectoryId: z.string()
        .describe('Trajectory ID'),
    context: z.record(z.unknown())
        .describe('Context to add'),
});
export const trajectoryEndSchema = z.object({
    trajectoryId: z.string()
        .describe('Trajectory ID'),
    verdict: z.enum(['success', 'failure', 'partial'])
        .describe('Final verdict for the trajectory'),
    triggerLearning: z.boolean().default(true)
        .describe('Whether to trigger learning from this trajectory'),
});
export const trajectoryListSchema = z.object({
    sessionId: z.string().optional()
        .describe('Filter by session ID'),
    verdict: z.enum(['success', 'failure', 'partial']).optional()
        .describe('Filter by verdict'),
    limit: z.number().default(20)
        .describe('Maximum trajectories to return'),
});
export const patternFindSchema = z.object({
    query: z.string()
        .describe('Query to find similar patterns'),
    category: z.string().optional()
        .describe('Filter by category'),
    topK: z.number().default(5)
        .describe('Number of patterns to return'),
    threshold: z.number().default(0.7)
        .describe('Similarity threshold (0-1)'),
});
export const loraApplySchema = z.object({
    adapterId: z.string().optional()
        .describe('LoRA adapter ID (auto-select if not provided)'),
    input: z.string()
        .describe('Input to adapt'),
    strength: z.number().default(0.5)
        .describe('Adaptation strength (0-1)'),
});
export const profileGetSchema = z.object({
    profileId: z.string().optional()
        .describe('Profile ID (returns active if not provided)'),
});
export const setEnabledSchema = z.object({
    enabled: z.boolean()
        .describe('Enable or disable SONA'),
});
// ============================================================================
