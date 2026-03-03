---
paths:
  - ".claude/settings.json"
  - ".claude/settings.local.json"
---

When editing `.claude/settings.json` or `.claude/settings.local.json`:

- `settings.json` — committed, shared with all contributors; put hooks here
- `settings.local.json` — gitignored, personal permissions only
- PostToolUse hooks must write to **stderr** (`>&2`) — stdout is silently ignored by Claude
- Read stdin before piping to jq: `INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')`
- Contributors must approve `Bash(npx eslint:*)` and `Bash(jq:*)` in their `settings.local.json` for the lint hook to run