# PR Review Agent

AI-powered code review agent that runs locally via Ollama, with optional Claude/OpenAI backends. Reviews pull requests on GitHub and Azure DevOps with skills-based review behavior.

## Features

- 🤖 **Multiple LLM Backends** - Ollama (free/local), Claude (best quality), OpenAI
- 🔄 **Multi-platform** - GitHub and Azure DevOps support
- 📚 **Skills-based** - Review behavior driven by pluggable skills
- 🚀 **Pipeline-triggered** - Runs in CI/CD, no continuously running service
- 🔗 **Ticket-aware** - Links PRs to Jira/Linear tickets (Phase 3)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/theashishmaurya/pr-review-agent.git
cd pr-review-agent

# Install dependencies
npm install

# Build
npm run build

# Review a PR (dry run)
GITHUB_TOKEN=$(gh auth token) node dist/cli.js review --pr 123 --repo owner/repo --dry-run
```

## Installation

### From Source

```bash
git clone https://github.com/theashishmaurya/pr-review-agent.git
cd pr-review-agent
npm install
npm run build
```

### Global Install (coming soon)

```bash
npm install -g pr-review-agent
```

## Configuration

### Quick Config

Create `~/.pr-review/config.yaml`:

```bash
mkdir -p ~/.pr-review
cp config.example.yaml ~/.pr-review/config.yaml
```

### Environment Variables

| Variable | Description | Required For |
|----------|-------------|--------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | GitHub reviews |
| `AZURE_DEVOPS_TOKEN` | Azure DevOps PAT | Azure DevOps reviews |
| `ANTHROPIC_API_KEY` | Anthropic API Key | Claude backend |
| `OPENAI_API_KEY` | OpenAI API Key | OpenAI backend |
| `OLLAMA_HOST` | Ollama server URL | Ollama (default: localhost:11434) |

### Config File

```yaml
# ~/.pr-review/config.yaml

# VCS Configuration
vcs:
  github:
    token: ""  # Or set GITHUB_TOKEN env var
  azure:
    organization: "my-org"
    project: "my-project"
    token: ""  # Or set AZURE_DEVOPS_TOKEN env var

# LLM Configuration
llm:
  # Provider: ollama, claude, or openai
  provider: ollama
  
  # Model (provider-specific)
  # Ollama: qwen3.5:cloud, codellama:70b, deepseek-coder:33b
  # Claude: claude-sonnet-4-20250514, claude-opus-4-20250514
  # OpenAI: gpt-4o, gpt-4-turbo, gpt-3.5-turbo
  model: qwen3.5:cloud
  
  # Base URL (optional)
  baseUrl: "http://localhost:11434"

# Skills Configuration
skills:
  path: ~/.pr-review/skills
  default: default

# Review Settings
review:
  maxDiffSize: 50000
  ignorePaths:
    - node_modules
    - dist
    - build
    - "*.lock"
```

## LLM Backends

### Ollama (Default, Free)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull qwen3.5:cloud

# Run review
GITHUB_TOKEN=$(gh auth token) node dist/cli.js review --pr 123 --repo owner/repo
```

**Recommended Models:**
| Model | Size | Best For |
|-------|------|----------|
| `qwen3.5:cloud` | 0.5GB | Fast, general reviews |
| `codellama:70b` | 38GB | Complex code analysis |
| `deepseek-coder:33b` | 19GB | Code-specific reviews |

### Claude (Best Quality)

```bash
# Set API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run with Claude
node dist/cli.js review --pr 123 --repo owner/repo --provider claude
```

**Available Models:**
- `claude-sonnet-4-20250514` - Fast, high quality (default)
- `claude-opus-4-20250514` - Best quality, slower

### OpenAI

```bash
# Set API key
export OPENAI_API_KEY=sk-...

# Run with OpenAI
node dist/cli.js review --pr 123 --repo owner/repo --provider openai
```

**Available Models:**
- `gpt-4o` - Latest, best (default)
- `gpt-4-turbo` - Fast GPT-4
- `gpt-3.5-turbo` - Fast, cheaper

## CLI Commands

