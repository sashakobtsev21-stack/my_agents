# ADR-021: Transfer Hook - IPFS-Based Pattern Sharing System

**Status:** Proposed
**Date:** 2026-01-08
**Author:** System Architecture Designer
**Version:** 1.0.0

## Context

Claude Flow V3's neural learning system generates valuable patterns, trajectories, and learned behaviors during operation. These patterns are currently isolated to individual installations, preventing knowledge sharing across:

1. **Team collaboration** - Developers can't share optimized routing patterns
2. **Organizational standards** - Companies can't distribute approved patterns
3. **Community learning** - Open-source pattern marketplace impossible
4. **Migration scenarios** - Moving to new machines loses learning

Additionally, learned patterns may contain:
- **PII** - Names, emails, file paths with usernames
- **Proprietary code patterns** - Trade secrets, internal APIs
- **Sensitive metadata** - Project structures, security configurations

### RuVector IPFS Capabilities

RuVector provides decentralized storage via IPFS (InterPlanetary File System):
- Content-addressable storage (CID-based)
- Immutable pattern versioning
- Peer-to-peer distribution
- Optional pinning services for persistence

## Decision

Implement a **Transfer Hook System** with:

1. **Export/Import Commands** - Serialize and deserialize learning models
2. **Anonymization Pipeline** - Multi-level PII redaction and obfuscation
3. **IPFS Integration** - Optional decentralized pattern sharing via RuVector
4. **Pattern Marketplace** - Community plugin store for shared patterns

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Transfer Hook System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   Export    │───▶│ Anonymization│───▶│  Serialization   │   │
│  │   Pipeline  │    │   Pipeline   │    │  (CBOR/JSON)     │   │
│  └─────────────┘    └──────────────┘    └────────┬─────────┘   │
│                                                   │              │
│                                                   ▼              │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   Import    │◀───│ Validation & │◀───│   Storage        │   │
│  │   Pipeline  │    │ Verification │    │  (File/IPFS)     │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## CLI Command Interface

### Export Command

```bash
# Basic export to file
npx claude-flow@v3alpha hooks transfer export \
  --output ./patterns/my-patterns.cfp \
  --format cbor

# Export with anonymization
npx claude-flow@v3alpha hooks transfer export \
  --output ./patterns/team-patterns.cfp \
  --anonymize standard \
  --redact-pii true \
  --strip-paths true

# Export to IPFS
npx claude-flow@v3alpha hooks transfer export \
  --to-ipfs \
  --anonymize strict \
  --pin true \
  --gateway https://w3s.link

# Export specific pattern types
npx claude-flow@v3alpha hooks transfer export \
  --types routing,complexity,coverage \
  --min-confidence 0.7 \
  --since "2026-01-01"
```

### Import Command

```bash
# Import from file
npx claude-flow@v3alpha hooks transfer import \
  --input ./patterns/team-patterns.cfp

# Import from IPFS
npx claude-flow@v3alpha hooks transfer import \
  --from-ipfs bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  --verify-signature true

# Import from Pattern Store
npx claude-flow@v3alpha hooks transfer import \
  --from-store typescript-routing-patterns \
  --version latest

# Import with merge strategy
npx claude-flow@v3alpha hooks transfer import \
  --input ./patterns.cfp \
  --strategy merge \
  --conflict-resolution highest-confidence
```

### Pattern Store Commands

```bash
# Browse pattern store
npx claude-flow@v3alpha hooks transfer store list \
  --category routing \
  --language typescript \
  --min-downloads 100

# Publish to store
npx claude-flow@v3alpha hooks transfer store publish \
  --input ./patterns.cfp \
  --name "react-component-patterns" \
  --description "Optimized routing for React projects" \
  --license MIT \
  --anonymize strict

# Download from store
npx claude-flow@v3alpha hooks transfer store download \
  --name "enterprise-security-patterns" \
  --output ./patterns/
```

---

## Anonymization Levels

### Level 1: Minimal (`--anonymize minimal`)

Preserves most data, only removes obvious PII:

```typescript
interface MinimalAnonymization {
  // Redacted
  usernames: true;           // Replace with 'user_XXXX'
  emails: true;              // Replace with 'user@example.com'

  // Preserved
  filePaths: false;          // Keep full paths
  functionNames: false;      // Keep original names
  projectStructure: false;   // Keep directory layout
  timestamps: false;         // Keep exact times
}
```

