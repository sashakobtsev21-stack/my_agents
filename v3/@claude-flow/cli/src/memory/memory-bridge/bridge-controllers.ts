/**
 * Memory-bridge controller access + health check.
 *
 *   - bridgeGetController   (named controller from the ControllerRegistry)
 *   - bridgeHasController   (availability probe)
 *   - bridgeListControllers (all controllers + enabled/level status)
 *   - bridgeHealthCheck     (registry + attestation + cache stats)
 *
 * Extracted from memory-bridge.ts (W71, P3.4 cut #8).
 */
import { getRegistry } from './bridge-core.js';

// ===== Phase 4: Controller access =====

/**
 * Get a named controller from AgentDB v3 via ControllerRegistry.
 * Returns null if unavailable.
 */
export async function bridgeGetController(
  name: string,
  dbPath?: string,
): Promise<any | null> {
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  try {
    return registry.get(name) ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if a controller is available.
 */
export async function bridgeHasController(
  name: string,
  dbPath?: string,
): Promise<boolean> {
  const registry = await getRegistry(dbPath);
  if (!registry) return false;

  try {
    const controller = registry.get(name);
    return controller !== null && controller !== undefined;
  } catch {
    return false;
  }
}

/**
 * List all controllers and their status.
 */
export async function bridgeListControllers(
  dbPath?: string,
): Promise<Array<{ name: string; enabled: boolean; level: number }> | null> {
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  try {
    return registry.listControllers();
  } catch {
    return null;
  }
}


// ===== Phase 4: Health check with attestation =====

/**
 * Get comprehensive bridge health including all controller statuses.
 */
export async function bridgeHealthCheck(
  dbPath?: string,
): Promise<{
  available: boolean;
  controllers: Array<{ name: string; enabled: boolean; level: number }>;
  attestationCount?: number;
  cacheStats?: { size: number; hits: number; misses: number };
} | null> {
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  try {
    const controllers = registry.listControllers();

    // Phase 4: AttestationLog stats
    let attestationCount = 0;
    const attestation = registry.get('attestationLog');
    if (attestation && typeof attestation.count === 'function') {
      attestationCount = attestation.count();
    }

    // Phase 2: TieredCache stats
    let cacheStats = { size: 0, hits: 0, misses: 0 };
    const cache = registry.get('tieredCache');
    if (cache && typeof cache.stats === 'function') {
      const s = cache.stats();
      cacheStats = { size: s.size ?? 0, hits: s.hits ?? 0, misses: s.misses ?? 0 };
    }

    return { available: true, controllers, attestationCount, cacheStats };
  } catch {
    return null;
  }
}

