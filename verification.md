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
    "issuedAt": "2026-05-09T00:52:57.167Z",
    "gitCommit": "d4795b75383d5a743de49fc1eb518f887eee606f",
    "branch": "main",
    "releases": {
      "ruflo": "3.7.0-alpha.18",
      "claude-flow": "3.7.0-alpha.18",
      "@claude-flow/cli": "3.7.0-alpha.18",
      "@claude-flow/memory": "3.0.0-alpha.15"
    },
    "summary": {
      "totalFixes": 81,
      "verified": 81,
      "missing": 0
    },
    "fixes": [
      {
        "id": "F1",
        "desc": "hooks_metrics persistence",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/hooks-tools.js",
        "sha256": "4c255b1d1ac66655551d6c199395f3174cde09f3012e5283f26eb402e7961cac",
        "marker": "getIntelligenceStatsFromMemory",
        "markerVerified": true
      },
      {
        "id": "F2",
        "desc": "worker-dispatch honesty",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/hooks-tools.js",
        "sha256": "4c255b1d1ac66655551d6c199395f3174cde09f3012e5283f26eb402e7961cac",
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
        "sha256": "6ca2c3b6d17e39378a6d95b9ef104a4c7e01c321687a4e21fc5ddc599589f91f",
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
        "sha256": "f623493c80bd305bbf9bf426563db5a9ad745817972bc5690c84a1d1b33e92b9",
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
        "sha256": "12ca47650a812c66fb5efbbc3b6cdf527ca74ee787f27c9556514492de9d07cd",
        "marker": "IntentRouter",
        "markerVerified": true
      },
      {
        "id": "F10",
        "desc": "intelligence_attention real patterns",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/hooks-tools.js",
        "sha256": "4c255b1d1ac66655551d6c199395f3174cde09f3012e5283f26eb402e7961cac",
        "marker": "real-flash-attention+memory",
        "markerVerified": true
      },
      {
        "id": "F11",
        "desc": "neural_predict classifier head",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/neural-tools.js",
        "sha256": "7e08b72ac68774af172107f93aba27c5e7254bdb52ba6a8a686da7917fe81e9b",
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
        "sha256": "9c9233e068f02511a4c8c310640fc0d3285b449435df5819afa9cc8ac211ff42",
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
        "sha256": "8fe7b53ad914532474b77cf419b6e64ee60e12562062342e9cf9fd5eee8c8498",
        "marker": "fork(cliPath",
        "markerVerified": true
      },
      {
        "id": "#1721",
        "desc": "postinstall copies all dist/src/* siblings",
        "file": "v3/@claude-flow/cli/package.json",
        "sha256": "b6836a525ba4914a9e9a42116bbdbb56449c3505a203611891e21888cc84ac4b",
        "marker": "postinstall.cjs",
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
        "id": "G1",
        "desc": "agent_execute wires Anthropic Messages API",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/agent-execute-core.js",
        "sha256": "3070ca38954ad68385faf54d4111e7395cf0667a3f4db6607fe1b9b3d84915fa",
        "marker": "callAnthropicMessages",
        "markerVerified": true
      },
      {
        "id": "G3",
        "desc": "workflow runtime task/wait/condition",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/workflow-tools.js",
        "sha256": "b562d739deb768e58bfd21d79cf30c7898a0c9a3d944d8fabebd218b4c4c305e",
        "marker": "executeAgentTask",
        "markerVerified": true
      },
      {
        "id": "G4",
        "desc": "WASM agent prompt routes to Anthropic",
        "file": "v3/@claude-flow/cli/dist/src/ruvector/agent-wasm.js",
        "sha256": "12fce07f6458aff5db210b0ba50104fa9b2dd52c85b5e9071b48c2899451c631",
        "marker": "isEchoStub",
        "markerVerified": true
      },
      {
        "id": "G6",
        "desc": "auto-memory content-hash dedup",
        "file": "v3/@claude-flow/cli/.claude/helpers/intelligence.cjs",
        "sha256": "84a6159b384b8118f0beaa1089c417cab6d1116cd77d3882a607715ef7679ea8",
        "marker": "deduplicateByContent",
        "markerVerified": true
      },
      {
        "id": "G7-gnn",
        "desc": "gnnService activated",
        "file": "v3/@claude-flow/cli/dist/src/memory/memory-bridge.js",
        "sha256": "12ca47650a812c66fb5efbbc3b6cdf527ca74ee787f27c9556514492de9d07cd",
        "marker": "GNNService",
        "markerVerified": true
      },
      {
        "id": "G7-rvf",
        "desc": "rvfOptimizer activated",
        "file": "v3/@claude-flow/cli/dist/src/memory/memory-bridge.js",
        "sha256": "12ca47650a812c66fb5efbbc3b6cdf527ca74ee787f27c9556514492de9d07cd",
        "marker": "RVFOptimizer",
        "markerVerified": true
      },
      {
        "id": "G7-mut",
        "desc": "mutationGuard activated",
        "file": "v3/@claude-flow/cli/dist/src/memory/memory-bridge.js",
        "sha256": "12ca47650a812c66fb5efbbc3b6cdf527ca74ee787f27c9556514492de9d07cd",
        "marker": "MutationGuard",
        "markerVerified": true
      },
      {
        "id": "G7-att",
        "desc": "attestationLog activated with sqlite db",
        "file": "v3/@claude-flow/cli/dist/src/memory/memory-bridge.js",
        "sha256": "12ca47650a812c66fb5efbbc3b6cdf527ca74ee787f27c9556514492de9d07cd",
        "marker": "attestation.db",
        "markerVerified": true
      },
      {
        "id": "G7-gvb",
        "desc": "GuardedVectorBackend wraps mutationGuard+log",
        "file": "v3/@claude-flow/cli/dist/src/memory/memory-bridge.js",
        "sha256": "12ca47650a812c66fb5efbbc3b6cdf527ca74ee787f27c9556514492de9d07cd",
        "marker": "GuardedVectorBackend",
        "markerVerified": true
      },
      {
        "id": "G2",
        "desc": "federation real Ed25519 signing/verification",
        "file": "v3/@claude-flow/plugin-agent-federation/dist/plugin.js",
        "sha256": "881dad4fa9dc19a539c1a46dfe27c77984596cdd05759937909aacf028378acc",
        "marker": "@noble/ed25519",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-agent-tools",
        "desc": "MCP tools (8): agent_execute, agent_health, agent_list, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/agent-tools.js",
        "sha256": "fc907ef704fdb0ab2df56019a8956c230cf270c2b8ef00038914d87b9abf4936",
        "marker": "agent_execute",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-agentdb-tools",
        "desc": "MCP tools (15): agentdb_batch, agentdb_causal-edge, agentdb_consolidate, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/agentdb-tools.js",
        "sha256": "6ca2c3b6d17e39378a6d95b9ef104a4c7e01c321687a4e21fc5ddc599589f91f",
        "marker": "agentdb_batch",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-analyze-tools",
        "desc": "MCP tools (6): analyze_diff, analyze_diff-classify, analyze_diff-reviewers, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/analyze-tools.js",
        "sha256": "34c78f417c395ca9df13e53c35c4d47153818f9d10a019e3e299da150c7329c4",
        "marker": "analyze_diff",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-autopilot-tools",
        "desc": "MCP tools (10): autopilot_config, autopilot_disable, autopilot_enable, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/autopilot-tools.js",
        "sha256": "927df07df0cbe27e8ce0a77ec99529beb62e222649854ef2d1e6d21ad2f446c9",
        "marker": "autopilot_config",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-browser-tools",
        "desc": "MCP tools (23): browser_back, browser_check, browser_click, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/browser-tools.js",
        "sha256": "2c075877030bba617709030487675296a9bfddcfc15ea4c30beedbd7d83cf94a",
        "marker": "browser_back",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-claims-tools",
        "desc": "MCP tools (12): claims_accept-handoff, claims_board, claims_claim, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/claims-tools.js",
        "sha256": "2a00b654e87dd75b9cbb36a0d32e41443c275f5bdf939136c6a397c355f83aa7",
        "marker": "claims_accept-handoff",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-config-tools",
        "desc": "MCP tools (6): config_export, config_get, config_import, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/config-tools.js",
        "sha256": "811ac1297fea330f0e497523a234eb97339a4e1c009b2c33be14915b662b7dec",
        "marker": "config_export",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-coordination-tools",
        "desc": "MCP tools (7): coordination_consensus, coordination_load_balance, coordination_metrics, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/coordination-tools.js",
        "sha256": "5d9b47750015c4626b044453494ef9905ccda9cbb35a06f56215783b6251cef0",
        "marker": "coordination_consensus",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-daa-tools",
        "desc": "MCP tools (8): daa_agent_adapt, daa_agent_create, daa_cognitive_pattern, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/daa-tools.js",
        "sha256": "90828f0744e1769212a079ef01c13c4a7d2f0d77d6036978a18b94134beef14a",
        "marker": "daa_agent_adapt",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-embeddings-tools",
        "desc": "MCP tools (10): embeddings_compare, embeddings_generate, embeddings_hyperbolic, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/embeddings-tools.js",
        "sha256": "6f0f172840b7db1a491356bed5f7b6b6f6e8760633cd38e1bc968f4aa22bc946",
        "marker": "embeddings_compare",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-github-tools",
        "desc": "MCP tools (5): github_issue_track, github_metrics, github_pr_manage, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/github-tools.js",
        "sha256": "5987990581843350f1e01490648dd7b85d8e02bbbce8d9551438219e23bef5ec",
        "marker": "github_issue_track",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-guidance-tools",
        "desc": "MCP tools (5): guidance_capabilities, guidance_discover, guidance_quickref, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/guidance-tools.js",
        "sha256": "c6e4b76e3ea97b9689a8ab7c72f286e653c46e95b59f1f49fe3615f960c1214e",
        "marker": "guidance_capabilities",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-hive-mind-tools",
        "desc": "MCP tools (9): hive-mind_broadcast, hive-mind_consensus, hive-mind_init, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/hive-mind-tools.js",
        "sha256": "6987df2e11f6c5fe7cb2a4f5b2ba8c883a6705b447b3c0d0f237a2187e5e28a4",
        "marker": "hive-mind_broadcast",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-hooks-tools",
        "desc": "MCP tools (62): build-agents, explain, hooks_build-agents, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/hooks-tools.js",
        "sha256": "4c255b1d1ac66655551d6c199395f3174cde09f3012e5283f26eb402e7961cac",
        "marker": "build-agents",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-memory-tools",
        "desc": "MCP tools (10): memory_bridge_status, memory_delete, memory_import_claude, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/memory-tools.js",
        "sha256": "f1478020eb35302b12e44e97cd99b7b357f84ccbcfd5a1dd5f1d58ad66e52743",
        "marker": "memory_bridge_status",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-neural-tools",
        "desc": "MCP tools (6): neural_compress, neural_optimize, neural_patterns, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/neural-tools.js",
        "sha256": "7e08b72ac68774af172107f93aba27c5e7254bdb52ba6a8a686da7917fe81e9b",
        "marker": "neural_compress",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-performance-tools",
        "desc": "MCP tools (6): performance_benchmark, performance_bottleneck, performance_metrics, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/performance-tools.js",
        "sha256": "d612f3c006c7c1bf3283c0c257bc24557feff65f8b1f3dbb32c4b9a33478767c",
        "marker": "performance_benchmark",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-progress-tools",
        "desc": "MCP tools (4): progress_check, progress_summary, progress_sync, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/progress-tools.js",
        "sha256": "6b9c5c1b27687cfaa1f6b47b245a8b25d98d16418221b0a462f1a11b5b090710",
        "marker": "progress_check",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-ruvllm-tools",
        "desc": "MCP tools (10): ruvllm_chat_format, ruvllm_generate_config, ruvllm_hnsw_add, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/ruvllm-tools.js",
        "sha256": "31eb7e4ee42c506685a85008740e83aee2b1d12df6189d4f9bf3f450e0223b37",
        "marker": "ruvllm_chat_format",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-security-tools",
        "desc": "MCP tools (6): aidefence_analyze, aidefence_has_pii, aidefence_is_safe, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/security-tools.js",
        "sha256": "991a2de4462b8a7b29ae26006977fd7b1942bc56fa0e891422d0f28a7e9fff06",
        "marker": "aidefence_analyze",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-session-tools",
        "desc": "MCP tools (5): session_delete, session_info, session_list, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/session-tools.js",
        "sha256": "f623493c80bd305bbf9bf426563db5a9ad745817972bc5690c84a1d1b33e92b9",
        "marker": "session_delete",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-swarm-tools",
        "desc": "MCP tools (9): agents, coordinator, persistence, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/swarm-tools.js",
        "sha256": "fc88476d365dff10b99a1feca048df5aa411b1cc908bd6032dd64a02f7b70a16",
        "marker": "agents",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-system-tools",
        "desc": "MCP tools (15): config, database, disk, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/system-tools.js",
        "sha256": "f4fb8a3a53cb57b71853652a2877c1d337d29306d557cb6fdb993d4e7c2d0c62",
        "marker": "config",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-task-tools",
        "desc": "MCP tools (7): task_assign, task_cancel, task_complete, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/task-tools.js",
        "sha256": "da3443945cfe91c4f253ead1b26c7c7995c1e89c0a6de3afa063b282de4416c8",
        "marker": "task_assign",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-terminal-tools",
        "desc": "MCP tools (5): terminal_close, terminal_create, terminal_execute, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/terminal-tools.js",
        "sha256": "ee54c3dc39f88da154722e1955ed88814e54e653f3b30848e4217eedf2352183",
        "marker": "terminal_close",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-transfer-tools",
        "desc": "MCP tools (11): transfer_detect-pii, transfer_ipfs-resolve, transfer_plugin-featured, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/transfer-tools.js",
        "sha256": "a58b95f7e702f72d1f142511bdf530116586138b90aca0e2833b8817799ed27f",
        "marker": "transfer_detect-pii",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-wasm-agent-tools",
        "desc": "MCP tools (10): wasm_agent_create, wasm_agent_export, wasm_agent_files, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/wasm-agent-tools.js",
        "sha256": "114a996d08963a3524447d80eb4c693a1d235eccd877d8b7163caa8f86bcaafa",
        "marker": "wasm_agent_create",
        "markerVerified": true
      },
      {
        "id": "CAP-MCP-workflow-tools",
        "desc": "MCP tools (10): workflow_cancel, workflow_create, workflow_delete, …",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/workflow-tools.js",
        "sha256": "b562d739deb768e58bfd21d79cf30c7898a0c9a3d944d8fabebd218b4c4c305e",
        "marker": "workflow_cancel",
        "markerVerified": true
      },
      {
        "id": "#1795",
        "desc": "umbrella package missing cli-core dep (ERR_MODULE_NOT_FOUND)",
        "file": "package.json",
        "sha256": "9c9233e068f02511a4c8c310640fc0d3285b449435df5819afa9cc8ac211ff42",
        "marker": "@claude-flow/cli-core",
        "markerVerified": true
      },
      {
        "id": "#1780",
        "desc": "hive-mind --mcp-config variadic prompt slurp (ENAMETOOLONG)",
        "file": "v3/@claude-flow/cli/dist/src/commands/hive-mind.js",
        "sha256": "1d54f3c7589b4e54df60846e29fbe64867f48df5467fc5f44b8bb2fb4b437ad7",
        "marker": "--mcp-config=",
        "markerVerified": true
      },
      {
        "id": "#1791.6",
        "desc": "memory init idempotent when DB exists",
        "file": "v3/@claude-flow/cli/dist/src/memory/memory-initializer.js",
        "sha256": "303808b8731937090f104d076495fbe1be43f7cc09d732c4c11f7073e5068653",
        "marker": "alreadyExists",
        "markerVerified": true
      },
      {
        "id": "#1791.7",
        "desc": "doctor walk-up .git fallback",
        "file": "v3/@claude-flow/cli/dist/src/commands/doctor.js",
        "sha256": "bc9739574092e4fad1c5d402720a0d7f50a23b02e78679eec82d8c883dd80703",
        "marker": "is-inside-work-tree",
        "markerVerified": true
      },
      {
        "id": "#1791.2",
        "desc": "lazy-command pre-load for short flag scoping (also closes #1651)",
        "file": "v3/@claude-flow/cli/dist/src/parser.js",
        "sha256": "381b884d3902a998be261637c13ac4c890e07b165b16437b4eb064c2daaa0381",
        "marker": "isLazyOnly",
        "markerVerified": true
      },
      {
        "id": "#1791.5",
        "desc": "doctor --fix help text clarification",
        "file": "v3/@claude-flow/cli/dist/src/commands/doctor.js",
        "sha256": "bc9739574092e4fad1c5d402720a0d7f50a23b02e78679eec82d8c883dd80703",
        "marker": "Print suggested fix commands",
        "markerVerified": true
      },
      {
        "id": "#1791.4",
        "desc": "subcommand --help renders leaf, not parent",
        "file": "v3/@claude-flow/cli/dist/src/index.js",
        "sha256": "ed6a9e9af820c26e8e40905797617628df8ea396493870779a0bc934abcfa10c",
        "marker": "commandPathOrName",
        "markerVerified": true
      },
      {
        "id": "#1791.1",
        "desc": "hive-mind task re-routed to task_create MCP tool",
        "file": "v3/@claude-flow/cli/dist/src/commands/hive-mind.js",
        "sha256": "1d54f3c7589b4e54df60846e29fbe64867f48df5467fc5f44b8bb2fb4b437ad7",
        "marker": "task_create",
        "markerVerified": true
      },
      {
        "id": "#1791.8",
        "desc": "content-hash dedupe in memory_import_claude --allProjects",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/memory-tools.js",
        "sha256": "f1478020eb35302b12e44e97cd99b7b357f84ccbcfd5a1dd5f1d58ad66e52743",
        "marker": "duplicatesSkipped",
        "markerVerified": true
      },
      {
        "id": "#1799",
        "desc": "orphan-swarm reconcile on swarm-state.json load (PID + TTL)",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/swarm-tools.js",
        "sha256": "fc88476d365dff10b99a1feca048df5aa411b1cc908bd6032dd64a02f7b70a16",
        "marker": "reconcileOrphanSwarms",
        "markerVerified": true
      },
      {
        "id": "#1798",
        "desc": "doctor surfaces config collision (legacy JSON + v3 YAML)",
        "file": "v3/@claude-flow/cli/dist/src/commands/doctor.js",
        "sha256": "bc9739574092e4fad1c5d402720a0d7f50a23b02e78679eec82d8c883dd80703",
        "marker": "Config collision",
        "markerVerified": true
      },
      {
        "id": "#1810",
        "desc": "WASM gallery default Sonnet bumped 20250514 → 4-6",
        "file": "v3/@claude-flow/cli/dist/src/ruvector/agent-wasm.js",
        "sha256": "12fce07f6458aff5db210b0ba50104fa9b2dd52c85b5e9071b48c2899451c631",
        "marker": "claude-sonnet-4-6",
        "markerVerified": true
      },
      {
        "id": "#1807",
        "desc": "aidefence load: retry plain import + actionable error",
        "file": "v3/@claude-flow/cli/dist/src/mcp-tools/security-tools.js",
        "sha256": "991a2de4462b8a7b29ae26006977fd7b1942bc56fa0e891422d0f28a7e9fff06",
        "marker": "resolver path",
        "markerVerified": true
      },
      {
        "id": "#1686",
        "desc": "NaN-safe coercion in hooks metrics + pretrain (safeNum)",
        "file": "v3/@claude-flow/cli/dist/src/commands/hooks.js",
        "sha256": "91a793c34e0c9bac00923fefde2ec458ef5fc8d0ff73cb2ebd35d55e9e938f3f",
        "marker": "safeNum",
        "markerVerified": true
      },
      {
        "id": "#1670",
        "desc": "RuFlo Co-Authored-By trailer made opt-in",
        "file": "v3/@claude-flow/cli/dist/src/init/settings-generator.js",
        "sha256": "bba78d719e47c4cd3d56bb08112fde37624432711c02baf9b356bfd480bd837e",
        "marker": "options.attribution === true",
        "markerVerified": true
      },
      {
        "id": "#1622",
        "desc": "memory stats shows embedding provider + HNSW status",
        "file": "v3/@claude-flow/cli/dist/src/commands/memory.js",
        "sha256": "7f04b21f168c7e00b13bdb7e0811fa83140db66ea2c3b0cf396abba6af3941f5",
        "marker": "Semantic Search",
        "markerVerified": true
      },
      {
        "id": "#1574",
        "desc": "github-project-management skill: Security Considerations section",
        "file": ".claude/skills/github-project-management/SKILL.md",
        "sha256": "b03341fd433d1523e74b4f407337fefc4b319186bff02620cff89b0193d5b286",
        "marker": "Security Considerations (read first)",
        "markerVerified": true
      },
      {
        "id": "#1608",
        "desc": "bcrypt → bcryptjs (drops 6 HIGH tar CVEs)",
        "file": "v3/@claude-flow/security/dist/password-hasher.js",
        "sha256": "96b46dd1849fcae990c955dc81703aca8269b2a5d2c69f18003ba9b15bc3f1cf",
        "marker": "bcryptjs",
        "markerVerified": true
      },
      {
        "id": "#1609",
        "desc": "vitest bumped to ^4.0.16 (drops 4 moderate esbuild CVEs)",
        "file": "v3/@claude-flow/aidefence/package.json",
        "sha256": "0a9d315b4c1c74b2f86befd070c73a5651d9d1fcdd0b81c38aa2663976952483",
        "marker": "\"vitest\": \"^4.0.16\"",
        "markerVerified": true
      },
      {
        "id": "#1779",
        "desc": "init detect-and-skip when ruflo MCP already registered",
        "file": "v3/@claude-flow/cli/dist/src/init/executor.js",
        "sha256": "0c90b9b2bc582e8c872a016de085ca6faa8d837ea43f7bb15ada01d6b67a33d4",
        "marker": "detectExistingRufloMCP",
        "markerVerified": true
      },
      {
        "id": "#1463",
        "desc": "statusline detects Python test_*.py / spec_*.py",
        "file": ".claude/helpers/statusline.cjs",
        "sha256": "2e1ec6702dc5dd64c563292414c93c49257ccd26ad1f74589bb3ddb4c1c0938f",
        "marker": "startsWith('test_')",
        "markerVerified": true
      },
      {
        "id": "#1825",
        "desc": "hotfix: workspace: protocol leak in cli optionalDependencies",
        "file": "v3/@claude-flow/cli/package.json",
        "sha256": "b6836a525ba4914a9e9a42116bbdbb56449c3505a203611891e21888cc84ac4b",
        "marker": "\"@claude-flow/memory\": \"^3.0.0-alpha.14\"",
        "markerVerified": true
      },
      {
        "id": "#1834",
        "desc": "skill listing budget bumped + duplicates pruned",
        "file": ".claude/settings.json",
        "sha256": "ba278b1f9ccf8e170e4cef3748a6bcb4efc0850b7ec66d34690fec328fdabeb1",
        "marker": "skillListingBudgetFraction",
        "markerVerified": true
      },
      {
        "id": "#1867",
        "desc": "Node 26 install: better-sqlite3 dynamic import + optionalDependencies",
        "file": "v3/@claude-flow/memory/dist/sqlite-backend.js",
        "sha256": "95b39424f3d27658d5f39ac8142c40fad7d10aeb0c439bc924d44ae95e8e74b3",
        "marker": "(await import('better-sqlite3')).default",
        "markerVerified": true
      },
      {
        "id": "#1859",
        "desc": "CLI flag/positional priority swap — named flags win over stray positionals (14 sites in hooks.ts)",
        "file": "v3/@claude-flow/cli/dist/src/commands/hooks.js",
        "sha256": "91a793c34e0c9bac00923fefde2ec458ef5fc8d0ff73cb2ebd35d55e9e938f3f",
        "marker": "ctx.flags.file || ctx.args[0]",
        "markerVerified": true
      },
      {
        "id": "#1862",
        "desc": "ruflo-core PostToolUse hooks call documented CLI flags (-c/-s/-e, -f/-s) instead of bogus --format true",
        "file": "plugins/ruflo-core/hooks/hooks.json",
        "sha256": "09c10c262c0bb36301e713e8173090adcdfe345443bff9c4c4aa17fb1e900033",
        "marker": "hooks post-edit -f \\"$FILE\\" -s true",
        "markerVerified": true
      }
    ]
  },
  "integrity": {
    "manifestHashAlgo": "sha256",
    "manifestHash": "97b0a18427bea61b81bba3bfcb1dfb386af4d7432b84c91b8c003945db9c7e0c",
    "signatureAlgo": "ed25519",
    "publicKey": "c89e93db40e811846867fbc2b845c3cd61c7abd81faf32e0164abeab19db86d9",
    "signature": "8ebf17a36f56d8bb203fa327533c7bd2d5633d6066fef5d5c75f85d6c4aed6e838c80a7ccc3adb3d70a914b7029bb649a1729695c35a563d5b7e2066f68ee906",
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

The current witness covers **81 fixes** spanning ADR-093 F1–F12, ADR-095 G1–G7 architectural gap closures, multiple GitHub-issue fixes (#1697, #1698, #1691, #1721, #1744, #1749), one ADR (#094 transformers loader), the ADR-096 encryption-at-rest phase markers, the ADR-097 federation budget envelope, and 28 CAP-MCP capability inventory entries (300 tools across 28 source files).

Released as **ruflo@3.6.28 / @claude-flow/cli@3.6.28 / claude-flow@3.6.28** on 2026-05-05. The 3.6.28 release closes 3 of 5 papercuts in #1744 (the install-study issue): adds `--no-global` flag to opt out of the user-global ~/.claude/CLAUDE.md append (#1744 #2), gates the `--minimal` settings.json hooks block on `components.helpers` so minimal stays minimal AND functional (#1744 #3), and clarifies plugin install vs `npx ruflo init` labeling in the README (#1744 #1). Also bundles three runtime honesty fixes: drop the unverified Flash Attention speedup claim from `performance` recommendations, drop the silent Tier-4 mock-embedding fallback in `neural-tools`, and throw on missing real embedding provider in `embedding-service` (mock is tests-only).

Regenerate manually with `node scripts/regenerate-witness.mjs` after a release bump.

Remaining work tracked separately:
- ADR-095 G7 graphAdapter — pending an external graph DB connection.
- ADR-096 (encryption-at-rest) Phases 1–4 shipped in this release but are not yet enumerated as individual fix entries; they appear in the capability inventory section. Per-feature witnesses land in task #25.
- ADR-097 (federation budget circuit breaker) Phase 1 shipped; Phases 2–4 deferred.

The capability inventory section below covers the full 305-MCP / 49-CLI / 32-plugin / 44-agent surface for human review until task #25 (per-tool cryptographic witness signing) lands.

---

## Post-witness validations

Fixes shipped after the signed manifest above (gitCommit `dba6b54d`) — captured here with file hashes and runtime evidence until the next manifest re-issuance folds them in. Same field shape as the manifest's `fixes[]` entries, plus a `runtime` block proving the fix actually behaves correctly on a real platform (markers alone prove the patch reached `dist/`, not that it works).

### #1766 — daemon survives parent exit on Windows

| Field | Value |
|---|---|
| `id` | `#1766` |
| `desc` | break IPC pipe so background daemon survives parent exit on Windows (`detached: true` on every platform + explicit `child.disconnect()` after `child.unref()`) |
| `gitCommit` | `69e72d2e4771981538b33ddde18bd902035a54a8` (branch `main`) |
| `releases` | `@claude-flow/cli@3.7.0-alpha.3`, `claude-flow@3.7.0-alpha.3`, `ruflo@3.7.0-alpha.3` |
| `sourceFile` | `v3/@claude-flow/cli/src/commands/daemon.ts` |
| `sourceSha256` | `8d52ffff350c68452760127a7d7dd2c69baee44b102f9dc318a95ae1259bd0dc` |
| `distFile` | `node_modules/@claude-flow/cli/dist/src/commands/daemon.js` (in `npm install ruflo@3.7.0-alpha.3`) |
| `distSha256` | `f09d153c3339f3bb341df93bdf2e351a3f911f5478028baefa1c3171a4925c2f` |
| `markers` | `detached: true` (line 242), `child.disconnect()` (line 286), `#1766` comment block (line 235, 279) |
| `markerVerified` | `true` |

**Runtime witness (Windows).** Static markers only prove the patch was published; they do not prove it actually keeps the daemon alive. The fix specifically targets a Windows-only IPC-pipe-teardown failure, so the meaningful test is on Windows.

| Field | Value |
|---|---|
| `os` | Windows 11 Home 10.0.26200 |
| `node` | v24.12.0 |
| `npm` | 11.10.0 |
| `shell` | `powershell.exe` 5.1 (parent), `node.exe` (daemon child) |
| `procedure` | (1) `npm install ruflo@3.7.0-alpha.3` in a clean dir. (2) Spawn the daemon from a child PowerShell via `Start-Process powershell.exe -Wait` running `node node_modules/@claude-flow/cli/bin/cli.js daemon start`. (3) Force-terminate that parent shell tree (the npx-wrapper-exits scenario from the bug report). (4) Re-check the recorded daemon PID `N` seconds later. |
| `daemonPid` | `25532` (read from `.claude-flow/daemon.pid`) |
| `parentExitedAt` | `16:13:53 local` (parent powershell tree force-killed via `TaskStop`) |
| `daemonStillAliveAt` | `16:18:00 local` — uptime = **246s** post parent exit (Windows reported `Get-Process -Id 25532` still alive: `StartTime = 05/05/2026 16:13:53`, computed uptime `246.0628487s`) |
| `failureMode` | The original #1766 symptom was the daemon dying within ~1s of npx exit. Survival past 5s is sufficient evidence the IPC pipe is no longer holding the child to the parent; 246s is well past any plausible delayed-teardown race. |
| `cleanup` | `node cli.js daemon stop` printed `Worker daemon stopped`; PID 25532 confirmed gone. |
| `verdict` | **PASS — fix verified on Windows, not merely shipped.** |

**CI lock-in (active).** Added as step `Daemon survives parent exit (Windows, regression #1766)` in the `build` matrix job of `.github/workflows/ci.yml`, gated on `runner.os == 'Windows'` so it runs alongside the existing `Test CLI binary (Windows)` step on every PR. The job exercises the local-built CLI (no `npm install` round-trip — same code path as `npm pack` artifacts), spawns the daemon from a child PowerShell that exits, waits 5s, and fails the build if `Get-Process -Id <pid>` no longer finds the daemon. With this in place, a re-introduction of the IPC-pipe-leak failure mode would turn `Build & Package (windows-latest)` red on the offending PR instead of waiting for a user report.

---

## Capability inventory (auto-extracted)

Snapshot of every documented capability in this repository at the witnessed git commit. Regenerate with `node scripts/inventory-capabilities.mjs`. The output is sorted + deterministic so this section can be diff-reviewed.

Coverage at this snapshot: **305 MCP tools**, **49 CLI commands**, **32 plugins**, **44 agent definitions**.

Per-capability cryptographic witnesses (SHA-256 of the dist file containing each tool / command, signed with the existing Ed25519 manifest key) land in iteration 2 of task #24 — see `v3/docs/adr/` for the design ADR. Functional smoke tests (`ruflo verify --functional`) that round-trip each MCP tool through the in-process server are iteration 3.

### MCP tools (305)

| Tool | Description | Source |
|---|---|---|
| `agent_execute` | Execute a task on a spawned agent — calls the Anthropic Messages API with the agent\ | `v3\@claude-flow\cli\src\mcp-tools\agent-tools.ts` |
| `agent_health` | Check agent health | `v3\@claude-flow\cli\src\mcp-tools\agent-tools.ts` |
| `agent_list` | List all agents | `v3\@claude-flow\cli\src\mcp-tools\agent-tools.ts` |
| `agent_pool` | Manage agent pool | `v3\@claude-flow\cli\src\mcp-tools\agent-tools.ts` |
| `agent_spawn` | Spawn a Ruflo-tracked agent with cost attribution + memory persistence + swarm coordination. Use when native Task tool is wrong because you need (a) cost tracking per agent in the cost-tracking namespace, (b) cross-session learning via the patterns namespace, or (c) coordination with other agents in a swarm topology (hierarchical / mesh / consensus). For one-shot subtasks with no learning loop, native Task is fine. Pair with hooks_route to pick the right model first. | `v3\@claude-flow\cli\src\mcp-tools\agent-tools.ts` |
| `agent_status` | Get agent status | `v3\@claude-flow\cli\src\mcp-tools\agent-tools.ts` |
| `agent_terminate` | Terminate an agent | `v3\@claude-flow\cli\src\mcp-tools\agent-tools.ts` |
| `agent_update` | Update agent status or config | `v3\@claude-flow\cli\src\mcp-tools\agent-tools.ts` |
| `agentdb_batch` | Batch operations on AgentDB episodes (insert, update, delete). Note: entries are stored in the AgentDB episodes table, not the memory_search namespace. Use memory_store for entries that should be searchable via memory_search. | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_causal-edge` | Record a causal edge between two memory entries via CausalMemoryGraph | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_consolidate` | Run memory consolidation to promote entries across tiers and compress old data | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_context-synthesize` | Synthesize context from stored memories for a given query | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_controllers` | List all AgentDB v3 controllers and their initialization status | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_feedback` | Record task feedback for learning via LearningSystem + ReasoningBank controllers | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_health` | Get AgentDB v3 controller health status including cache stats and attestation count | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_hierarchical-recall` | Recall from hierarchical memory with optional tier filter | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_hierarchical-store` | Store to hierarchical memory with tier (working, episodic, semantic) | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_pattern-search` | Search patterns via ReasoningBank controller with BM25+semantic hybrid | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_pattern-store` | Store a pattern directly via ReasoningBank controller | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_route` | Route a task via AgentDB SemanticRouter or LearningSystem recommendAlgorithm | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_semantic-route` | Route an input via AgentDB SemanticRouter for intent classification | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_session-end` | End session, persist to ReflexionMemory, trigger NightlyLearner consolidation | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agentdb_session-start` | Start a session with ReflexionMemory episodic replay | `v3\@claude-flow\cli\src\mcp-tools\agentdb-tools.ts` |
| `agents` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\swarm-tools.ts` |
| `aidefence_analyze` | Deep analysis of input for specific threat types with similar pattern search and mitigation recommendations. | `v3\@claude-flow\cli\src\mcp-tools\security-tools.ts` |
| `aidefence_has_pii` | Check if input contains PII (emails, SSNs, API keys, passwords, etc.). | `v3\@claude-flow\cli\src\mcp-tools\security-tools.ts` |
| `aidefence_is_safe` | Quick boolean check if input is safe. Fastest option for simple validation. | `v3\@claude-flow\cli\src\mcp-tools\security-tools.ts` |
| `aidefence_learn` | Record detection feedback for pattern learning. Improves future detection accuracy. | `v3\@claude-flow\cli\src\mcp-tools\security-tools.ts` |
| `aidefence_scan` | Scan input text for AI manipulation threats (prompt injection, jailbreaks, PII). Returns threat assessment with <10ms latency. | `v3\@claude-flow\cli\src\mcp-tools\security-tools.ts` |
| `aidefence_stats` | Get AIDefence detection and learning statistics. | `v3\@claude-flow\cli\src\mcp-tools\security-tools.ts` |
| `analyze_diff` | Analyze git diff for change risk assessment and classification | `v3\@claude-flow\cli\src\mcp-tools\analyze-tools.ts` |
| `analyze_diff-classify` | Classify git diff change type | `v3\@claude-flow\cli\src\mcp-tools\analyze-tools.ts` |
| `analyze_diff-reviewers` | Suggest reviewers for git diff changes | `v3\@claude-flow\cli\src\mcp-tools\analyze-tools.ts` |
| `analyze_diff-risk` | Quick risk assessment for git diff | `v3\@claude-flow\cli\src\mcp-tools\analyze-tools.ts` |
| `analyze_diff-stats` | Get quick statistics for git diff | `v3\@claude-flow\cli\src\mcp-tools\analyze-tools.ts` |
| `analyze_file-risk` | Assess risk for a specific file change | `v3\@claude-flow\cli\src\mcp-tools\analyze-tools.ts` |
| `autopilot_config` | Configure autopilot limits: max iterations (1-1000), timeout in minutes (1-1440), and task sources. | `v3\@claude-flow\cli\src\mcp-tools\autopilot-tools.ts` |
| `autopilot_disable` | Disable autopilot. Agents will be allowed to stop even if tasks remain. | `v3\@claude-flow\cli\src\mcp-tools\autopilot-tools.ts` |
| `autopilot_enable` | Enable autopilot persistent completion. Agents will be re-engaged when tasks remain incomplete. | `v3\@claude-flow\cli\src\mcp-tools\autopilot-tools.ts` |
| `autopilot_history` | Search past completion episodes by keyword. Requires AgentDB. | `v3\@claude-flow\cli\src\mcp-tools\autopilot-tools.ts` |
| `autopilot_learn` | Discover success patterns from past task completions. Requires AgentDB for full functionality. | `v3\@claude-flow\cli\src\mcp-tools\autopilot-tools.ts` |
| `autopilot_log` | Retrieve the autopilot event log. Shows enable/disable events, re-engagements, completions. | `v3\@claude-flow\cli\src\mcp-tools\autopilot-tools.ts` |
| `autopilot_predict` | Predict the optimal next action based on current state and learned patterns. | `v3\@claude-flow\cli\src\mcp-tools\autopilot-tools.ts` |
| `autopilot_progress` | Detailed task progress broken down by source (team-tasks, swarm-tasks, file-checklist). | `v3\@claude-flow\cli\src\mcp-tools\autopilot-tools.ts` |
| `autopilot_reset` | Reset autopilot iteration counter and restart the timer. | `v3\@claude-flow\cli\src\mcp-tools\autopilot-tools.ts` |
| `autopilot_status` | Get autopilot state including enabled status, iteration count, task progress, and learning metrics. | `v3\@claude-flow\cli\src\mcp-tools\autopilot-tools.ts` |
| `browser_back` | Navigate back in browser history | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_check` | Check a checkbox | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_click` | Click an element using ref (@e1) or CSS selector | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_close` | Close the browser session | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_cookie_use` | Fetch a vault handle for a host from the browser-cookies AgentDB namespace. Raw cookie values are NEVER returned — only the opaque handle plus expiry / AIDefence verdict. | `v3\@claude-flow\cli\src\mcp-tools\browser-session-tools.ts` |
| `browser_eval` | Execute JavaScript in page context | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_fill` | Clear and fill an input element | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_forward` | Navigate forward in browser history | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_get-text` | Get text content of an element | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_get-title` | Get the page title | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_get-url` | Get the current URL | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_get-value` | Get value of an input element | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_hover` | Hover over an element using ref (@e1) or CSS selector | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_open` | Navigate browser to a URL | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_press` | Press a keyboard key | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_reload` | Reload the current page | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_screenshot` | Capture screenshot of the page | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_scroll` | Scroll the page | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_select` | Select an option from a dropdown | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_session_end` | End a recorded browser session: trajectory-end with verdict, rvf compact, AIDefence pre-store gate (best-effort), and AgentDB index in the browser-sessions namespace. | `v3\@claude-flow\cli\src\mcp-tools\browser-session-tools.ts` |
| `browser_session_record` | Open a named, traced browser session: allocate an RVF cognitive container, begin a ruvector trajectory, then open the URL via agent-browser. Returns the session id and rvf path. | `v3\@claude-flow\cli\src\mcp-tools\browser-session-tools.ts` |
| `browser_session_replay` | Load a recorded session trajectory and return its steps so the caller can dispatch them through the 23 browser_* tools. Does NOT itself drive the browser — replay execution is caller-orchestrated to keep this tool a primitive (ADR-0001 §7). | `v3\@claude-flow\cli\src\mcp-tools\browser-session-tools.ts` |
| `browser_session-list` | List active browser sessions | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_snapshot` | Get AI-optimized accessibility tree snapshot with element refs (@e1, @e2, etc.) | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_template_apply` | Fetch a recipe from the browser-templates AgentDB namespace and return it for caller-level execution. | `v3\@claude-flow\cli\src\mcp-tools\browser-session-tools.ts` |
| `browser_type` | Type text with key events (for autocomplete, etc.) | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_uncheck` | Uncheck a checkbox | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `browser_wait` | Wait for a condition | `v3\@claude-flow\cli\src\mcp-tools\browser-tools.ts` |
| `build-agents` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `claims_accept-handoff` | Accept a pending handoff | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_board` | Get a visual board view of all claims | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_claim` | Claim an issue for work (human or agent) | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_handoff` | Request handoff of an issue to another claimant | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_list` | List all claims or filter by criteria | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_load` | Get agent load information | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_mark-stealable` | Mark an issue as stealable by other agents | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_rebalance` | Suggest or apply load rebalancing across agents | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_release` | Release a claim on an issue | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_status` | Update claim status | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_steal` | Steal a stealable issue | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `claims_stealable` | List all stealable issues | `v3\@claude-flow\cli\src\mcp-tools\claims-tools.ts` |
| `config` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `config_export` | Export configuration to JSON | `v3\@claude-flow\cli\src\mcp-tools\config-tools.ts` |
| `config_get` | Get configuration value | `v3\@claude-flow\cli\src\mcp-tools\config-tools.ts` |
| `config_import` | Import configuration from JSON | `v3\@claude-flow\cli\src\mcp-tools\config-tools.ts` |
| `config_list` | List configuration values | `v3\@claude-flow\cli\src\mcp-tools\config-tools.ts` |
| `config_reset` | Reset configuration to defaults | `v3\@claude-flow\cli\src\mcp-tools\config-tools.ts` |
| `config_set` | Set configuration value | `v3\@claude-flow\cli\src\mcp-tools\config-tools.ts` |
| `coordination_consensus` | Manage consensus protocol with BFT, Raft, or Quorum strategies | `v3\@claude-flow\cli\src\mcp-tools\coordination-tools.ts` |
| `coordination_load_balance` | Configure load balancing | `v3\@claude-flow\cli\src\mcp-tools\coordination-tools.ts` |
| `coordination_metrics` | Get coordination metrics | `v3\@claude-flow\cli\src\mcp-tools\coordination-tools.ts` |
| `coordination_node` | Manage coordination nodes | `v3\@claude-flow\cli\src\mcp-tools\coordination-tools.ts` |
| `coordination_orchestrate` | Orchestrate multi-agent coordination | `v3\@claude-flow\cli\src\mcp-tools\coordination-tools.ts` |
| `coordination_sync` | Synchronize state across nodes | `v3\@claude-flow\cli\src\mcp-tools\coordination-tools.ts` |
| `coordination_topology` | Configure swarm topology | `v3\@claude-flow\cli\src\mcp-tools\coordination-tools.ts` |
| `coordinator` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\swarm-tools.ts` |
| `daa_agent_adapt` | Trigger agent adaptation based on feedback | `v3\@claude-flow\cli\src\mcp-tools\daa-tools.ts` |
| `daa_agent_create` | Create a decentralized autonomous agent | `v3\@claude-flow\cli\src\mcp-tools\daa-tools.ts` |
| `daa_cognitive_pattern` | Analyze or change cognitive patterns | `v3\@claude-flow\cli\src\mcp-tools\daa-tools.ts` |
| `daa_knowledge_share` | Share knowledge between agents | `v3\@claude-flow\cli\src\mcp-tools\daa-tools.ts` |
| `daa_learning_status` | Get learning status for DAA agents | `v3\@claude-flow\cli\src\mcp-tools\daa-tools.ts` |
| `daa_performance_metrics` | Get DAA performance metrics | `v3\@claude-flow\cli\src\mcp-tools\daa-tools.ts` |
| `daa_workflow_create` | Create an autonomous workflow | `v3\@claude-flow\cli\src\mcp-tools\daa-tools.ts` |
| `daa_workflow_execute` | Execute a DAA workflow | `v3\@claude-flow\cli\src\mcp-tools\daa-tools.ts` |
| `database` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `disk` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `embeddings_compare` | Compare similarity between two texts | `v3\@claude-flow\cli\src\mcp-tools\embeddings-tools.ts` |
| `embeddings_generate` | Generate embeddings for text (Euclidean or hyperbolic) | `v3\@claude-flow\cli\src\mcp-tools\embeddings-tools.ts` |
| `embeddings_hyperbolic` | Hyperbolic embedding operations (Poincaré ball) | `v3\@claude-flow\cli\src\mcp-tools\embeddings-tools.ts` |
| `embeddings_init` | Initialize the ONNX embedding subsystem with hyperbolic support | `v3\@claude-flow\cli\src\mcp-tools\embeddings-tools.ts` |
| `embeddings_neural` | Neural substrate operations (RuVector integration) | `v3\@claude-flow\cli\src\mcp-tools\embeddings-tools.ts` |
| `embeddings_rabitq_build` | Build RaBitQ 1-bit quantized index from stored embeddings (32× compression). Pre-filters candidates via Hamming scan before exact rerank. | `v3\@claude-flow\cli\src\mcp-tools\embeddings-tools.ts` |
| `embeddings_rabitq_search` | Search via RaBitQ quantized index (fast Hamming scan). Returns candidate IDs for reranking. | `v3\@claude-flow\cli\src\mcp-tools\embeddings-tools.ts` |
| `embeddings_rabitq_status` | Get RaBitQ quantized index status — availability, vector count, compression ratio | `v3\@claude-flow\cli\src\mcp-tools\embeddings-tools.ts` |
| `embeddings_search` | Semantic search across stored embeddings | `v3\@claude-flow\cli\src\mcp-tools\embeddings-tools.ts` |
| `embeddings_status` | Get embeddings system status and configuration | `v3\@claude-flow\cli\src\mcp-tools\embeddings-tools.ts` |
| `explain` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `github_issue_track` | Track and manage issues | `v3\@claude-flow\cli\src\mcp-tools\github-tools.ts` |
| `github_metrics` | Get repository metrics and statistics | `v3\@claude-flow\cli\src\mcp-tools\github-tools.ts` |
| `github_pr_manage` | Manage pull requests | `v3\@claude-flow\cli\src\mcp-tools\github-tools.ts` |
| `github_repo_analyze` | Analyze a GitHub repository | `v3\@claude-flow\cli\src\mcp-tools\github-tools.ts` |
| `github_workflow` | Manage GitHub Actions workflows | `v3\@claude-flow\cli\src\mcp-tools\github-tools.ts` |
| `guidance_capabilities` | List all capability areas with their tools, commands, agents, and skills. Use this to discover what Ruflo can do. | `v3\@claude-flow\cli\src\mcp-tools\guidance-tools.ts` |
| `guidance_discover` | Discover all available agents and skills from the .claude/ directory. Returns live filesystem data. | `v3\@claude-flow\cli\src\mcp-tools\guidance-tools.ts` |
| `guidance_quickref` | Quick reference card for common operations. Returns the most useful commands for a given domain. | `v3\@claude-flow\cli\src\mcp-tools\guidance-tools.ts` |
| `guidance_recommend` | Given a task description, recommend which capability areas, tools, agents, and workflow to use. | `v3\@claude-flow\cli\src\mcp-tools\guidance-tools.ts` |
| `guidance_workflow` | Get a recommended workflow template for a task type. Includes steps, agents, and topology. | `v3\@claude-flow\cli\src\mcp-tools\guidance-tools.ts` |
| `hive-mind_broadcast` | Broadcast message to all workers | `v3\@claude-flow\cli\src\mcp-tools\hive-mind-tools.ts` |
| `hive-mind_consensus` | Propose or vote on consensus with BFT, Raft, or Quorum strategies | `v3\@claude-flow\cli\src\mcp-tools\hive-mind-tools.ts` |
| `hive-mind_init` | Initialize the hive-mind collective | `v3\@claude-flow\cli\src\mcp-tools\hive-mind-tools.ts` |
| `hive-mind_join` | Join an agent to the hive-mind | `v3\@claude-flow\cli\src\mcp-tools\hive-mind-tools.ts` |
| `hive-mind_leave` | Remove an agent from the hive-mind | `v3\@claude-flow\cli\src\mcp-tools\hive-mind-tools.ts` |
| `hive-mind_memory` | Access hive shared memory | `v3\@claude-flow\cli\src\mcp-tools\hive-mind-tools.ts` |
| `hive-mind_shutdown` | Shutdown the hive-mind and terminate all workers | `v3\@claude-flow\cli\src\mcp-tools\hive-mind-tools.ts` |
| `hive-mind_spawn` | Spawn workers and automatically join them to the hive-mind (combines agent/spawn + hive-mind/join) | `v3\@claude-flow\cli\src\mcp-tools\hive-mind-tools.ts` |
| `hive-mind_status` | Get hive-mind status | `v3\@claude-flow\cli\src\mcp-tools\hive-mind-tools.ts` |
| `hooks_build-agents` | Generate optimized agent configurations from pretrain data | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_explain` | Explain routing decision with full transparency | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_init` | Initialize hooks in project with .claude/settings.json | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_intelligence` | RuVector intelligence system status (shows REAL metrics from memory store) | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_intelligence_attention` | Compute attention-weighted similarity using MoE/Flash/Hyperbolic | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_intelligence_learn` | Force immediate SONA learning cycle with EWC++ consolidation | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_intelligence_pattern-search` | Search patterns using REAL vector search (HNSW when available, brute-force fallback) | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_intelligence_pattern-store` | Store pattern in ReasoningBank (HNSW-indexed) | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_intelligence_stats` | Get RuVector intelligence layer statistics | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_intelligence_trajectory-end` | End trajectory and trigger SONA learning with EWC++ | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_intelligence_trajectory-start` | Begin SONA trajectory for reinforcement learning | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_intelligence_trajectory-step` | Record step in trajectory for reinforcement learning | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_intelligence-reset` | Reset intelligence learning state | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_list` | List all registered hooks | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_metrics` | View learning metrics dashboard | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_model-outcome` | Record model routing outcome for learning | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_model-route` | Route task to optimal Claude model (haiku/sonnet/opus) based on complexity | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_model-stats` | Get model routing statistics | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_notify` | Send cross-agent notification | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_post-command` | Record command execution outcome | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_post-edit` | Record editing outcome for learning | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_post-task` | Record task completion for learning | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_pre-command` | Assess risk before executing a command | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_pre-edit` | Get context and agent suggestions before editing a file | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_pre-task` | Record task start and get agent suggestions with intelligent model routing (ADR-026) | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_pretrain` | Analyze repository to bootstrap intelligence (4-step pipeline) | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_route` | Get a 3-tier routing recommendation for a task: Tier 1 (Agent Booster, 0ms / $0 — for var-to-const, add-types, etc.), Tier 2 (Haiku — simple), Tier 3 (Sonnet/Opus — complex). Use this BEFORE spawning an agent to avoid sending simple transforms to Sonnet. Native tools have no equivalent — Claude Code does not introspect its own model-selection cost. Returns the recommended model + a | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_session-end` | End current session, stop daemon, and persist state | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_session-restore` | Restore a previous session | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_session-start` | Initialize a new session and auto-start daemon | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_transfer` | Transfer learned patterns from another project | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_worker-cancel` | Cancel a running worker | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_worker-detect` | Detect worker triggers from user prompt (for UserPromptSubmit hook) | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_worker-dispatch` | Dispatch a background worker for analysis/optimization tasks | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_worker-list` | List all 12 background workers with status and capabilities | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `hooks_worker-status` | Get status of a specific worker or all active workers | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `init` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `intelligence` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `intelligence_attention` | Record task start and get agent suggestions with intelligent model routing (ADR-026) | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `intelligence_learn` | Record task start and get agent suggestions with intelligent model routing (ADR-026) | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `intelligence_pattern-search` | Record task start and get agent suggestions with intelligent model routing (ADR-026) | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `intelligence_pattern-store` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `intelligence_stats` | Record task start and get agent suggestions with intelligent model routing (ADR-026) | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `intelligence_trajectory-end` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `intelligence_trajectory-start` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `intelligence_trajectory-step` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `mcp` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `mcp_status` | Get MCP server status, including stdio mode detection | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `memory` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `memory_bridge_status` | Show Claude Code memory bridge status — AgentDB vectors, SONA learning, intelligence patterns, and connection health. | `v3\@claude-flow\cli\src\mcp-tools\memory-tools.ts` |
| `memory_delete` | Remove a stored memory entry by exact (namespace, key). Use when a previously stored decision is invalidated or contains stale data. No native equivalent — Write to a file does not affect the .swarm/memory.db SQLite store. | `v3\@claude-flow\cli\src\mcp-tools\memory-tools.ts` |
| `memory_import_claude` | Import Claude Code auto-memory files into AgentDB with ONNX vector embeddings. Reads ~/.claude/projects/*/memory/*.md files, parses YAML frontmatter, splits into sections, and stores with 384-dim embeddings for semantic search. Use allProjects=true to import from ALL Claude projects. | `v3\@claude-flow\cli\src\mcp-tools\memory-tools.ts` |
| `memory_list` | Enumerate stored memory entries (optionally filtered by namespace/tags) without semantic search. Use when native Glob is wrong because the entries are not files (they live in .swarm/memory.db). For inspection / audit / | `v3\@claude-flow\cli\src\mcp-tools\memory-tools.ts` |
| `memory_migrate` | Manually trigger migration from legacy JSON store to sql.js | `v3\@claude-flow\cli\src\mcp-tools\memory-tools.ts` |
| `memory_retrieve` | Read back a value previously stored via memory_store, by exact (namespace, key) — lossless, includes metadata. Use when native Read is wrong because the value is not a file (it lives in the .swarm/memory.db SQLite store) AND you know the exact key. For semantic lookup by meaning, use memory_search. | `v3\@claude-flow\cli\src\mcp-tools\memory-tools.ts` |
| `memory_search` | Find stored memories by meaning (vector similarity), not by literal text — finds | `v3\@claude-flow\cli\src\mcp-tools\memory-tools.ts` |
| `memory_search_unified` | Search across both Claude Code memories and AgentDB entries using semantic vector similarity. Returns merged, deduplicated results from all namespaces. | `v3\@claude-flow\cli\src\mcp-tools\memory-tools.ts` |
| `memory_stats` | Get memory storage statistics including HNSW index status | `v3\@claude-flow\cli\src\mcp-tools\memory-tools.ts` |
| `memory_store` | Persistent key-value store with vector embedding — survives across sessions and is searchable by meaning, not just by file path. Use when native Write is wrong because the data is not a file (e.g. a learned pattern, a decision, a budget config) AND you need to recall it later by semantic query, not by path. Defaults to namespace= | `v3\@claude-flow\cli\src\mcp-tools\memory-tools.ts` |
| `metrics` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `network` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `neural` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `neural_compress` | Compress neural model or embeddings | `v3\@claude-flow\cli\src\mcp-tools\neural-tools.ts` |
| `neural_optimize` | Optimize neural model performance | `v3\@claude-flow\cli\src\mcp-tools\neural-tools.ts` |
| `neural_patterns` | Get or manage neural patterns | `v3\@claude-flow\cli\src\mcp-tools\neural-tools.ts` |
| `neural_predict` | Make predictions using a neural model | `v3\@claude-flow\cli\src\mcp-tools\neural-tools.ts` |
| `neural_status` | Get neural system status | `v3\@claude-flow\cli\src\mcp-tools\neural-tools.ts` |
| `neural_train` | Train a neural model | `v3\@claude-flow\cli\src\mcp-tools\neural-tools.ts` |
| `notify` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `performance_benchmark` | Run performance benchmarks | `v3\@claude-flow\cli\src\mcp-tools\performance-tools.ts` |
| `performance_bottleneck` | Detect performance bottlenecks | `v3\@claude-flow\cli\src\mcp-tools\performance-tools.ts` |
| `performance_metrics` | Get detailed performance metrics | `v3\@claude-flow\cli\src\mcp-tools\performance-tools.ts` |
| `performance_optimize` | Apply performance optimizations | `v3\@claude-flow\cli\src\mcp-tools\performance-tools.ts` |
| `performance_profile` | Profile specific component or operation | `v3\@claude-flow\cli\src\mcp-tools\performance-tools.ts` |
| `performance_report` | Generate performance report | `v3\@claude-flow\cli\src\mcp-tools\performance-tools.ts` |
| `persistence` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\swarm-tools.ts` |
| `post-command` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `post-edit` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `post-task` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `pre-command` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `pre-edit` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `pre-task` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `pretrain` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `progress_check` | Get current V3 implementation progress percentage and metrics | `v3\@claude-flow\cli\src\mcp-tools\progress-tools.ts` |
| `progress_summary` | Get human-readable V3 implementation progress summary | `v3\@claude-flow\cli\src\mcp-tools\progress-tools.ts` |
| `progress_sync` | Calculate and persist V3 progress metrics to file | `v3\@claude-flow\cli\src\mcp-tools\progress-tools.ts` |
| `progress_watch` | Get current watch status for progress monitoring | `v3\@claude-flow\cli\src\mcp-tools\progress-tools.ts` |
| `route` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `ruvllm_chat_format` | Format chat messages using a template (llama3, mistral, chatml, phi, gemma, or auto-detect). | `v3\@claude-flow\cli\src\mcp-tools\ruvllm-tools.ts` |
| `ruvllm_generate_config` | Create a generation config (maxTokens, temperature, topP, etc.) as JSON. | `v3\@claude-flow\cli\src\mcp-tools\ruvllm-tools.ts` |
| `ruvllm_hnsw_add` | Add a pattern to an HNSW router. Embedding must match router dimensions. | `v3\@claude-flow\cli\src\mcp-tools\ruvllm-tools.ts` |
| `ruvllm_hnsw_create` | Create a WASM HNSW router for semantic pattern routing. Max ~11 patterns (v2.0.1 limit). | `v3\@claude-flow\cli\src\mcp-tools\ruvllm-tools.ts` |
| `ruvllm_hnsw_route` | Route a query embedding to nearest patterns in HNSW index. | `v3\@claude-flow\cli\src\mcp-tools\ruvllm-tools.ts` |
| `ruvllm_microlora_adapt` | Adapt MicroLoRA weights with quality feedback. | `v3\@claude-flow\cli\src\mcp-tools\ruvllm-tools.ts` |
| `ruvllm_microlora_create` | Create a MicroLoRA adapter (ultra-lightweight LoRA, ranks 1-4). | `v3\@claude-flow\cli\src\mcp-tools\ruvllm-tools.ts` |
| `ruvllm_sona_adapt` | Run SONA instant adaptation with a quality signal. | `v3\@claude-flow\cli\src\mcp-tools\ruvllm-tools.ts` |
| `ruvllm_sona_create` | Create a SONA instant adaptation loop (<1ms adaptation cycles). | `v3\@claude-flow\cli\src\mcp-tools\ruvllm-tools.ts` |
| `ruvllm_status` | Get ruvllm-wasm availability and initialization status. | `v3\@claude-flow\cli\src\mcp-tools\ruvllm-tools.ts` |
| `session_delete` | Delete a saved session | `v3\@claude-flow\cli\src\mcp-tools\session-tools.ts` |
| `session_info` | Get detailed session information | `v3\@claude-flow\cli\src\mcp-tools\session-tools.ts` |
| `session_list` | List saved sessions | `v3\@claude-flow\cli\src\mcp-tools\session-tools.ts` |
| `session_restore` | Restore a saved session | `v3\@claude-flow\cli\src\mcp-tools\session-tools.ts` |
| `session_save` | Save current session state | `v3\@claude-flow\cli\src\mcp-tools\session-tools.ts` |
| `session-end` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `session-restore` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `session-start` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `swarm` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `swarm_exists` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\swarm-tools.ts` |
| `swarm_health` | Check swarm health status with real state inspection | `v3\@claude-flow\cli\src\mcp-tools\swarm-tools.ts` |
| `swarm_init` | Initialize a swarm with persistent state tracking | `v3\@claude-flow\cli\src\mcp-tools\swarm-tools.ts` |
| `swarm_shutdown` | Shutdown a swarm and update persistent state | `v3\@claude-flow\cli\src\mcp-tools\swarm-tools.ts` |
| `swarm_status` | Get swarm status from persistent state | `v3\@claude-flow\cli\src\mcp-tools\swarm-tools.ts` |
| `system_health` | Perform system health check | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `system_info` | Get system information | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `system_metrics` | Get system metrics and performance data | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `system_reset` | Reset system state | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `system_status` | Get overall system status | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `task_assign` | Assign a task to one or more agents | `v3\@claude-flow\cli\src\mcp-tools\task-tools.ts` |
| `task_cancel` | Cancel a task | `v3\@claude-flow\cli\src\mcp-tools\task-tools.ts` |
| `task_complete` | Mark task as complete | `v3\@claude-flow\cli\src\mcp-tools\task-tools.ts` |
| `task_create` | Create a new task | `v3\@claude-flow\cli\src\mcp-tools\task-tools.ts` |
| `task_list` | List all tasks | `v3\@claude-flow\cli\src\mcp-tools\task-tools.ts` |
| `task_status` | Get task status | `v3\@claude-flow\cli\src\mcp-tools\task-tools.ts` |
| `task_summary` | Get a summary of all tasks by status | `v3\@claude-flow\cli\src\mcp-tools\system-tools.ts` |
| `task_update` | Update task status or progress | `v3\@claude-flow\cli\src\mcp-tools\task-tools.ts` |
| `terminal_close` | Close a terminal session | `v3\@claude-flow\cli\src\mcp-tools\terminal-tools.ts` |
| `terminal_create` | Create a new terminal session | `v3\@claude-flow\cli\src\mcp-tools\terminal-tools.ts` |
| `terminal_execute` | Execute a command in a terminal session | `v3\@claude-flow\cli\src\mcp-tools\terminal-tools.ts` |
| `terminal_history` | Get command history for a terminal session | `v3\@claude-flow\cli\src\mcp-tools\terminal-tools.ts` |
| `terminal_list` | List all terminal sessions | `v3\@claude-flow\cli\src\mcp-tools\terminal-tools.ts` |
| `topology` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\swarm-tools.ts` |
| `transfer` | *(no description)* | `v3\@claude-flow\cli\src\mcp-tools\hooks-tools.ts` |
| `transfer_detect-pii` | Detect PII in content without redacting | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `transfer_ipfs-resolve` | Resolve IPNS name to CID | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `transfer_plugin-featured` | Get featured plugins from the store | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `transfer_plugin-info` | Get detailed info about a plugin | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `transfer_plugin-official` | Get official plugins from the store | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `transfer_plugin-search` | Search the plugin store | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `transfer_store-download` | Download a pattern from the store | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `transfer_store-featured` | Get featured patterns from the store | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `transfer_store-info` | Get detailed info about a pattern | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `transfer_store-search` | Search the pattern store | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `transfer_store-trending` | Get trending patterns from the store | `v3\@claude-flow\cli\src\mcp-tools\transfer-tools.ts` |
| `wasm_agent_create` | Create a sandboxed WASM agent with virtual filesystem (no OS access). Optionally use a gallery template. | `v3\@claude-flow\cli\src\mcp-tools\wasm-agent-tools.ts` |
| `wasm_agent_export` | Export a WASM agent\ | `v3\@claude-flow\cli\src\mcp-tools\wasm-agent-tools.ts` |
| `wasm_agent_files` | Get a WASM agent\ | `v3\@claude-flow\cli\src\mcp-tools\wasm-agent-tools.ts` |
| `wasm_agent_list` | List all active WASM agents. | `v3\@claude-flow\cli\src\mcp-tools\wasm-agent-tools.ts` |
| `wasm_agent_prompt` | Send a prompt to a WASM agent and get a response. | `v3\@claude-flow\cli\src\mcp-tools\wasm-agent-tools.ts` |
| `wasm_agent_terminate` | Terminate a WASM agent and free resources. | `v3\@claude-flow\cli\src\mcp-tools\wasm-agent-tools.ts` |
| `wasm_agent_tool` | Execute a tool on a WASM agent sandbox. Tools: read_file, write_file, edit_file, write_todos, list_files. Use flat format: {tool, path, content, ...}. | `v3\@claude-flow\cli\src\mcp-tools\wasm-agent-tools.ts` |
| `wasm_gallery_create` | Create a WASM agent from a gallery template. | `v3\@claude-flow\cli\src\mcp-tools\wasm-agent-tools.ts` |
| `wasm_gallery_list` | List all available WASM agent gallery templates (Coder, Researcher, Tester, Reviewer, Security, Swarm). | `v3\@claude-flow\cli\src\mcp-tools\wasm-agent-tools.ts` |
| `wasm_gallery_search` | Search WASM agent gallery templates by query. | `v3\@claude-flow\cli\src\mcp-tools\wasm-agent-tools.ts` |
| `workflow_cancel` | Cancel a workflow | `v3\@claude-flow\cli\src\mcp-tools\workflow-tools.ts` |
| `workflow_create` | Create a new workflow | `v3\@claude-flow\cli\src\mcp-tools\workflow-tools.ts` |
| `workflow_delete` | Delete a workflow | `v3\@claude-flow\cli\src\mcp-tools\workflow-tools.ts` |
| `workflow_execute` | Execute a workflow | `v3\@claude-flow\cli\src\mcp-tools\workflow-tools.ts` |
| `workflow_list` | List all workflows | `v3\@claude-flow\cli\src\mcp-tools\workflow-tools.ts` |
| `workflow_pause` | Pause a running workflow | `v3\@claude-flow\cli\src\mcp-tools\workflow-tools.ts` |
| `workflow_resume` | Resume a paused workflow | `v3\@claude-flow\cli\src\mcp-tools\workflow-tools.ts` |
| `workflow_run` | Run a workflow from a template or file | `v3\@claude-flow\cli\src\mcp-tools\workflow-tools.ts` |
| `workflow_status` | Get workflow status | `v3\@claude-flow\cli\src\mcp-tools\workflow-tools.ts` |
| `workflow_template` | Save workflow as template or create from template | `v3\@claude-flow\cli\src\mcp-tools\workflow-tools.ts` |

### CLI commands (49)

Top-level command surface. Subcommands are documented per-command in the source file and in `.claude-flow/CAPABILITIES.md` after `ruflo init`.

| Command | Description | Source |
|---|---|---|
| `ruflo agent` | Agent management commands | `v3\@claude-flow\cli\src\commands\agent.ts` |
| `ruflo analyze` | Code analysis, diff classification, graph boundaries, and change risk assessment | `v3\@claude-flow\cli\src\commands\analyze.ts` |
| `ruflo appliance` | Self-contained RVFA appliance management (build, inspect, verify, extract, run) | `v3\@claude-flow\cli\src\commands\appliance.ts` |
| `ruflo autopilot` | Persistent swarm completion — keeps agents working until ALL tasks are done | `v3\@claude-flow\cli\src\commands\autopilot.ts` |
| `ruflo benchmark` | Performance benchmarking for self-learning and neural systems | `v3\@claude-flow\cli\src\commands\benchmark.ts` |
| `ruflo claims` | Claims-based authorization, permissions, and access control | `v3\@claude-flow\cli\src\commands\claims.ts` |
| `ruflo cleanup` | Remove project artifacts created by claude-flow/ruflo | `v3\@claude-flow\cli\src\commands\cleanup.ts` |
| `ruflo completions` | Generate shell completion scripts | `v3\@claude-flow\cli\src\commands\completions.ts` |
| `ruflo config` | Configuration management | `v3\@claude-flow\cli\src\commands\config.ts` |
| `ruflo daemon` | Manage background worker daemon (Node.js-based, auto-runs like shell helpers) | `v3\@claude-flow\cli\src\commands\daemon.ts` |
| `ruflo deployment` | Deployment management, environments, rollbacks | `v3\@claude-flow\cli\src\commands\deployment.ts` |
| `ruflo doctor` | System diagnostics and health checks | `v3\@claude-flow\cli\src\commands\doctor.ts` |
| `ruflo download` | Download a pattern from the registry | `v3\@claude-flow\cli\src\commands\transfer-store.ts` |
| `ruflo embeddings` | Vector embeddings, semantic search, similarity operations | `v3\@claude-flow\cli\src\commands\embeddings.ts` |
| `ruflo guidance` | Guidance Control Plane - compile, retrieve, enforce, and optimize guidance rules | `v3\@claude-flow\cli\src\commands\guidance.ts` |
| `ruflo hive-mind` | Queen-led consensus-based multi-agent coordination | `v3\@claude-flow\cli\src\commands\hive-mind.ts` |
| `ruflo hooks` | Self-learning hooks system for intelligent workflow automation | `v3\@claude-flow\cli\src\commands\hooks.ts` |
| `ruflo info` | Show detailed information about a pattern | `v3\@claude-flow\cli\src\commands\transfer-store.ts` |
| `ruflo init` | Initialize RuFlo in the current directory | `v3\@claude-flow\cli\src\commands\init.ts` |
| `ruflo issues` | Collaborative issue claims for human-agent workflows (ADR-016) | `v3\@claude-flow\cli\src\commands\issues.ts` |
| `ruflo list` | List patterns from decentralized registry | `v3\@claude-flow\cli\src\commands\transfer-store.ts` |
| `ruflo mcp` | MCP server management | `v3\@claude-flow\cli\src\commands\mcp.ts` |
| `ruflo memory` | Memory management commands | `v3\@claude-flow\cli\src\commands\memory.ts` |
| `ruflo migrate` | V2 to V3 migration tools | `v3\@claude-flow\cli\src\commands\migrate.ts` |
| `ruflo neural` | Neural pattern training, MoE, Flash Attention, pattern learning | `v3\@claude-flow\cli\src\commands\neural.ts` |
| `ruflo performance` | Performance profiling, benchmarking, optimization, metrics | `v3\@claude-flow\cli\src\commands\performance.ts` |
| `ruflo plugins` | Plugin management with IPFS-based decentralized registry | `v3\@claude-flow\cli\src\commands\plugins.ts` |
| `ruflo process` | Background process management, daemon, and monitoring | `v3\@claude-flow\cli\src\commands\process.ts` |
| `ruflo progress` | Check V3 implementation progress | `v3\@claude-flow\cli\src\commands\progress.ts` |
| `ruflo providers` | Manage AI providers, models, and configurations | `v3\@claude-flow\cli\src\commands\providers.ts` |
| `ruflo publish` | Publish an RVFA appliance to IPFS via Pinata | `v3\@claude-flow\cli\src\commands\appliance-advanced.ts` |
| `ruflo publish` | Publish a pattern to the decentralized registry | `v3\@claude-flow\cli\src\commands\transfer-store.ts` |
| `ruflo route` | Intelligent task-to-agent routing using Q-Learning | `v3\@claude-flow\cli\src\commands\route.ts` |
| `ruflo search` | Search patterns in the decentralized registry | `v3\@claude-flow\cli\src\commands\transfer-store.ts` |
| `ruflo security` | Security scanning, CVE detection, threat modeling, AI defense | `v3\@claude-flow\cli\src\commands\security.ts` |
| `ruflo session` | Session management commands | `v3\@claude-flow\cli\src\commands\session.ts` |
| `ruflo sign` | Sign an RVFA appliance with Ed25519 for tamper detection | `v3\@claude-flow\cli\src\commands\appliance-advanced.ts` |
| `ruflo start` | Start the RuFlo orchestration system | `v3\@claude-flow\cli\src\commands\start.ts` |
| `ruflo status` | Show system status | `v3\@claude-flow\cli\src\commands\status.ts` |
| `ruflo store` | Pattern marketplace - list, search, download, publish | `v3\@claude-flow\cli\src\commands\transfer-store.ts` |
| `ruflo swarm` | Swarm coordination commands | `v3\@claude-flow\cli\src\commands\swarm.ts` |
| `ruflo task` | Task management commands | `v3\@claude-flow\cli\src\commands\task.ts` |
| `ruflo update` | Hot-patch a section in an RVFA appliance | `v3\@claude-flow\cli\src\commands\appliance-advanced.ts` |
| `ruflo verify` | Verify installed artifact against the signed witness manifest | `v3\@claude-flow\cli\src\commands\verify.ts` |
| `ruflo wasm-create` | Create a WASM-sandboxed agent | `v3\@claude-flow\cli\src\commands\agent-wasm.ts` |
| `ruflo wasm-gallery` | List available WASM agent gallery templates | `v3\@claude-flow\cli\src\commands\agent-wasm.ts` |
| `ruflo wasm-prompt` | Send a prompt to a WASM agent | `v3\@claude-flow\cli\src\commands\agent-wasm.ts` |
| `ruflo wasm-status` | Check rvagent-wasm availability, version, and capabilities | `v3\@claude-flow\cli\src\commands\agent-wasm.ts` |
| `ruflo workflow` | Workflow execution and management | `v3\@claude-flow\cli\src\commands\workflow.ts` |

### Plugins (32)

| Plugin | Version | Description |
|---|---|---|
| `ruflo-adr` | 0.3.0 | ADR lifecycle management — create, index, supersede, check compliance, and link Architecture Decision Records to code via AgentDB hierarchical store + causal edges (supersedes/amends/depends-on/related) |
| `ruflo-agentdb` | 0.3.0 | Substrate plugin for Ruflo memory: AgentDB controller bridge (15 agentdb_* MCP tools), RuVector ONNX embeddings (10 embeddings_* tools incl. RaBitQ 32x quantization), and WASM HNSW pattern router (3 ruvllm_hnsw_* tools) |
| `ruflo-aidefence` | 0.2.0 | AI safety scanning, PII detection, prompt injection defense, and adaptive threat learning |
| `ruflo-autopilot` | 0.2.0 | Autonomous /loop-driven task completion with learning, prediction, and progress tracking — wraps 10 autopilot_* MCP tools (status/enable/disable/config/reset/log/progress/learn/history/predict) |
| `ruflo-browser` | 0.2.0 | Session-as-skill browser automation: Playwright + RVF cognitive containers + ruvector trajectories + AgentDB selector memory + AIDefence PII/injection gates |
| `ruflo-core` | 0.2.0 | Foundation plugin — registers the ruflo MCP server (300+ tools across memory/agentdb/embeddings/hooks/aidefence/neural/autopilot/browser/agent/swarm), provides 3 generalist agents (coder/researcher/reviewer), 3 first-run skills, and a curated plugin-discovery catalog |
| `ruflo-cost-tracker` | 0.16.1 | Token usage tracking, model cost attribution per agent, budget alerts, and optimization recommendations — uses memory_* (namespace-routed) for cost-tracking and cost-patterns; pairs with federation budget circuit breaker (ADR-097) |
| `ruflo-daa` | 0.2.0 | Dynamic Agentic Architecture — 8 daa_* MCP tools for adaptive agents (create/adapt), cognitive patterns, workflows (create/execute), knowledge sharing, and learning/performance metrics. Feeds the JUDGE phase of the 4-step intelligence pipeline. |
| `ruflo-ddd` | 0.2.0 | Domain-Driven Design scaffolding — bounded contexts, aggregate roots, domain events, value objects, repositories, and anti-corruption layers; navigable domain graph stored in AgentDB |
| `ruflo-docs` | 0.2.0 | Documentation generation, API docs (JSDoc/TSDoc/OpenAPI), and drift detection — drives the `document` background worker via hooks_worker-dispatch; uses Haiku model for cost-efficient docs work |
| `ruflo-federation` | 0.2.0 | Cross-installation agent federation with zero-trust security, peer discovery, consensus-based task routing, and per-call budget circuit breaker (ADR-097) |
| `ruflo-goals` | 0.2.0 | Long-horizon goal planning, deep research orchestration, and adaptive replanning using GOAP algorithms |
| `ruflo-intelligence` | 0.3.0 | User-facing surface for Ruflo's self-learning system: 6 neural_* + 10 hooks_intelligence_* + 9 routing/meta hooks + 4 SONA/MicroLoRA tools (29 total). Implements the 4-step pipeline (RETRIEVE → JUDGE → DISTILL → CONSOLIDATE) and IPFS-based cross-project pattern transfer. |
| `ruflo-iot-cognitum` | 0.2.0 | IoT device lifecycle, telemetry anomaly detection, fleet management, and witness chain verification for Cognitum Seed hardware |
| `ruflo-jujutsu` | 0.2.0 | Advanced git workflows with diff analysis, risk scoring, change classification (feature/bugfix/refactor/...), and reviewer recommendations — wraps 6 analyze_* MCP tools (diff, diff-risk, diff-classify, diff-reviewers, file-risk, diff-stats) |
| `ruflo-knowledge-graph` | 0.2.0 | Knowledge graph construction — entity extraction, relation mapping, and pathfinder graph traversal |
| `ruflo-loop-workers` | 0.2.0 | Cache-aware /loop workers and CronCreate background automation — wraps 5 hooks_worker-* MCP tools (list/dispatch/status/detect/cancel) and exposes 12 background worker triggers (ultralearn, optimize, consolidate, predict, audit, map, preload, deepdive, document, refactor, benchmark, testgaps) |
| `ruflo-market-data` | 0.2.0 | Market data ingestion — feed normalization, OHLCV vectorization, and HNSW-indexed pattern matching |
| `ruflo-migrations` | 0.2.0 | Schema migration management — generate, validate, dry-run, and rollback database migrations |
| `ruflo-neural-trader` | 0.2.0 | Neural trading via npx neural-trader — self-learning strategies, Rust/NAPI backtesting, 112+ MCP tools, swarm coordination, and portfolio optimization |
| `ruflo-observability` | 0.2.0 | Structured logging, distributed tracing, and metrics — correlate agent swarm activity with application telemetry |
| `ruflo-plugin-creator` | 0.2.0 | Scaffold, validate, and publish new Claude Code plugins with the canonical plugin contract — ADR + smoke + Compatibility + namespace coordination + MCP-tool drift warnings |
| `ruflo-rag-memory` | 0.2.0 | RuVector memory with HNSW search, AgentDB, and semantic retrieval |
| `ruflo-ruvector` | 0.2.1 | Self-learning vector database via npx ruvector@0.2.25 — HNSW, adaptive LoRA embeddings, code-graph clustering, hooks routing, brain/SONA, 103 MCP tools |
| `ruflo-ruvllm` | 0.2.0 | RuVLLM local inference with chat formatting (Claude/GPT/Gemini/Ollama/Cohere), model configuration, MicroLoRA fine-tuning, and SONA real-time adaptation |
| `ruflo-rvf` | 0.2.0 | RVF format for portable agent memory, session persistence, and cross-platform transfer |
| `ruflo-security-audit` | 0.2.0 | Security review, dependency scanning, policy gates, and CVE monitoring |
| `ruflo-sparc` | 0.2.0 | SPARC methodology — Specification, Pseudocode, Architecture, Refinement, Completion phases with gate checks |
| `ruflo-swarm` | 0.2.0 | Agent teams, swarm coordination, Monitor streams, and worktree isolation — wraps 4 swarm_* + 8 agent_* MCP tools (12 total) plus 6 topologies (hierarchical / mesh / hierarchical-mesh / ring / star / adaptive) |
| `ruflo-testgen` | 0.2.0 | Test gap detection, coverage analysis, and automated test generation — drives the testgaps background worker via hooks_worker-dispatch; SPARC Refinement-phase canonical owner |
| `ruflo-wasm` | 0.2.0 | Sandboxed WASM agent creation, execution, and gallery sharing — wraps 10 wasm_* MCP tools (agent_create/prompt/tool/list/terminate/files/export + gallery_list/search/create); built on @ruvector/rvagent-wasm + @ruvector/ruvllm-wasm per ADR-070 (Implemented) |
| `ruflo-workflows` | 0.2.0 | Workflow automation with templates, orchestration, and lifecycle management — wraps 10 workflow_* MCP tools (create/run/execute/status/list/pause/resume/cancel/delete/template) with full state-machine lifecycle (created → running ↔ paused → completed/cancelled) |

### Agents (44)

| Agent | Plugin | Description |
|---|---|---|
| `adr-architect` | ruflo-adr | ADR lifecycle manager -- create, index, supersede, and link Architecture Decision Records to code |
| `agentdb-specialist` | ruflo-agentdb | AgentDB and RuVector specialist for memory operations, HNSW indexing, RaBitQ quantization, and semantic search across the controller bridge |
| `architect` | ruflo-swarm | System architect for designing implementation approaches, API contracts, and module boundaries |
| `autopilot-coordinator` | ruflo-autopilot | Autonomous task completion coordinator using /loop and autopilot MCP tools |
| `backtest-engineer` | ruflo-neural-trader | Backtesting specialist using npx neural-trader Rust/NAPI engine — walk-forward validation, Monte Carlo simulation, parameter optimization |
| `browser-agent` | ruflo-browser | Browser automation agent — drives Playwright via 23 MCP tools, captures every session as an RVF container with a ruvector trajectory, and gates content through AIDefence |
| `coder` | ruflo-core | Implementation specialist for writing clean, efficient code following project patterns |
| `coordinator` | ruflo-swarm | Swarm coordinator that manages agent lifecycle, task assignment, and anti-drift enforcement |
| `cost-analyst` | ruflo-cost-tracker | Tracks token usage per agent and model, computes cost attribution in USD, monitors budgets, and recommends optimizations |
| `daa-specialist` | ruflo-daa | Dynamic Agentic Architecture specialist for adaptive agents, cognitive patterns, and knowledge sharing |
| `data-engineer` | ruflo-market-data | Ingests market data feeds, normalizes OHLCV vectors, and performs HNSW-indexed candlestick pattern matching |
| `deep-researcher` | ruflo-goals | Multi-source research specialist that gathers, cross-references, and synthesizes information with evidence grading and contradiction resolution |
| `device-coordinator` | ruflo-iot-cognitum | Manages Cognitum Seed device fleet as Ruflo agent swarm members with 5-tier trust scoring |
| `docs-writer` | ruflo-docs | Documentation specialist -- generates and maintains project documentation |
| `domain-modeler` | ruflo-ddd | Domain-Driven Design specialist -- maps domains to bounded contexts, designs aggregate roots, defines domain events, and generates anti-corruption layers |
| `dossier-investigator` | ruflo-goals | Recursive parallel multi-source investigator that fans out across web, memory, knowledge-graph, codebase, and ADR index to build a graph-structured dossier on a seed entity, with budget caps, de-duplication, and provenance per claim |
| `federation-coordinator` | ruflo-federation | Orchestrates cross-installation agent federation with zero-trust security |
| `fleet-manager` | ruflo-iot-cognitum | Manages device fleets, firmware rollouts, and fleet-wide policies |
| `git-specialist` | ruflo-jujutsu | Git workflow specialist for diff analysis, risk assessment, and PR management |
| `goal-planner` | ruflo-goals | GOAP specialist that creates optimal action plans using A* search through state spaces, with adaptive replanning, trajectory learning, and multi-mode execution |
| `graph-navigator` | ruflo-knowledge-graph | Extracts entities and relations from code and docs, builds knowledge graphs, and traverses them with pathfinder scoring |
| `horizon-tracker` | ruflo-goals | Long-horizon objective tracker that persists progress across sessions with milestone checkpoints, drift detection, and adaptive timeline management |
| `intelligence-specialist` | ruflo-intelligence | Self-learning intelligence specialist — drives the 4-step pipeline (RETRIEVE → JUDGE → DISTILL → CONSOLIDATE) across 29 MCP tools, coordinates with ruflo-agentdb namespaces, and ships patterns cross-project via IPFS |
| `llm-specialist` | ruflo-ruvllm | RuVLLM specialist for local inference configuration, MicroLoRA fine-tuning, and multi-provider routing |
| `loop-worker-coordinator` | ruflo-loop-workers | Coordinates background worker scheduling, health monitoring, and dispatch across loop and cron execution modes |
| `market-analyst` | ruflo-neural-trader | Market regime detection and technical analysis using npx neural-trader — RSI, MACD, Bollinger Bands, volume profile, regime classification |
| `memory-specialist` | ruflo-rag-memory | SOTA RAG memory specialist — hybrid search (sparse+dense), Graph RAG multi-hop retrieval, MMR diversity reranking, smart consolidation, ruvector integration |
| `migration-engineer` | ruflo-migrations | Generates sequential database migrations with up/down pairs, dry-run validation, and rollback safety checks |
| `observability-engineer` | ruflo-observability | Implements structured logging, distributed tracing, and metrics collection to correlate agent swarm activity with application telemetry |
| `plugin-developer` | ruflo-plugin-creator | Plugin development specialist for scaffolding, validating, and publishing Claude Code plugins |
| `researcher` | ruflo-core | Pathfinder research specialist — traverses RuVector memory graphs and codebase to surface patterns, dependencies, and prior art |
| `reviewer` | ruflo-core | Code review specialist for quality, security, and best-practice enforcement |
| `risk-analyst` | ruflo-neural-trader | Portfolio risk assessment and position sizing using npx neural-trader — VaR/CVaR, Kelly criterion, circuit breakers, correlation monitoring |
| `safety-specialist` | ruflo-aidefence | AI safety specialist for threat detection, PII scanning, and adaptive defense training |
| `security-auditor` | ruflo-security-audit | Specialized agent for security auditing and vulnerability remediation |
| `session-specialist` | ruflo-rvf | Session persistence specialist for state management, memory transfer, and cross-conversation continuity |
| `sparc-orchestrator` | ruflo-sparc | Orchestrates the 5-phase SPARC methodology (Specification, Pseudocode, Architecture, Refinement, Completion) with quality gates between each phase, spawning specialized agents per phase |
| `telemetry-analyzer` | ruflo-iot-cognitum | Analyzes Cognitum Seed device telemetry for anomalies using Z-score detection |
| `tester` | ruflo-testgen | Specialized testing agent -- writes comprehensive tests using TDD London School |
| `trading-strategist` | ruflo-neural-trader | Designs and optimizes neural trading strategies using npx neural-trader — LSTM/Transformer models, Rust/NAPI backtesting, Z-score anomaly detection |
| `vector-engineer` | ruflo-ruvector | Vector operations specialist using npx ruvector@0.2.25 — HNSW indexing, adaptive LoRA embeddings, code-graph clustering, hooks routing, brain/SONA, 103 MCP tools |
| `wasm-specialist` | ruflo-wasm | WASM sandbox specialist for creating, managing, and sharing isolated agent environments |
| `witness-auditor` | ruflo-iot-cognitum | Verifies Ed25519 witness chain integrity and detects provenance gaps |
| `workflow-specialist` | ruflo-workflows | Workflow automation specialist for creating, executing, and managing multi-step processes |