### Level 2: Standard (`--anonymize standard`)

Balanced privacy/utility tradeoff:

```typescript
interface StandardAnonymization {
  // Redacted
  usernames: true;
  emails: true;
  absolutePaths: true;       // Convert to relative
  ipAddresses: true;
  apiKeys: true;             // Detect and redact

  // Generalized
  timestamps: 'relative';    // Convert to relative offsets
  filePaths: 'hashed';       // Hash file names, keep structure

  // Preserved
  functionNames: false;
  codePatterns: false;
}
```

### Level 3: Strict (`--anonymize strict`)

Maximum privacy, suitable for public sharing:

```typescript
interface StrictAnonymization {
  // Fully Redacted
  usernames: true;
  emails: true;
  absolutePaths: true;
  ipAddresses: true;
  apiKeys: true;
  hostnames: true;
  projectNames: true;
  customIdentifiers: true;   // Regex-based custom patterns

  // Generalized
  timestamps: 'bucketed';    // 1-hour buckets
  filePaths: 'normalized';   // Canonical paths only
  functionNames: 'hashed';   // SHA256 prefix

  // Differential Privacy
  noiseInjection: true;      // Add Laplacian noise to numeric values
  kAnonymity: 5;             // Ensure k=5 anonymity
}
```

### Level 4: Paranoid (`--anonymize paranoid`)

Cryptographic protection for sensitive environments:

```typescript
interface ParanoidAnonymization {
  // Everything from strict, plus:
  encryptPatterns: true;          // AES-256-GCM encryption
  homomorphicStats: true;         // Preserve aggregations only
  federatedMode: true;            // Never export raw patterns
  zeroKnowledgeProofs: true;      // Verifiable without revealing
}
```

---

## PII Detection & Redaction

### Built-in Detectors

```typescript
interface PIIDetectors {
  // Personal Identifiers
  emails: RegExp[];              // RFC 5322 compliant
  phoneNumbers: RegExp[];        // International formats
  socialSecurityNumbers: RegExp[];
  creditCards: RegExp[];         // Luhn validation

  // Digital Identifiers
  ipAddresses: RegExp[];         // IPv4 and IPv6
  macAddresses: RegExp[];
  jwtTokens: RegExp[];
  apiKeys: RegExp[];             // Common patterns (sk-, pk-, etc.)

  // File System
  homeDirectories: RegExp[];     // /Users/*, /home/*, C:\Users\*
  tempFiles: RegExp[];           // Temporary file patterns

  // Custom Patterns
  customPatterns: CustomDetector[];
}

interface CustomDetector {
  name: string;
  pattern: RegExp;
  replacement: string | ((match: string) => string);
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

### Redaction Strategies

```typescript
type RedactionStrategy =
  | 'remove'           // Delete entirely
  | 'hash'             // SHA256 with optional salt
  | 'mask'             // Replace with asterisks
  | 'generalize'       // Category replacement
  | 'tokenize'         // Consistent pseudonymization
  | 'differential'     // Differential privacy noise
  ;

interface RedactionConfig {
  emails: {
    strategy: 'tokenize';
    preserveDomain: false;
    format: 'user_{hash}@example.com';
  };
  paths: {
    strategy: 'generalize';
    preserveStructure: true;
    format: '/{category}/{depth}/file.ext';
  };
  timestamps: {
    strategy: 'differential';
    granularity: 'hour';
    noise: 'laplacian';
    epsilon: 0.1;
  };
}
```

---

## Export Format Specification

### Claude Flow Pattern (.cfp) Format

```typescript
interface CFPFormat {
  // Header
  magic: 'CFP1';                    // Magic bytes
  version: SemVer;                  // Format version
  createdAt: ISO8601;
  generatedBy: string;              // Claude Flow version

  // Metadata
  metadata: {
    id: UUID;
    name?: string;
    description?: string;
    author?: AnonymizedAuthor;
    license?: SPDXLicense;
    tags: string[];
    language?: string;              // Primary language
    framework?: string;             // Primary framework
  };

