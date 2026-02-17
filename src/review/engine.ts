// Review Engine - Orchestrates the review process

import { LLMBackend } from '../llm/base';
import { ContextBuilder } from '../context/builder';
import { ReviewContext, ReviewResult, ReviewComment, CodeSuggestion } from '../types';

export interface ReviewEngineOptions {
  llm: LLMBackend;
  contextBuilder: ContextBuilder;
  maxComments?: number;
  maxSuggestions?: number;
}

export class ReviewEngine {
  private llm: LLMBackend;
  private contextBuilder: ContextBuilder;
  private maxComments: number;
  private maxSuggestions: number;

  constructor(options: ReviewEngineOptions) {
    this.llm = options.llm;
    this.contextBuilder = options.contextBuilder;
    this.maxComments = options.maxComments || 20;
    this.maxSuggestions = options.maxSuggestions || 10;
  }

  async review(prId: string | number): Promise<ReviewResult> {
    // Build context
    const context = await this.contextBuilder.build(prId);

    // Generate review via LLM
    const result = await this.llm.generateReview(context);

    // Post-process: limit comments
    result.comments = result.comments.slice(0, this.maxComments);
    result.suggestions = result.suggestions.slice(0, this.maxSuggestions);

    // Validate comments have required fields
    result.comments = result.comments.filter((c: ReviewComment) => 
      c.path && c.line && c.body
    );

    return result;
  }

  /**
   * Generate a quick summary review without inline comments
   */
  async quickSummary(prId: string | number): Promise<string> {
    const context = await this.contextBuilder.build(prId);
    
    const prompt = `Provide a brief 2-3 sentence summary of this PR without inline comments.

PR: ${context.pr.title}
Files changed: ${context.diff.changedFiles}
Additions: +${context.diff.additions}
Deletions: -${context.diff.deletions}

Summary:`;

    return await this.llm.generate(prompt, context);
  }

  /**
   * Review only specific files
   */
  async reviewFiles(prId: string | number, filePaths: string[]): Promise<ReviewResult> {
    const context = await this.contextBuilder.build(prId);
    
    // Filter context to only specified files
    context.files = context.files.filter(f => filePaths.includes(f.path));
    context.diff.files = context.diff.files.filter(f => filePaths.includes(f.path));

    return await this.llm.generateReview(context);
  }

  /**
   * Apply a specific skill to the review
   */
  async reviewWithSkill(prId: string | number, skillName: string): Promise<ReviewResult> {
    const context = await this.contextBuilder.build(prId);
    
    // Find and prioritize the skill
    const skill = context.skills.find(s => 
      s.name.toLowerCase() === skillName.toLowerCase()
    );

    if (skill) {
      // Move skill to front of array for priority
      context.skills = [skill, ...context.skills.filter(s => s !== skill)];
    }

    return await this.llm.generateReview(context);
  }
}