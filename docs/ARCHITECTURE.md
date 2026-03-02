# Knowhub

> Personal knowledge hub tool that captures learnings as GitHub/GitLab issues and synthesizes them into a curated knowledge base via AI.

## Structure

```
knowhub/
├── src/                        # CLI source (TypeScript)
│   ├── cli/                    # Command definitions (init, capture, absorb, index)
│   ├── providers/              # GitHub/GitLab adapters
│   ├── absorb/                 # Synthesis engine (Claude integration)
│   └── config/                 # Config management (~/.knowhub/)
├── plugin/                     # Claude Code plugin
│   ├── .claude-plugin/
│   │   └── plugin.json         # Plugin manifest
│   ├── skills/                 # Slash commands (/knowhub:setup, etc.)
│   └── agents/                 # Absorb agent for synthesis work
├── templates/                  # Scaffolding templates
│   ├── github-actions/         # CI/CD workflow for automated absorb
│   ├── issue-templates/        # Suggested learning capture format
│   └── hub-config/             # Default .knowhub.yml
├── docs/                       # Project documentation
└── tests/
```

## Key Concepts

- **Knowledge Hub** — a git repo (GitHub/GitLab) containing curated markdown knowledge files, queryable by humans and AI
- **Learning** — a discrete piece of knowledge captured as a GitHub/GitLab issue (the "inbox")
- **Capture** — creating an issue on the hub repo; thin wrapper over `gh`/`glab` CLI
- **Absorb** — batch process that fetches open issues, uses Claude to synthesize them into the knowledge base markdown files, commits directly
- **Index** — an `INDEX.md` file at the hub root for progressive disclosure; Claude reads this first and dives deeper as needed
- **Hub Config** — `.knowhub.yml` in the hub repo defining structure rules, topic taxonomy, and absorb conventions
- **Provider Adapter** — abstraction over GitHub (`gh`) and GitLab (`glab`) CLIs for uniform issue/repo operations

## System Overview

```
┌─────────────────────────────────────────────────┐
│  Capture (many sources)                         │
│                                                 │
│  Claude Code session → knowhub capture / plugin │
│  Manual entry        → knowhub capture          │
│  Script/webhook      → gh/glab issue create     │
│  Auto-memory scan    → /knowhub:scan            │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │  GitHub/GitLab   │
            │  Issues (inbox)  │
            └────────┬─────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  knowhub absorb  (batch, stateless, one-shot)   │
│                                                 │
│  1. Fetch open issues via provider adapter      │
│  2. Read hub config (.knowhub.yml) for rules    │
│  3. Claude synthesizes into knowledge files     │
│  4. Commit to hub repo (or PR for team hubs)    │
│  5. Close processed issues                      │
│  6. Regenerate INDEX.md                         │
└─────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  Knowledge Hub (git repo)                       │
│                                                 │
│  Queryable via:                                 │
│  - INDEX.md → progressive disclosure for Claude │
│  - Obsidian (it's just a markdown folder)       │
│  - knowhub CLI (future: query command)          │
│  - grep / search (plain markdown files)         │
└─────────────────────────────────────────────────┘
```

## Components

### CLI (`knowhub`)

TypeScript CLI distributed via npm (`npm install -g knowhub`). Four commands:

- **`knowhub init`** — interactive setup wizard. Creates hub repo, scaffolds config/templates/workflows, writes `~/.knowhub/config.yml`, optionally installs Claude Code plugin
- **`knowhub capture <learning>`** — resolves target hub from context, creates a formatted issue via provider adapter
- **`knowhub absorb`** — the core intelligence. Fetches issues, invokes Claude for synthesis, commits results, closes issues
- **`knowhub index`** — regenerates `INDEX.md` from current knowledge files

### Claude Code Plugin

Distributed via Claude Code marketplace (`/plugin install knowhub`). Provides:

- **`/knowhub:setup`** — guided conversational onboarding (replaces raw `knowhub init` for Claude Code users)
- **`/knowhub:capture`** — capture a learning with Claude's help formatting it
- **`/knowhub:absorb`** — run absorb with Claude explaining what happened
- **`/knowhub:scan`** — mine Claude auto-memory files for learnings worth promoting to the hub
- **Passive capture** — skill instructs Claude to notice learnings during sessions and offer to push them (always asks, never auto-captures)

### Provider Adapters

Uniform interface over GitHub and GitLab:

```
Provider
├── createIssue(title, body, labels?)
├── listIssues(state, labels?)
├── closeIssue(id)
├── cloneRepo(path)
├── createPR(title, body, branch)   # team hubs only
└── getRepoInfo()
```

GitHub adapter wraps `gh` CLI. GitLab adapter wraps `glab` CLI. Both required to be pre-installed and authenticated by the user.

