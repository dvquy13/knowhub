import { Octokit } from '@octokit/rest';
import type { Provider, Issue, RepoInfo } from './types.js';

export class GitHubProvider implements Provider {
  private octokit: Octokit;

  constructor(private owner: string, private repo: string, token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async createIssue(title: string, body: string, labels?: string[]): Promise<Issue> {
    const response = await this.octokit.rest.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      labels,
    });
    const data = response.data;
    return {
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body ?? '',
      labels: (data.labels ?? []).map((l) =>
        typeof l === 'string' ? l : (l.name ?? '')
      ),
      createdAt: data.created_at,
      url: data.html_url,
    };
  }

  async listIssues(state: 'open' | 'closed' | 'all' = 'open', labels?: string[]): Promise<Issue[]> {
    const response = await this.octokit.rest.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      state,
      labels: labels?.join(','),
    });
    return response.data.map((data) => ({
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body ?? '',
      labels: (data.labels ?? []).map((l) =>
        typeof l === 'string' ? l : (l.name ?? '')
      ),
      createdAt: data.created_at,
      url: data.html_url,
    }));
  }

  async closeIssue(issueNumber: number): Promise<void> {
    await this.octokit.rest.issues.update({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      state: 'closed',
    });
  }

  async getRepoInfo(): Promise<RepoInfo> {
    const response = await this.octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo,
    });
    const data = response.data;
    return {
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      defaultBranch: data.default_branch,
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
    };
  }

  async createRepo(name: string, description?: string, isPrivate?: boolean): Promise<RepoInfo> {
    const response = await this.octokit.rest.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
    });
    const data = response.data;
    return {
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      defaultBranch: data.default_branch,
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
    };
  }
}
