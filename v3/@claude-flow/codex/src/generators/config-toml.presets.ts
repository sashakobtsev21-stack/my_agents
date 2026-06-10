/**
 * Preset config.toml generators — minimal / CI / enterprise / dev /
 * secure. Each returns a complete config.toml string. Self-contained
 * (only the ConfigTomlOptions type).
 *
 * Extracted from config-toml.ts (W153, P3.32 cut #1). config-toml.ts stays
 * the barrel and re-exports these (src/index.ts deep-imports
 * generateMinimalConfigToml + generateCIConfigToml from there).
 */
import type { ConfigTomlOptions } from '../types.js';

/**
 * Generate minimal config.toml
 */
export async function generateMinimalConfigToml(options: ConfigTomlOptions = {}): Promise<string> {
  const {
    model = 'gpt-5.3-codex',
    approvalPolicy = 'on-request',
    sandboxMode = 'workspace-write',
  } = options;

  return `# Claude Flow V3 - Minimal Codex Configuration

model = "${model}"
approval_policy = "${approvalPolicy}"
sandbox_mode = "${sandboxMode}"

[mcp_servers.ruflo]
command = "npx"
args = ["-y", "ruflo@latest", "mcp", "start"]
enabled = true
`;
}

/**
 * Generate CI/CD config.toml
 */
export async function generateCIConfigToml(): Promise<string> {
  return `# =============================================================================
# Claude Flow V3 - CI/CD Pipeline Configuration
# =============================================================================
# Optimized for automated CI/CD environments
# No interactive approvals, ephemeral history, minimal overhead
# =============================================================================

model = "gpt-5.3-codex"
approval_policy = "never"
sandbox_mode = "workspace-write"
web_search = "disabled"

# Project documentation
project_doc_max_bytes = 65536

[features]
# Disable interactive features for CI
shell_snapshot = false
remote_compaction = false
child_agents_md = true
request_rule = false

[mcp_servers.ruflo]
command = "npx"
args = ["-y", "ruflo@latest", "mcp", "start"]
enabled = true
tool_timeout_sec = 300

[history]
persistence = "none"

[shell_environment_policy]
inherit = "core"
exclude = ["*_KEY", "*_SECRET", "*_TOKEN", "*_PASSWORD", "CI_*"]

[security]
input_validation = true
path_traversal_prevention = true
secret_scanning = true
cve_scanning = true

[performance]
max_agents = 4
task_timeout = 600
cache_enabled = false
parallel_execution = true

[logging]
level = "info"
format = "json"
destination = "stdout"

[swarm]
default_topology = "hierarchical"
default_strategy = "specialized"
anti_drift = true

[hooks]
enabled = true
pre_task = true
post_task = false
train_on_edit = false
`;
}

/**
 * Generate enterprise config.toml with full governance
 */
export async function generateEnterpriseConfigToml(): Promise<string> {
  return `# =============================================================================
# Claude Flow V3 - Enterprise Configuration
# =============================================================================
# Full governance, audit logging, and compliance features enabled
# Suitable for enterprise environments with strict security requirements
# =============================================================================

model = "gpt-5.3-codex"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
web_search = "cached"

# Project documentation
project_doc_max_bytes = 131072
project_doc_fallback_filenames = [
  "AGENTS.md",
  "TEAM_GUIDE.md",
  ".agents.md",
  "CONTRIBUTING.md"
]

[features]
child_agents_md = true
shell_snapshot = true
request_rule = true
remote_compaction = true

# =============================================================================
# MCP Servers
# =============================================================================

[mcp_servers.ruflo]
command = "npx"
args = ["-y", "ruflo@latest", "mcp", "start"]
enabled = true
tool_timeout_sec = 120

[mcp_servers.ruflo.env]
CLAUDE_FLOW_LOG_LEVEL = "info"

# =============================================================================
# Profiles
# =============================================================================

# Development profile - more permissive for local work
[profiles.dev]
approval_policy = "never"
sandbox_mode = "danger-full-access"
web_search = "live"

# Safe profile - maximum restrictions
[profiles.safe]
approval_policy = "untrusted"
sandbox_mode = "read-only"
web_search = "disabled"

# CI profile - for automated pipelines
[profiles.ci]
approval_policy = "never"
sandbox_mode = "workspace-write"
web_search = "disabled"

# Production profile - careful changes only
[profiles.production]
approval_policy = "untrusted"
sandbox_mode = "workspace-write"
web_search = "cached"

# =============================================================================
# History
# =============================================================================

[history]
persistence = "save-all"
retention_days = 90
audit_log = true

# =============================================================================
# Shell Environment
# =============================================================================

[shell_environment_policy]
inherit = "core"
exclude = ["*_KEY", "*_SECRET", "*_TOKEN", "*_PASSWORD", "AWS_*", "AZURE_*"]

[sandbox_workspace_write]
writable_roots = []
network_access = true
exclude_slash_tmp = false

# =============================================================================
# Security (Enterprise)
# =============================================================================

[security]
input_validation = true
path_traversal_prevention = true
secret_scanning = true
cve_scanning = true
max_file_size = 10485760
blocked_patterns = ["\\\\.env$", "credentials\\\\.json$", "\\\\.pem$", "\\\\.key$", "secrets\\\\.yaml$"]

# RBAC configuration
[security.rbac]
enabled = true
default_role = "developer"

# Audit configuration
[security.audit]
enabled = true
destination = "file"
file_path = "./logs/audit.json"
retention_days = 90

# =============================================================================
# Performance
# =============================================================================

[performance]
max_agents = 8
task_timeout = 300
memory_limit = "1GB"
cache_enabled = true
cache_ttl = 3600
parallel_execution = true

# =============================================================================
# Logging (Enterprise)
# =============================================================================

[logging]
level = "info"
format = "json"
destination = "both"
file_path = "./logs/claude-flow.log"
max_files = 30
max_size = "50MB"

# =============================================================================
# Neural Intelligence
# =============================================================================

[neural]
sona_enabled = true
hnsw_enabled = true
hnsw_m = 16
hnsw_ef_construction = 200
hnsw_ef_search = 100
pattern_learning = true
learning_rate = 0.01

# =============================================================================
# Swarm Orchestration
# =============================================================================

[swarm]
default_topology = "hierarchical"
default_strategy = "specialized"
consensus = "raft"
anti_drift = true
checkpoint_interval = 10

# =============================================================================
# Hooks
# =============================================================================

[hooks]
enabled = true
pre_task = true
post_task = true
train_on_edit = true

# =============================================================================
# Background Workers
# =============================================================================

[workers]
enabled = true

[workers.audit]
enabled = true
priority = "critical"
interval = 300

[workers.optimize]
enabled = true
priority = "high"
interval = 600

[workers.consolidate]
enabled = true
priority = "low"
interval = 1800

[workers.testgaps]
enabled = true
priority = "normal"
interval = 3600

# =============================================================================
# Compliance
# =============================================================================

[compliance]
soc2 = true
gdpr = true
pci_dss = false
hipaa = false
`;
}

