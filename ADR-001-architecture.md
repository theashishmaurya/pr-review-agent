# ADR-001: PR Review Agent Architecture

## Status
Proposed

## Context

We need an AI-powered PR review agent that:
- Reviews pull requests on **GitHub** and **Azure DevOps**
- Adds meaningful review comments
- References related tickets (Jira, Linear, GitHub Issues, Azure Boards)
- Runs locally via **Claude Code + Ollama**
- Integrates into CI/CD pipelines

### Constraints
- Must run locally (no external API calls for code review)
- Support multiple VCS platforms (GitHub, Azure DevOps)
- Should be callable from CI pipelines (GitHub Actions, Azure Pipelines)
- Token budget: ~32K context window for diffs + context

## Decision

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CI/CD Pipeline                           │
│  (GitHub Actions / Azure Pipelines / Webhook Trigger)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PR Review Agent                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
││   VCS        │  │   Ticket    │  │   Review Engine         │  │
││   Adapters   │  │   Adapters  │  │   (Claude Code + Ollama)│  │
││              │  │             │  │                         │  │
││ - GitHub     │  │ - Jira      │  │  - Diff Analysis        │  │
│ │ - Azure     │  │ - Linear    │  │  - Code Understanding  │  │
│ │   DevOps    │  │ - GH Issues │  │  - Comment Generation  │  │
│ └─────────────┘  │ - Azure     │  │  - Suggestion Engine   │  │
│                  │   Boards    │  └─────────────────────────┘  │
│                  └─────────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Output Layer                                │
│  - Review Comments (inline + summary)                          │
│  - Approval/Changes Requested                                   │
│  - Ticket Linkages                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. VCS Adapters (Platform Abstraction)

```typescript
interface VCSAdapter {
  // PR Operations
  getPR(prId: string): Promise<PullRequest>;
  getDiff(prId: string): Promise<Diff>;
  getFiles(prId: string): Promise<FileInfo[]>;
  
  // Comments
  addComment(prId: string, comment: ReviewComment): Promise<void>;
  addInlineComment(prId: string, path: string, line: number, body: string): Promise<void>;
  submitReview(prId: string, review: Review): Promise<void>;
  
  // PR Metadata
  getLinkedTickets(prId: string): Promise<Ticket[]>;
  getAuthor(prId: string): Promise<Author>;
}
```

**Implementations:**
- `GitHubAdapter` - REST API + GraphQL for advanced queries
- `AzureDevOpsAdapter` - Azure DevOps REST API

#### 2. Ticket Adapters (Context Enrichment)

```typescript
interface TicketAdapter {
  getTicket(ticketId: string): Promise<Ticket>;
  getTicketContext(ticketId: string): Promise<TicketContext>;
}

interface TicketContext {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  relatedPRs: string[];
  labels: string[];
}
```

#### 3. Review Engine (Claude Code + Ollama)

The brain of the operation. Takes diff + context, produces review.

```typescript
interface ReviewEngine {
  analyzeDiff(diff: Diff, context: ReviewContext): Promise<ReviewResult>;
}

interface ReviewContext {
  pr: PullRequest;
  tickets: Ticket[];
  codebase?: CodebaseContext;  // File tree, recent changes
  reviewConfig: ReviewConfig;
}

interface ReviewResult {
  summary: string;
  comments: ReviewComment[];
  suggestions: CodeSuggestion[];
  verdict: 'approve' | 'request_changes' | 'comment';
}
```

#### 4. Tool Layer (For Claude Code)

Tools exposed to Claude Code for performing review actions:

```typescript
const reviewTools = [
  {
    name: 'get_pr_diff',
    description: 'Get the diff for a PR',
    parameters: { pr_id: 'string', vcs: 'github | azure' }
  },
  {
    name: 'get_pr_files',
    description: 'List changed files in PR',
    parameters: { pr_id: 'string' }
  },
  {
    name: 'get_ticket',
    description: 'Get ticket |
  {
    name:  
    name: 'add_review_comment',
    description: 'Add an inline review comment',
       parameters: {
      pr_id: 'string',
      file_path: 'string',
      line: 'number',
      body: 'string',
      severity: 'info | warning | error'
    }
  },
  {
    name: 'submit_review',
    description: 'Submit the final review',
    parameters: {
      pr_id: 'string',
      verdict: 'approve | request_changes | comment',
      summary: 'string'
    }
  },
  {
    name: 'get_file_content',
    description: 'Get content of a file for context|  
];
```

