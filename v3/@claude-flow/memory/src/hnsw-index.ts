/**
 * V3 HNSW Vector Index
 *
 * High-performance Hierarchical Navigable Small World (HNSW) index for
 * ~1.9x-4.7x (measured) vector similarity search compared to brute force.
 *
 * OPTIMIZATIONS:
 * - BinaryMinHeap/BinaryMaxHeap for O(log n) operations (vs O(n log n) Array.sort)
 * - Pre-normalized vectors for O(1) cosine similarity (no sqrt needed)
 * - Bounded max-heap for efficient top-k tracking
 *
 * @module v3/memory/hnsw-index
 */

import { EventEmitter } from 'node:events';
import {
  DistanceMetric,
  HNSWConfig,
  HNSWStats,
  QuantizationConfig,
  SearchResult,
  MemoryEntry,
  MemoryEvent,
  MemoryEventHandler,
} from './types.js';

/**
 * Binary Min Heap for O(log n) priority queue operations
 * Used for candidate selection in HNSW search
 */

// The heaps, HNSWNode shape, Quantizer, and persistence helpers were
// extracted into ./hnsw-support.ts during the P3.48 god-file
// decomposition (W169). They were module-private and are intentionally
// not re-exported from here.
import {
  BinaryMaxHeap,
  BinaryMinHeap,
  Quantizer,
  readFloat32Array,
  readLengthPrefixedString,
} from './hnsw-support.js';
import type { HNSWNode } from './hnsw-support.js';

export class HNSWIndex extends EventEmitter {
  private config: HNSWConfig;
  private nodes: Map<string, HNSWNode> = new Map();
  private entryPoint: string | null = null;
  private maxLevel: number = 0;
  private levelMult: number;

  // Performance tracking
  private stats: {
    searchCount: number;
    totalSearchTime: number;
    insertCount: number;
    totalInsertTime: number;
    buildStartTime: number;
  } = {
    searchCount: 0,
    totalSearchTime: 0,
    insertCount: 0,
    totalInsertTime: 0,
    buildStartTime: 0,
  };

  // Quantization support
  private quantizer: Quantizer | null = null;

  constructor(config: Partial<HNSWConfig> = {}) {
    super();
    this.config = this.mergeConfig(config);
    this.levelMult = 1 / Math.log(this.config.M);

    if (this.config.quantization) {
      this.quantizer = new Quantizer(this.config.quantization, this.config.dimensions);
    }
  }

