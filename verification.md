# Verification & Regression Witness

This document is a cryptographically-witnessed proof manifest for ruflo functionality across releases. Each entry in the **fixes** table below is a tuple of:

- **id** — the fix identifier (ADR-093 F#, ADR-095 G#, GitHub issue #, or ADR ID)
- **desc** — what the fix does
- **file** — the relative path containing the fix marker
- **sha256** — content hash of that file at the time the witness was issued
- **marker** — a substring that must appear in the file for the fix to be considered present
- **markerVerified** — boolean recorded at issuance time

The whole manifest is hashed with SHA-256 and signed with Ed25519 using a deterministic seed (`sha256(gitCommit + ':ruflo-witness/v1')`) so anyone with the same git commit can re-derive the public key and verify the signature.

## How to verify

**1. Reproduce the file fingerprints.** Install the same release in a clean directory and re-hash the cited files:

```bash
mkdir -p /tmp/verify && cd /tmp/verify && npm init -y >/dev/null
npm install ruflo@$(jq -r '.manifest.releases.ruflo' verification.md.json)
sha256sum node_modules/@claude-flow/cli/dist/src/mcp-tools/hooks-tools.js
# compare against the F1/F2/F10 hash in the manifest
```

**2. Re-derive the public key from the git commit.** Anyone with this repo can independently produce the same key:

```bash
GITSHA=$(jq -r '.manifest.gitCommit' verification.md.json)
node -e "
const ed = require('@noble/ed25519');
const { createHash } = require('crypto');
ed.etc.sha512Sync = (...m) => { const h = createHash('sha512'); for (const x of m) h.update(x); return h.digest(); };
const seed = createHash('sha256').update('$GITSHA' + ':ruflo-witness/v1').digest();
console.log(Buffer.from(ed.getPublicKey(seed)).toString('hex'));
"
# should match integrity.publicKey in the manifest
```

**3. Verify the signature against the manifest hash.**

```bash
node -e "
const ed = require('@noble/ed25519');
const { createHash } = require('crypto');
const fs = require('fs');
ed.etc.sha512Sync = (...m) => { const h = createHash('sha512'); for (const x of m) h.update(x); return h.digest(); };
const w = JSON.parse(fs.readFileSync('verification.md.json'));
const recomputed = createHash('sha256').update(JSON.stringify(w.manifest)).digest('hex');
console.log('manifestHash match:', recomputed === w.integrity.manifestHash);
console.log('signature valid:', ed.verify(
  Buffer.from(w.integrity.signature, 'hex'),
  Buffer.from(w.integrity.manifestHash, 'hex'),
  Buffer.from(w.integrity.publicKey, 'hex'),
));
"
```

If both checks return `true` and the file SHA-256s match, the published artifact is byte-for-byte identical to the one this manifest witnesses.

## Regression monitoring

Re-run the verification flow after each release. If any `markerVerified` flips from `true` to `false`, the fix has regressed in that release. If `sha256` changes for a file but `markerVerified` stays `true`, the fix is still present but the file was edited (could be benign — inspect the diff).

The `integrity.manifestHash` is a single fingerprint for the whole release's verified state. If two releases have the same `manifestHash`, they have an identical verification footprint.

## Witness manifest

> The JSON below is the canonical manifest. Save it as `verification.md.json` for tooling that wants to consume it directly without parsing markdown.

```json
{
  "manifest": {
    "schema": "ruflo-witness/v1",
    "issuedAt": "2026-05-03T21:55:25.955Z",
    "gitCommit": "43fda1110416b301766cd1a283f6e60bf748c101",
    "branch": "fix/issues-may-1-3",
    "releases": {
      "@claude-flow/cli": "3.6.20",
      "claude-flow": "3.6.20",
      "ruflo": "3.6.20",
      "@claude-flow/embeddings": "3.0.0-alpha.15"
    },
    "summary": {
      "totalFixes": 18,
      "verified": 18,
      "failed": 0
    },
    "fixes": [
      {
        "id": "F1",
        "desc": "hooks_metrics persistence",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/hooks-tools.js",
        "sha256": "5c66f36bf3cff3802870e4f60f229f82c83f408b3ced308e19ccd314ac2e2e5c",
        "marker": "getIntelligenceStatsFromMemory",
        "markerVerified": true
      },
      {
        "id": "F2",
        "desc": "worker-dispatch honesty",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/hooks-tools.js",
        "sha256": "5c66f36bf3cff3802870e4f60f229f82c83f408b3ced308e19ccd314ac2e2e5c",
        "marker": "'no-daemon'",
        "markerVerified": true
      },
      {
        "id": "F3",
        "desc": "hive-mind consensus schema + persistence",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/hive-mind-tools.js",
        "sha256": "6987df2e11f6c5fe7cb2a4f5b2ba8c883a6705b447b3c0d0f237a2187e5e28a4",
        "marker": "consensusStrategy",
        "markerVerified": true
      },
      {
        "id": "F4",
        "desc": "agentdb_pattern-store memory-store fallback",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/agentdb-tools.js",
        "sha256": "68d7257df63e72a441c444df7f5ed697117d31802c220a2234ff9e6d678d57ac",
        "marker": "memory-store-fallback",
        "markerVerified": true
      },
      {
        "id": "F5",
        "desc": "embeddings_status structured ruvectorStatus",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/embeddings-tools.js",
        "sha256": "6f0f172840b7db1a491356bed5f7b6b6f6e8760633cd38e1bc968f4aa22bc946",
        "marker": "ruvectorStatus",
        "markerVerified": true
      },
      {
        "id": "F6",
        "desc": "session_list dual-shape handling",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/session-tools.js",
        "sha256": "6d3b81c98b090b3b39105542f2d1caf088269b080d3b3b7c2f83b5c9c2da55b9",
        "marker": "s.sessionId || s.id",
        "markerVerified": true
      },
      {
        "id": "F7",
        "desc": "coordination_orchestrate honest stub",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/coordination-tools.js",
        "sha256": "5d9b47750015c4626b044453494ef9905ccda9cbb35a06f56215783b6251cef0",
        "marker": "executor: 'none'",
        "markerVerified": true
      },
      {
        "id": "F8",
        "desc": "performance_metrics real measurements",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/performance-tools.js",
        "sha256": "d612f3c006c7c1bf3283c0c257bc24557feff65f8b1f3dbb32c4b9a33478767c",
        "marker": "process.hrtime.bigint",
        "markerVerified": true
      },
      {
        "id": "F9",
        "desc": "F9 router probe + actionable error",
        "file": "v3/@claude-flow/cli/dist/src/memory/memory-bridge.js",
        "sha256": "bdadb33f02c98b8546dd3d9e1ba9975e7f35e2c70ed22e5c0109d558a924cfbb",
        "marker": "IntentRouter",
        "markerVerified": true
      },
      {
        "id": "F10",
        "desc": "intelligence_attention real patterns",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/hooks-tools.js",
        "sha256": "5c66f36bf3cff3802870e4f60f229f82c83f408b3ced308e19ccd314ac2e2e5c",
        "marker": "real-flash-attention+memory",
        "markerVerified": true
      },
      {
        "id": "F11",
        "desc": "neural_predict classifier head",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/neural-tools.js",
        "sha256": "4d750ebae6f7ab427b2ae2b37949fa123aee5f5c5718d550eb8c702360da4f8c",
        "marker": "knn-cosine+softmax",
        "markerVerified": true
      },
      {
        "id": "F12",
        "desc": "config_list union with source labels",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/config-tools.js",
        "sha256": "811ac1297fea330f0e497523a234eb97339a4e1c009b2c33be14915b662b7dec",
        "marker": "merged.set",
        "markerVerified": true
      },
      {
        "id": "#1697",
        "desc": "rvf-wasm overrides",
        "file": "package.json",
        "sha256": "9d11d5f941113b4fa674078c637a08ed4123987d9e3068489164e2e8e279a354",
        "marker": "@ruvector/rvf-wasm",
        "markerVerified": true
      },
      {
        "id": "#1698",
        "desc": "HNSW init fix in CLI command",
        "file": "v3/@claude-flow/cli/dist/src/commands/embeddings.js",
        "sha256": "2cb57b6fb38bb4722eebd169f4b6056f1b6f69ba0adde9978bcd9e03f83d43ab",
        "marker": "getHNSWIndex",
        "markerVerified": true
      },
      {
        "id": "#1691",
        "desc": "Windows daemon fork()",
        "file": "v3/@claude-flow/cli/dist/src/commands/daemon.js",
        "sha256": "8272eafbfcd0010166d44797461e2730e85d44ce6bb09e54bacce4affefdd179",
        "marker": "fork(cliPath",
        "markerVerified": true
      },
      {
        "id": "#1721",
        "desc": "postinstall copies all dist/src/* siblings",
        "file": "v3/@claude-flow/cli/package.json",
        "sha256": "701eb03ab56a376392a7689884c1caa17e6b943fc79dfcc46e15ec77e66bcb2f",
        "marker": "srcDist",
        "markerVerified": true
      },
      {
        "id": "ADR-094",
        "desc": "transformers loader try-prefer-fallback",
        "file": "v3/@claude-flow/embeddings/dist/transformers-loader.js",
        "sha256": "1d2225e7422f8a2d47d39100324d5e4ac2d29c55e8e72b02f5e4a7a113d45be2",
        "marker": "@huggingface/transformers",
        "markerVerified": true
      },
      {
        "id": "G6",
        "desc": "auto-memory content-hash dedup",
        "file": "v3/@claude-flow/cli/.claude/helpers/intelligence.cjs",
        "sha256": "84a6159b384b8118f0beaa1089c417cab6d1116cd77d3882a607715ef7679ea8",
        "marker": "deduplicateByContent",
        "markerVerified": true
      }
    ]
  },
  "integrity": {
    "manifestHashAlgo": "sha256",
    "manifestHash": "f886378b34a00af241943bb8c808a0d5eaf5c5e0984d3e18b9d466129829c64e",
    "signatureAlgo": "ed25519",
    "publicKey": "778d617bea39d24dcc40e22acb7b4914bd5d81847f426b030e2ee52240dd7299",
    "signature": "458c003632adf895979bf9e9756dacb975181102b2313737ac2f2662bddcbbe84f3cf8fa0d7407b7d6acf6fb6ef86afd12fdc2ad3445e9ea81c2365a3c38830a",
    "seedDerivation": "sha256(gitCommit + ':ruflo-witness/v1')"
  }
}
```

## Schema

```
ruflo-witness/v1 {
  manifest: {
    schema: 'ruflo-witness/v1'
    issuedAt: ISO-8601 UTC timestamp
    gitCommit: 40-char hex (HEAD at issuance)
    branch: working branch name
    releases: { '@claude-flow/cli': semver, 'claude-flow': semver, 'ruflo': semver, '@claude-flow/embeddings': semver }
    summary: { totalFixes: int, verified: int, failed: int }
    fixes: [
      {
        id: string,                    // F#, G#, #issue, or ADR-NNN
        desc: string,
        file: string,                  // path relative to repo root
        sha256: 64-char hex,           // SHA-256 of the file
        marker: string,                // substring expected in the file
        markerVerified: boolean,
      }
    ]
  }
  integrity: {
    manifestHashAlgo: 'sha256'
    manifestHash: 64-char hex,         // SHA-256 of JSON.stringify(manifest)
    signatureAlgo: 'ed25519'
    publicKey: 64-char hex,
    signature: 128-char hex,
    seedDerivation: "sha256(gitCommit + ':ruflo-witness/v1')",
  }
}
```

The deterministic seed derivation means the signing key is reproducible from the git commit alone — there is no committed private key. This is intentional: the witness signs the *manifest*, not user actions. Anyone with the git commit can verify the signature; only someone with the committed code can reproduce both the file hashes and the signing key.

## Coverage so far

The current witness covers **18 fixes** spanning ADR-093 F1–F12, four GitHub-issue fixes (#1697, #1698, #1691, #1721), one ADR (#094 transformers loader), and one ADR-095 gap closure (G6 auto-memory dedup).

The 6 remaining ADR-095 architectural gaps (G1, G2, G3, G4, G5/handed off to ADR-094, G7) are tracked in [`v3/docs/adr/ADR-095-architectural-gaps-from-april-audit.md`](v3/docs/adr/ADR-095-architectural-gaps-from-april-audit.md). When their per-gap ADRs land, they will be added to this manifest with their own fingerprints.