```bash
# Review a PR
pr-review review --pr 123 --repo owner/repo

# Review with specific VCS
pr-review review --pr 456 --repo my-repo --vcs azure --azure-org my-org --azure-project my-project

# Use specific LLM provider
pr-review review --pr 123 --repo owner/repo --provider claude

# Use specific model
pr-review review --pr 123 --repo owner/repo --provider openai --model gpt-4-turbo

# Use specific skill
pr-review review --pr 123 --repo owner/repo --skill security

# Dry run (show review without posting)
pr-review review --pr 123 --repo owner/repo --dry-run

# Output as JSON
pr-review review --pr 123 --repo owner/repo --output json

# List available skills
pr-review skills --path ./skills

# Show current config
pr-review config
```

## Skills

Skills define review behavior. They're just markdown files with front matter.

### Skill Location

```
~/.pr-review/skills/
├── default/
│   └── SKILL.md          # Default review behavior
├── security/
│   └── SKILL.md          # Security-focused reviews
├── frontend/
│   └── SKILL.md          # React/TypeScript patterns
└── backend/
    └── SKILL.md          # API/Database patterns
```

### Creating a Skill

```bash
mkdir -p ~/.pr-review/skills/my-skill
cat > ~/.pr-review/skills/my-skill/SKILL.md << 'EOF'
---
name: My Custom Review
description: Custom review rules
trigger:
  - "**/*.ts"
  - "src/**/*.js"
priority: high
---

# My Custom Review Rules

## What to Check
- No `any` types
- All functions have JSDoc comments
- Max 50 lines per function
EOF
```

### Skill Structure

```yaml
---
name: Skill Name           # Display name
description: What it does  # Shown in CLI
trigger:                   # Glob patterns to match files
  - "**/*.ts"
  - "src/api/**"
priority: high | medium | low  # Higher = injected first into prompt
---

# Review Instructions

Your custom review logic here...
This content is injected into the LLM prompt.
```

### Built-in Skills

| Skill | Triggers | Focus |
|-------|----------|-------|
| `default` | `**/*` | General correctness, patterns, best practices |
| `security` | `**/*.ts`, `**/api/**` | Vulnerabilities, auth, input validation |
| `frontend` | `**/*.tsx`, `**/*.css` | React patterns, a11y, performance |
| `backend` | `**/api/**`, `**/*.go` | API design, database, reliability |

## How It Works

