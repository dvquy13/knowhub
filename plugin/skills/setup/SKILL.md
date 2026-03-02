# /knowhub:setup

Guided onboarding for knowhub. Walk the user through setting up their first knowledge hub.

## When to use
- User wants to set up knowhub for the first time
- User doesn't have a hub configured yet
- User wants to add a new hub

## Behavior

1. Ask the user if they have knowhub installed (`knowhub --version`). If not, tell them to run `npm install -g @dvquys/knowhub` first.

2. Check if a hub is already configured by attempting to read `~/.knowhub/config.yml`. If configured, show the existing hubs and ask if they want to add another.

3. Run `knowhub init` with the user guiding through the interactive prompts. Explain each step as they go:
   - Hub name: used to reference this hub in commands (suggest "personal")
   - Provider: GitHub or GitLab
   - Token: explain scope required (repo for GitHub, api for GitLab)
   - Repository: create new or use existing
   - Local path: where to clone the hub repo

4. After init completes, confirm success and show example commands:
   ```
   knowhub capture "TIL: something I learned"
   knowhub absorb
   ```

5. Offer to run `/knowhub:capture` to capture the first learning.

## Key notes
- Always validate token works before proceeding
- Guide users to the right token creation page for their provider
- GitHub token URL: https://github.com/settings/tokens/new?scopes=repo
- GitLab token URL: https://gitlab.com/-/profile/personal_access_tokens
