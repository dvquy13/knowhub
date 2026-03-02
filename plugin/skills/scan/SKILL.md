# /knowhub:scan

Scan Claude's auto-memory files for learnings worth promoting to the knowledge hub.

## When to use
- User wants to bootstrap their hub with existing learnings
- User has been using Claude Code for a while and wants to extract insights
- User explicitly asks to scan auto-memory

## Behavior

1. Explain what you're about to do: scan `~/.claude/` for memory files that may contain learnings.

2. Locate Claude auto-memory files:
   - `~/.claude/MEMORY.md` (main memory file)
   - Any project-specific memory files in `~/.claude/projects/*/memory/`

3. Read and analyze the memory files. Look for:
   - TIL entries
   - Patterns and conventions discovered
   - Debugging insights and root causes
   - Architectural decisions and their rationale
   - Gotchas and edge cases
   - Tool/library preferences

4. Present the findings to the user in a structured list:
   ```
   Found N potential learnings:

   1. [TypeScript] NodeNext module resolution requires .js extensions in imports
      Source: ~/.claude/projects/.../memory/MEMORY.md

   2. [Vitest] vi.mock is hoisted — factory must be synchronous
      Source: ~/.claude/MEMORY.md

   ...
   ```

5. Ask the user which ones to capture (multi-select, or "all", or "none").

6. For each selected learning, run:
   ```bash
   knowhub capture "<learning>" --title "<title>" --labels "<labels>"
   ```

7. Report how many learnings were captured and remind them to run `knowhub absorb` to synthesize.

## Privacy note
Always tell the user what files you're reading before reading them. The auto-memory files may contain sensitive project details.
