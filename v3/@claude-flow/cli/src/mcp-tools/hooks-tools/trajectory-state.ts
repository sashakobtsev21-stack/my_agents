/**
 * Trajectory storage for SONA learning.
 *
 * Extracted from hooks-tools.ts (W36, P3.2 cut #6). The trajectory state
 * is a per-process in-memory Map keyed by trajectoryId; only the
 * intelligence trajectory-start / trajectory-step / trajectory-end MCP
 * handlers in hooks-tools.ts touch it, and they always reach in via
 * `activeTrajectories.{get,set,delete,size,clear}`. The interfaces are
 * shared with the intelligence module via structural typing.
 */

export interface TrajectoryStep {
  action: string;
  result: string;
  quality: number;
  timestamp: string;
}

export interface TrajectoryData {
  id: string;
  task: string;
  agent: string;
  steps: TrajectoryStep[];
  startedAt: string;
  success?: boolean;
  endedAt?: string;
}

// In-memory trajectory tracking (persisted on end)
export const activeTrajectories = new Map<string, TrajectoryData>();