### Data Flow

```
1. Trigger: PR opened/updated
   │
   ▼
2. Fetch PR Data
   - Get diff (target branch vs PR branch)
   - Get file list
   - Get PR description (may contain ticket refs)
│
   ▼
3. Enrich Context
   - Parse ticket IDs from PR description/title
   - Fetch ticket details (acceptance criteria, context)
   - Optional: Get surrounding code context
   │
   ▼
4. Run Review
   - Claude Code analyzes diff with full context
   - Generates structured review:
     * Summary comment
     * Inline comments on specific lines
     * Code suggestions
     * Verdict (approve/request changes)
   │
   ▼
5. Submit Review
   - Post comments via VCS API
   - Set review status
   - Link to related tickets
```

### Prompt Structure

```
You are a code reviewer. Review this PR and provide actionable feedback.

## Context
{ticket_context}
{pr_description}

## Changed Files
{file_list}

## Diff
{diff}

## Review Guidelines
- Focus on: correctness, security, performance, maintainability
- Be constructive, not pedantic
- Reference ticket requirements when relevant
- Suggest improvements, don't just point out problems

## Tools Available
{tool_descriptions}

## Output Format
1. Analyze the diff
2. Use tools to get additional context if needed
3. Add inline comments for specific issues
4. Submit review with summary and verdict
```

### Deployment Options

#### Option A: CLI Tool (MVP)

```bash
pr-review review --pr 123 --repo owner/repo --vcs github
pr-review review --pr 456 --repo project/repo --vcs azure
```

**Pros:** Simple, testable, can run locally  
**Cons:** Manual trigger only

#### Option B: CI Integration

```yaml
# GitHub Actions
- name: AI PR Review
  run: pr-review review --pr ${{ github.event.pull_request.number }} --vcs github
  env:
    GITHUB                                                     
```

```yaml
# Azure Pipelines
- task: PRTask@1
  inputs:
    vcs: 'azure'
    prId: '$(System.PullRequest.PullRequestId)'
```

**Pros:** Automatic on every PR  
**Cons:** Requires CI setup

#### Option C: Webhook Server

```                                                       
POST /webhook/github
POST /webhook/azure
```

**Pros:** Real-time, no CI changes  
**Cons:** Infrastructure, auth

### Recommended: Start with Option A → B

1. **Phase 1:** CLI tool for manual testing
2. **Phase 2:** CI integration for automation
3. **Phase 3:** Webhook server if needed

## Consequences

### Positive
- Consistent review quality
- Catches common issues before human review
- Links code changes to ticket context
- Runs locally (privacy, cost control)
- Platform-agnostic design

### Negative
- Initial setup complexity
- Model may miss nuanced issues
- Need to tune prompts for codebase style
- Token limits on large PRs

### Risks
- Hallucinated comments (mitigate with validation)
- Rate limits on VCS APIs (mitigate with batching)
- Model bias (mitigate with prompt tuning)

## Implementation Plan

### Sprint 1: Foundation
- [ ] Claude                                                           
- [ ] GitHub adapter (get PR, get diff, add comments)
- [ ] Basic review prompt
- [ ] CLI interface

### Sprint 2: Azure + Tickets
- [ ] Azure DevOps adapter
- [ ] Ticket adapters (Jira, Linear)                                                    
- [ ] Context enrichment
- [ ] Better comment formatting

### Sprint                
- [ ] CI integration (GitHub Actions, Azure Pipelines)
- [ ] Review configuration (custom rules, severity levels)
- [ ] Metrics (review quality, time saved)

### Sprint 4: Polish
- [ ] Caching for repeated reviews
- [ ] Incremental reviews (only new commits)
- [ ] Review templates per repo
- [ ] Documentation

## Technology Stack

| Component | Technology |
|-----------|------------}
| Review Engine | Claude Code + Ollama |
| CLI Framework | Node.js (commander/yargs) |
| VCS APIs | Octokit (GitHub), azure-devops-node-api |
| Ticket APIs | jira.js, Linear SDK |
| Config | YAML/JSON per repo |
| Logging | Pino or Winston |

## Configuration Example