### Internal Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Entry                               │
│                    pr-review review --pr 13                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Adapter                             │
│  1. GET /repos/{owner}/{repo}/pulls/{pr_number}                │
│     → PR metadata (title, description, author, branches)       │
│                                                                 │
│  2. GET /repos/{owner}/{repo}/pulls/{pr_number}/files          │
│     → List of changed files with additions/deletions           │
│                                                                 │
│  3. GET /repos/{owner}/{repo}/pulls/{pr_number}                │
│     Accept: application/vnd.github.v3.diff                     │
│     → Raw diff content                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Context Builder                            │
│  - Parse diff into hunks (old line, new line, content)         │
│  - Match files against skills (glob patterns)                  │
│  - Extract ticket IDs from description (PROJ-123, #456)        │
│  - Build unified context object                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Skill Loader                                │
│  Load skills matching the changed files                         │
│  Inject skill content into prompt                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LLM Backend                                 │
│  Send prompt to Ollama/Claude/OpenAI                           │
│  Parse response into structured review                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Post Review                                  │
│  POST /repos/{owner}/{repo}/pulls/{pr_number}/reviews          │
│  { event: "APPROVE|REQUEST_CHANGES", body, comments }          │
└─────────────────────────────────────────────────────────────────┘
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/pr-review.yml
name: AI PR Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install PR Review Agent
        run: |
          git clone https://github.com/theashishmaurya/pr-review-agent.git
          cd pr-review-agent
          npm install
          npm run build
      
      - name: Run Review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # For remote Ollama:
          # OLLAMA_HOST: ${{ secrets.OLLAMA_HOST }}
          
          # For Claude:
          # ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          
          # For OpenAI:
          # OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          cd pr-review-agent
          node dist/cli.js review \
            --pr ${{ github.event.pull_request.number }} \
            --repo ${{ github.repository }} \
            --skill security
      
      - name: Post Review
        if: always()
        run: |
          # Review is posted automatically by the agent
          echo "Review posted!"
```

### Azure Pipelines

```yaml
# azure-pipelines.yml
trigger: none
pr:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
  
  - script: |
      git clone https://github.com/theashishmaurya/pr-review-agent.git
      cd pr-review-agent
      npm install
      npm run build
    displayName: 'Install PR Review Agent'
  
  - script: |
      cd pr-review-agent
      node dist/cli.js review \
        --pr $(System.PullRequest.PullRequestId) \
        --repo $(Build.Repository.Name) \
        --vcs azure \
        --azure-org $(System.TeamOrganization) \
        --azure-project $(System.TeamProject)
    displayName: 'Run Review'
    env:
      AZURE_DEVOPS_TOKEN: $(System.AccessToken)
      GITHUB_TOKEN: $(GITHUB_TOKEN)  # If using GitHub repos
```

### Trigger Model

The agent is **pipeline-triggered**, not a running service:

```
PR opened/updated
       │
       ▼
GitHub Actions / Azure Pipelines triggers
       │
       ▼
Runner spins up, installs agent
       │
       ▼
Agent reviews PR, posts comments
       │
       ▼
Runner terminates
```

**Benefits:**
- No running service to maintain
- Fresh process for each review
- No long-lived tokens
- Scales automatically

## VCS Support

### GitHub (Full Support)

```bash
# Via gh CLI
gh auth login
GITHUB_TOKEN=$(gh auth token) node dist/cli.js review --pr 123 --repo owner/repo

# Via PAT
GITHUB_TOKEN=ghp_xxx node dist/cli.js review --pr 123 --repo owner/repo
```

### Azure DevOps (Phase 2)

```bash
AZURE_DEVOPS_TOKEN=xxx node dist/cli.js review \
  --pr 456 \
  --repo my-repo \
  --vcs azure \
  --azure-org my-org \
  --azure-project my-project
```

## Architecture

See [ADR-001-architecture.md](./ADR-001-architecture.md) for full design documentation.

```
pr-review-agent/
├── src/
│   ├── index.ts          # Main agent class
│   ├── cli.ts            # CLI entry point
│   ├── types.ts          # TypeScript types
│   ├── adapters/
│   │   ├── vcs/
│   │   │   ├── base.ts
│   │   │   ├── github.ts
│   │   │   └── azure-devops.ts
│   │   └── ticket/
│   │       ├── base.ts
│   │       ├── jira.ts
│   │       └── linear.ts
│   ├── llm/
│   │   ├── base.ts
│   │   ├── ollama.ts
│   │   ├── claude.ts
│   │   └── openai.ts
│   ├── skills/
│   │   └── loader.ts
│   ├── context/
│   │   └── builder.ts
│   └── review/
│       ├── engine.ts
│       └── output.ts
├── skills/
│   ├── default/SKILL.md
│   ├── security/SKILL.md
│   ├── frontend/SKILL.md
│   └── backend/SKILL.md
├── package.json
├── tsconfig.json
└── config.example.yaml
```

## Roadmap

### Phase 1 ✅ (Complete)
- [x] Skills folder structure
- [x] GitHub adapter
- [x] Ollama backend
- [x] CLI skeleton
- [x] Context builder

### Phase 2 ✅ (Complete)
- [x] Claude backend
- [x] OpenAI backend
- [x] Azure DevOps adapter

### Phase 3 (Planned)
- [ ] Jira adapter
- [ ] Linear adapter
- [ ] GitHub Issues adapter
- [ ] Azure Boards adapter
- [ ] Memory system (learned conventions)

### Phase 4 (Future)
- [ ] Binary distribution (pkg/bun)
- [ ] npm global install
- [ ] Homebrew formula
- [ ] Self-review the repo

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test locally
GITHUB_TOKEN=$(gh auth token) node dist/cli.js review --pr 123 --repo owner/repo --dry-run

# Run tests (coming soon)
npm test
```

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a PR

## License

MIT

## Author

[Ashish Maurya](https://github.com/theashishmaurya)