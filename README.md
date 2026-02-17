# PR Review Agent

AI-powered code review agent that runs locally via Ollama. Reviews pull requests on GitHub and Azure DevOps with skills-based review behavior.

## Features

- **Local LLM** - Uses Ollama (qwen3.5:cloud by default) for privacy
- **Multi-platform** - GitHub and Azure DevOps support
- **Skills-based** - Review behavior driven by pluggable skills
- **Pipeline-triggered** - Runs in CI/CD, no continuously running service
- **Ticket-aware** - Links PRs to Jira/Linear tickets

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Review a PR
GITHUB_TOKEN=your_token ./dist/cli.js review --pr 123 --repo owner/repo
```

## Configuration

Copy `config.example.yaml` to `~/.pr-review/config.yaml`:

```bash
mkdir -p ~/.pr-review
cp config.example.yaml ~/.pr-review/config.yaml
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token |
| `AZURE_DEVOPS_TOKEN` | Azure DevOps PAT |
| `OLLAMA_HOST` | Ollama server URL (default: localhost:11434) |

## Skills

Skills define review behavior. Place them in `~/.pr-review/skills/`:

```
~/.pr-review/skills/
├── default/
│   └── SKILL.md          # Default review behavior
├── security/
│   └── SKILL.md          # Security-focused reviews
└── frontend/
    └── SKILL.md          # React/TypeScript patterns
```

## CLI Commands

```bash
# Review a PR
pr-review review --pr 123 --repo owner/repo

# Review with specific VCS
pr-review review --pr 456 --repo project/repo --vcs azure

# Use specific skill
pr-review review --pr 123 --repo owner/repo --skill security

# Dry run (no posting)
pr-review review --pr 123 --repo owner/repo --dry-run
```

## CI/CD Integration

### GitHub Actions

```yaml
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
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install PR Review Agent
        run: |
          npm install -g pr-review-agent
      
      - name: Run Review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          pr-review review --pr ${{ github.event.pull_request.number }} \
                          --repo ${{ github.repository }}
```

## Architecture

See [ADR-001-architecture.md](./ADR-001-architecture.md) for full design documentation.

## License

MIT