```yaml
# .pr-review.yaml
vcs:
  github:
    token: ${                                          
  azure:
    organization: myorg
    project: myproject
    token: ${AZURE_PAT}                                              

tickets:
  - type: jira
    patterns:
      - "[A-Z]+-\\d+"  # PROJ-123
    adapter:
      url: https://company.atlassian.net
      token: ${JIRA_TOKEN}
  - type: linear
    patterns:
      - "[A-Z]{2,}-\\d+"  # ENG-123
    adapter:
      apiKey: ${LINEAR_API_KEY}

review:
  maxDiffSize: 50000  # characters
  focusAreas:
    - security
    - performance
    - testing
  ignorePaths:
    - "*.lock"
    - "dist/"
    - "node_modules/"

ollama:
  model: claude-code
  baseUrl: http://localhost:11434
```

## Skills-Based Review System

Review behavior is driven by **skills** (like OpenClaw's skill system), not hardcoded rules.

### Skills Architecture

```
~/.pr-review/
├── skills/
│   ├── default/
│   │   └── SKILL.md          # Default review behavior
│   ├── security/
│   │   └── SKILL.md          # Security-focused reviews
│   ├── frontend/
│   │   └── SKILL.md          # React/TypeScript patterns
│   ├── backend/
│   │   └── SKILL.md          # API/Database patterns
│   └── custom/
│       └── SKILL.md          # User-defined skills
├── memory/
│   └── conventions.md        # Learned codebase conventions
└── config.yaml
```

### Skill Structure

```markdown
---
name: Frontend Review
trigger:
  - "src/**/*.tsx"
  - "src/**/*.ts"
  - "src/**/*.css"
priority: high
---

## Review Focus
- Component structure and patterns
- State management correctness
- Accessibility (a11y)
- Performance (React anti-patterns)
- TypeScript type safety

## Common Issues to Catch
- Missing useCallback for event handlers
- Incorrect dependency arrays in useEffect
- Unnecessary re-renders
- Missing error boundaries

## Style Conventions
- Use arrow functions for components
- Prefer named exports
- Colocate styles with components
```

### Skill Loading Logic

1. **Detect file types** in PR diff
2. **Match skills** by trigger patterns
3. **Inject skill prompts** into review context
4. **Apply skill-specific review rules**

### Benefits
- Different review behavior per codebase
- Team-specific conventions
- Incremental skill library
- Shareable across projects

---

## LLM Configuration

The review engine supports multiple LLM backends, configurable via CLI or config file.

### Configurable Backend

```yaml
# config.yaml
llm:
  provider: ollama  # or "claude" or "openai"
  model: qwen3.5:cloud
  baseUrl: http://localhost:11434
  
  # Alternative configurations:
  # provider: claude
  # apiKey: ${ANTHROPIC_API_KEY}
  # model: claude-sonnet-4-5-20250929
```

### CLI Usage

```bash
# Use Ollama (default)
pr-review --pr 123 --repo owner/repo

# Use Claude Code
pr-review --pr 123 --repo owner/repo --provider claude

# Use specific Ollama model
pr-review --pr 123 --repo owner/repo --model qwen3.5:cloud

# Launch via Ollama (long-running)
ollama launch claude --model qwen3.5:cloud
pr-review --pr 123 --repo owner/repo
```

### Backend Abstraction

```typescript
interface LLMBackend {
  generate(prompt: string, context: ReviewContext): Promise<ReviewResult>;
}

class OllamaBackend implements LLMBackend {
  constructor(model: string, baseUrl: string) {}
}

class ClaudeBackend implements LLMBackend {
  constructor(apiKey: string, model: string) {}
}

class OpenAIBackend implements LLMBackend {
  constructor(apiKey: string, model: string) {}
}
```

---

## Binary Distribution

Distribute as a single binary (like CodeRabbit CLI).

### Build Targets

| Platform | Architecture | Binary Name |
|----------|--------------|-------------|
| Linux | x64 | `pr-review-linux-amd64` |
| Linux | ARM64 | `pr-review-linux-arm64` |
| macOS | x64 | `pr-review-darwin-amd64` |
| macOS | ARM64 | `pr-review-darwin-arm64` |
| Windows | x64 | `pr-review-windows-amd64.exe` |

### Installation

```bash
# Install via curl
curl -fsSL https://pr-review.dev/install.sh | bash

# Install via npm
npm install -g @pr-review/cli

# Install via brew (future)
brew install pr-review
```

### Build Technology

- **Go** or **Rust** for single binary distribution
- **Alternative:** Node.js packaged with `pkg` or `bun`
- Include all adapters, no external dependencies

---

## Trigger Model

**Pipeline-triggered, NOT continuously running.**

### Trigger Sources

| Source | How It Works |
|--------|--------------|
| **CLI (Manual)** | User runs `pr-review --pr 123` |
| **GitHub Actions** | Workflow step calls binary |
| **Azure Pipelines** | Task calls binary |
| **Webhook → CI** | Webhook triggers pipeline which runs binary |

### GitHub Actions Example

```yaml
# .github/workflows/pr-review.yml
name: AI PR Review
on: 
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for better context
      
      - name: Setup PR Review
        run: |
          curl -fsSL https://pr-review.dev/install.sh | bash
      
      - name: Run Review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OLLAMA_HOST: ${{ secrets.OLLAMA_HOST }}  # Optional: remote Ollama
        run: |
          pr-review --pr ${{ github.event.pull_request.number }} \
                    --repo ${{ github.repository }} \
                    --output review.json
      
      - name: Post Review
        run: |
          # Binary handles posting via GitHub API
          # Or use action to post review.json content
```

### Azure Pipelines Example

```yaml
# azure-pipelines.yml
trigger: none
pr:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - script: |
      curl -fsSL https://pr-review.dev/install.sh | bash
    displayName: 'Install PR Review'
  
  - script: |
      pr-review --pr $(System.PullRequest.PullRequestId) \
                --repo $(Build.Repository.Name) \
                --vcs azure \
                --azure-org $(System.TeamOrganization) \
                --azure-project $(System.TeamProject)
    displayName: 'Run Review'
    env:
      AZURE_DEVOPS_TOKEN: $(System.AccessToken)
```

### Why NOT Continuously Running

- **Cost:** No idle resource consumption
- **Simplicity:** No server maintenance, auth, uptime concerns
- **Scalability:** Each PR gets fresh process, no state management
- **Security:** No long-lived tokens, fresh auth per run

---

## Context Sources

The agent aggregates context from multiple sources:

| Source | How It's Used | Priority |
|--------|---------------|----------|
| **PR Diff** | Core content to review | Required |
| **PR Description** | Understanding intent, linked tickets | High |
| **Codebase Files** | Related files for context | Medium |
| **Ticket Info** | Requirements, acceptance criteria | High (Phase 2) |
| **Skills** | Review behavior, patterns | High |
| **Memory** | Learned conventions, past feedback | Medium |
| **Git History** | Related commits, authors | Low |

### Context Building

```typescript
async function buildContext(pr: PullRequest): Promise<ReviewContext> {
  return {
    // Core
    diff: await getDiff(pr),
    files: await getChangedFiles(pr),
    description: pr.description,
    
    // Enriched
    relatedFiles: await findRelatedFiles(pr.files),
    ticket: await extractTicketFromDescription(pr.description),
    
    // Skills
    applicableSkills: await matchSkills(pr.files),
    
    // Memory
    conventions: await loadConventions(pr.repo),
    pastReviews: await loadPastReviews(pr.repo),
  };
}
```

---

## Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Skills folder structure
- [ ] GitHub adapter (get PR, diff, post comments)
- [ ] Ollama backend integration
- [ ] CLI binary (basic commands)
- [ ] Default review skill

### Phase 2: VCS + CI (Week 3-4)
- [ ] Azure DevOps adapter
- [ ] GitHub Actions integration
- [ ] Azure Pipelines integration
- [ ] Better error handling
- [ ] Review output formatting

### Phase 3: Integrations (Week 5-6)
- [ ] Ticket integration framework
- [ ] Jira adapter
- [ ] Linear adapter
- [ ] GitHub Issues adapter
- [ ] Azure Boards adapter
- [ ] Memory system (learned conventions)

### Phase 4: Polish & Distribution (Week 7-8)
- [ ] Cross-platform binary builds
- [ ] Installation scripts (curl, npm, brew)
- [ ] Documentation
- [ ] Example skills library
- [ ] Self-reviewing the reviewer (dogfooding)

---

## Next Steps

1. Pull `qwen3.5:cloud` model via Ollama
2. Create GitHub repo for project tracking
3. Launch subagent with Claude Code + Ollama
4. Build Phase 1 components
5. Test on real PRs