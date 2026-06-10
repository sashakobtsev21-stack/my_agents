/**
 * GitHubSync — syncs a ClaimService's claims to/from GitHub issues, with
 * input validators (repo / issue-number / claimant / label) + error
 * sanitization and the default GitHub config.
 *
 * Extracted from claim-service.ts (W148, P3.28 cut #2). Imports
 * ClaimService as a TYPE only — no runtime cycle.
 */
import { execFileSync } from 'child_process';
import type { GitHubSyncConfig, GitHubIssue, GitHubSyncResult, Claimant } from './claim-service/types.js';
import type { ClaimService } from './claim-service.js';

const DEFAULT_GITHUB_CONFIG: GitHubSyncConfig = {
  enabled: false,
  syncLabels: true,
  claimLabel: 'claimed',
  autoAssign: true,
  commentOnClaim: true,
  commentOnRelease: true,
};

// ============================================================================
// Input Validation (Security)
// ============================================================================

/**
 * Validate GitHub repository format (owner/repo)
 * Prevents command injection via malicious repo names
 */
function isValidRepo(repo: string): boolean {
  // owner/repo format: alphanumeric, hyphens, underscores, dots
  return /^[\w.-]+\/[\w.-]+$/.test(repo) && repo.length <= 100;
}

/**
 * Validate issue number (positive integer)
 */
function isValidIssueNumber(num: number): boolean {
  return Number.isInteger(num) && num > 0 && num < 1000000000;
}

/**
 * Validate claimant name (GitHub username format)
 * Prevents command injection via malicious usernames
 */
function isValidClaimantName(name: string): boolean {
  // GitHub usernames: alphanumeric, hyphens, max 39 chars
  return /^[\w-]+$/.test(name) && name.length >= 1 && name.length <= 39;
}

/**
 * Validate label name
 * Prevents command injection via malicious label names
 */
function isValidLabel(label: string): boolean {
  // Labels: alphanumeric, hyphens, underscores, spaces, max 50 chars
  return /^[\w\s-]+$/.test(label) && label.length >= 1 && label.length <= 50;
}

/**
 * Sanitize error messages to prevent information disclosure
 */
function sanitizeError(error: Error): string {
  const msg = error.message || 'Unknown error';
  // Remove paths and sensitive details
  return msg.replace(/\/[\w./-]+/g, '[path]').substring(0, 200);
}

export class GitHubSync {
  private config: GitHubSyncConfig;
  private claimService: ClaimService;

  constructor(claimService: ClaimService, config?: Partial<GitHubSyncConfig>) {
    this.claimService = claimService;
    this.config = { ...DEFAULT_GITHUB_CONFIG, ...config };
  }

