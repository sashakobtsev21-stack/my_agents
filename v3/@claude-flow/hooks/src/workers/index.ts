/**
 * V3 Workers System - Cross-Platform Background Workers
 *
 * Optimizes Claude Flow with non-blocking, scheduled workers.
 * Works on Linux, macOS, and Windows.
 */

// This file is now a thin assembler. The worker subsystem was split into
// the workers/ sub-modules during the P3.7 god-file decomposition
// (W84-W87): types · fs-helpers · factories · worker-manager. The public
// API is re-exported byte-identically so every existing
// `import { … } from '.../workers/index.js'` callsite keeps working.
export * from './types.js';
export * from './factories.js';
export { WorkerManager } from './worker-manager.js';

import { WorkerManager } from './worker-manager.js';
import {
  createPerformanceWorker,
  createHealthWorker,
  createSwarmWorker,
  createGitWorker,
  createLearningWorker,
  createADRWorker,
  createDDDWorker,
  createSecurityWorker,
  createPatternsWorker,
  createCacheWorker,
  createV3ProgressWorker,
} from './factories.js';

// ============================================================================
// Factory
// ============================================================================

export function createWorkerManager(projectRoot?: string): WorkerManager {
  const root = projectRoot || process.cwd();
  const manager = new WorkerManager(root);

  // Register all built-in workers
  manager.register('performance', createPerformanceWorker(root));
  manager.register('health', createHealthWorker(root));
  manager.register('swarm', createSwarmWorker(root));
  manager.register('git', createGitWorker(root));
  manager.register('learning', createLearningWorker(root));
  manager.register('adr', createADRWorker(root));
  manager.register('ddd', createDDDWorker(root));
  manager.register('security', createSecurityWorker(root));
  manager.register('patterns', createPatternsWorker(root));
  manager.register('cache', createCacheWorker(root));
  manager.register('v3progress', createV3ProgressWorker(root));

  return manager;
}

// Default instance
export const workerManager = createWorkerManager();
