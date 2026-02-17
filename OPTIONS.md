# PR Review Agent: Implementation Options

## Option 1: Claude Code + Cloud (Recommended for Quality)

Use Claude Code CLI with Anthropic API or cloud providers.

**Pros:**
- Best review quality (Claude 4 Sonnet/Opus)
- Native GitHub/Azure integrations via MCP
- Well-documented, actively maintained
- Built-in tools for git, file operations

**Cons:**
- Requires API key/subscription
- Not fully local

**Architecture:**
```
CI Pipeline → pr-review CLI → Claude Code → VCS APIs
                    ↓
              GitHub/Azure MCP servers
```

**Setup:**
```bash
# Install Claude Code
curl -fsSL https://claude.ai/install.sh | bash

# Configure for GitHub
claude auth login

# Run review
claude -p "Review PR #123 in repo owner/repo" --allowedTools "mcp_github,mcp_azure_devops"
```

---

## Option 2: Ollama + Custom Agent (Recommended for Privacy)

Build a custom review agent using Ollama with a capable local model.

**Pros:**
- Fully local, no external API calls
- Complete control over prompts and tools
- No per-review cost

**Cons:**
- Lower quality reviews than Claude
- More implementation work
- Need to build VCS integrations

**Architecture:**
```
CI Pipeline → pr-review (Node.js) → Ollama → VCS APIs
                    ↓
              Tool Layer (GitHub/Azure SDK)
```

**Tech Stack:**
- **LLM:** Ollama with `codellama:70b` or `deepseek-coder:33b`
- **Runtime:** Node.js or Python
- **VCS:** Octokit (GitHub), azure-devops-node-api
- **Tickets:** jira.js, Linear SDK

---

## Option 3: Hybrid (Best of Both)

Use Claude Code for complex reviews, fall back to Ollama for simple ones.

**Architecture:**
```
CI Pipeline → pr-review
                    ↓
         ┌─────────────────────────────┐
         │  Diff Size Analysis         │
         │  - Small (<500 lines): Ollama │
         │  - Large (>500 lines): Claude │
         └─────────────────────────────┘
                    ↓
         Ollama (local) OR Claude Code (cloud)
```

---

## Recommended: Start with Option 1

**Why:**
1. Fastest to implement (days, not weeks)
2. Best review quality out of the box
3. MCP servers already exist for GitHub/Azure
4. Can add Ollama fallback later

**Migration path:**
1. **Week 1:** Claude Code CLI with GitHub/Azure MCP
2. **Week 2:** Wrap in CI pipeline (GitHub Action, Azure Pipeline)
3. **Week 3:** Add ticket context (Jira, Linear)
4. **Week 4+:** Add Ollama as fallback for simple reviews

---

## Claude Code MCP for VCS Integration

Claude Code supports Model Context Protocol (MCP) for external tools. Use existing MCP servers:

### GitHub MCP Server
```json
// .mcp.json
{
  "mcpServers": {
    "github": {
      "command": "mcp-server-github",
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Azure DevOps MCP Server
```json
// .mcp.json
{
  "mcpServers": {
    "azure-devops": {
      "command": "mcp-server-azure-devops",
      "env": {
        "AZURE_DEVOPS_TOKEN": "${AZURE_DEVOPS_TOKEN}",
        "AZURE_DEVOPS_ORG": "your-org"
      }
    }
  }
}
```

### Tools Available
```typescript
// GitHub MCP provides:
- get_pr(pr_number) → PR details
- get_pr_diff(pr_number) → Diff content
- get_pr_files(pr_number) → Changed files
- create_review_comment(pr, file, line, body) → Inline comment
- submit_review(pr, verdict, summary) → Final review

// Azure DevOps MCP provides:
- get_pull_request(pr_id) → PR details
- get_pull_request_diff(pr_id) → Diff
- create_comment(pr_id, thread, comment) → Comment
```

---

## Next Steps

1. **Install Claude Code CLI:**
   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   claude auth login
   ```

2. **Test with a PR:**
   ```bash
   claude -p "Review this PR: https://github.com/owner/repo/pull/123"
   ```

3. **Create skill for review:**
   ```
   /root/.openclaw/workspace/skills/pr-review/SKILL.md
   ```

4. **Add to CI:**
   ```yaml
   # .github/workflows/pr-review.yml
   name: AI PR Review
   on: pull_request
   jobs:
     review:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Install Claude Code
           run: curl -fsSL https://claude.ai/install.sh | bash
         - name: Review PR
           env:
             ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
           run: |
             claude -p "Review PR ${{ github.event.pull_request.number }}" \
               --allowedTools "mcp_github" \
               --output review.md
         - name: Post Review
           # Post review.md as PR comment
   ```

---

## Questions to Decide

1. **Claude Code or Ollama first?** (Claude Code recommended for quality)
2. **GitHub only or GitHub + Azure DevOps?** (Both?)
3. **Ticket integration?** (Jira, Linear, Azure Boards?)
4. **CI/CD platform?** (GitHub Actions, Azure Pipelines, both?)

Once decided, I can start building the skill and CI integration.