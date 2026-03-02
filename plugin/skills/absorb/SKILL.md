# /knowhub:absorb

Synthesize captured learnings from issues into the knowledge base.

## When to use
- User wants to run the absorb process
- User has accumulated learnings in issues and wants them organized
- User explicitly asks to synthesize their hub

## Key design: In-session synthesis

When running in a Claude Code session, Claude performs the synthesis DIRECTLY rather than invoking an external Claude instance. This is more efficient and allows for richer reasoning.

## Behavior

1. Check that knowhub is configured: read `~/.knowhub/config.yml` to find the default hub.

2. Identify the hub's local path and verify it exists.

3. Fetch open issues from the hub repo:
   ```bash
   knowhub absorb --dry-run
   ```
   Show the user how many issues will be processed.

4. Ask the user to confirm before proceeding.

5. Run the actual absorb:
   ```bash
   knowhub absorb
   ```

6. Report what happened:
   - How many issues were processed
   - Which files were created or updated
   - The summary from Claude
   - That issues were closed

7. Offer to show the updated INDEX.md.

## Alternative: Direct synthesis (advanced)

For in-session synthesis, you can perform synthesis directly:
1. Read all open issues via the provider
2. Read existing knowledge files
3. Apply your synthesis judgment directly
4. Write the resulting files
5. Commit changes using git
6. Close the processed issues

This bypasses the CLI and uses Claude's current session capabilities.
