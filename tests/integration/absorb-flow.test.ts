import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAbsorb } from '../../src/absorb/engine.js';
import { KnowhubError } from '../../src/utils/errors.js';
import type { HubFileConfig } from '../../src/config/types.js';
import type { Issue } from '../../src/providers/types.js';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports of the mocked modules
// ---------------------------------------------------------------------------

vi.mock('../../src/config/loader.js', () => ({
  resolveHub: vi.fn(),
  loadHubFileConfig: vi.fn(),
}));

vi.mock('../../src/providers/factory.js', () => ({
  getProvider: vi.fn(),
}));

vi.mock('../../src/absorb/claude.js', () => ({
  invokeClaudeForAbsorb: vi.fn(),
}));

vi.mock('../../src/utils/git.js', () => ({
  gitAdd: vi.fn(),
  gitCommit: vi.fn(),
  hasUncommittedChanges: vi.fn(() => true),
}));

// Import mocked modules after vi.mock declarations
import { resolveHub, loadHubFileConfig } from '../../src/config/loader.js';
import { getProvider } from '../../src/providers/factory.js';
import { invokeClaudeForAbsorb } from '../../src/absorb/claude.js';
import { gitAdd, gitCommit } from '../../src/utils/git.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fakeIssues: Issue[] = [
  {
    id: 1,
    number: 101,
    title: 'TypeScript generics patterns',
    body: 'Use generics to create reusable components.',
    labels: ['learning'],
    createdAt: '2026-01-01T00:00:00Z',
    url: 'https://github.com/testuser/my-learnings/issues/101',
  },
  {
    id: 2,
    number: 102,
    title: 'Async error handling',
    body: 'Always use try/catch with await.',
    labels: ['learning'],
    createdAt: '2026-01-02T00:00:00Z',
    url: 'https://github.com/testuser/my-learnings/issues/102',
  },
];

function makeHubFileConfig(knowledgeDir = 'knowledge', indexFile = 'INDEX.md'): HubFileConfig {
  return {
    name: 'Test Hub',
    description: 'Integration test hub',
    structure: {
      knowledge_dir: knowledgeDir,
      index_file: indexFile,
    },
    absorb: {
      strategy: 'commit',
      batch_size: 10,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAbsorb — happy path', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    tmpDir = await fs.mkdtemp(join(tmpdir(), 'knowhub-absorb-test-'));
    // Create the knowledge directory so it already exists
    await fs.mkdir(join(tmpDir, 'knowledge'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a created file, closes issues, and returns correct summary', async () => {
    const hubFileConfig = makeHubFileConfig();

    vi.mocked(resolveHub).mockResolvedValue({
      name: 'personal',
      hub: {
        repo: 'testuser/my-learnings',
        provider: 'github',
        local: tmpDir,
        token: 'fake-token',
      },
    });
    vi.mocked(loadHubFileConfig).mockResolvedValue(hubFileConfig);

    const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getProvider).mockReturnValue({
      listIssues: vi.fn().mockResolvedValue(fakeIssues),
      closeIssue: mockCloseIssue,
      createIssue: vi.fn(),
      getRepoInfo: vi.fn(),
      createRepo: vi.fn(),
    });

    vi.mocked(invokeClaudeForAbsorb).mockResolvedValue({
      operations: [
        {
          action: 'create',
          path: 'typescript.md',
          content: '# TypeScript\n\n## Summary\nKey TypeScript patterns.',
        },
      ],
      summary: 'Created typescript.md with TypeScript patterns.',
    });

    const summary = await runAbsorb({});

    // Verify the knowledge file was physically written
    const writtenContent = await fs.readFile(join(tmpDir, 'knowledge', 'typescript.md'), 'utf-8');
    expect(writtenContent).toContain('# TypeScript');
    expect(writtenContent).toContain('Key TypeScript patterns.');

    // Verify both issues were closed
    expect(mockCloseIssue).toHaveBeenCalledTimes(2);
    expect(mockCloseIssue).toHaveBeenCalledWith(101);
    expect(mockCloseIssue).toHaveBeenCalledWith(102);

    // Verify INDEX.md was generated
    const indexContent = await fs.readFile(join(tmpDir, 'INDEX.md'), 'utf-8');
    expect(indexContent).toContain('# Test Hub — Knowledge Index');
    expect(indexContent).toContain('typescript.md');

    // Verify git operations were called
    expect(gitAdd).toHaveBeenCalled();
    expect(gitCommit).toHaveBeenCalledWith(tmpDir, 'knowhub: absorb 2 learnings');

    // Verify summary counts
    expect(summary.issuesProcessed).toBe(2);
    expect(summary.filesCreated).toBe(1);
    expect(summary.filesUpdated).toBe(0);
    expect(summary.filesDeleted).toBe(0);
    expect(summary.summary).toBe('Created typescript.md with TypeScript patterns.');
  });
});

