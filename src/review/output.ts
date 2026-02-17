// Review Output - Formats and exports review results

import { ReviewResult, ReviewComment } from '../types';

export interface OutputFormatter {
  format(result: ReviewResult): string;
  extension: string;
}

export class MarkdownFormatter implements OutputFormatter {
  extension = 'md';

  format(result: ReviewResult): string {
    const lines: string[] = [];

    // Header
    const verdictEmoji = {
      approve: '✅',
      request_changes: '🔄',
      comment: '💬'
    };

    lines.push(`# ${verdictEmoji[result.verdict]} Code Review`);
    lines.push('');
    
    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(result.summary);
    lines.push('');

    // Comments
    if (result.comments.length > 0) {
      lines.push('## Comments');
      lines.push('');

      // Group by file
      const byFile = this.groupByFile(result.comments);
      
      for (const [file, comments] of Object.entries(byFile)) {
        lines.push(`### \`${file}\``);
        lines.push('');

        for (const comment of comments) {
          const emoji = {
            info: '💡',
            warning: '⚠️',
            error: '🚨'
          }[comment.severity];

          lines.push(`${emoji} **Line ${comment.line}:**`);
          lines.push('');
          lines.push(comment.body);
          lines.push('');

          if (comment.suggestion) {
            lines.push('**Suggested fix:**');
            lines.push('```');
            lines.push(comment.suggestion);
            lines.push('```');
            lines.push('');
          }
        }
      }
    }

    // Suggestions
    if (result.suggestions.length > 0) {
      lines.push('## Code Suggestions');
      lines.push('');

      for (const suggestion of result.suggestions) {
        lines.push(`### \`${suggestion.path}:${suggestion.line}\``);
        lines.push('');
        lines.push(suggestion.description);
        lines.push('');
        lines.push('```diff');
        lines.push(`-${suggestion.oldCode}`);
        lines.push(`+${suggestion.newCode}`);
        lines.push('```');
        lines.push('');
      }
    }

    // Verdict
    lines.push('## Verdict');
    lines.push('');
    lines.push(`**${result.verdict.toUpperCase()}**`);
    lines.push('');

    return lines.join('\n');
  }

  private groupByFile(comments: ReviewComment[]): Record<string, ReviewComment[]> {
    return comments.reduce((acc, comment) => {
      if (!acc[comment.path]) {
        acc[comment.path] = [];
      }
      acc[comment.path].push(comment);
      return acc;
    }, {} as Record<string, ReviewComment[]>);
  }
}

export class JsonFormatter implements OutputFormatter {
  extension = 'json';

  format(result: ReviewResult): string {
    return JSON.stringify(result, null, 2);
  }
}

export class GhActionsFormatter implements OutputFormatter {
  extension = 'txt';

  format(result: ReviewResult): string {
    // GitHub Actions compatible output
    const lines: string[] = [];

    lines.push(`::notice::Review Summary: ${result.summary.slice(0, 200)}`);

    for (const comment of result.comments) {
      const level = comment.severity === 'error' ? 'error' : 
                    comment.severity === 'warning' ? 'warning' : 'notice';
      lines.push(`::${level} file=${comment.path},line=${comment.line}::${comment.body}`);
    }

    return lines.join('\n');
  }
}

export function getFormatter(format: string): OutputFormatter {
  switch (format) {
    case 'json':
      return new JsonFormatter();
    case 'gh-actions':
      return new GhActionsFormatter();
    case 'markdown':
    default:
      return new MarkdownFormatter();
  }
}