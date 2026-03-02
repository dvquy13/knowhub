import { Issues, Projects } from '@gitbeaker/rest';
import type { Provider, Issue, RepoInfo } from './types.js';

interface GitLabProviderOptions {
  projectId: string | number;
  token: string;
  host?: string;
}

type GitLabProjectData = {
  path_with_namespace: unknown;
  name: string;
  default_branch: unknown;
  http_url_to_repo: unknown;
  ssh_url_to_repo: unknown;
};

function mapGitLabState(state: 'open' | 'closed' | 'all'): 'opened' | 'closed' | 'all' {
  if (state === 'open') return 'opened';
  return state;
}

function normalizeLabel(label: unknown): string {
  if (typeof label === 'string') return label;
  if (label !== null && typeof label === 'object' && 'name' in label) {
    return String((label as { name: unknown }).name ?? '');
  }
  return '';
}

export class GitLabProvider implements Provider {
  private issuesApi: InstanceType<typeof Issues>;
  private projectsApi: InstanceType<typeof Projects>;

  constructor(private options: GitLabProviderOptions) {
    const auth = { host: options.host ?? 'https://gitlab.com', token: options.token };
    this.issuesApi = new Issues(auth);
    this.projectsApi = new Projects(auth);
  }

  private extractOwner(pathWithNamespace: string): string {
    const parts = pathWithNamespace.split('/');
    return parts.slice(0, -1).join('/');
  }

  private mapRepoInfo(data: GitLabProjectData): RepoInfo {
    const pathWithNamespace = String(data.path_with_namespace);
    return {
      owner: this.extractOwner(pathWithNamespace),
      name: data.name,
      fullName: pathWithNamespace,
      defaultBranch: String(data.default_branch),
      cloneUrl: String(data.http_url_to_repo),
      sshUrl: String(data.ssh_url_to_repo),
    };
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
      labels: (data.labels as unknown[]).map(normalizeLabel),
      createdAt: String(data.created_at),
      url: String(data.web_url),
    };
  }

  async listIssues(state: 'open' | 'closed' | 'all' = 'open', labels?: string[]): Promise<Issue[]> {
    const items = await this.issuesApi.all({
      projectId: this.options.projectId,
      state: mapGitLabState(state),
      labels: labels?.join(','),
    });
    return (items as typeof items).map((data) => ({
      id: data.id,
      number: data.iid,
      title: data.title,
      body: data.description ?? '',
      labels: (data.labels as unknown[]).map(normalizeLabel),
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
    return this.mapRepoInfo(data as GitLabProjectData);
  }

  async createRepo(name: string, description?: string, isPrivate?: boolean): Promise<RepoInfo> {
    const data = await this.projectsApi.create({
      name,
      description,
      visibility: isPrivate ? 'private' : 'public',
    });
    return this.mapRepoInfo(data as GitLabProjectData);
  }
}