### Absorb Engine

The synthesis step that makes knowhub valuable. Stateless batch process:

1. Fetch all open issues (or issues with specific labels)
2. Read `.knowhub.yml` for hub structure rules
3. Read existing knowledge files for context
4. Invoke Claude with issues + rules + existing content
5. Claude decides: create new files, update existing files, flag duplicates, flag contradictions
6. Write changes, commit, close processed issues
7. Regenerate INDEX.md

Claude invocation priority:
1. In a Claude Code session → Claude does synthesis directly
2. `claude` CLI available → `claude --print` (headless)
3. `ANTHROPIC_API_KEY` set → direct Anthropic SDK call
4. None → error with setup instructions

## Data Flow

- User encounters a learning → `knowhub capture` or plugin creates an issue on the hub repo
- Issues accumulate in the hub's issue tracker (the inbox)
- `knowhub absorb` runs (manually, via plugin, or CI/CD) → reads issues, synthesizes, commits to repo
- Hub repo updates → INDEX.md regenerated → Obsidian sees changes (if linked)
- Claude in future sessions reads INDEX.md for progressive disclosure into the knowledge base

## Configuration

### `~/.knowhub/config.yml` (user-level)

```yaml
default_hub: personal

hubs:
  personal:
    repo: user/my-learnings
    provider: github
    local: ~/knowledge-hub
  work:
    repo: gitlab.company.com/team/learnings
    provider: gitlab
    local: ~/work/team-learnings
```

### `.knowhub.yml` (hub-level, in the hub repo)

```yaml
name: My Knowledge Hub
description: Personal software engineering learnings

structure:
  knowledge_dir: knowledge/    # where knowledge files live
  index_file: INDEX.md         # progressive disclosure index

absorb:
  strategy: commit             # "commit" for personal, "pr" for team
  batch_size: 20               # max issues per absorb run
  # Rules for Claude to follow during synthesis:
  rules: |
    Organize by topic. One file per major topic.
    Prefer updating existing files over creating new ones.
    Each file should have a clear ## Summary at the top.
    Use practical, actionable language.
```

## Decisions

- **CLI + Plugin, not just one** — CLI serves CI/CD, non-Claude users, and provides `--help` discoverability. Plugin provides the UX layer for Claude Code users. Plugin calls CLI under the hood. `(2026-03-01)`
- **TypeScript for CLI** — better CLI tooling ecosystem (commander, inquirer), native JSON, aligns with Claude Code plugin ecosystem. `(2026-03-01)`
- **Issues as inbox, not direct commits** — decouples capture from organization. Capture is frictionless (just create an issue). Organization happens during absorb when Claude has full context. `(2026-03-01)`
- **GitHub + GitLab from day one** — user needs both (personal GitHub, work GitLab). Provider adapter pattern keeps the cost low. `(2026-03-01)`
- **Direct commit default, PR opt-in** — PRs add unnecessary ceremony for personal hubs. Team hubs can set `strategy: pr` in `.knowhub.yml`. `(2026-03-01)`
- **Freeform capture, structured absorb** — issue descriptions can be anything descriptive. Structure is imposed during absorb, not at capture time. Maximizes capture ease. `(2026-03-01)`
- **Progressive disclosure via INDEX.md** — small index file that Claude reads first, with pointers to deeper topic files. Avoids loading the entire knowledge base into context. `(2026-03-01)`
- **Claude auth cascade for absorb** — session > `claude` CLI headless > direct API key. Maximizes flexibility across local and CI/CD environments. `(2026-03-01)`
- **Passive capture always asks** — Claude suggests pushing learnings to hub but never auto-captures. User must confirm. Trust can be earned over time via future config. `(2026-03-01)`
- **Auto-memory bootstrap** — `/knowhub:scan` mines existing Claude auto-memory to seed the hub. Solves cold-start problem. `(2026-03-01)`

## Gotchas

- `gh` and `glab` CLIs must be pre-installed and authenticated — knowhub does not manage git provider credentials itself
- Absorb requires Claude access (one of: active session, `claude` CLI, or `ANTHROPIC_API_KEY`) — no offline mode for synthesis
- Hub repo must be cloned locally for absorb to write files — the `local` path in config must be valid

## Dependencies

- `commander` — CLI command parsing and help generation
- `inquirer` — interactive prompts for `knowhub init`
- `yaml` — parse/write `.knowhub.yml` and config files
- `gh` CLI (external) — GitHub issue/repo operations
- `glab` CLI (external) — GitLab issue/repo operations
- `claude` CLI (external, optional) — headless absorb invocation
- `@anthropic-ai/sdk` (optional) — direct API fallback for absorb in CI/CD