describe('runAbsorb — dry-run', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    tmpDir = await fs.mkdtemp(join(tmpdir(), 'knowhub-absorb-dryrun-'));
    await fs.mkdir(join(tmpDir, 'knowledge'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('does not write files or close issues when dryRun is true', async () => {
    const hubFileConfig = makeHubFileConfig();

    vi.mocked(resolveHub).mockResolvedValue({
      name: 'personal',
      hub: {
        repo: 'testuser/my-learnings',
        provider: 'github',
        local: tmpDir,
        token: 'fake-token',
      },
    });
    vi.mocked(loadHubFileConfig).mockResolvedValue(hubFileConfig);

    const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getProvider).mockReturnValue({
      listIssues: vi.fn().mockResolvedValue(fakeIssues),
      closeIssue: mockCloseIssue,
      createIssue: vi.fn(),
      getRepoInfo: vi.fn(),
      createRepo: vi.fn(),
    });

    vi.mocked(invokeClaudeForAbsorb).mockResolvedValue({
      operations: [
        {
          action: 'create',
          path: 'typescript.md',
          content: '# TypeScript\n\n## Summary\nKey TypeScript patterns.',
        },
      ],
      summary: 'Would create typescript.md with TypeScript patterns.',
    });

    const summary = await runAbsorb({ dryRun: true });

    // File must NOT have been created
    await expect(
      fs.readFile(join(tmpDir, 'knowledge', 'typescript.md'), 'utf-8')
    ).rejects.toThrow();

    // Issues must NOT have been closed
    expect(mockCloseIssue).not.toHaveBeenCalled();

    // Git operations must NOT have been called
    expect(gitCommit).not.toHaveBeenCalled();

    // Summary should still reflect what would happen
    expect(summary.issuesProcessed).toBe(2);
    expect(summary.filesCreated).toBe(1);
    expect(summary.filesUpdated).toBe(0);
    expect(summary.filesDeleted).toBe(0);
    expect(summary.summary).toBe('Would create typescript.md with TypeScript patterns.');
  });
});

describe('runAbsorb — no issues', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns early with "Nothing to absorb" when provider returns no issues', async () => {
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'knowhub-test-'));
    vi.mocked(resolveHub).mockResolvedValue({
      name: 'personal',
      hub: {
        repo: 'testuser/my-learnings',
        provider: 'github',
        local: tempDir,
        token: 'fake-token',
      },
    });
    vi.mocked(loadHubFileConfig).mockResolvedValue(makeHubFileConfig());
    vi.mocked(getProvider).mockReturnValue({
      listIssues: vi.fn().mockResolvedValue([]),
      closeIssue: vi.fn(),
      createIssue: vi.fn(),
      getRepoInfo: vi.fn(),
      createRepo: vi.fn(),
    });

    const summary = await runAbsorb({});
    await fs.rm(tempDir, { recursive: true, force: true });

    expect(summary.issuesProcessed).toBe(0);
    expect(summary.filesCreated).toBe(0);
    expect(summary.filesUpdated).toBe(0);
    expect(summary.filesDeleted).toBe(0);
    expect(summary.summary).toBe('Nothing to absorb.');
    expect(invokeClaudeForAbsorb).not.toHaveBeenCalled();
  });
});

describe('runAbsorb — local path does not exist', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws KnowhubError when hub local path does not exist', async () => {
    vi.mocked(resolveHub).mockResolvedValue({
      name: 'personal',
      hub: {
        repo: 'testuser/my-learnings',
        provider: 'github',
        local: '/nonexistent/path/that/does/not/exist',
        token: 'fake-token',
      },
    });

    await expect(runAbsorb({})).rejects.toThrow(KnowhubError);

    try {
      await runAbsorb({});
    } catch (err) {
      expect(err).toBeInstanceOf(KnowhubError);
      const khErr = err as KnowhubError;
      expect(khErr.message).toContain('/nonexistent/path/that/does/not/exist');
      expect(khErr.hint).toContain('git clone');
    }
  });
});
