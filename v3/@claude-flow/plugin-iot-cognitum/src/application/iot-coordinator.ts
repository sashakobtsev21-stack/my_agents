import type { SeedClient, WitnessChain, CustodyEpoch } from '@cognitum-one/sdk/seed';
import { SeedClientFactory } from '../infrastructure/seed-client-factory.js';
import { DeviceLifecycleService } from '../domain/services/device-lifecycle-service.js';
import { TelemetryService } from '../domain/services/telemetry-service.js';
import type {
  StoreQueryResult,
  IngestResult,
  StoreHealthStatus,
} from '../domain/services/telemetry-service.js';
import { MeshService } from '../domain/services/mesh-service.js';
import type { MeshTopology } from '../domain/services/mesh-service.js';
import type { DeviceAgent, DeviceTrustLevel } from '../domain/entities/index.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface IoTCoordinatorConfig {
  /** Fleet ID assigned to newly registered devices. */
  defaultFleetId: string;
  /** IEC 62443 security zone assigned to newly registered devices. */
  defaultZoneId: string;
  /** TLS defaults forwarded to the underlying SeedClientFactory. */
  defaultTls?: { insecure?: boolean; ca?: string };
  /** Active health-probe interval (ms) for each SeedClient. */
  healthInterval?: number;
}

export interface IoTCoordinatorCallbacks {
  onDeviceRegistered?: (device: DeviceAgent) => void;
  onTrustChange?: (
    deviceId: string,
    oldLevel: DeviceTrustLevel,
    newLevel: DeviceTrustLevel,
  ) => void;
}

// ---------------------------------------------------------------------------
// Coordinator
// ---------------------------------------------------------------------------

/**
 * Application-layer coordinator that wires domain services to the
 * Cognitum Seed SDK transport. Every public method resolves a
 * {@link SeedClient} from the internal registry and delegates to the
 * appropriate domain service.
 */
export class IoTCoordinator {
  private readonly factory: SeedClientFactory;
  private readonly devices: Map<
    string,
    { agent: DeviceAgent; client: SeedClient }
  > = new Map();
  private readonly lifecycle: DeviceLifecycleService;
  private readonly telemetry: TelemetryService;
  private readonly mesh: MeshService;
  private readonly config: IoTCoordinatorConfig;

  constructor(
    config: IoTCoordinatorConfig,
    callbacks?: IoTCoordinatorCallbacks,
  ) {
    this.config = config;
    this.factory = new SeedClientFactory({
      defaultTls: config.defaultTls,
      healthInterval: config.healthInterval,
    });

    // -----------------------------------------------------------------------
    // Wire domain-service deps to real SDK calls via this.devices
    // -----------------------------------------------------------------------

    this.lifecycle = new DeviceLifecycleService({
      getStatus: async (deviceId: string) => {
        const client = this.resolveClient(deviceId);
        return client.status();
      },
      getIdentity: async (deviceId: string) => {
        const client = this.resolveClient(deviceId);
        return client.identity();
      },
      getPairStatus: async (deviceId: string) => {
        const client = this.resolveClient(deviceId);
        return client.pair.status();
      },
      getWitnessChain: async (deviceId: string) => {
        const client = this.resolveClient(deviceId);
        const chain = await client.witness.chain();
        return {
          depth: chain.length ?? chain.entries?.length ?? 0,
          epoch: chain.entries?.[0]?.epoch ?? 0,
          head_hash: chain.head ?? '',
        };
      },
      getCustodyEpoch: async (deviceId: string) => {
        const client = this.resolveClient(deviceId);
        return client.custody.epoch();
      },
      onDeviceRegistered: callbacks?.onDeviceRegistered,
      onTrustChange: callbacks?.onTrustChange,
    });

    this.telemetry = new TelemetryService({
      queryVectors: async (deviceId, vector, k) => {
        const client = this.resolveClient(deviceId);
        return client.store.query({ vector, k });
      },
      ingestVectors: async (deviceId, vectors) => {
        const client = this.resolveClient(deviceId);
        return client.store.ingest({ vectors });
      },
      getStoreStatus: async (deviceId) => {
        const client = this.resolveClient(deviceId);
        return client.store.status();
      },
    });

    this.mesh = new MeshService({
      getMeshStatus: async (deviceId) => {
        const client = this.resolveClient(deviceId);
        return client.mesh.status();
      },
      getPeers: async (deviceId) => {
        const client = this.resolveClient(deviceId);
        return client.mesh.peers();
      },
      getSwarmStatus: async (deviceId) => {
        const client = this.resolveClient(deviceId);
        return client.mesh.swarmStatus();
      },
      getClusterHealth: async (deviceId) => {
        const client = this.resolveClient(deviceId);
        return client.mesh.clusterHealth();
      },
    });
  }

  // -------------------------------------------------------------------------
  // Device lifecycle
  // -------------------------------------------------------------------------

