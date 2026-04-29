/**
 * DiscoveryService Tests
 *
 * Validates peer management (add, remove, discover), duplicate rejection,
 * and manifest publication with signed capabilities.
 *
 * London School TDD: all dependencies are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Types expected from the not-yet-implemented DiscoveryService ---

interface PeerInfo {
  peerId: string;
  endpoint: string;
  publicKey: string;
  capabilities: string[];
  addedAt: number;
}

interface Manifest {
  nodeId: string;
  publicKey: string;
  capabilities: string[];
  version: string;
  timestamp: string;
  signature: string;
}

interface IDiscoveryService {
  addStaticPeer(peer: Omit<PeerInfo, 'addedAt'>): void;
  removePeer(peerId: string): boolean;
  discoverPeers(): PeerInfo[];
  getPeer(peerId: string): PeerInfo | undefined;
  publishManifest(nodeId: string, signingKey: string): Manifest;
}

// --- Mock implementation matching ADR-078 spec ---

function createDiscoveryService(
  capabilities: string[] = ['discovery', 'send', 'receive'],
  publicKey: string = 'mock-public-key-abc123',
): IDiscoveryService {
  const peers = new Map<string, PeerInfo>();

  return {
    addStaticPeer(peer: Omit<PeerInfo, 'addedAt'>): void {
      // Check for duplicate endpoint
      for (const existing of peers.values()) {
        if (existing.endpoint === peer.endpoint) {
          throw new Error(`Peer with endpoint ${peer.endpoint} already exists`);
        }
      }
      if (peers.has(peer.peerId)) {
        throw new Error(`Peer ${peer.peerId} already exists`);
      }
      peers.set(peer.peerId, { ...peer, addedAt: Date.now() });
    },

    removePeer(peerId: string): boolean {
      return peers.delete(peerId);
    },

    discoverPeers(): PeerInfo[] {
      return Array.from(peers.values());
    },

    getPeer(peerId: string): PeerInfo | undefined {
      return peers.get(peerId);
    },

    publishManifest(nodeId: string, signingKey: string): Manifest {
      const timestamp = new Date().toISOString();
      const data = `${nodeId}:${publicKey}:${capabilities.join(',')}:${timestamp}`;
      // Simple signing mock (in production, use ECDSA or similar)
      const signature = `sig_${Buffer.from(data + ':' + signingKey).toString('base64url')}`;

      return {
        nodeId,
        publicKey,
        capabilities,
        version: '1.0.0',
        timestamp,
        signature,
      };
    },
  };
}

describe('DiscoveryService', () => {
  let service: IDiscoveryService;

  beforeEach(() => {
    service = createDiscoveryService();
  });

  describe('addStaticPeer', () => {
    it('should add a peer to the known peers list', () => {
      service.addStaticPeer({
        peerId: 'peer-1',
        endpoint: 'https://peer1.example.com:8443',
        publicKey: 'pk-peer-1',
        capabilities: ['discovery', 'send'],
      });
      const peers = service.discoverPeers();
      expect(peers).toHaveLength(1);
      expect(peers[0].peerId).toBe('peer-1');
    });

    it('should store the endpoint correctly', () => {
      service.addStaticPeer({
        peerId: 'peer-1',
        endpoint: 'https://peer1.example.com:8443',
        publicKey: 'pk-peer-1',
        capabilities: [],
      });
      const peer = service.getPeer('peer-1');
      expect(peer?.endpoint).toBe('https://peer1.example.com:8443');
    });

    it('should store the public key', () => {
      service.addStaticPeer({
        peerId: 'peer-1',
        endpoint: 'https://peer1.example.com:8443',
        publicKey: 'pk-peer-1',
        capabilities: [],
      });
      const peer = service.getPeer('peer-1');
      expect(peer?.publicKey).toBe('pk-peer-1');
    });

    it('should store capabilities', () => {
      service.addStaticPeer({
        peerId: 'peer-1',
        endpoint: 'https://peer1.example.com:8443',
        publicKey: 'pk-peer-1',
        capabilities: ['discovery', 'send', 'receive'],
      });
      const peer = service.getPeer('peer-1');
      expect(peer?.capabilities).toEqual(['discovery', 'send', 'receive']);
    });

    it('should record the addedAt timestamp', () => {
      const before = Date.now();
      service.addStaticPeer({
        peerId: 'peer-1',
        endpoint: 'https://peer1.example.com:8443',
        publicKey: 'pk-peer-1',
        capabilities: [],
      });
      const after = Date.now();
      const peer = service.getPeer('peer-1');
      expect(peer?.addedAt).toBeGreaterThanOrEqual(before);
      expect(peer?.addedAt).toBeLessThanOrEqual(after);
    });

    it('should reject duplicate peer IDs', () => {
      service.addStaticPeer({
        peerId: 'peer-1',
        endpoint: 'https://peer1.example.com:8443',
        publicKey: 'pk-peer-1',
        capabilities: [],
      });
      expect(() =>
        service.addStaticPeer({
          peerId: 'peer-1',
          endpoint: 'https://peer1-alt.example.com:8443',
          publicKey: 'pk-peer-1-alt',
          capabilities: [],
        })
      ).toThrow();
    });

    it('should reject duplicate endpoints', () => {
      service.addStaticPeer({
        peerId: 'peer-1',
        endpoint: 'https://shared.example.com:8443',
        publicKey: 'pk-peer-1',
        capabilities: [],
      });
      expect(() =>
        service.addStaticPeer({
          peerId: 'peer-2',
          endpoint: 'https://shared.example.com:8443',
          publicKey: 'pk-peer-2',
          capabilities: [],
        })
      ).toThrow(/already exists/);
    });

    it('should allow adding multiple peers with different endpoints', () => {
      service.addStaticPeer({
        peerId: 'peer-1',
        endpoint: 'https://peer1.example.com:8443',
        publicKey: 'pk-1',
        capabilities: [],
      });
      service.addStaticPeer({
        peerId: 'peer-2',
        endpoint: 'https://peer2.example.com:8443',
        publicKey: 'pk-2',
        capabilities: [],
      });
      expect(service.discoverPeers()).toHaveLength(2);
    });
  });

  describe('removePeer', () => {
    it('should remove a known peer by ID', () => {
      service.addStaticPeer({
        peerId: 'peer-1',
        endpoint: 'https://peer1.example.com:8443',
        publicKey: 'pk-1',
        capabilities: [],
      });
      const removed = service.removePeer('peer-1');
      expect(removed).toBe(true);
      expect(service.discoverPeers()).toHaveLength(0);
    });

    it('should return false when removing a non-existent peer', () => {
      const removed = service.removePeer('non-existent');
      expect(removed).toBe(false);
    });

    it('should only remove the specified peer, not others', () => {
      service.addStaticPeer({ peerId: 'peer-1', endpoint: 'https://p1.com', publicKey: 'pk1', capabilities: [] });
      service.addStaticPeer({ peerId: 'peer-2', endpoint: 'https://p2.com', publicKey: 'pk2', capabilities: [] });
      service.removePeer('peer-1');
      const peers = service.discoverPeers();
      expect(peers).toHaveLength(1);
      expect(peers[0].peerId).toBe('peer-2');
    });
  });

  describe('discoverPeers', () => {
    it('should return an empty array when no peers are added', () => {
      expect(service.discoverPeers()).toEqual([]);
    });

    it('should return all added peers', () => {
      service.addStaticPeer({ peerId: 'p1', endpoint: 'https://p1.com', publicKey: 'pk1', capabilities: ['a'] });
      service.addStaticPeer({ peerId: 'p2', endpoint: 'https://p2.com', publicKey: 'pk2', capabilities: ['b'] });
      service.addStaticPeer({ peerId: 'p3', endpoint: 'https://p3.com', publicKey: 'pk3', capabilities: ['c'] });
      const peers = service.discoverPeers();
      expect(peers).toHaveLength(3);
      const ids = peers.map((p) => p.peerId);
      expect(ids).toContain('p1');
      expect(ids).toContain('p2');
      expect(ids).toContain('p3');
    });
  });

  describe('publishManifest', () => {
    it('should generate a manifest with nodeId', () => {
      const manifest = service.publishManifest('my-node', 'signing-key');
      expect(manifest.nodeId).toBe('my-node');
    });

    it('should include the public key in the manifest', () => {
      const manifest = service.publishManifest('my-node', 'signing-key');
      expect(manifest.publicKey).toBe('mock-public-key-abc123');
    });

    it('should include capabilities in the manifest', () => {
      const manifest = service.publishManifest('my-node', 'signing-key');
      expect(manifest.capabilities).toEqual(['discovery', 'send', 'receive']);
    });

    it('should include a version string', () => {
      const manifest = service.publishManifest('my-node', 'signing-key');
      expect(manifest.version).toBeDefined();
      expect(manifest.version.length).toBeGreaterThan(0);
    });

    it('should include an ISO 8601 timestamp', () => {
      const manifest = service.publishManifest('my-node', 'signing-key');
      const iso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(manifest.timestamp).toMatch(iso8601);
    });

    it('should include a non-empty signature', () => {
      const manifest = service.publishManifest('my-node', 'signing-key');
      expect(manifest.signature).toBeDefined();
      expect(manifest.signature.length).toBeGreaterThan(0);
    });

    it('should produce different signatures for different signing keys', () => {
      const m1 = service.publishManifest('my-node', 'key-1');
      const m2 = service.publishManifest('my-node', 'key-2');
      expect(m1.signature).not.toBe(m2.signature);
    });

    it('should reflect custom capabilities provided at construction', () => {
      const customService = createDiscoveryService(['full-memory', 'remote-spawn'], 'custom-pk');
      const manifest = customService.publishManifest('node-x', 'key');
      expect(manifest.capabilities).toEqual(['full-memory', 'remote-spawn']);
      expect(manifest.publicKey).toBe('custom-pk');
    });
  });
});