/**
 * Generate development config.toml with permissive settings
 */
export async function generateDevConfigToml(): Promise<string> {
  return `# =============================================================================
# Claude Flow V3 - Development Configuration
# =============================================================================
# Permissive settings for local development
# Auto-approve most actions, full access, live web search
# =============================================================================

model = "gpt-5.3-codex"
approval_policy = "never"
sandbox_mode = "danger-full-access"
web_search = "live"

# Project documentation
project_doc_max_bytes = 65536

[features]
child_agents_md = true
shell_snapshot = true
request_rule = false
remote_compaction = true

[mcp_servers.ruflo]
command = "npx"
args = ["-y", "ruflo@latest", "mcp", "start"]
enabled = true
tool_timeout_sec = 120

[history]
persistence = "save-all"

[shell_environment_policy]
inherit = "all"
exclude = []

[sandbox_workspace_write]
writable_roots = ["/tmp", "~/.cache"]
network_access = true
exclude_slash_tmp = false

[security]
input_validation = true
path_traversal_prevention = true
secret_scanning = true
cve_scanning = false

[performance]
max_agents = 8
task_timeout = 600
cache_enabled = true
parallel_execution = true

[logging]
level = "debug"
format = "pretty"
destination = "stdout"

[neural]
sona_enabled = true
hnsw_enabled = true
pattern_learning = true

[swarm]
default_topology = "hierarchical"
default_strategy = "specialized"
anti_drift = true

[hooks]
enabled = true
pre_task = true
post_task = true
train_on_edit = true

[workers]
enabled = true
`;
}

/**
 * Generate security-focused config.toml
 */
export async function generateSecureConfigToml(): Promise<string> {
  return `# =============================================================================
# Claude Flow V3 - Security-Focused Configuration
# =============================================================================
# Maximum security restrictions for sensitive environments
# All actions require approval, read-only access, no web search
# =============================================================================

model = "gpt-5.3-codex"
approval_policy = "untrusted"
sandbox_mode = "read-only"
web_search = "disabled"

# Project documentation
project_doc_max_bytes = 32768

[features]
child_agents_md = true
shell_snapshot = false
request_rule = true
remote_compaction = false

[mcp_servers.ruflo]
command = "npx"
args = ["-y", "ruflo@latest", "mcp", "start"]
enabled = true
tool_timeout_sec = 60

[history]
persistence = "save-all"
retention_days = 365

[shell_environment_policy]
inherit = "none"
exclude = ["*"]

[sandbox_workspace_write]
writable_roots = []
network_access = false
exclude_slash_tmp = true

[security]
input_validation = true
path_traversal_prevention = true
secret_scanning = true
cve_scanning = true
max_file_size = 1048576
allowed_extensions = [".ts", ".js", ".json", ".md", ".yaml", ".yml"]
blocked_patterns = ["\\\\.env", "secret", "credential", "password", "key", "token", "\\\\.pem", "\\\\.p12"]

[security.rbac]
enabled = true
default_role = "observer"

[security.audit]
enabled = true
destination = "both"
file_path = "./logs/security-audit.json"
retention_days = 365

[performance]
max_agents = 4
task_timeout = 120
cache_enabled = false
parallel_execution = false

[logging]
level = "info"
format = "json"
destination = "both"
file_path = "./logs/claude-flow.log"
max_files = 100
max_size = "10MB"

[neural]
sona_enabled = false
hnsw_enabled = true
pattern_learning = false

[swarm]
default_topology = "hierarchical"
default_strategy = "specialized"
consensus = "byzantine"
anti_drift = true
checkpoint_interval = 5

[hooks]
enabled = true
pre_task = true
post_task = true
train_on_edit = false

[workers]
enabled = true

[workers.audit]
enabled = true
priority = "critical"
interval = 60

[workers.optimize]
enabled = false

[workers.consolidate]
enabled = false
`;
}
