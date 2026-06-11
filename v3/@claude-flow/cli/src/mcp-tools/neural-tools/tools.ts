/**
 * Neural MCP tool definitions — neural_train / predict / patterns /
 * compress / status / optimize. Each wires the shared embedding subsystem
 * + neural store from ./helpers.js.
 *
 * Extracted from neural-tools.ts (W138, P3.21 cut #2 — final).
 *
 * Campaign-2 wave 82 (W288): the six tool defs were split into
 * ./tools-train.ts and ./tools-optimize.ts; this file re-exports them.
 */
export { neuralTrain, neuralPredict, neuralPatterns } from './tools-train.js';
export { neuralCompress, neuralStatus, neuralOptimize } from './tools-optimize.js';
