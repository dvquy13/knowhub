# Knowhub

Personal knowledge hub tool — captures learnings as GitHub/GitLab issues, synthesizes into curated markdown via Claude.

## Architecture

- See `docs/ARCHITECTURE.md` for full system design, data flow, and decisions
- Two deliverables: CLI (`knowhub`) + Claude Code plugin
- Provider adapter pattern abstracts GitHub/GitLab via REST API — zero external binary deps

## Tech Stack

- TypeScript ESM-only (`"type": "module"`, NodeNext), distributed via npm
- CLI: commander + inquirer (prompts via `@inquirer/prompts`)
- Providers: `@octokit/rest` (GitHub), `@gitbeaker/rest` (GitLab) — no `gh`/`glab` CLI required
- Claude integration: `@anthropic-ai/sdk` for direct API fallback in CI/CD
- Config: YAML (`~/.knowhub/config.yml` user-level, `.knowhub.yml` hub-level)

## Commands

- `npm run build` — compile TypeScript
- `npm run test` — run tests
- `npm run lint` — lint codebase
- `npm publish --access public` — publish CLI (scoped package; `--access public` required or it defaults to private)

## Publishing

- npm package: `@dvquys/knowhub` (npm username `dvquys`, GitHub username `dvquy13` — different)
- GitHub repo: `https://github.com/dvquy13/knowhub`
- Claude Code plugin: see `docs/ARCHITECTURE.md` for marketplace structure and install flow

## Conventions

- Provider adapters in `src/providers/` — one file per provider, implement shared interface
- Skills in `plugin/skills/` — one directory per skill with `SKILL.md`
- All CLI commands must support `--hub <name>` flag to override default hub
- Config resolution: CLI flag > `~/.knowhub/config.yml` default_hub
- All imports within `src/` must use `.js` extension (NodeNext ESM requirement)
- Use `getErrorMessage(err)` from `src/utils/errors.ts` — never inline `err instanceof Error ? err.message : String(err)`
- Inquirer v12: import prompts from `@inquirer/prompts` (`input`, `select`, `confirm`, `password`)
