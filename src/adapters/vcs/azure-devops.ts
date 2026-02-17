// Azure DevOps VCS Adapter

import fetch from 'node-fetch';
import { VCSAdapter } from './base';
import {
  PullRequest,
  Diff,
  FileInfo,
  ReviewComment,
  Review,
  Ticket,
  Author,
  FileDiff,
  DiffHunk
} from '../../types';

interface AzureDevOpsConfig {
  organization: string;
  project: string;
  repository: string;
  token: string;
  baseUrl?: string;
}

export class AzureDevOpsAdapter implements VCSAdapter {
  readonly name = 'azure-devops';
  private organization: string;
  private project: string;
  private repository: string;
  private token: string;
  private baseUrl: string;

  constructor(config: AzureDevOpsConfig) {
    this.organization = config.organization;
    this.project = config.project;
    this.repository = config.repository;
    this.token = config.token;
    this.baseUrl = config.baseUrl || 'https://dev.azure.com';
  }

  private getAuthHeaders(): Record<string, string> {
    // Azure DevOps uses Basic auth with PAT (password is empty)
    const encoded = Buffer.from(`:${this.token}`).toString('base64');
    return {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json'
    };
  }

  private getApiUrl(path: string): string {
    return `${this.baseUrl}/${this.organization}/${this.project}/_apis${path}`;
  }

  private getGitApiUrl(path: string): string {
    return `${this.baseUrl}/${this.organization}/${this.project}/_apis/git${path}`;
  }

