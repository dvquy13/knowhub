import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubProvider } from '../../../src/providers/github.js';

// Mock @octokit/rest before any imports that use it
const mockIssuesCreate = vi.fn();
const mockIssuesListForRepo = vi.fn();
const mockIssuesUpdate = vi.fn();
const mockReposGet = vi.fn();
const mockReposCreateForAuthenticatedUser = vi.fn();

vi.mock('@octokit/rest', () => {
  return {
    Octokit: vi.fn().mockImplementation(() => ({
      rest: {
        issues: {
          create: mockIssuesCreate,
          listForRepo: mockIssuesListForRepo,
          update: mockIssuesUpdate,
        },
        repos: {
          get: mockReposGet,
          createForAuthenticatedUser: mockReposCreateForAuthenticatedUser,
        },
      },
    })),
  };
});

describe('GitHubProvider', () => {
  let provider: GitHubProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GitHubProvider('myowner', 'myrepo', 'test-token');
  });

  describe('createIssue', () => {
    it('calls Octokit issues.create with correct params and maps response', async () => {
      mockIssuesCreate.mockResolvedValue({
        data: {
          id: 1001,
          number: 42,
          title: 'Test Issue',
          body: 'Issue body',
          labels: [{ name: 'bug' }, { name: 'help-wanted' }],
          created_at: '2026-01-01T00:00:00Z',
          html_url: 'https://github.com/myowner/myrepo/issues/42',
        },
      });

      const issue = await provider.createIssue('Test Issue', 'Issue body', ['bug', 'help-wanted']);

      expect(mockIssuesCreate).toHaveBeenCalledWith({
        owner: 'myowner',
        repo: 'myrepo',
        title: 'Test Issue',
        body: 'Issue body',
        labels: ['bug', 'help-wanted'],
      });

      expect(issue).toEqual({
        id: 1001,
        number: 42,
        title: 'Test Issue',
        body: 'Issue body',
        labels: ['bug', 'help-wanted'],
        createdAt: '2026-01-01T00:00:00Z',
        url: 'https://github.com/myowner/myrepo/issues/42',
      });
    });

    it('handles null body by mapping to empty string', async () => {
      mockIssuesCreate.mockResolvedValue({
        data: {
          id: 2,
          number: 1,
          title: 'No Body',
          body: null,
          labels: [],
          created_at: '2026-01-01T00:00:00Z',
          html_url: 'https://github.com/myowner/myrepo/issues/1',
        },
      });

      const issue = await provider.createIssue('No Body', '');
      expect(issue.body).toBe('');
      expect(issue.labels).toEqual([]);
    });
  });

  describe('listIssues', () => {
    it('calls issues.listForRepo with default state open and maps responses', async () => {
      mockIssuesListForRepo.mockResolvedValue({
        data: [
          {
            id: 101,
            number: 1,
            title: 'Open Issue',
            body: 'Some body',
            labels: [{ name: 'feature' }],
            created_at: '2026-02-01T00:00:00Z',
            html_url: 'https://github.com/myowner/myrepo/issues/1',
          },
        ],
      });

      const issues = await provider.listIssues();

      expect(mockIssuesListForRepo).toHaveBeenCalledWith({
        owner: 'myowner',
        repo: 'myrepo',
        state: 'open',
        labels: undefined,
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        id: 101,
        number: 1,
        title: 'Open Issue',
        body: 'Some body',
        labels: ['feature'],
        createdAt: '2026-02-01T00:00:00Z',
        url: 'https://github.com/myowner/myrepo/issues/1',
      });
    });

    it('passes state and labels to the API call', async () => {
      mockIssuesListForRepo.mockResolvedValue({ data: [] });

      await provider.listIssues('closed', ['bug', 'wontfix']);

      expect(mockIssuesListForRepo).toHaveBeenCalledWith({
        owner: 'myowner',
        repo: 'myrepo',
        state: 'closed',
        labels: 'bug,wontfix',
      });
    });
  });

  describe('closeIssue', () => {
    it('calls issues.update with state closed', async () => {
      mockIssuesUpdate.mockResolvedValue({ data: {} });

      await provider.closeIssue(42);

      expect(mockIssuesUpdate).toHaveBeenCalledWith({
        owner: 'myowner',
        repo: 'myrepo',
        issue_number: 42,
        state: 'closed',
      });
    });
  });

  describe('getRepoInfo', () => {
    it('calls repos.get and maps response to RepoInfo', async () => {
      mockReposGet.mockResolvedValue({
        data: {
          owner: { login: 'myowner' },
          name: 'myrepo',
          full_name: 'myowner/myrepo',
          default_branch: 'main',
          clone_url: 'https://github.com/myowner/myrepo.git',
          ssh_url: 'git@github.com:myowner/myrepo.git',
        },
      });

      const info = await provider.getRepoInfo();

      expect(mockReposGet).toHaveBeenCalledWith({
        owner: 'myowner',
        repo: 'myrepo',
      });

      expect(info).toEqual({
        owner: 'myowner',
        name: 'myrepo',
        fullName: 'myowner/myrepo',
        defaultBranch: 'main',
        cloneUrl: 'https://github.com/myowner/myrepo.git',
        sshUrl: 'git@github.com:myowner/myrepo.git',
      });
    });
  });

  describe('createRepo', () => {
    it('calls repos.createForAuthenticatedUser and maps response', async () => {
      mockReposCreateForAuthenticatedUser.mockResolvedValue({
        data: {
          owner: { login: 'myowner' },
          name: 'newrepo',
          full_name: 'myowner/newrepo',
          default_branch: 'main',
          clone_url: 'https://github.com/myowner/newrepo.git',
          ssh_url: 'git@github.com:myowner/newrepo.git',
        },
      });

      const info = await provider.createRepo('newrepo', 'A new repo', true);

      expect(mockReposCreateForAuthenticatedUser).toHaveBeenCalledWith({
        name: 'newrepo',
        description: 'A new repo',
        private: true,
      });

      expect(info).toEqual({
        owner: 'myowner',
        name: 'newrepo',
        fullName: 'myowner/newrepo',
        defaultBranch: 'main',
        cloneUrl: 'https://github.com/myowner/newrepo.git',
        sshUrl: 'git@github.com:myowner/newrepo.git',
      });
    });
  });
});