  /**
   * Check if GitHub CLI is available
   */
  isGhAvailable(): boolean {
    try {
      execFileSync('gh', ['--version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current repository from git remote
   */
  getRepo(): string | null {
    if (this.config.repo) {
      return isValidRepo(this.config.repo) ? this.config.repo : null;
    }
    try {
      const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf-8' }).trim();
      const match = remote.match(/github\.com[/:]([\w.-]+\/[\w.-]+)/);
      const repo = match ? match[1].replace('.git', '') : null;
      return repo && isValidRepo(repo) ? repo : null;
    } catch {
      return null;
    }
  }

  /**
   * Sync issues from GitHub
   */
  async syncIssues(state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubSyncResult> {
    const errors: string[] = [];
    const issues: GitHubIssue[] = [];

    if (!this.isGhAvailable()) {
      return { success: false, synced: 0, errors: ['GitHub CLI (gh) not installed'] };
    }

    const repo = this.getRepo();
    if (!repo) {
      return { success: false, synced: 0, errors: ['Could not determine GitHub repository'] };
    }

    // Validate state parameter (whitelist)
    const validStates = ['open', 'closed', 'all'];
    if (!validStates.includes(state)) {
      return { success: false, synced: 0, errors: ['Invalid state parameter'] };
    }

    try {
      const issuesJson = execFileSync('gh', [
        'issue', 'list',
        '--repo', repo,
        '--state', state,
        '--json', 'number,title,body,state,labels,assignees,url,createdAt,updatedAt',
        '--limit', '100'
      ], { encoding: 'utf-8' });
      const rawIssues = JSON.parse(issuesJson);

      for (const raw of rawIssues) {
        issues.push({
          number: raw.number,
          title: raw.title,
          body: raw.body || '',
          state: raw.state === 'OPEN' ? 'open' : 'closed',
          labels: raw.labels?.map((l: { name: string }) => l.name) || [],
          assignees: raw.assignees?.map((a: { login: string }) => a.login) || [],
          url: raw.url,
          createdAt: new Date(raw.createdAt),
          updatedAt: new Date(raw.updatedAt),
        });
      }

      return { success: true, synced: issues.length, errors, issues };
    } catch (error) {
      errors.push(`Failed to fetch issues: ${sanitizeError(error as Error)}`);
      return { success: false, synced: 0, errors };
    }
  }

  /**
   * Sync a local claim to GitHub (add label/assignee/comment)
   */
  async claimOnGitHub(issueNumber: number, claimant: Claimant): Promise<GitHubSyncResult> {
    const errors: string[] = [];

    if (!this.config.enabled) {
      return { success: true, synced: 0, errors: ['GitHub sync not enabled'] };
    }

    if (!this.isGhAvailable()) {
      return { success: false, synced: 0, errors: ['GitHub CLI (gh) not installed'] };
    }

    // Validate issue number
    if (!isValidIssueNumber(issueNumber)) {
      return { success: false, synced: 0, errors: ['Invalid issue number'] };
    }

    const repo = this.getRepo();
    if (!repo) {
      return { success: false, synced: 0, errors: ['Could not determine repository'] };
    }

    // Validate claim label
    if (!isValidLabel(this.config.claimLabel)) {
      return { success: false, synced: 0, errors: ['Invalid claim label configuration'] };
    }

    try {
      // Add claim label
      if (this.config.syncLabels) {
        try {
          execFileSync('gh', [
            'issue', 'edit', String(issueNumber),
            '--repo', repo,
            '--add-label', this.config.claimLabel
          ], { stdio: 'ignore' });
        } catch {
          errors.push('Failed to add claim label (label may not exist)');
        }
      }

      // Auto-assign if human claimant
      if (this.config.autoAssign && claimant.type === 'human') {
        if (!isValidClaimantName(claimant.name)) {
          errors.push('Invalid claimant name format');
        } else {
          try {
            execFileSync('gh', [
              'issue', 'edit', String(issueNumber),
              '--repo', repo,
              '--add-assignee', claimant.name
            ], { stdio: 'ignore' });
          } catch {
            errors.push('Failed to assign issue');
          }
        }
      }

      // Add comment
      if (this.config.commentOnClaim) {
        const claimantStr = claimant.type === 'human'
          ? `@${claimant.name.replace(/[^a-zA-Z0-9_-]/g, '')}`
          : `Agent: ${(claimant.agentType || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '')}`;
        const comment = `🤖 **Issue claimed** by ${claimantStr}\n\n_Coordinated by AlexKo V3_`;
        try {
          execFileSync('gh', [
            'issue', 'comment', String(issueNumber),
            '--repo', repo,
            '--body', comment
          ], { stdio: 'ignore' });
        } catch {
          errors.push('Failed to add comment');
        }
      }

      return { success: errors.length === 0, synced: 1, errors };
    } catch (error) {
      errors.push(`GitHub sync failed: ${sanitizeError(error as Error)}`);
      return { success: false, synced: 0, errors };
    }
  }

  /**
   * Release claim on GitHub (remove label/assignee/comment)
   */
  async releaseOnGitHub(issueNumber: number, claimant: Claimant): Promise<GitHubSyncResult> {
    const errors: string[] = [];

    if (!this.config.enabled) {
      return { success: true, synced: 0, errors: ['GitHub sync not enabled'] };
    }

    if (!this.isGhAvailable()) {
      return { success: false, synced: 0, errors: ['GitHub CLI (gh) not installed'] };
    }

    // Validate issue number
    if (!isValidIssueNumber(issueNumber)) {
      return { success: false, synced: 0, errors: ['Invalid issue number'] };
    }

    const repo = this.getRepo();
    if (!repo) {
      return { success: false, synced: 0, errors: ['Could not determine repository'] };
    }

    // Validate claim label
    if (!isValidLabel(this.config.claimLabel)) {
      return { success: false, synced: 0, errors: ['Invalid claim label configuration'] };
    }

    try {
      // Remove claim label
      if (this.config.syncLabels) {
        try {
          execFileSync('gh', [
            'issue', 'edit', String(issueNumber),
            '--repo', repo,
            '--remove-label', this.config.claimLabel
          ], { stdio: 'ignore' });
        } catch {
          // Label might not exist
        }
      }

      // Remove assignee if human claimant
      if (this.config.autoAssign && claimant.type === 'human') {
        if (isValidClaimantName(claimant.name)) {
          try {
            execFileSync('gh', [
              'issue', 'edit', String(issueNumber),
              '--repo', repo,
              '--remove-assignee', claimant.name
            ], { stdio: 'ignore' });
          } catch {
            errors.push('Failed to remove assignee');
          }
        }
      }

      // Add release comment
      if (this.config.commentOnRelease) {
        const claimantStr = claimant.type === 'human'
          ? `@${claimant.name.replace(/[^a-zA-Z0-9_-]/g, '')}`
          : `Agent: ${(claimant.agentType || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '')}`;
        const comment = `🔓 **Issue released** by ${claimantStr}\n\n_This issue is now available for others to claim._`;
        try {
          execFileSync('gh', [
            'issue', 'comment', String(issueNumber),
            '--repo', repo,
            '--body', comment
          ], { stdio: 'ignore' });
        } catch {
          errors.push('Failed to add release comment');
        }
      }

      return { success: errors.length === 0, synced: 1, errors };
    } catch (error) {
      errors.push(`GitHub release sync failed: ${sanitizeError(error as Error)}`);
      return { success: false, synced: 0, errors };
    }
  }

  /**
   * Bulk sync all local claims to GitHub
   */
  async syncAllClaimsToGitHub(): Promise<GitHubSyncResult> {
    const errors: string[] = [];
    let synced = 0;

    const claims = await this.claimService.getAllClaims();
    for (const claim of claims) {
      // Extract issue number from issueId (assumes format like "123" or "issue-123")
      const issueMatch = claim.issueId.match(/(\d+)/);
      if (issueMatch) {
        const result = await this.claimOnGitHub(parseInt(issueMatch[1], 10), claim.claimant);
        if (result.success) synced++;
        else errors.push(...result.errors);
      }
    }

    return { success: errors.length === 0, synced, errors };
  }

  /**
   * Get GitHub issues that are claimed locally
   */
  async getClaimedGitHubIssues(): Promise<GitHubIssue[]> {
    const syncResult = await this.syncIssues('open');
    if (!syncResult.success || !syncResult.issues) return [];

    const localClaims = await this.claimService.getAllClaims();
    const claimedIds = new Set(localClaims.map(c => {
      const match = c.issueId.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    }).filter(Boolean));

    return syncResult.issues.filter(issue => claimedIds.has(issue.number));
  }
}

// ============================================================================
// Factory
