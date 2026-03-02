# /knowhub:capture

Capture a learning to the knowledge hub.

## When to use
- User wants to capture a learning, TIL, or insight
- User mentions something interesting they just discovered
- User wants to push a specific piece of knowledge to their hub

## Passive capture
During any session, if you notice the user encountering a significant learning, gotcha, or insight, you MAY offer to capture it. Always ask first — never auto-capture. Example:

> "That's a useful insight about [topic]. Would you like me to capture that to your knowledge hub? `/knowhub:capture`"

## Behavior

1. If the user hasn't provided the learning content, ask them to describe what they learned. Help them frame it clearly and concisely.

2. Format the learning:
   - Make the title concise and searchable (start with "TIL:" for discoveries, or a clear topic phrase)
   - The body should be the complete learning with context
   - Add relevant labels (e.g., "typescript", "git", "debugging")

3. Run the capture command:
   ```bash
   knowhub capture "<learning body>" --title "<title>" --labels "<label1>,<label2>"
   ```

4. Show the user the issue URL that was created.

5. Remind them that `knowhub absorb` will synthesize this into their knowledge base.

## Example
User: "I just learned that you can use `git stash pop --index` to restore staged changes"

→ Run:
```bash
knowhub capture "You can use \`git stash pop --index\` to restore both working directory changes AND staged changes. Without --index, stash pop only restores working directory changes." --title "TIL: git stash pop --index preserves staged state" --labels "git,tips"
```
