// Claude LLM Backend - Anthropic API

import fetch from 'node-fetch';
import { LLMBackend } from './base';
import { ReviewContext, ReviewResult, ReviewComment } from '../types';

interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class ClaudeBackend implements LLMBackend {
  readonly name = 'claude';
  private apiKey: string;
  private model: string;
  private maxTokens: number;

  constructor(config: ClaudeConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096;
  }

  async generate(prompt: string, _context: ReviewContext): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    return data.content[0].text;
  }

  async generateReview(context: ReviewContext): Promise<ReviewResult> {
    const prompt = this.buildReviewPrompt(context);
    const response = await this.generate(prompt, context);
    return this.parseReviewResponse(response);
  }

  private buildReviewPrompt(context: ReviewContext): string {
    const { pr, diff, skills } = context;

    const skillContext = skills.length > 0
      ? `\n## Review Skills Applied\n${skills.map((s: { content: string }) => s.content).join('\n\n')}`
      : '';

    const diffSummary = this.buildDiffSummary(diff);

    const fileList = diff.files.map((f: { path: string; status: string; additions: number; deletions: number }) =>
      `- ${f.path} (${f.status}, +${f.additions}/-${f.deletions})`
    ).join('\n');

    return `You are an expert code reviewer. Review this pull request and provide actionable feedback.

## PR Information
Title: ${pr.title}
Author: ${pr.author.username}
Branch: ${pr.sourceBranch} → ${pr.targetBranch}

## Description
${pr.description || 'No description provided.'}

## Changed Files (${diff.files.length} files)
${fileList}

## Diff Summary
${diffSummary}
${skillContext}

## Review Instructions
1. Analyze the diff for issues in: correctness, security, performance, maintainability
2. Be constructive and specific
3. Focus on important issues, not nitpicks
4. Provide code suggestions where helpful

## Output Format
Provide your review in this format:

SUMMARY:
[2-3 sentence overall assessment]

COMMENTS:
[File: path, Line: number]
[Your comment here]

VERDICT: [approve|request_changes|comment]

Note: Only include comments for actual issues. If the PR is good, verdict should be "approve".`;
  }

  private buildDiffSummary(diff: import('../types').Diff): string {
    const maxChars = 30000;
    let summary = '';
    let currentSize = 0;

    for (const file of diff.files) {
      const fileDiff = `--- ${file.path}\n+++ ${file.path}\n${file.hunks.map((h: { content: string }) => h.content).join('\n')}\n`;

      if (currentSize + fileDiff.length > maxChars) {
        summary += `\n... [Diff truncated, ${diff.files.length - diff.files.indexOf(file)} more files]`;
        break;
      }

      summary += fileDiff;
      currentSize += fileDiff.length;
    }

    return summary;
  }

  private parseReviewResponse(response: string): ReviewResult {
    const comments: ReviewComment[] = [];

    const summaryMatch = response.match(/SUMMARY:\s*([\s\S]*?)(?=COMMENTS:|VERDICT:|$)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : response.slice(0, 500);

    const commentPattern = /\[File:\s*([^\],]+),?\s*Line:\s*(\d+)\]\s*([\s\S]*?)(?=\[File:|VERDICT:|$)/gi;
    let match;
    while ((match = commentPattern.exec(response)) !== null) {
      const [, path, line, body] = match;
      comments.push({
        path: path.trim(),
        line: parseInt(line),
        body: body.trim(),
        severity: this.detectSeverity(body)
      });
    }

    const verdictMatch = response.match(/VERDICT:\s*(approve|request_changes|comment)/i);
    const verdict = verdictMatch
      ? (verdictMatch[1].toLowerCase() as ReviewResult['verdict'])
      : 'comment';

    return {
      summary,
      comments,
      suggestions: [],
      verdict
    };
  }

  private detectSeverity(body: string): 'info' | 'warning' | 'error' {
    const lowerBody = body.toLowerCase();
    if (lowerBody.includes('security') || lowerBody.includes('vulnerability') || lowerBody.includes('critical')) {
      return 'error';
    }
    if (lowerBody.includes('should') || lowerBody.includes('consider') || lowerBody.includes('might')) {
      return 'warning';
    }
    return 'info';
  }
}

export function createClaudeBackend(config: ClaudeConfig): ClaudeBackend {
  return new ClaudeBackend(config);
}