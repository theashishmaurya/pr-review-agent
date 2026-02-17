// Core types for the PR Review Agent

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  description: string;
  author: Author;
  sourceBranch: string;
  targetBranch: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Author {
  id: string;
  username: string;
  email?: string;
}

export interface Diff {
  files: FileDiff[];
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface FileDiff {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface FileInfo {
  path: string;
  content?: string;
  language?: string;
}

export interface ReviewComment {
  id?: string;
  path: string;
  line: number;
  body: string;
  severity: 'info' | 'warning' | 'error';
  suggestion?: string;
}

export interface Review {
  summary: string;
  comments: ReviewComment[];
  verdict: 'approve' | 'request_changes' | 'comment';
}

export interface Ticket {
  id: string;
  key: string;
  title: string;
  description: string;
  status: string;
  type: string;
  labels: string[];
  acceptanceCriteria?: string[];
}

export interface TicketContext {
  ticket: Ticket;
  relatedPRs: string[];
}

export interface ReviewContext {
  pr: PullRequest;
  diff: Diff;
  files: FileInfo[];
  tickets: Ticket[];
  skills: Skill[];
  config: ReviewConfig;
}

export interface ReviewResult {
  summary: string;
  comments: ReviewComment[];
  suggestions: CodeSuggestion[];
  verdict: 'approve' | 'request_changes' | 'comment';
}

export interface CodeSuggestion {
  path: string;
  line: number;
  oldCode: string;
  newCode: string;
  description: string;
}

export interface ReviewConfig {
  maxDiffSize: number;
  focusAreas: string[];
  ignorePaths: string[];
}

export interface Skill {
  name: string;
  description: string;
  triggers: string[];
  priority: 'low' | 'medium' | 'high';
  content: string;
}

export interface Config {
  vcs: {
    github?: {
      token: string;
    };
    azure?: {
      organization: string;
      project: string;
      token: string;
    };
  };
  tickets: TicketConfig[];
  llm: LLMConfig;
  review: ReviewConfig;
  skills: {
    path: string;
    default: string;
  };
}

export interface TicketConfig {
  type: 'jira' | 'linear' | 'github' | 'azure';
  patterns: string[];
  adapter: {
    url?: string;
    token?: string;
    apiKey?: string;
  };
}

export interface LLMConfig {
  provider: 'ollama' | 'claude' | 'openai';
  model: string;
  baseUrl?: string;
  apiKey?: string;
}
