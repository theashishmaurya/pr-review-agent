// VCS Adapter Base Interface

import { PullRequest, Diff, FileInfo, ReviewComment, Review, Ticket, Author } from '../../types';

export interface VCSAdapter {
  readonly name: string;

  // PR Operations
  getPR(prId: string | number): Promise<PullRequest>;
  getDiff(prId: string | number): Promise<Diff>;
  getFiles(prId: string | number): Promise<FileInfo[]>;

  // Comments
  addComment(prId: string | number, comment: ReviewComment): Promise<void>;
  addInlineComment(
    prId: string | number,
    path: string,
    line: number,
    body: string,
    severity?: 'info' | 'warning' | 'error'
  ): Promise<void>;
  submitReview(prId: string | number, review: Review): Promise<void>;

  // PR Metadata
  getLinkedTickets(prId: string | number): Promise<Ticket[]>;
  getAuthor(prId: string | number): Promise<Author>;

  // File Content
  getFileContent(path: string, ref?: string): Promise<string>;
}