  async getPR(prId: string | number): Promise<PullRequest> {
    const url = this.getGitApiUrl(`/repositories/${this.repository}/pullrequests/${prId}?api-version=7.0`);
    
    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PR: ${response.statusText}`);
    }

    const data = await response.json() as {
      pullRequestId: number;
      title: string;
      description: string;
      createdBy: { id: string; displayName: string; uniqueName: string };
      sourceRefName: string;
      targetRefName: string;
      url: string;
      creationDate: string;
    };

    return {
      id: String(data.pullRequestId),
      number: data.pullRequestId,
      title: data.title,
      description: data.description || '',
      author: {
        id: data.createdBy.id,
        username: data.createdBy.uniqueName,
        email: data.createdBy.uniqueName
      },
      sourceBranch: data.sourceRefName.replace('refs/heads/', ''),
      targetBranch: data.targetRefName.replace('refs/heads/', ''),
      url: data.url,
      createdAt: new Date(data.creationDate),
      updatedAt: new Date(data.creationDate)
    };
  }

  async getDiff(prId: string | number): Promise<Diff> {
    // Get the list of changed files
    const url = this.getGitApiUrl(
      `/repositories/${this.repository}/pullrequests/${prId}/iterations?api-version=7.0`
    );

    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PR iterations: ${response.statusText}`);
    }

    const iterations = await response.json() as { value: Array<{ id: number }> };
    const latestIteration = iterations.value[iterations.value.length - 1]?.id || 1;

    // Get changes in the iteration
    const changesUrl = this.getGitApiUrl(
      `/repositories/${this.repository}/pullrequests/${prId}/iterations/${latestIteration}/changes?api-version=7.0`
    );

    const changesResponse = await fetch(changesUrl, {
      headers: this.getAuthHeaders()
    });

    if (!changesResponse.ok) {
      throw new Error(`Failed to fetch PR changes: ${changesResponse.statusText}`);
    }

    const changesData = await changesResponse.json() as {
      changeEntries: Array<{
        changeId: number;
        changeTrackingId: number;
        item: { path: string };
        changeType: 'add' | 'edit' | 'delete' | 'rename';
      }>
    };

    // Get the actual diff for each file
    const files: FileDiff[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const change of changesData.changeEntries || []) {
      const diffContent = await this.getFileDiff(prId, change.item.path, latestIteration);
      
      files.push({
        path: change.item.path,
        status: this.mapChangeType(change.changeType),
        additions: diffContent.additions,
        deletions: diffContent.deletions,
        hunks: diffContent.hunks
      });

      totalAdditions += diffContent.additions;
      totalDeletions += diffContent.deletions;
    }

    return {
      files,
      additions: totalAdditions,
      deletions: totalDeletions,
      changedFiles: files.length
    };
  }

  private async getFileDiff(
    prId: string | number,
    filePath: string,
    iteration: number
  ): Promise<{ additions: number; deletions: number; hunks: DiffHunk[] }> {
    // Fetch diff content
    const url = this.getGitApiUrl(
      `/repositories/${this.repository}/pullrequests/${prId}/iterations/${iteration}/changes?api-version=7.0&$top=1&changeId=${filePath}`
    );

    try {
      const response = await fetch(url, {
        headers: { ...this.getAuthHeaders(), 'Accept': 'application/json' }
      });

      if (!response.ok) {
        // Could not fetch diff, return empty
        return { additions: 0, deletions: 0, hunks: [] };
      }

      // Parse the diff content from the response
      // Azure DevOps API returns diff in a specific format
      const data = await response.json() as {
        changeEntries?: Array<{
          linesAdded?: number;
          linesRemoved?: number;
        }>
      };

      const changeEntry = data.changeEntries?.[0];
      const additions = changeEntry?.linesAdded || 0;
      const deletions = changeEntry?.linesRemoved || 0;

      return {
        additions,
        deletions,
        hunks: [] // Would need additional API call for full hunks
      };
    } catch {
      return { additions: 0, deletions: 0, hunks: [] };
    }
  }

  private mapChangeType(changeType: string): FileDiff['status'] {
    switch (changeType) {
      case 'add':
        return 'added';
      case 'edit':
        return 'modified';
      case 'delete':
        return 'deleted';
      case 'rename':
        return 'renamed';
      default:
        return 'modified';
    }
  }

  async getFiles(prId: string | number): Promise<FileInfo[]> {
    const diff = await this.getDiff(prId);
    return diff.files.map(f => ({
      path: f.path,
      language: this.detectLanguage(f.path)
    }));
  }

  private detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      kt: 'kotlin',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      css: 'css',
      scss: 'scss',
      html: 'html',
      sql: 'sql',
      sh: 'bash'
    };
    return langMap[ext] || 'text';
  }

  async addComment(prId: string | number, comment: ReviewComment): Promise<void> {
    const url = this.getGitApiUrl(
      `/repositories/${this.repository}/pullrequests/${prId}/threads?api-version=7.0`
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        comments: [{
          parentCommentId: 0,
          content: comment.body,
          commentType: 'text'
        }],
        status: 'active'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to add comment: ${response.statusText}`);
    }
  }

  async addInlineComment(
    prId: string | number,
    path: string,
    line: number,
    body: string,
    severity: 'info' | 'warning' | 'error' = 'info'
  ): Promise<void> {
    const severityEmoji = {
      info: '💡',
      warning: '⚠️',
      error: '🚨'
    };

    const url = this.getGitApiUrl(
      `/repositories/${this.repository}/pullrequests/${prId}/threads?api-version=7.0`
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        comments: [{
          parentCommentId: 0,
          content: `${severityEmoji[severity]} ${body}`,
          commentType: 'text'
        }],
        status: 'active',
        threadContext: {
          filePath: path,
          rightFileStart: {
            line,
            offset: 1
          },
          rightFileEnd: {
            line,
            offset: 1
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to add inline comment: ${response.statusText}`);
    }
  }

  async submitReview(prId: string | number, review: Review): Promise<void> {
    // Post summary as a comment
    const summaryUrl = this.getGitApiUrl(
      `/repositories/${this.repository}/pullrequests/${prId}/threads?api-version=7.0`
    );

    const verdictEmoji = {
      approve: '✅',
      request_changes: '🔄',
      comment: '💬'
    };

    // Post all inline comments
    for (const comment of review.comments) {
      await this.addInlineComment(prId, comment.path, comment.line, comment.body, comment.severity);
    }

    // Post summary
    await fetch(summaryUrl, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        comments: [{
          parentCommentId: 0,
          content: `${verdictEmoji[review.verdict]} **Review Summary**\n\n${review.summary}\n\n**Verdict:** ${review.verdict}`,
          commentType: 'text'
        }],
        status: 'active'
      })
    });

    // Set vote (approve/reject)
    const voteMap: Record<string, number> = {
      approve: 10,      // Approved
      request_changes: -5,  // Waiting for author
      comment: 0        // No vote
    };

    if (voteMap[review.verdict] !== 0) {
      const prUrl = this.getGitApiUrl(
        `/repositories/${this.repository}/pullrequests/${prId}?api-version=7.0`
      );

      await fetch(prUrl, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          vote: voteMap[review.verdict]
        })
      });
    }
  }

  async getLinkedTickets(prId: string | number): Promise<Ticket[]> {
    const pr = await this.getPR(prId);
    const tickets: Ticket[] = [];
    const text = `${pr.title} ${pr.description}`;

    // Parse ticket IDs from PR description
    // Jira: PROJ-123
    // Azure Boards: #123 or AB#123
    const patterns = [
      /\b([A-Z]+-\d+)\b/g,      // Jira
      /\bAB#(\d+)\b/g,          // Azure Boards
      /#(\d+)/g                  // Simple number
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern) || [];
      for (const match of matches) {
        tickets.push({
          id: match.replace(/^(AB)?#/, ''),
          key: match,
          title: 'Linked ticket',
          description: '',
          status: 'unknown',
          type: 'unknown',
          labels: []
        });
      }
    }

    return tickets;
  }

  async getAuthor(prId: string | number): Promise<Author> {
    const pr = await this.getPR(prId);
    return pr.author;
  }

  async getFileContent(path: string, ref?: string): Promise<string> {
    const branch = ref || 'main';
    const url = this.getGitApiUrl(
      `/repositories/${this.repository}/items?path=${path}&versionDescriptor[versionOptions]=0&versionDescriptor[versionType]=0&versionDescriptor[version]=${branch}&api-version=7.0`
    );

    const response = await fetch(url, {
      headers: { ...this.getAuthHeaders(), 'Accept': 'application/octet-stream' }
    });

    if (!response.ok) {
      return '';
    }

    return await response.text();
  }
}

export function createAzureDevOpsAdapter(config: AzureDevOpsConfig): AzureDevOpsAdapter {
  return new AzureDevOpsAdapter(config);
}