# Knowhub

Personal knowledge hub tool — captures learnings as GitHub/GitLab issues, synthesizes into curated markdown via Claude.

## Architecture

- See `docs/ARCHITECTURE.md` for full system design, data flow, and decisions
- Two deliverables: CLI (`knowhub`) + Claude Code plugin
- Provider adapter pattern abstracts GitHub (`gh`) / GitLab (`glab`)

## Tech Stack

- TypeScript, distributed via npm
- CLI: commander + inquirer
- Config: YAML (`~/.knowhub/config.yml` user-level, `.knowhub.yml` hub-level)
- No runtime dependencies on databases or servers — everything is git + issues + markdown

## Commands

- `npm run build` — compile TypeScript
- `npm run test` — run tests
- `npm run lint` — lint codebase

## Conventions

- Provider adapters in `src/providers/` — one file per provider, implement shared interface
- Skills in `plugin/skills/` — one directory per skill with `SKILL.md`
- All CLI commands must support `--hub <name>` flag to override default hub
- Config resolution: CLI flag > project `.knowhub` file > `~/.knowhub/config.yml` default_hub
