/**
 * SKILL.md Generator — helper-script templates
 *
 * generateHelperScript: the per-skill helper .mjs script bodies.
 * Module-private in the original skill-md.ts (campaign-2 W208); NOT
 * re-exported by the barrel — only generateBuiltInSkill consumes it.
 */

export function generateHelperScript(skillName: string, scriptName: string): string {
  const scripts: Record<string, Record<string, string>> = {
    'swarm-orchestration': {
      'swarm-start': `#!/bin/bash
# Swarm Orchestration - Start Script
# Initialize swarm with default anti-drift settings

set -e

echo "Initializing hierarchical swarm..."
npx ruflo swarm init \\
  --topology hierarchical \\
  --max-agents 8 \\
  --strategy specialized

echo "Swarm initialized successfully"
npx @claude-flow/cli swarm status
`,
      'swarm-monitor': `#!/bin/bash
# Swarm Orchestration - Monitor Script
# Real-time swarm monitoring

set -e

echo "Starting swarm monitor..."
npx @claude-flow/cli swarm status --watch --interval 5
`,
    },
    'memory-management': {
      'memory-backup': `#!/bin/bash
# Memory Management - Backup Script
# Export memory to backup file

set -e

BACKUP_DIR="\${BACKUP_DIR:-./.backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="\${BACKUP_DIR}/memory_\${TIMESTAMP}.json"

mkdir -p "$BACKUP_DIR"

echo "Backing up memory to $BACKUP_FILE..."
npx @claude-flow/cli memory export --output "$BACKUP_FILE"

echo "Backup complete: $BACKUP_FILE"
`,
      'memory-consolidate': `#!/bin/bash
# Memory Management - Consolidate Script
# Optimize and consolidate memory

set -e

echo "Running memory consolidation..."
npx @claude-flow/cli hooks worker dispatch --trigger consolidate

echo "Memory consolidation complete"
npx @claude-flow/cli memory stats
`,
    },
    'sparc-methodology': {
      'sparc-init': `#!/bin/bash
# SPARC Methodology - Init Script
# Initialize SPARC workflow for a new feature

set -e

FEATURE_NAME="\${1:-new-feature}"

echo "Initializing SPARC workflow for: $FEATURE_NAME"

# Create SPARC documentation directory
mkdir -p "./docs/sparc/$FEATURE_NAME"

# Create phase files
touch "./docs/sparc/$FEATURE_NAME/1-specification.md"
touch "./docs/sparc/$FEATURE_NAME/2-pseudocode.md"
touch "./docs/sparc/$FEATURE_NAME/3-architecture.md"
touch "./docs/sparc/$FEATURE_NAME/4-refinement.md"
touch "./docs/sparc/$FEATURE_NAME/5-completion.md"

echo "SPARC workflow initialized in ./docs/sparc/$FEATURE_NAME"
`,
      'sparc-review': `#!/bin/bash
# SPARC Methodology - Review Script
# Run SPARC phase review checklist

set -e

FEATURE_DIR="\${1:-.}"

echo "SPARC Phase Review Checklist"
echo "============================="

for phase in specification pseudocode architecture refinement completion; do
  if [ -f "$FEATURE_DIR/\${phase}.md" ]; then
    echo "[x] $phase - found"
  else
    echo "[ ] $phase - missing"
  fi
done
`,
    },
    'security-audit': {
      'security-scan': `#!/bin/bash
# Security Audit - Full Scan Script
# Run comprehensive security scan pipeline

set -e

echo "Running full security scan..."

# Input validation
echo "Checking input validation..."
npx @claude-flow/cli security scan --check input-validation

# Path traversal
echo "Checking path traversal..."
npx @claude-flow/cli security scan --check path-traversal

# SQL injection
echo "Checking SQL injection..."
npx @claude-flow/cli security scan --check sql-injection

# XSS
echo "Checking XSS..."
npx @claude-flow/cli security scan --check xss

# Secrets
echo "Checking for hardcoded secrets..."
npx @claude-flow/cli security validate --check secrets

# CVE scan
echo "Scanning dependencies for CVEs..."
npx @claude-flow/cli security cve --scan

echo "Security scan complete"
`,
      'cve-remediate': `#!/bin/bash
# Security Audit - CVE Remediation Script
# Auto-remediate known CVEs

set -e

echo "Scanning for CVEs..."
npx @claude-flow/cli security cve --scan --severity high

echo "Attempting auto-remediation..."
npm audit fix

echo "Re-scanning after remediation..."
npx @claude-flow/cli security cve --scan

echo "CVE remediation complete"
`,
    },
    'performance-analysis': {
      'perf-baseline': `#!/bin/bash
# Performance Analysis - Baseline Script
# Capture performance baseline

set -e

BASELINE_FILE="\${1:-baseline.json}"

echo "Capturing performance baseline..."
npx @claude-flow/cli performance benchmark \\
  --suite all \\
  --iterations 100 \\
  --output "$BASELINE_FILE"

echo "Baseline saved to $BASELINE_FILE"
`,
      'perf-regression': `#!/bin/bash
# Performance Analysis - Regression Check Script
# Check for performance regressions

set -e

BASELINE_FILE="\${1:-baseline.json}"
CURRENT_FILE="current.json"
THRESHOLD="\${2:-10}"

echo "Running current benchmarks..."
npx @claude-flow/cli performance benchmark \\
  --suite all \\
  --iterations 100 \\
  --output "$CURRENT_FILE"

echo "Comparing against baseline..."
npx @claude-flow/cli performance benchmark \\
  --compare "$BASELINE_FILE" "$CURRENT_FILE" \\
  --threshold "$THRESHOLD"

rm "$CURRENT_FILE"
`,
    },
    'github-automation': {
      'pr-template': `#!/bin/bash
# GitHub Automation - PR Template Script
# Generate PR from template

set -e

TITLE="\${1:-Update}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "Creating PR for branch: $BRANCH"

gh pr create \\
  --title "$TITLE" \\
  --body "$(cat <<EOF
## Summary
<!-- Describe your changes -->

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No breaking changes

Generated with claude-flow
EOF
)"

echo "PR created successfully"
`,
      'release-prep': `#!/bin/bash
# GitHub Automation - Release Prep Script
# Prepare release with changelog

set -e

VERSION="\${1:-patch}"

echo "Preparing release..."

# Bump version
npm version "$VERSION" --no-git-tag-version

NEW_VERSION=$(node -p "require('./package.json').version")

echo "Creating release v$NEW_VERSION..."
gh release create "v$NEW_VERSION" \\
  --generate-notes \\
  --draft

echo "Draft release v$NEW_VERSION created"
`,
    },
  };

  const skillScripts = scripts[skillName];
  if (skillScripts && skillScripts[scriptName]) {
    return skillScripts[scriptName];
  }

  return `#!/bin/bash
# ${skillName} - ${scriptName}
# Generated by @claude-flow/codex

set -e

echo "Running ${scriptName}..."
# Add your script logic here
`;
}
