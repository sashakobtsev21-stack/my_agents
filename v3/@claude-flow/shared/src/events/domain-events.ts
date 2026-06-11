/**
 * Domain Events for Event Sourcing (ADR-007)
 *
 * Defines all domain events for the V3 system:
 * - Agent lifecycle events (spawned, started, stopped, failed)
 * - Task execution events (created, started, completed, failed)
 * - Memory operations events (stored, retrieved, deleted)
 * - Swarm coordination events (initialized, scaled, terminated)
 *
 * @module v3/shared/events/domain-events
 */

import { AgentId, TaskId, EventType, SwarmEvent } from '../types.js';

// Split into ./domain-events-core.ts + ./domain-events-extended.ts during campaign-2 wave W303.
export * from './domain-events-core.js';
export * from './domain-events-extended.js';
