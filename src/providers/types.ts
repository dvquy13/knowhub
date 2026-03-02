export interface Issue {
  id: number;
  number: number;     // issue number (used for close)
  title: string;
  body: string;
  labels: string[];
  createdAt: string;
  url: string;
}

export interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  sshUrl: string;
}

export interface Provider {
  createIssue(title: string, body: string, labels?: string[]): Promise<Issue>;
  listIssues(state?: 'open' | 'closed' | 'all', labels?: string[]): Promise<Issue[]>;
  closeIssue(issueNumber: number): Promise<void>;
  getRepoInfo(): Promise<RepoInfo>;
  createRepo(name: string, description?: string, isPrivate?: boolean): Promise<RepoInfo>;
}
