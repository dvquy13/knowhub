---
name: pr-title
description: Format a PR title following conventional commits for knowhub. Use when opening a pull request or when asked to suggest a PR title.
disable-model-invocation: true
---

# /pr-title

PR titles for knowhub must follow the **conventional commits** format. GitHub CI validates this automatically via `amannn/action-semantic-pull-request`.

## Format

```
<type>(<optional scope>): <short description>
```

- **type** — lowercase, from the allowed list below
- **scope** — optional, in parentheses, narrows the context (e.g. `cli`, `github`, `config`)
- **description** — imperative mood, no period, ≤72 chars total

## Allowed Types

| Type | When to use |
|------|-------------|
| `feat` | New user-facing feature or command |
| `fix` | Bug fix in existing behavior |
| `docs` | Documentation only (CLAUDE.md, ARCHITECTURE.md, README) |
| `chore` | Build system, deps, CI config, release tooling |
| `refactor` | Code restructuring with no behavior change |
| `test` | Adding or fixing tests |
| `perf` | Performance improvement |

## Breaking Changes

Append `!` after the type for breaking changes:

```
feat!: rename --hub flag to --hub-name
```

## Examples for Knowhub

```
feat: add status command
fix: handle missing token gracefully in gitlab provider
docs: add git workflow section to CLAUDE.md
chore: set up release-it with conventional-changelog
refactor(providers): extract factory into separate module
test: add integration tests for absorb flow
feat(cli): add --json output flag to status command
```

## Generating a Title for $ARGUMENTS

Look at the changes described in `$ARGUMENTS` (branch name, diff summary, or task description) and output a single PR title line that:
1. Picks the most appropriate type
2. Adds a scope if it meaningfully narrows the change
3. Summarizes the change concisely in imperative mood
