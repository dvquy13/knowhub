# knowhub

**Personal knowledge hub — capture learnings as issues, synthesize into curated markdown via Claude.**

knowhub turns your GitHub or GitLab issue tracker into a frictionless learning inbox. Capture anything worth remembering as an issue, then run `absorb` to let Claude synthesize your raw notes into a structured, queryable knowledge base.

## What is knowhub?

knowhub is a two-part tool: a CLI and a Claude Code plugin. You capture learnings as issues on a dedicated git repository (your "hub"), which acts as an unstructured inbox. When you run `knowhub absorb`, Claude reads all open issues, merges them into your existing knowledge files, and commits the result — leaving you with a curated markdown knowledge base that grows with you over time.

## Quick Start

**Prerequisites:** Node.js 18+, a GitHub or GitLab account, and a personal access token.

### Claude Code users (recommended)

Install the plugin, then let `/knowhub:setup` walk you through everything:

```bash
claude plugin marketplace add dvquy13/knowhub
claude plugin install knowhub@knowhub
```

Then in any Claude Code session:
```
/knowhub:setup
```

### CLI only

```bash
npm install -g @dvquys/knowhub
knowhub init
```

`init` walks you through an interactive setup: pick a provider, authenticate, create or link a repository, and scaffold the hub structure. After setup, your hub is ready:

```bash
knowhub capture "TIL: postgres EXPLAIN ANALYZE shows actual vs estimated row counts"
knowhub absorb
```

## Commands

### `knowhub init`

Interactive wizard that sets up a new knowledge hub.

```bash
knowhub init
knowhub init --hub work
```

Prompts for: hub name, provider (GitHub/GitLab), access token, repository (new or existing), and local clone path. Writes configuration to `~/.knowhub/config.yml` and scaffolds `.knowhub.yml` and `INDEX.md` in the hub repo.

---

### `knowhub capture "<learning>"`

Captures a learning as a new issue in the hub repository.

```bash
knowhub capture "TIL: git rebase --onto lets you transplant a branch to a new base"
knowhub capture "Always use EXPLAIN ANALYZE in postgres, not just EXPLAIN" --title "Postgres: EXPLAIN vs EXPLAIN ANALYZE" --labels "postgres,databases"
knowhub capture "$(cat my-notes.md)" --hub work
```

| Flag | Description |
|------|-------------|
| `--title <title>` | Issue title (defaults to first line of the learning, truncated to 100 chars) |
| `--labels <labels>` | Comma-separated labels to apply (defaults to `learning`) |
| `--hub <name>` | Target hub (overrides config default) |

---

### `knowhub absorb`

Fetches all open issues from the hub and uses Claude to synthesize them into the knowledge base markdown files. After synthesis, processed issues are closed and `INDEX.md` is regenerated.

```bash
knowhub absorb
knowhub absorb --dry-run
knowhub absorb --hub work
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Show what would happen without writing or committing any changes |
| `--hub <name>` | Target hub (overrides config default) |

Requires Claude access — see [How absorb works](#how-absorb-works).

---

### `knowhub index`

Regenerates `INDEX.md` from the current knowledge files without running a full absorb cycle.

```bash
knowhub index
knowhub index --hub work
```

| Flag | Description |
|------|-------------|
| `--hub <name>` | Target hub (overrides config default) |

---

### Global flags

All commands accept:

| Flag | Description |
|------|-------------|
| `--hub <name>` | Target hub, overrides `default_hub` in config |
| `--verbose` | Enable debug output |

## Claude Code Plugin

The plugin provides slash commands inside Claude Code sessions, letting Claude help you capture and organize learnings without leaving your flow. See [Quick Start](#quick-start) for install instructions.

### Slash commands

| Command | Description |
|---------|-------------|
| `/knowhub:setup` | Guided conversational onboarding — walks you through `knowhub init`, explaining each step |
| `/knowhub:capture` | Capture a learning with Claude's help formatting and labeling it |
| `/knowhub:absorb` | Run `knowhub absorb` with Claude explaining what changed and why |
| `/knowhub:scan` | Mine your Claude auto-memory files for learnings worth promoting to the hub |

The plugin also passively notices when learnings come up during a session and offers to capture them — it always asks before creating an issue, never auto-captures.

## Configuration

### `~/.knowhub/config.yml` (user-level)

Stores hub definitions and your default hub. Created automatically by `knowhub init`.

```yaml
default_hub: personal

hubs:
  personal:
    repo: yourname/my-learnings
    provider: github
    local: ~/knowledge-hubs/personal
    token: ghp_xxxxxxxxxxxxxxxxxxxx   # or use GITHUB_TOKEN env var

  work:
    repo: gitlab.company.com/yourname/team-learnings
    provider: gitlab
    local: ~/knowledge-hubs/work
    token: glpat-xxxxxxxxxxxxxxxxxxxx # or use GITLAB_TOKEN env var
```

**Auth:** Store your token in the config file, or set `GITHUB_TOKEN` / `GITLAB_TOKEN` environment variables. Environment variables take precedence.

### `.knowhub.yml` (hub-level, lives in the hub repo)

Controls how your knowledge base is structured and how absorb behaves. Scaffolded by `knowhub init`; customize it to fit your workflow.

```yaml
name: My Knowledge Hub
description: Personal software engineering learnings

structure:
  knowledge_dir: knowledge/   # directory where knowledge files live
  index_file: INDEX.md        # progressive-disclosure index

absorb:
  strategy: commit            # "commit" for personal hubs, "pr" for team hubs
  batch_size: 20              # max issues processed per absorb run
  rules: |
    Organize by topic. One file per major topic.
    Prefer updating existing files over creating new ones.
    Each file should have a clear ## Summary at the top.
    Use practical, actionable language.
```

A default template is available at `templates/knowhub.yml`.

## CI/CD

Run `knowhub absorb` automatically on a schedule so your knowledge base stays current without manual effort.

### GitHub Actions

Copy `templates/github-actions/absorb.yml` into your hub repo's `.github/workflows/` directory. It runs absorb every Monday at 9am and pushes the result:

```bash
cp templates/github-actions/absorb.yml path/to/hub-repo/.github/workflows/absorb.yml
```

Set the following secrets in your hub repository:
- `KNOWHUB_TOKEN` — your GitHub personal access token
- `ANTHROPIC_API_KEY` — your Anthropic API key

### GitLab CI

Copy `templates/gitlab-ci/.gitlab-ci.yml` into your hub repo for equivalent GitLab CI/CD automation.

## How absorb works

`knowhub absorb` is stateless and runs in one pass:

1. Fetch all open issues from the hub repository (the inbox)
2. Read `.knowhub.yml` for structure rules and absorb configuration
3. Read existing knowledge files for context
4. Invoke Claude to synthesize issues into the knowledge base — creating new topic files, updating existing ones, flagging duplicates
5. Write changes and commit to the hub repo (or open a PR if `strategy: pr`)
6. Close processed issues
7. Regenerate `INDEX.md`

**Claude auth cascade** (tried in order):

1. Active Claude Code session — Claude synthesizes directly
2. `claude` CLI available — invoked headless with `--print`
3. `ANTHROPIC_API_KEY` set — Anthropic SDK called directly
4. None available — error with setup instructions

For CI/CD, set `ANTHROPIC_API_KEY` as a secret. For local use, the active session or `claude` CLI is used automatically.

## License

MIT
