/**
 * Embeddings MCP Tools for CLI
 *
 * Tool definitions for ONNX embeddings with hyperbolic support and neural substrate.
 * Implements ADR-024: Embeddings MCP Tools
 */


import type { MCPTool } from './types.js';
// The config/math helpers and the three tool groups were extracted into
// the sub-modules below during campaign-2 wave 3 (W209). All were
// module-private; the single public export (embeddingsTools) is
// reassembled here byte-equivalently.
import { embeddingsCoreTools } from './embeddings-tools-core.js';
import { embeddingsAdvancedTools } from './embeddings-tools-advanced.js';
import { embeddingsRabitqTools } from './embeddings-tools-rabitq.js';

export const embeddingsTools: MCPTool[] = [
  ...embeddingsCoreTools,
  ...embeddingsAdvancedTools,
  ...embeddingsRabitqTools,
];
