// LLM Backend Base Interface

import { ReviewContext, ReviewResult } from '../types';

export interface LLMBackend {
  readonly name: string;
  
  generate(prompt: string, context: ReviewContext): Promise<string>;
  generateReview(context: ReviewContext): Promise<ReviewResult>;
}
