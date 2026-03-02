import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitLabProvider } from '../../../src/providers/gitlab.js';

const mockIssuesCreate = vi.fn();
const mockIssuesAll = vi.fn();
const mockIssuesEdit = vi.fn();
const mockProjectsShow = vi.fn();
const mockProjectsCreate = vi.fn();

vi.mock('@gitbeaker/rest', () => {
  return {
    Issues: vi.fn().mockImplementation(() => ({
      create: mockIssuesCreate,
      all: mockIssuesAll,
      edit: mockIssuesEdit,
    })),
    Projects: vi.fn().mockImplementation(() => ({
      show: mockProjectsShow,
      create: mockProjectsCreate,
    })),
  };
});

describe('GitLabProvider', () => {
  let provider: GitLabProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GitLabProvider({ projectId: 'mygroup/myproject', token: 'test-token' });
  });

  describe('createIssue', () => {
    it('calls Issues.create with correct params and maps response', async () => {
      mockIssuesCreate.mockResolvedValue({
        id: 501,
        iid: 10,
        title: 'GitLab Issue',
        description: 'Issue description',
        labels: ['backend', 'urgent'],
        created_at: '2026-01-15T00:00:00Z',
        web_url: 'https://gitlab.com/mygroup/myproject/-/issues/10',
      });

      const issue = await provider.createIssue('GitLab Issue', 'Issue description', ['backend', 'urgent']);

      expect(mockIssuesCreate).toHaveBeenCalledWith(
        'mygroup/myproject',
        'GitLab Issue',
        {
          description: 'Issue description',
          labels: 'backend,urgent',
        }
      );

      expect(issue).toEqual({
        id: 501,
        number: 10,
        title: 'GitLab Issue',
        body: 'Issue description',
        labels: ['backend', 'urgent'],
        createdAt: '2026-01-15T00:00:00Z',
        url: 'https://gitlab.com/mygroup/myproject/-/issues/10',
      });
    });

    it('handles null description by mapping to empty string', async () => {
      mockIssuesCreate.mockResolvedValue({
        id: 1,
        iid: 1,
        title: 'No Description',
        description: null,
        labels: [],
        created_at: '2026-01-01T00:00:00Z',
        web_url: 'https://gitlab.com/mygroup/myproject/-/issues/1',
      });

      const issue = await provider.createIssue('No Description', '');
      expect(issue.body).toBe('');
      expect(issue.labels).toEqual([]);
    });
  });

  describe('listIssues', () => {
    it('calls Issues.all with projectId and maps open state to opened', async () => {
      mockIssuesAll.mockResolvedValue([
        {
          id: 201,
          iid: 5,
          title: 'Open GL Issue',
          description: 'Body here',
          labels: ['feature'],
          created_at: '2026-03-01T00:00:00Z',
          web_url: 'https://gitlab.com/mygroup/myproject/-/issues/5',
        },
      ]);

      const issues = await provider.listIssues('open', ['feature']);

      expect(mockIssuesAll).toHaveBeenCalledWith({
        projectId: 'mygroup/myproject',
        state: 'opened',
        labels: 'feature',
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        id: 201,
        number: 5,
        title: 'Open GL Issue',
        body: 'Body here',
        labels: ['feature'],
        createdAt: '2026-03-01T00:00:00Z',
        url: 'https://gitlab.com/mygroup/myproject/-/issues/5',
      });
    });

    it('passes closed state through unchanged', async () => {
      mockIssuesAll.mockResolvedValue([]);

      await provider.listIssues('closed');

      expect(mockIssuesAll).toHaveBeenCalledWith({
        projectId: 'mygroup/myproject',
        state: 'closed',
        labels: undefined,
      });
    });

    it('passes all state through unchanged', async () => {
      mockIssuesAll.mockResolvedValue([]);

      await provider.listIssues('all');

      expect(mockIssuesAll).toHaveBeenCalledWith({
        projectId: 'mygroup/myproject',
        state: 'all',
        labels: undefined,
      });
    });
  });

  describe('closeIssue', () => {
    it('calls Issues.edit with stateEvent close', async () => {
      mockIssuesEdit.mockResolvedValue({});

      await provider.closeIssue(10);

      expect(mockIssuesEdit).toHaveBeenCalledWith(
        'mygroup/myproject',
        10,
        { stateEvent: 'close' }
      );
    });
  });

  describe('getRepoInfo', () => {
    it('calls Projects.show and maps response to RepoInfo', async () => {
      mockProjectsShow.mockResolvedValue({
        name: 'myproject',
        path_with_namespace: 'mygroup/myproject',
        default_branch: 'main',
        http_url_to_repo: 'https://gitlab.com/mygroup/myproject.git',
        ssh_url_to_repo: 'git@gitlab.com:mygroup/myproject.git',
      });

      const info = await provider.getRepoInfo();

      expect(mockProjectsShow).toHaveBeenCalledWith('mygroup/myproject');

      expect(info).toEqual({
        owner: 'mygroup',
        name: 'myproject',
        fullName: 'mygroup/myproject',
        defaultBranch: 'main',
        cloneUrl: 'https://gitlab.com/mygroup/myproject.git',
        sshUrl: 'git@gitlab.com:mygroup/myproject.git',
      });
    });
  });

  describe('createRepo', () => {
    it('calls Projects.create with visibility private when isPrivate=true', async () => {
      mockProjectsCreate.mockResolvedValue({
        name: 'newproject',
        path_with_namespace: 'mygroup/newproject',
        default_branch: 'main',
        http_url_to_repo: 'https://gitlab.com/mygroup/newproject.git',
        ssh_url_to_repo: 'git@gitlab.com:mygroup/newproject.git',
      });

      const info = await provider.createRepo('newproject', 'A new GitLab project', true);

      expect(mockProjectsCreate).toHaveBeenCalledWith({
        name: 'newproject',
        description: 'A new GitLab project',
        visibility: 'private',
      });

      expect(info).toEqual({
        owner: 'mygroup',
        name: 'newproject',
        fullName: 'mygroup/newproject',
        defaultBranch: 'main',
        cloneUrl: 'https://gitlab.com/mygroup/newproject.git',
        sshUrl: 'git@gitlab.com:mygroup/newproject.git',
      });
    });

    it('uses public visibility when isPrivate=false', async () => {
      mockProjectsCreate.mockResolvedValue({
        name: 'publicproject',
        path_with_namespace: 'mygroup/publicproject',
        default_branch: 'main',
        http_url_to_repo: 'https://gitlab.com/mygroup/publicproject.git',
        ssh_url_to_repo: 'git@gitlab.com:mygroup/publicproject.git',
      });

      await provider.createRepo('publicproject', undefined, false);

      expect(mockProjectsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'public' })
      );
    });
  });
});
