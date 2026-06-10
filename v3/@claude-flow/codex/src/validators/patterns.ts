/**
 * Validation constants for the codex validators — secret-detection
 * patterns, AGENTS.md required/recommended sections, the valid config
 * enums, and the required config.toml fields.
 *
 * Extracted from validators/index.ts (W149, P3.29 cut #1).
 */

/**
 * Secret patterns to detect
 */
export const SECRET_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /sk-[a-zA-Z0-9]{32,}/, name: 'OpenAI API key' },
  { pattern: /sk-ant-[a-zA-Z0-9-]{32,}/, name: 'Anthropic API key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub personal access token' },
  { pattern: /gho_[a-zA-Z0-9]{36}/, name: 'GitHub OAuth token' },
  { pattern: /github_pat_[a-zA-Z0-9_]{22,}/, name: 'GitHub fine-grained token' },
  { pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/, name: 'Slack token' },
  { pattern: /AKIA[A-Z0-9]{16}/, name: 'AWS access key' },
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[a-zA-Z0-9_-]{20,}["']?/i, name: 'Generic API key' },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/i, name: 'Hardcoded password' },
  { pattern: /(?:secret|token)\s*[:=]\s*["'][a-zA-Z0-9_/-]{16,}["']/i, name: 'Hardcoded secret/token' },
  { pattern: /Bearer\s+[a-zA-Z0-9_.-]{20,}/, name: 'Bearer token' },
  { pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/, name: 'Private key' },
];

/**
 * Required sections for AGENTS.md
 */
export const AGENTS_MD_REQUIRED_SECTIONS = ['Setup', 'Code Standards', 'Security'];

/**
 * Recommended sections for AGENTS.md
 */
export const AGENTS_MD_RECOMMENDED_SECTIONS = [
  'Project Overview',
  'Skills',
  'Agent Types',
  'Memory System',
  'Links',
];

/**
 * Valid approval policies
 */
export const VALID_APPROVAL_POLICIES = ['untrusted', 'on-failure', 'on-request', 'never'];

/**
 * Valid sandbox modes
 */
export const VALID_SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'];

/**
 * Valid web search modes
 */
export const VALID_WEB_SEARCH_MODES = ['disabled', 'cached', 'live'];

/**
 * Required config.toml fields
 */
export const CONFIG_TOML_REQUIRED_FIELDS = ['model', 'approval_policy', 'sandbox_mode'];
