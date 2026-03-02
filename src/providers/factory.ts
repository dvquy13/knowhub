import { GitHubProvider } from './github.js';
import { GitLabProvider } from './gitlab.js';
import type { Provider } from './types.js';
import type { HubConfig } from '../config/types.js';
import { KnowhubError } from '../utils/errors.js';

export function getProvider(hub: HubConfig): Provider {
  const token = hub.token
    ?? (hub.provider === 'github' ? process.env.GITHUB_TOKEN : process.env.GITLAB_TOKEN);

  if (!token) {
    throw new KnowhubError(
      `No token found for ${hub.provider} hub`,
      1,
      `Set the token in ~/.knowhub/config.yml or via ${hub.provider === 'github' ? 'GITHUB_TOKEN' : 'GITLAB_TOKEN'} env var`
    );
  }

  if (hub.provider === 'github') {
    const [owner, repo] = hub.repo.split('/');
    return new GitHubProvider(owner, repo, token);
  } else {
    // For GitLab, repo can be "owner/repo" or a full URL
    return new GitLabProvider({ projectId: hub.repo, token });
  }
}