  // Anonymization Record
  anonymization: {
    level: AnonymizationLevel;
    appliedTransforms: Transform[];
    piiRedacted: boolean;
    pathsStripped: boolean;
    timestampsGeneralized: boolean;
    checksum: string;               // SHA256 of original
  };

  // Patterns
  patterns: {
    routing: RoutingPattern[];
    complexity: ComplexityPattern[];
    coverage: CoveragePattern[];
    trajectory: TrajectoryPattern[];
    custom: CustomPattern[];
  };

  // Statistics (differential privacy applied)
  statistics: {
    totalPatterns: number;
    avgConfidence: number;
    patternTypes: Record<string, number>;
    timeRange: { start: string; end: string };
  };

  // Verification
  signature?: {
    algorithm: 'ed25519';
    publicKey: string;
    signature: string;
  };

  // IPFS Metadata (if applicable)
  ipfs?: {
    cid: string;
    pinnedAt: string[];
    gateway: string;
  };
}
```

### Serialization Options

```bash
# CBOR (default) - compact binary format
--format cbor

# JSON - human-readable
--format json

# MessagePack - fast binary
--format msgpack

# Compressed variants
--format cbor.gz
--format cbor.zstd
```

---

## IPFS Integration

### RuVector IPFS Adapter

```typescript
// v3/@claude-flow/cli/src/transfer/ipfs-adapter.ts

import { create as createIpfsClient } from 'ipfs-http-client';

interface IPFSConfig {
  gateway: string;                    // e.g., 'https://w3s.link'
  apiEndpoint?: string;               // For write operations
  pinningService?: PinningService;    // Pinata, Web3.Storage, etc.
  timeout: number;
}

interface PinningService {
  name: 'pinata' | 'web3storage' | 'infura' | 'custom';
  apiKey: string;
  apiSecret?: string;
}

class IPFSPatternStore {
  async upload(
    pattern: CFPFormat,
    options: UploadOptions
  ): Promise<{ cid: string; size: number; gateway: string }>;

  async download(
    cid: string,
    options: DownloadOptions
  ): Promise<CFPFormat>;

  async pin(cid: string, service: PinningService): Promise<void>;
  async unpin(cid: string, service: PinningService): Promise<void>;

  async resolve(name: string): Promise<string>; // IPNS resolution
  async publish(cid: string, key: string): Promise<string>; // IPNS publish
}
```

### IPFS Commands

```bash
# Upload to IPFS with pinning
npx claude-flow@v3alpha hooks transfer ipfs upload \
  --input ./patterns.cfp \
  --pin pinata \
  --name "my-patterns"

# Download from IPFS
npx claude-flow@v3alpha hooks transfer ipfs download \
  --cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  --output ./patterns.cfp

# List pinned patterns
npx claude-flow@v3alpha hooks transfer ipfs list \
  --service pinata

# Publish to IPNS (mutable name)
npx claude-flow@v3alpha hooks transfer ipfs publish \
  --cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  --key my-patterns-key

# Resolve IPNS name
npx claude-flow@v3alpha hooks transfer ipfs resolve \
  --name my-patterns
```

---

## Pattern Marketplace (Plugin Store)

### Store Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Flow Pattern Store                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   Store Index    │    │   IPFS Gateway   │                   │
│  │   (GitHub/API)   │◀──▶│   (Patterns)     │                   │
│  └────────┬─────────┘    └──────────────────┘                   │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     Pattern Registry                      │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  Name             │ CID          │ Downloads │ Rating    │   │
│  │──────────────────────────────────────────────────────────│   │
│  │  react-routing    │ bafybei...   │ 1,234     │ 4.8/5     │   │
│  │  typescript-tdd   │ bafybej...   │ 892       │ 4.6/5     │   │
│  │  security-audit   │ bafybek...   │ 567       │ 4.9/5     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Store Registry Format

```typescript
interface PatternRegistry {
  version: string;
  updatedAt: ISO8601;

  patterns: PatternEntry[];
  categories: Category[];
  authors: Author[];
}

interface PatternEntry {
  id: string;
  name: string;
  description: string;
  version: SemVer;

  // Storage
  cid: string;
  size: number;
  checksum: string;

  // Metadata
  author: string;
  license: SPDXLicense;
  category: string[];
  tags: string[];
  language?: string;
  framework?: string;

  // Stats
  downloads: number;
  rating: number;
  ratingCount: number;

