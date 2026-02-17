// GitHub VCS Adapter

import { Octokit } from '@octokit/rest';
import { VCSAdapter } from './base';
import {
  PullRequest,
  Diff,
  FileInfo,
  ReviewComment,
  Review,
  Ticket,
  Author,
  DiffHunk,
  FileDiff
} from '../../types';

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export class GitHubAdapter implements VCSAdapter {
  readonly name = 'github';
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  async getPR(prId: string | number): Promise<PullRequest> {
    const { data: pr } = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: Number(prId)
    });

    return {
      id: String(pr.id),
      number: pr.number,
      title: pr.title,
      description: pr.body || '',
      author: {
        id: String(pr.user?.id),
        username: pr.user?.login || 'unknown',
        email: pr.user?.email ?? undefined
      },
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      url: pr.html_url,
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at)
    };
  }

  async getDiff(prId: string | number): Promise<Diff> {
    const response = await this.octokit.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: Number(prId),
      per_page: 100
    });

    // Get the actual diff content
    const diffResponse = await this.octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner: this.owner,
        repo: this.repo,
        pull_number: Number(prId),
        headers: { Accept: 'application/vnd.github.v3.diff' }
      }
    );

    const diffText = String(diffResponse.data);
    const files = this.parseDiff(diffText, response.data);

    return {
      files,
      additions: response.data.reduce((sum, f) => sum + f.additions, 0),
      deletions: response.data.reduce((sum, f) => sum + f.deletions, 0),
      changedFiles: response.data.length
    };
  }

  private parseDiff(diffText: string, filesData: any[]): FileDiff[] {
    const fileDiffs: FileDiff[] = [];
    const fileBlocks = diffText.split(/^diff --git /m).filter(Boolean);

    for (let i = 0; i < fileBlocks.length && i < filesData.length; i++) {
      const block = fileBlocks[i];
      const fileInfo = filesData[i];
      const hunks = this.parseHunks(block);
      
      let status: FileDiff['status'] = 'modified';
      if (fileInfo.status === 'added') status = 'added';
      else if (fileInfo.status === 'removed') status = 'deleted';
      else if (fileInfo.status === 'renamed') status = 'renamed';

      fileDiffs.push({
        path: fileInfo.filename,
        oldPath: fileInfo.previous_filename,
        status,
        additions: fileInfo.additions,
        deletions: fileInfo.deletions,
        hunks
      });
    }

    return fileDiffs;
  }

  private parseHunks(diffBlock: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const hunkRegex = /@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/g;
    let match;

    while ((match = hunkRegex.exec(diffBlock)) !== null) {
      const [fullMatch, oldStart, oldLines, newStart, newLines] = match;
      
      // Extract hunk content
      const startIndex = match.index + fullMatch.length;
      let endIndex = diffBlock.indexOf('@@ ', startIndex);
      if (endIndex === -1) endIndex = diffBlock.length;
      
      const content = diffBlock.slice(startIndex, endIndex).trim();

      hunks.push({
        oldStart: parseInt(oldStart) || 1,
        oldLines: parseInt(oldLines) || 0,
        newStart: parseInt(newStart) || 1,
        newLines: parseInt(newLines) || 0,
        content
      });
    }

    return hunks;
  }

  async getFiles(prId: string | number): Promise<FileInfo[]> {
    const { data: files } = await this.octokit.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: Number(prId),
      per_page: 100
    });

    return files.map(file => ({
      path: file.filename,
      language: this.detectLanguage(file.filename)
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
      h: 'c',
      hpp: 'cpp',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      css: 'css',
      scss: 'scss',
      html: 'html',
      sql: 'sql',
      sh: 'bash',
      dockerfile: 'dockerfile'
    };
    return langMap[ext] || 'text';
  }

  async addComment(prId: string | number, comment: ReviewComment): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: Number(prId),
      body: comment.body
    });
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

    // Get the PR to find the head commit
    const pr = await this.getPR(prId);

    await this.octokit.pulls.createReviewComment({
      owner: this.owner,
      repo: this.repo,
      pull_number: Number(prId),
      path,
      line,
      body: `${severityEmoji[severity]} ${body}`,
      commit_id: pr.sourceBranch
    });
  }

  async submitReview(prId: string | number, review: Review): Promise<void> {
    // First create review comments
    const comments = review.comments.map(c => ({
      path: c.path,
      line: c.line,
      body: c.body
    }));

    const eventMap: Record<string, 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'> = {
      approve: 'APPROVE',
      request_changes: 'REQUEST_CHANGES',
      comment: 'COMMENT'
    };

    await this.octokit.pulls.createReview({
      owner: this.owner,
      repo: this.repo,
      pull_number: Number(prId),
      event: eventMap[review.verdict],
      body: review.summary,
      comments
    });
  }

  async getLinkedTickets(prId: string | number): Promise<Ticket[]> {
    const pr = await this.getPR(prId);
    // Parse ticket IDs from PR description and title
    const ticketPatterns = [
      /\b([A-Z]+-\d+)\b/g,  // Jira: PROJ-123
      /\b([A-Z]{2,}-\d+)\b/g, // Linear: ENG-123
      /#(\d+)/g              // GitHub Issues: #123
    ];

    const tickets: Ticket[] = [];
    const text = `${pr.title} ${pr.description}`;

    // For now, just extract IDs - actual fetching requires ticket adapters
    for (const pattern of ticketPatterns) {
      const matches = text.match(pattern) || [];
      for (const match of matches) {
        tickets.push({
          id: match.replace('#', ''),
          key: match.replace('#', ''),
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
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: ref || 'main'
      });

      if ('content' in data) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return '';
    } catch {
      return '';
    }
  }
}

export function createGitHubAdapter(config: GitHubConfig): GitHubAdapter {
  return new GitHubAdapter(config);
}
