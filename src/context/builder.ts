// Context Builder - Assembles review context from multiple sources

import { VCSAdapter } from '../adapters/vcs/base';
import { TicketAdapter } from '../adapters/ticket/base';
import { SkillLoader } from '../skills/loader';
import { PullRequest, Diff, FileInfo, Ticket, Skill, ReviewContext, ReviewConfig } from '../types';

export interface ContextBuilderOptions {
  vcs: VCSAdapter;
  tickets: TicketAdapter[];
  skills: SkillLoader;
  config: ReviewConfig;
  maxFileSize?: number;
}

export class ContextBuilder {
  private vcs: VCSAdapter;
  private tickets: TicketAdapter[];
  private skills: SkillLoader;
  private config: ReviewConfig;
  private maxFileSize: number;

  constructor(options: ContextBuilderOptions) {
    this.vcs = options.vcs;
    this.tickets = options.tickets;
    this.skills = options.skills;
    this.config = options.config;
    this.maxFileSize = options.maxFileSize || 100000; // 100KB default
  }

  async build(prId: string | number): Promise<ReviewContext> {
    // Fetch all data in parallel for speed
    const [pr, diff, files] = await Promise.all([
      this.vcs.getPR(prId),
      this.vcs.getDiff(prId),
      this.vcs.getFiles(prId)
    ]);

    // Filter ignored paths
    const filteredFiles = files.filter((f: FileInfo) => 
      !this.config.ignorePaths.some(ignore => 
        f.path.includes(ignore)
      )
    );

    // Get linked tickets
    const linkedTicketIds = await this.vcs.getLinkedTickets(prId);
    const tickets = await this.fetchTickets(linkedTicketIds);

    // Match skills based on file paths
    const filePaths = filteredFiles.map((f: FileInfo) => f.path);
    const applicableSkills = await this.skills.matchSkills(filePaths);

    // Enrich with file contents if needed
    await this.enrichFileContents(filteredFiles, pr);

    return {
      pr,
      diff,
      files: filteredFiles,
      tickets,
      skills: applicableSkills,
      config: this.config
    };
  }

  private async fetchTickets(ticketIds: Ticket[]): Promise<Ticket[]> {
    const tickets: Ticket[] = [];

    for (const adapter of this.tickets) {
      for (const ticketId of ticketIds) {
        try {
          const ticket = await adapter.getTicket(ticketId.key);
          tickets.push(ticket);
        } catch (error) {
          // Ticket not found in this adapter, continue
        }
      }
    }

    return tickets;
  }

  private async enrichFileContents(files: FileInfo[], pr: PullRequest): Promise<void> {
    // Only fetch content for small files to avoid huge payloads
    for (const file of files) {
      if (this.shouldFetchContent(file)) {
        try {
          file.content = await this.vcs.getFileContent(file.path, pr.sourceBranch);
        } catch {
          // File content not available, continue without it
        }
      }
    }
  }

  private shouldFetchContent(file: FileInfo): boolean {
    // Skip binary files, large files, and common generated files
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
    const generatedPatterns = ['lock', 'min.js', 'min.css', '.d.ts'];

    const ext = file.path.split('.').pop()?.toLowerCase() || '';
    
    if (binaryExtensions.includes(`.${ext}`)) return false;
    if (generatedPatterns.some(p => file.path.includes(p))) return false;

    return true;
  }

  /**
   * Truncate diff if it exceeds configured size limit
   */
  truncateDiff(diff: Diff): Diff {
    let currentSize = 0;
    const truncatedFiles: typeof diff.files = [];

    for (const file of diff.files) {
      const fileSize = file.hunks.reduce((sum, h) => sum + h.content.length, 0);
      
      if (currentSize + fileSize > this.config.maxDiffSize) {
        // Include file header but truncate hunks
        truncatedFiles.push({
          ...file,
          hunks: [{
            oldStart: 0,
            oldLines: 0,
            newStart: 0,
            newLines: 0,
            content: `... [Truncated - file too large]`
          }]
        });
        break;
      }

      truncatedFiles.push(file);
      currentSize += fileSize;
    }

    return {
      ...diff,
      files: truncatedFiles,
      changedFiles: truncatedFiles.length
    };
  }
}