  /**
   * Register a Seed device by its HTTP endpoint. Creates a
   * {@link SeedClient}, fetches status and identity from the real
   * hardware, and returns a fully populated {@link DeviceAgent}.
   */
  async registerDevice(
    endpoint: string,
    pairingToken?: string,
  ): Promise<DeviceAgent> {
    const client = await this.factory.createClient(endpoint, pairingToken);

    // During initial registration the lifecycle service calls
    // getStatus(endpoint) and getIdentity(device_id). We temporarily
    // store the client under the endpoint key so resolveClient() can
    // find it before the real device ID is known.
    this.devices.set(endpoint, {
      agent: {} as DeviceAgent,
      client,
    });

    let agent: DeviceAgent;
    try {
      agent = await this.lifecycle.registerDevice(
        endpoint,
        this.config.defaultFleetId,
        this.config.defaultZoneId,
      );
    } catch (err) {
      this.devices.delete(endpoint);
      throw err;
    }

    // Promote: remove the temporary endpoint key and store under the
    // real device ID returned by the hardware.
    this.devices.delete(endpoint);
    this.devices.set(agent.deviceId, { agent, client });

    return agent;
  }

  /**
   * Refresh a device's state from the real hardware and recalculate
   * its trust score.
   */
  async getDeviceStatus(deviceId: string): Promise<DeviceAgent> {
    const entry = this.requireEntry(deviceId);
    const refreshed = await this.lifecycle.refreshDeviceState(entry.agent);
    entry.agent = refreshed;
    return refreshed;
  }

  // -------------------------------------------------------------------------
  // Telemetry / vector store
  // -------------------------------------------------------------------------

  /** Run a k-NN query against a device's on-board vector store. */
  async queryDeviceVectors(
    deviceId: string,
    vector: number[],
    k: number,
  ): Promise<StoreQueryResult> {
    return this.telemetry.queryDevice(deviceId, vector, k);
  }

  /** Ingest raw vectors into a device's vector store. */
  async ingestDeviceTelemetry(
    deviceId: string,
    vectors: Array<{ values: number[]; metadata?: Record<string, unknown> }>,
  ): Promise<IngestResult> {
    const client = this.resolveClient(deviceId);
    const result = await client.store.ingest({ vectors });
    return {
      deviceId,
      ingested: result.ingested,
      epoch: result.epoch,
    };
  }

  /** Retrieve vector store health metrics for a device. */
  async getDeviceStoreStatus(deviceId: string): Promise<StoreHealthStatus> {
    return this.telemetry.getStoreHealth(deviceId);
  }

  // -------------------------------------------------------------------------
  // Mesh
  // -------------------------------------------------------------------------

  /** Get the aggregated mesh topology snapshot for a device. */
  async getDeviceMeshTopology(deviceId: string): Promise<MeshTopology> {
    return this.mesh.getTopology(deviceId);
  }

  // -------------------------------------------------------------------------
  // Witness / custody — direct SDK pass-through
  // -------------------------------------------------------------------------

  /** Retrieve the full witness chain from a device. */
  async getDeviceWitnessChain(deviceId: string): Promise<WitnessChain> {
    const client = this.resolveClient(deviceId);
    return client.witness.chain();
  }

  /** Retrieve the current custody epoch from a device. */
  async getDeviceCustodyEpoch(deviceId: string): Promise<CustodyEpoch> {
    const client = this.resolveClient(deviceId);
    return client.custody.epoch();
  }

  // -------------------------------------------------------------------------
  // Inventory
  // -------------------------------------------------------------------------

  /** List all registered device agents. */
  listDevices(): DeviceAgent[] {
    return Array.from(this.devices.values()).map((e) => e.agent);
  }

  /** Remove a device from the coordinator and close its SDK client. */
  async removeDevice(deviceId: string): Promise<void> {
    const entry = this.devices.get(deviceId);
    if (!entry) return;

    await entry.client.close();
    this.devices.delete(deviceId);
  }

  /** Shut down all SDK clients and clear internal state. */
  async shutdown(): Promise<void> {
    await this.factory.closeAll();
    this.devices.clear();
  }

  /** Health snapshot of the coordinator. */
  getStatus(): {
    healthy: boolean;
    deviceCount: number;
    devices: DeviceAgent[];
  } {
    return {
      healthy: this.devices.size >= 0,
      deviceCount: this.devices.size,
      devices: this.listDevices(),
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Resolve a SeedClient by device ID (or temporary endpoint key).
   * Throws when the device has not been registered.
   */
  private resolveClient(deviceId: string): SeedClient {
    return this.requireEntry(deviceId).client;
  }

  private requireEntry(
    deviceId: string,
  ): { agent: DeviceAgent; client: SeedClient } {
    const entry = this.devices.get(deviceId);
    if (!entry) {
      throw new Error(`Device ${deviceId} not registered with coordinator`);
    }
    return entry;
  }
}
