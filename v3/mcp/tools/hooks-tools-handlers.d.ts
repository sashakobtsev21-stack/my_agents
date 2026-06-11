/**
 * V3 MCP Hooks Tools — singleton & handlers
 *
 * The ReasoningBank singleton (mutable let-bindings stay co-located with
 * their reassigning getter — TS2540-safe) and the nine tool handler
 * implementations. These were module-private in the original
 * hooks-tools.ts (P3.60, W181) and are NOT re-exported by the barrel.
 */
import { z } from 'zod';
import type { ToolContext } from '../types.js';
import { ReasoningBank } from '../../@claude-flow/neural/src/index.js';
import { preEditSchema, postEditSchema, preCommandSchema, postCommandSchema, routeSchema, explainSchema, pretrainSchema, metricsSchema, listHooksSchema } from './hooks-tools-support.js';
import type { PreEditResult, PostEditResult, PreCommandResult, PostCommandResult, RouteResult, ExplainResult, PretrainResult, MetricsResult, ListHooksResult } from './hooks-tools-support.js';
/**
 * Get or create the singleton ReasoningBank instance
 */
export declare function getReasoningBank(): Promise<ReasoningBank>;
/**
 * Pre-edit hook with context and suggestions
 */
export declare function handlePreEdit(input: z.infer<typeof preEditSchema>, context?: ToolContext): Promise<PreEditResult>;
/**
 * Post-edit hook for learning
 */
export declare function handlePostEdit(input: z.infer<typeof postEditSchema>, context?: ToolContext): Promise<PostEditResult>;
/**
 * Pre-command hook for risk assessment
 */
export declare function handlePreCommand(input: z.infer<typeof preCommandSchema>, context?: ToolContext): Promise<PreCommandResult>;
/**
 * Post-command hook for recording
 */
export declare function handlePostCommand(input: z.infer<typeof postCommandSchema>, context?: ToolContext): Promise<PostCommandResult>;
/**
 * Route task to optimal agent
 */
export declare function handleRoute(input: z.infer<typeof routeSchema>, context?: ToolContext): Promise<RouteResult>;
/**
 * Explain routing decision
 */
export declare function handleExplain(input: z.infer<typeof explainSchema>, context?: ToolContext): Promise<ExplainResult>;
/**
 * Bootstrap intelligence from repository
 */
export declare function handlePretrain(input: z.infer<typeof pretrainSchema>, context?: ToolContext): Promise<PretrainResult>;
/**
 * Get learning metrics
 */
export declare function handleMetrics(input: z.infer<typeof metricsSchema>, context?: ToolContext): Promise<MetricsResult>;
/**
 * List registered hooks
 */
export declare function handleListHooks(input: z.infer<typeof listHooksSchema>, context?: ToolContext): Promise<ListHooksResult>;
