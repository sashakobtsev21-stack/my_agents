/**
 * Memory MCP Tools for CLI - V3 with sql.js/HNSW Backend
 *
 * UPGRADED: Now uses the advanced sql.js + HNSW backend for:
 * - HNSW-indexed semantic search (~1.9x-4.7x, measured)
 * - Vector embeddings with cosine similarity
 * - Persistent SQLite storage (WASM)
 * - Backward compatible with legacy JSON storage (auto-migrates)
 *
 * @module v3/cli/mcp-tools/memory-tools
 */

// This file is now a thin registrar: it assembles memoryTools[] from the
// tool objects + helpers extracted into the ./memory-tools/ directory
// during the P3.16 god-file decomposition (W124-W126). Sub-modules:
//   helpers · tools-crud · tools-extra-a · tools-extra-b
import type { MCPTool } from './types.js';
import { memoryStore, memoryRetrieve, memorySearch, memoryDelete, memoryList } from './memory-tools/tools-crud.js';
// Stats/migrate + bridge tools (W126, P3.16 cut #3).
import { memoryStats, memoryMigrate, memoryImportClaude, memoryBridgeStatus } from './memory-tools/tools-extra-a.js';
// Unified search + detailed-stats + maintenance tools (W126, P3.16 cut #4).
import { memorySearchUnified, memoryDetailedStats, memoryCleanup, memoryCompress, memoryExport, memoryImport } from './memory-tools/tools-extra-b.js';

export const memoryTools: MCPTool[] = [
  memoryStore,
  memoryRetrieve,
  memorySearch,
  memoryDelete,
  memoryList,
  memoryStats,
  memoryMigrate,
  memoryImportClaude,
  memoryBridgeStatus,
  memorySearchUnified,
  memoryDetailedStats,
  memoryCleanup,
  memoryCompress,
  memoryExport,
  memoryImport,
];