  // Requirements
  minClaudeFlowVersion: SemVer;
  dependencies?: string[];

  // Verification
  verified: boolean;
  signature?: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  subcategories?: Category[];
}
```

### Store Commands

```bash
# Search patterns
npx claude-flow@v3alpha hooks transfer store search \
  --query "react hooks optimization" \
  --category routing \
  --min-rating 4.0

# Get pattern info
npx claude-flow@v3alpha hooks transfer store info \
  --name react-routing-patterns

# Install pattern
npx claude-flow@v3alpha hooks transfer store install \
  --name react-routing-patterns \
  --version ^1.0.0

# Publish pattern
npx claude-flow@v3alpha hooks transfer store publish \
  --input ./patterns.cfp \
  --name my-patterns \
  --category routing \
  --license MIT

# Update published pattern
npx claude-flow@v3alpha hooks transfer store update \
  --name my-patterns \
  --input ./patterns-v2.cfp

# Rate pattern
npx claude-flow@v3alpha hooks transfer store rate \
  --name react-routing-patterns \
  --rating 5 \
  --comment "Excellent for large React projects"
```

---

## Security Considerations

### 1. Pattern Verification

```typescript
interface PatternVerification {
  // Signature verification
  verifySignature(pattern: CFPFormat): Promise<boolean>;

  // Integrity check
  verifyChecksum(pattern: CFPFormat): Promise<boolean>;

  // Malware scanning (basic heuristics)
  scanForMaliciousPatterns(pattern: CFPFormat): Promise<ScanResult>;

  // Source verification
  verifySource(pattern: CFPFormat, trustedSources: string[]): boolean;
}

interface ScanResult {
  safe: boolean;
  warnings: Warning[];
  blockedPatterns?: string[];
}
```

### 2. Import Sandboxing

```typescript
interface ImportSandbox {
  // Isolated pattern evaluation
  evaluatePattern(pattern: Pattern): Promise<EvaluationResult>;

  // Resource limits
  maxPatterns: number;
  maxMemoryMB: number;
  timeoutMs: number;

  // Capability restrictions
  allowNetworkAccess: false;
  allowFileSystemAccess: false;
  allowCodeExecution: false;
}
```

### 3. Trust Levels

```typescript
type TrustLevel =
  | 'verified'      // Signed by Claude Flow team
  | 'community'     // Community verified, high ratings
  | 'unverified'    // No verification
  | 'untrusted'     // Flagged or low trust
  ;