  /**
   * Add a vector to the index
   */
  async addPoint(id: string, vector: Float32Array): Promise<void> {
    const startTime = performance.now();

    if (vector.length !== this.config.dimensions) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.config.dimensions}, got ${vector.length}`
      );
    }

    if (this.nodes.size >= this.config.maxElements) {
      throw new Error('Index is full, cannot add more elements');
    }

    // Quantize if enabled
    const storedVector = this.quantizer
      ? this.quantizer.encode(vector)
      : vector;

    // Pre-normalize vector for O(1) cosine similarity
    const normalizedVector = this.config.metric === 'cosine'
      ? this.normalizeVector(storedVector)
      : null;

    // Generate random level for new node
    const level = this.getRandomLevel();

    const node: HNSWNode = {
      id,
      vector: storedVector,
      normalizedVector,
      connections: new Map(),
      level,
    };

    // Initialize connection sets for each layer
    for (let l = 0; l <= level; l++) {
      node.connections.set(l, new Set());
    }

    if (this.entryPoint === null) {
      // First node
      this.entryPoint = id;
      this.maxLevel = level;
      this.nodes.set(id, node);
    } else {
      // Insert new node into the graph
      await this.insertNode(node);
    }

    const duration = performance.now() - startTime;
    this.stats.insertCount++;
    this.stats.totalInsertTime += duration;

    this.emit('point:added', { id, level, duration });
  }

  /**
   * Search for k nearest neighbors
   */
  async search(
    query: Float32Array,
    k: number,
    ef?: number
  ): Promise<Array<{ id: string; distance: number }>> {
    const startTime = performance.now();

    if (query.length !== this.config.dimensions) {
      throw new Error(
        `Query dimension mismatch: expected ${this.config.dimensions}, got ${query.length}`
      );
    }

    if (this.entryPoint === null) {
      return [];
    }

    const searchEf = ef || Math.max(k, this.config.efConstruction);

    // Quantize query if needed
    const queryVector = this.quantizer
      ? this.quantizer.encode(query)
      : query;

    // Pre-normalize query for O(1) cosine similarity
    const normalizedQuery = this.config.metric === 'cosine'
      ? this.normalizeVector(queryVector)
      : null;

    // Start from entry point and search down the layers
    let currentNode = this.entryPoint;
    let currentDist = this.distanceOptimized(
      queryVector,
      normalizedQuery,
      this.nodes.get(currentNode)!
    );

    // Search through layers from top to 1
    for (let level = this.maxLevel; level > 0; level--) {
      const layerResult = this.searchLayerOptimized(
        queryVector,
        normalizedQuery,
        currentNode,
        1,
        level
      );
      currentNode = layerResult[0]?.id || currentNode;
      currentDist = this.distanceOptimized(
        queryVector,
        normalizedQuery,
        this.nodes.get(currentNode)!
      );
    }

    // Search layer 0 with ef candidates using heap-based search
    const candidates = this.searchLayerOptimized(
      queryVector,
      normalizedQuery,
      currentNode,
      searchEf,
      0
    );

    // Return top k results (already sorted by heap)
    const results = candidates.slice(0, k);

    const duration = performance.now() - startTime;
    this.stats.searchCount++;
    this.stats.totalSearchTime += duration;

    return results;
  }

  /**
   * Search with filters applied post-retrieval
   */
  async searchWithFilters(
    query: Float32Array,
    k: number,
    filter: (id: string) => boolean,
    ef?: number
  ): Promise<Array<{ id: string; distance: number }>> {
    // Over-fetch to account for filtered results
    const overFetchFactor = 3;
    const candidates = await this.search(query, k * overFetchFactor, ef);

    return candidates
      .filter((c) => filter(c.id))
      .slice(0, k);
  }

  /**
   * Remove a point from the index
   */
  async removePoint(id: string): Promise<boolean> {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }

    // Remove all connections to this node
    for (let level = 0; level <= node.level; level++) {
      const connections = node.connections.get(level);
      if (connections) {
        for (const connectedId of connections) {
          const connectedNode = this.nodes.get(connectedId);
          if (connectedNode) {
            connectedNode.connections.get(level)?.delete(id);
          }
        }
      }
    }

    this.nodes.delete(id);

    // Update entry point if needed
    if (this.entryPoint === id) {
      if (this.nodes.size === 0) {
        this.entryPoint = null;
        this.maxLevel = 0;
      } else {
        // Find new entry point with highest level
        let newEntry: string | null = null;
        let newMaxLevel = 0;
        for (const [nodeId, n] of this.nodes) {
          if (newEntry === null || n.level > newMaxLevel) {
            newMaxLevel = n.level;
            newEntry = nodeId;
          }
        }
        this.entryPoint = newEntry;
        this.maxLevel = newMaxLevel;
      }
    }

    this.emit('point:removed', { id });
    return true;
  }

  /**
   * Rebuild the index from scratch
   */
  async rebuild(
    entries: Array<{ id: string; vector: Float32Array }>
  ): Promise<void> {
    this.stats.buildStartTime = performance.now();

    this.nodes.clear();
    this.entryPoint = null;
    this.maxLevel = 0;

    for (const entry of entries) {
      await this.addPoint(entry.id, entry.vector);
    }

    const buildTime = performance.now() - this.stats.buildStartTime;

    this.emit('index:rebuilt', {
      vectorCount: this.nodes.size,
      buildTime,
    });
  }

  /**
   * Get index statistics
   */
  getStats(): HNSWStats {
    const vectorCount = this.nodes.size;
    const avgSearchTime =
      this.stats.searchCount > 0
        ? this.stats.totalSearchTime / this.stats.searchCount
        : 0;

    // Estimate memory usage
    const bytesPerVector = this.config.dimensions * 4; // Float32 = 4 bytes
    const connectionOverhead = this.config.M * 8 * (this.maxLevel + 1); // Approximate
    const memoryUsage = vectorCount * (bytesPerVector + connectionOverhead);

    return {
      vectorCount,
      memoryUsage,
      avgSearchTime,
      buildTime: performance.now() - this.stats.buildStartTime,
      compressionRatio: this.quantizer?.getCompressionRatio() || 1.0,
    };
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.nodes.clear();
    this.entryPoint = null;
    this.maxLevel = 0;
    this.stats = {
      searchCount: 0,
      totalSearchTime: 0,
      insertCount: 0,
      totalInsertTime: 0,
      buildStartTime: 0,
    };
  }

  /**
   * Check if an ID exists in the index
   */
  has(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Get the number of vectors in the index
   */
  get size(): number {
    return this.nodes.size;
  }

  /**
   * Read-only view of the resolved HNSW config (dimensions, M, etc.).
   * Used by {@link MemoryConsolidator.compactHnsw} to rebuild the index with
   * matching parameters.
   */
  getConfig(): Readonly<HNSWConfig> {
    return this.config;
  }

  // ===== Persistence (ADR-125 Phase 3) =====

  /**
   * Magic header for serialized HNSW snapshots.
   * Format: "HNSW" + version byte (0x01).
   */
  static readonly SERIALIZATION_MAGIC = Buffer.from([0x48, 0x4e, 0x53, 0x57, 0x01]);

  /**
   * Serialize the index to a binary buffer.
   *
   * Layout (all integers big-endian):
   * - 5 bytes:  magic header "HNSW" + version (0x01)
   * - 4 bytes:  dimensions (uint32)
   * - 4 bytes:  M (uint32)
   * - 4 bytes:  efConstruction (uint32)
   * - 4 bytes:  metric length (uint32) + metric utf-8 bytes
   * - 4 bytes:  maxLevel (uint32)
   * - 4 bytes:  entryPoint length (uint32) + entryPoint utf-8 bytes (0 = null)
   * - 4 bytes:  node count (uint32)
   * - per node:
   *   - 4 bytes id length + id utf-8 bytes
   *   - 4 bytes level
   *   - 4 bytes vector length (in floats) + vector bytes (Float32, little-endian native)
   *   - 1 byte  hasNormalized (0/1)
   *   - if hasNormalized: 4 bytes normalized length + normalized bytes
   *   - 4 bytes connection-level count
   *   - per level:
   *     - 4 bytes layer index
   *     - 4 bytes neighbor count
   *     - per neighbor: 4 bytes id length + id utf-8 bytes
   */
  serialize(): Buffer {
    const chunks: Buffer[] = [];
    chunks.push(HNSWIndex.SERIALIZATION_MAGIC);

    // Config header
    const header = Buffer.alloc(16);
    header.writeUInt32BE(this.config.dimensions, 0);
    header.writeUInt32BE(this.config.M, 4);
    header.writeUInt32BE(this.config.efConstruction, 8);
    header.writeUInt32BE(this.maxLevel, 12);
    chunks.push(header);

    chunks.push(this.encodeLengthPrefixedString(this.config.metric));
    chunks.push(this.encodeLengthPrefixedString(this.entryPoint ?? ''));

    const nodeCountBuf = Buffer.alloc(4);
    nodeCountBuf.writeUInt32BE(this.nodes.size, 0);
    chunks.push(nodeCountBuf);

    for (const [id, node] of this.nodes) {
      chunks.push(this.encodeLengthPrefixedString(id));

      const meta = Buffer.alloc(4);
      meta.writeUInt32BE(node.level, 0);
      chunks.push(meta);

      chunks.push(this.encodeFloat32Array(node.vector));

      if (node.normalizedVector) {
        chunks.push(Buffer.from([1]));
        chunks.push(this.encodeFloat32Array(node.normalizedVector));
      } else {
        chunks.push(Buffer.from([0]));
      }

      const levels = [...node.connections.entries()];
      const lvlCountBuf = Buffer.alloc(4);
      lvlCountBuf.writeUInt32BE(levels.length, 0);
      chunks.push(lvlCountBuf);

      for (const [layer, neighbors] of levels) {
        const layerBuf = Buffer.alloc(8);
        layerBuf.writeUInt32BE(layer, 0);
        layerBuf.writeUInt32BE(neighbors.size, 4);
        chunks.push(layerBuf);
        for (const neighborId of neighbors) {
          chunks.push(this.encodeLengthPrefixedString(neighborId));
        }
      }
    }

    return Buffer.concat(chunks);
  }

  /**
   * Deserialize an HNSW index from a buffer produced by {@link serialize}.
   *
   * Throws on magic-header mismatch, version mismatch, or truncated input.
   */
  static deserialize(buf: Buffer): HNSWIndex {
    if (buf.length < HNSWIndex.SERIALIZATION_MAGIC.length) {
      throw new Error('HNSWIndex.deserialize: buffer too short for magic header');
    }
    for (let i = 0; i < HNSWIndex.SERIALIZATION_MAGIC.length; i++) {
      if (buf[i] !== HNSWIndex.SERIALIZATION_MAGIC[i]) {
        throw new Error(
          `HNSWIndex.deserialize: magic header mismatch at byte ${i} (got 0x${buf[i].toString(16)}, expected 0x${HNSWIndex.SERIALIZATION_MAGIC[i].toString(16)})`
        );
      }
    }

    let offset = HNSWIndex.SERIALIZATION_MAGIC.length;

    const dimensions = buf.readUInt32BE(offset); offset += 4;
    const M = buf.readUInt32BE(offset); offset += 4;
    const efConstruction = buf.readUInt32BE(offset); offset += 4;
    const maxLevel = buf.readUInt32BE(offset); offset += 4;

    const metricRead = readLengthPrefixedString(buf, offset);
    offset = metricRead.offset;
    const metric = metricRead.value as DistanceMetric;

    const entryRead = readLengthPrefixedString(buf, offset);
    offset = entryRead.offset;
    const entryPoint = entryRead.value === '' ? null : entryRead.value;

    const nodeCount = buf.readUInt32BE(offset); offset += 4;

    const index = new HNSWIndex({
      dimensions,
      M,
      efConstruction,
      metric,
    });
    index.maxLevel = maxLevel;
    index.entryPoint = entryPoint;

    for (let n = 0; n < nodeCount; n++) {
      const idRead = readLengthPrefixedString(buf, offset);
      offset = idRead.offset;
      const id = idRead.value;

      const level = buf.readUInt32BE(offset); offset += 4;

      const vecRead = readFloat32Array(buf, offset);
      offset = vecRead.offset;
      const vector = vecRead.value;

      const hasNormalized = buf[offset]; offset += 1;
      let normalizedVector: Float32Array | null = null;
      if (hasNormalized) {
        const normRead = readFloat32Array(buf, offset);
        offset = normRead.offset;
        normalizedVector = normRead.value;
      }

      const lvlCount = buf.readUInt32BE(offset); offset += 4;
      const connections = new Map<number, Set<string>>();
      for (let l = 0; l < lvlCount; l++) {
        const layer = buf.readUInt32BE(offset); offset += 4;
        const neighborCount = buf.readUInt32BE(offset); offset += 4;
        const neighbors = new Set<string>();
        for (let k = 0; k < neighborCount; k++) {
          const neighborRead = readLengthPrefixedString(buf, offset);
          offset = neighborRead.offset;
          neighbors.add(neighborRead.value);
        }
        connections.set(layer, neighbors);
      }

      index.nodes.set(id, {
        id,
        vector,
        normalizedVector,
        connections,
        level,
      });
    }

    return index;
  }

  private encodeLengthPrefixedString(s: string): Buffer {
    const strBuf = Buffer.from(s, 'utf-8');
    const out = Buffer.alloc(4 + strBuf.length);
    out.writeUInt32BE(strBuf.length, 0);
    strBuf.copy(out, 4);
    return out;
  }

  private encodeFloat32Array(arr: Float32Array): Buffer {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(arr.length, 0);
    const dataBuf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    return Buffer.concat([lenBuf, dataBuf]);
  }

  /**
   * Remove a point from the index — alias for {@link removePoint}.
   *
   * Added by ADR-125 Phase 4 so {@link MemoryConsolidator} has a stable
   * synchronous-shaped API to call. Internally delegates to {@link removePoint}.
   */
  async remove(id: string): Promise<boolean> {
    return this.removePoint(id);
  }

  // ===== Private Methods =====

  private mergeConfig(config: Partial<HNSWConfig>): HNSWConfig {
    return {
      dimensions: config.dimensions || 1536, // OpenAI embedding size
      M: config.M || 16,
      efConstruction: config.efConstruction || 200,
      maxElements: config.maxElements || 1000000,
      metric: config.metric || 'cosine',
      quantization: config.quantization,
    };
  }

  private getRandomLevel(): number {
    let level = 0;
    while (Math.random() < 0.5 && level < 16) {
      level++;
    }
    return level;
  }

  private async insertNode(node: HNSWNode): Promise<void> {
    const query = node.vector;
    const normalizedQuery = node.normalizedVector;
    let currentNode = this.entryPoint!;
    let currentDist = this.distanceOptimized(
      query,
      normalizedQuery,
      this.nodes.get(currentNode)!
    );

    // Find entry point for the node's level
    for (let level = this.maxLevel; level > node.level; level--) {
      const result = this.searchLayerOptimized(query, normalizedQuery, currentNode, 1, level);
      if (result.length > 0 && result[0].distance < currentDist) {
        currentNode = result[0].id;
        currentDist = result[0].distance;
      }
    }

    // Insert at each level from node.level down to 0
    for (let level = Math.min(node.level, this.maxLevel); level >= 0; level--) {
      const neighbors = this.searchLayerOptimized(
        query,
        normalizedQuery,
        currentNode,
        this.config.efConstruction,
        level
      );

      // Select M best neighbors
      const selectedNeighbors = this.selectNeighbors(
        node.id,
        query,
        neighbors,
        this.config.M
      );

      // Add connections
      for (const neighbor of selectedNeighbors) {
        node.connections.get(level)!.add(neighbor.id);
        this.nodes.get(neighbor.id)?.connections.get(level)?.add(node.id);

        // Prune connections if over limit
        const neighborNode = this.nodes.get(neighbor.id);
        if (neighborNode) {
          const neighborConns = neighborNode.connections.get(level)!;
          if (neighborConns.size > this.config.M * 2) {
            this.pruneConnections(neighborNode, level, this.config.M);
          }
        }
      }

      if (neighbors.length > 0) {
        currentNode = neighbors[0].id;
      }
    }

    this.nodes.set(node.id, node);

    // Update max level if needed
    if (node.level > this.maxLevel) {
      this.maxLevel = node.level;
      this.entryPoint = node.id;
    }
  }

  private async searchLayer(
    query: Float32Array,
    entryPoint: string,
    ef: number,
    level: number
  ): Promise<Array<{ id: string; distance: number }>> {
    const visited = new Set<string>([entryPoint]);
    const candidates: Array<{ id: string; distance: number }> = [];
    const results: Array<{ id: string; distance: number }> = [];

    const entryDist = this.distance(query, this.nodes.get(entryPoint)!.vector);
    candidates.push({ id: entryPoint, distance: entryDist });
    results.push({ id: entryPoint, distance: entryDist });

    while (candidates.length > 0) {
      // Get closest candidate
      candidates.sort((a, b) => a.distance - b.distance);
      const current = candidates.shift()!;

      // Check termination condition
      const worstResult = results.length > 0
        ? Math.max(...results.map((r) => r.distance))
        : Infinity;
      if (current.distance > worstResult && results.length >= ef) {
        break;
      }

      // Explore neighbors
      const node = this.nodes.get(current.id);
      if (!node) continue;

      const connections = node.connections.get(level);
      if (!connections) continue;

      for (const neighborId of connections) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const distance = this.distance(query, neighborNode.vector);

        if (results.length < ef || distance < worstResult) {
          candidates.push({ id: neighborId, distance });
          results.push({ id: neighborId, distance });

          // Keep results bounded
          if (results.length > ef) {
            results.sort((a, b) => a.distance - b.distance);
            results.pop();
          }
        }
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * OPTIMIZED searchLayer using heap-based priority queues
   * Performance: O(log n) per operation vs O(n log n) for Array.sort()
   * Expected speedup: 3-5x for large result sets
   */
  private searchLayerOptimized(
    query: Float32Array,
    normalizedQuery: Float32Array | null,
    entryPoint: string,
    ef: number,
    level: number
  ): Array<{ id: string; distance: number }> {
    const visited = new Set<string>([entryPoint]);

    // Min-heap for candidates (closest first for expansion)
    const candidates = new BinaryMinHeap<string>();

    // Max-heap for results (bounded size, tracks worst distance efficiently)
    const results = new BinaryMaxHeap<string>(ef);

    const entryNode = this.nodes.get(entryPoint)!;
    const entryDist = this.distanceOptimized(query, normalizedQuery, entryNode);

    candidates.insert(entryPoint, entryDist);
    results.insert(entryPoint, entryDist);

    while (!candidates.isEmpty()) {
      // Get closest candidate - O(log n)
      const currentDist = candidates.peekPriority()!;
      const currentId = candidates.extractMin()!;

      // Check termination: if closest candidate is worse than worst result, stop
      const worstResultDist = results.peekMaxPriority();
      if (currentDist > worstResultDist && results.size >= ef) {
        break;
      }

      // Explore neighbors
      const node = this.nodes.get(currentId);
      if (!node) continue;

      const connections = node.connections.get(level);
      if (!connections) continue;

      for (const neighborId of connections) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const distance = this.distanceOptimized(query, normalizedQuery, neighborNode);

        // Only add if within threshold or results not full
        if (results.size < ef || distance < worstResultDist) {
          candidates.insert(neighborId, distance);
          // Max-heap handles size bounding automatically - O(log n)
          results.insert(neighborId, distance);
        }
      }
    }

    // Return sorted results
    return results.toSortedArray().map(({ item, priority }) => ({
      id: item,
      distance: priority,
    }));
  }

  private selectNeighbors(
    nodeId: string,
    query: Float32Array,
    candidates: Array<{ id: string; distance: number }>,
    M: number
  ): Array<{ id: string; distance: number }> {
    // Simple selection: take M closest
    return candidates
      .filter((c) => c.id !== nodeId)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, M);
  }

  private pruneConnections(node: HNSWNode, level: number, maxConnections: number): void {
    const connections = node.connections.get(level);
    if (!connections || connections.size <= maxConnections) return;

    // Calculate distances to all connections
    const distances: Array<{ id: string; distance: number }> = [];
    for (const connId of connections) {
      const connNode = this.nodes.get(connId);
      if (connNode) {
        distances.push({
          id: connId,
          distance: this.distance(node.vector, connNode.vector),
        });
      }
    }

    // Keep only the closest ones
    distances.sort((a, b) => a.distance - b.distance);
    const toKeep = new Set(distances.slice(0, maxConnections).map((d) => d.id));

    // Remove excess connections
    for (const connId of connections) {
      if (!toKeep.has(connId)) {
        connections.delete(connId);
        this.nodes.get(connId)?.connections.get(level)?.delete(node.id);
      }
    }
  }

  private distance(a: Float32Array, b: Float32Array): number {
    switch (this.config.metric) {
      case 'cosine':
        return this.cosineDistance(a, b);
      case 'euclidean':
        return this.euclideanDistance(a, b);
      case 'dot':
        return this.dotProductDistance(a, b);
      case 'manhattan':
        return this.manhattanDistance(a, b);
      default:
        return this.cosineDistance(a, b);
    }
  }

  private cosineDistance(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return 1 - similarity; // Convert to distance
  }

  /**
   * OPTIMIZED: Cosine distance using pre-normalized vectors
   * Only requires dot product (no sqrt operations)
   * Performance: O(n) with ~2x speedup over standard cosine
   */
  private cosineDistanceNormalized(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    // For normalized vectors: cosine_similarity = dot_product
    // Return distance (1 - similarity)
    return 1 - dotProduct;
  }

  /**
   * Normalize a vector to unit length for O(1) cosine similarity
   */
  private normalizeVector(vector: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm === 0) {
      return vector; // Return as-is if zero vector
    }

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / norm;
    }
    return normalized;
  }

  /**
   * OPTIMIZED distance calculation that uses pre-normalized vectors when available
   */
  private distanceOptimized(
    query: Float32Array,
    normalizedQuery: Float32Array | null,
    node: HNSWNode
  ): number {
    // Use optimized path for cosine with pre-normalized vectors
    if (
      this.config.metric === 'cosine' &&
      normalizedQuery !== null &&
      node.normalizedVector !== null
    ) {
      return this.cosineDistanceNormalized(normalizedQuery, node.normalizedVector);
    }

    // Fall back to standard distance calculation
    return this.distance(query, node.vector);
  }

  private euclideanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  private dotProductDistance(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    // Negative because higher dot product = more similar
    return -dotProduct;
  }

  private manhattanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.abs(a[i] - b[i]);
    }
    return sum;
  }
}

/**
 * Quantizer for vector compression
 */

export default HNSWIndex;
