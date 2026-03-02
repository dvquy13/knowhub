import { Issues, Projects } from '@gitbeaker/rest';
import type { Provider, Issue, RepoInfo } from './types.js';

interface GitLabProviderOptions {
  projectId: string | number;
  token: string;
  host?: string;
}

function mapGitLabState(state: 'open' | 'closed' | 'all'): 'opened' | 'closed' | 'all' {
  if (state === 'open') return 'opened';
  return state;
}

function extractLabels(labels: unknown[]): string[] {
  return labels.map((l) => {
    if (typeof l === 'string') return l;
    if (l !== null && typeof l === 'object' && 'name' in l) return String((l as { name: unknown }).name ?? '');
    return '';
  });
}

export class GitLabProvider implements Provider {
  private issuesApi: InstanceType<typeof Issues>;
  private projectsApi: InstanceType<typeof Projects>;

  constructor(private options: GitLabProviderOptions) {
    const auth = { host: options.host ?? 'https://gitlab.com', token: options.token };
    this.issuesApi = new Issues(auth);
    this.projectsApi = new Projects(auth);
  }

  async createIssue(title: string, body: string, labels?: string[]): Promise<Issue> {
    const data = await this.issuesApi.create(this.options.projectId, title, {
      description: body,
      labels: labels?.join(','),
    });
    return {
      id: data.id,
      number: data.iid,
      title: data.title,
      body: data.description ?? '',
      labels: extractLabels(data.labels as unknown[]),
      createdAt: String(data.created_at),
      url: String(data.web_url),
    };
  }

  async listIssues(state: 'open' | 'closed' | 'all' = 'open', labels?: string[]): Promise<Issue[]> {
    const gitlabState = mapGitLabState(state);
    const items = await this.issuesApi.all({
      projectId: this.options.projectId,
      state: gitlabState,
      labels: labels?.join(','),
    });
    return (items as typeof items).map((data) => ({
      id: data.id,
      number: data.iid,
      title: data.title,
      body: data.description ?? '',
      labels: extractLabels(data.labels as unknown[]),
      createdAt: String(data.created_at),
      url: String(data.web_url),
    }));
  }

  async closeIssue(issueNumber: number): Promise<void> {
    await this.issuesApi.edit(this.options.projectId, issueNumber, {
      stateEvent: 'close',
    });
  }

  async getRepoInfo(): Promise<RepoInfo> {
    const data = await this.projectsApi.show(this.options.projectId);
    const pathWithNamespace = String(data.path_with_namespace);
    const pathParts = pathWithNamespace.split('/');
    const owner = pathParts.slice(0, -1).join('/');
    return {
      owner,
      name: data.name,
      fullName: pathWithNamespace,
      defaultBranch: String(data.default_branch),
      cloneUrl: String(data.http_url_to_repo),
      sshUrl: String(data.ssh_url_to_repo),
    };
  }

  async createRepo(name: string, description?: string, isPrivate?: boolean): Promise<RepoInfo> {
    const data = await this.projectsApi.create({
      name,
      description,
      visibility: isPrivate ? 'private' : 'public',
    });
    const pathWithNamespace = String(data.path_with_namespace);
    const pathParts = pathWithNamespace.split('/');
    const owner = pathParts.slice(0, -1).join('/');
    return {
      owner,
      name: data.name,
      fullName: pathWithNamespace,
      defaultBranch: String(data.default_branch),
      cloneUrl: String(data.http_url_to_repo),
      sshUrl: String(data.ssh_url_to_repo),
    };
  }
}