interface TrustPolicy {
  allowUnverified: boolean;
  requireSignature: boolean;
  minRating: number;
  trustedAuthors: string[];
  blockedPatterns: string[];
}
```

---

## Implementation Plan

### Phase 1: Core Export/Import (Week 1)

1. Implement `CFPFormat` serialization
2. Create export command with basic file output
3. Create import command with file input
4. Add minimal anonymization level
5. Unit tests for serialization

### Phase 2: Anonymization Pipeline (Week 2)

1. Implement PII detectors (email, phone, paths)
2. Add standard anonymization level
3. Add strict anonymization level
4. Implement differential privacy for stats
5. Create custom detector configuration

### Phase 3: IPFS Integration (Week 3)

1. Integrate RuVector IPFS adapter
2. Implement upload/download commands
3. Add pinning service support (Pinata, Web3.Storage)
4. Implement IPNS for mutable references
5. Add gateway fallback logic

### Phase 4: Pattern Store (Week 4)

1. Create store registry format
2. Implement store list/search commands
3. Implement store install command
4. Implement store publish command
5. Add rating and verification system

### Phase 5: Security & Polish (Week 5)

1. Implement signature verification
2. Add malware scanning heuristics
3. Create import sandboxing
4. Add trust policies
5. Documentation and examples

---

## File Structure

```
v3/@claude-flow/cli/src/
├── commands/
│   └── transfer.ts              # Main transfer command with subcommands
├── transfer/
│   ├── index.ts                 # Re-exports
│   ├── types.ts                 # TypeScript interfaces
│   ├── export.ts                # Export pipeline
│   ├── import.ts                # Import pipeline
│   ├── anonymization/
│   │   ├── index.ts             # Anonymization orchestrator
│   │   ├── detectors.ts         # PII detectors
│   │   ├── redactors.ts         # Redaction strategies
│   │   ├── differential.ts      # Differential privacy
│   │   └── levels.ts            # Anonymization level configs
│   ├── serialization/
│   │   ├── index.ts             # Format negotiation
│   │   ├── cbor.ts              # CBOR serializer
│   │   ├── json.ts              # JSON serializer
│   │   └── compression.ts       # Compression utilities
│   ├── ipfs/
│   │   ├── index.ts             # IPFS adapter
│   │   ├── upload.ts            # Upload logic
│   │   ├── download.ts          # Download logic
│   │   ├── pinning.ts           # Pinning services
│   │   └── ipns.ts              # IPNS operations
│   ├── store/
│   │   ├── index.ts             # Store client
│   │   ├── registry.ts          # Registry operations
│   │   ├── publish.ts           # Publish logic
│   │   ├── install.ts           # Install logic
│   │   └── search.ts            # Search and discovery
│   └── security/
│       ├── verification.ts      # Signature verification
│       ├── scanning.ts          # Malware scanning
│       ├── sandbox.ts           # Import sandboxing
│       └── trust.ts             # Trust policies
```

---

## Configuration

### claude-flow.config.json

```json
{
  "transfer": {
    "defaultAnonymization": "standard",
    "defaultFormat": "cbor",

    "ipfs": {
      "enabled": true,
      "gateway": "https://w3s.link",
      "pinningService": {
        "name": "pinata",
        "apiKey": "${PINATA_API_KEY}"
      }
    },

    "store": {
      "enabled": true,
      "registryUrl": "https://patterns.claude-flow.dev/registry.json",
      "cacheDir": ".claude-flow/patterns"
    },

    "security": {
      "requireSignature": false,
      "allowUnverified": true,
      "trustedAuthors": [],
      "blockedPatterns": []
    },

    "customDetectors": [
      {
        "name": "internal-api",
        "pattern": "internal\\.company\\.com",
        "replacement": "internal.example.com",
        "severity": "high"
      }
    ]
  }
}
```

---

## Success Metrics

- [ ] Export 1000+ patterns in <5 seconds
- [ ] Import with validation in <3 seconds
- [ ] IPFS upload with pinning in <30 seconds
- [ ] 100% PII detection rate for common patterns
- [ ] Pattern store with 50+ community patterns
- [ ] <1% false positive rate in malware scanning

---

## Consequences

### Positive

1. **Knowledge Sharing** - Teams can share optimized patterns
2. **Community Growth** - Open marketplace for patterns
3. **Privacy Protection** - Multi-level anonymization
4. **Decentralization** - IPFS removes single point of failure
5. **Verification** - Cryptographic signatures ensure integrity

### Negative

1. **Complexity** - Multiple anonymization levels to maintain
2. **Storage Costs** - IPFS pinning requires ongoing payment
3. **Security Surface** - Pattern import is potential attack vector
4. **Version Compatibility** - Pattern format must be stable

### Neutral

1. **Optional Dependency** - IPFS features require RuVector
2. **Configuration Overhead** - Multiple options to configure
3. **Network Dependency** - Store features require connectivity

---

## References

- ADR-017: RuVector Integration Architecture
- ADR-006: Unified Memory Service
- IPFS Documentation: https://docs.ipfs.io
- Differential Privacy: https://desfontain.es/privacy/differential-privacy-awesomeness.html
- Web3.Storage: https://web3.storage/docs/

---

## Appendix: Command Reference

| Command | Description | IPFS Required |
|---------|-------------|---------------|
| `transfer export` | Export patterns to file | No |
| `transfer import` | Import patterns from file | No |
| `transfer ipfs upload` | Upload to IPFS | Yes |
| `transfer ipfs download` | Download from IPFS | Yes |
| `transfer ipfs pin` | Pin to pinning service | Yes |
| `transfer ipfs publish` | Publish to IPNS | Yes |
| `transfer store list` | List store patterns | No |
| `transfer store search` | Search patterns | No |
| `transfer store install` | Install pattern | Optional |
| `transfer store publish` | Publish to store | Yes |
| `transfer store rate` | Rate a pattern | No |

---

**Status:** Proposed
**Next Steps:** Review by security team, then proceed to Phase 1 implementation
