// Skill Loader

import * as fs from 'fs';
import * as path from 'path';
import { Skill } from '../types';

export class SkillLoader {
  private skillsPath: string;

  constructor(skillsPath: string) {
    this.skillsPath = skillsPath;
  }

  async loadSkills(): Promise<Skill[]> {
    const skills: Skill[] = [];
    
    if (!fs.existsSync(this.skillsPath)) {
      return skills;
    }

    const skillDirs = fs.readdirSync(this.skillsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dir of skillDirs) {
      const skillPath = path.join(this.skillsPath, dir, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        const skill = await this.loadSkill(dir, skillPath);
        if (skill) skills.push(skill);
      }
    }

    // Sort by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    skills.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    return skills;
  }

  private async loadSkill(name: string, skillPath: string): Promise<Skill | null> {
    try {
      const content = fs.readFileSync(skillPath, 'utf-8');
      const frontMatter = this.parseFrontMatter(content);
      const bodyContent = this.extractBody(content);

      return {
        name: frontMatter.name || name,
        description: frontMatter.description || '',
        triggers: frontMatter.trigger || [],
        priority: frontMatter.priority || 'medium',
        content: bodyContent
      };
    } catch (error) {
      console.error(`Failed to load skill ${name}:`, error);
      return null;
    }
  }

  private parseFrontMatter(content: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Check for YAML front matter
    const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return result;
    }

    const frontMatter = frontMatterMatch[1];
    
    // Parse simple YAML key-value pairs
    const lines = frontMatter.split('\n');
    let currentKey: string | null = null;
    
    for (const line of lines) {
      const keyMatch = line.match(/^(\w+):\s*(.*)$/);
      if (keyMatch) {
        const [, key, value] = keyMatch;
        currentKey = key;
        
        if (value) {
          result[key] = value;
        } else {
          result[key] = [];
        }
      } else if (line.startsWith('  - ') && currentKey) {
        (result[currentKey] as any[]).push(line.slice(4));
      }
    }

    return result;
  }

  private extractBody(content: string): string {
    // Remove front matter and return body
    return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').trim();
  }

  /**
   * Match skills based on file paths - loads skills and matches
   */
  async matchSkills(filePaths: string[]): Promise<Skill[]> {
    const skills = await this.loadSkills();
    const matched = new Set<Skill>();

    for (const filePath of filePaths) {
      for (const skill of skills) {
        for (const trigger of skill.triggers) {
          if (this.matchesPattern(filePath, trigger)) {
            matched.add(skill);
            break;
          }
        }
      }
    }

    return Array.from(matched);
  }

  /**
   * List all available skills
   */
  async listSkills(): Promise<Skill[]> {
    return this.loadSkills();
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob-like pattern matching
    const regex = pattern
      .replace(/\*\*/g, '<<DOUBLE_STAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<DOUBLE_STAR>>/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(regex).test(filePath);
  }
}

export function createSkillLoader(skillsPath: string): SkillLoader {
  return new SkillLoader(skillsPath);
}
