import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResolvedHub } from '../../src/config/types.js';
import type { Issue } from '../../src/providers/types.js';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports of the mocked modules
// ---------------------------------------------------------------------------

vi.mock('../../src/config/loader.js', () => ({
  resolveHub: vi.fn(),
}));

vi.mock('../../src/providers/factory.js', () => ({
  getProvider: vi.fn(),
}));

// Import mocked modules after vi.mock declarations
import { resolveHub } from '../../src/config/loader.js';
import { getProvider } from '../../src/providers/factory.js';
import { makeCaptureCommand } from '../../src/cli/capture.js';
import { KnowhubError } from '../../src/utils/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeResolvedHub: ResolvedHub = {
  name: 'personal',
  hub: {
    repo: 'testuser/my-learnings',
    provider: 'github',
    local: '/tmp/test-hub',
    token: 'fake-token',
  },
};

const fakeIssue: Issue = {
  id: 1,
  number: 42,
  title: 'TIL: vitest rocks',
  body: 'TIL: vitest rocks',
  labels: ['learning'],
  createdAt: '2026-03-02T00:00:00Z',
  url: 'https://github.com/testuser/my-learnings/issues/42',
};

async function runCapture(args: string[]): Promise<void> {
  const { Command } = await import('commander');
  const prog = new Command();
  // Suppress commander's default error output and process.exit during tests
  prog.exitOverride();
  prog.addCommand(makeCaptureCommand());
  await prog.parseAsync(['node', 'test', ...args]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
});

describe('capture command — happy path', () => {
  it('calls createIssue with the learning text and default labels', async () => {
    const mockCreateIssue = vi.fn().mockResolvedValue(fakeIssue);
    vi.mocked(resolveHub).mockResolvedValue(fakeResolvedHub);
    vi.mocked(getProvider).mockReturnValue({
      createIssue: mockCreateIssue,
      listIssues: vi.fn(),
      closeIssue: vi.fn(),
      getRepoInfo: vi.fn(),
      createRepo: vi.fn(),
    });

    await runCapture(['capture', 'TIL: vitest rocks']);

    expect(resolveHub).toHaveBeenCalledWith(undefined);
    expect(getProvider).toHaveBeenCalledWith(fakeResolvedHub.hub);
    expect(mockCreateIssue).toHaveBeenCalledWith(
      'TIL: vitest rocks',
      'TIL: vitest rocks',
      ['learning'],
    );
  });

  it('uses --title option when provided', async () => {
    const mockCreateIssue = vi.fn().mockResolvedValue(fakeIssue);
    vi.mocked(resolveHub).mockResolvedValue(fakeResolvedHub);
    vi.mocked(getProvider).mockReturnValue({
      createIssue: mockCreateIssue,
      listIssues: vi.fn(),
      closeIssue: vi.fn(),
      getRepoInfo: vi.fn(),
      createRepo: vi.fn(),
    });

    await runCapture(['capture', '--title', 'Custom Title', 'TIL: vitest rocks']);

    expect(mockCreateIssue).toHaveBeenCalledWith(
      'Custom Title',
      'TIL: vitest rocks',
      ['learning'],
    );
  });

  it('splits --labels into a trimmed array', async () => {
    const mockCreateIssue = vi.fn().mockResolvedValue(fakeIssue);
    vi.mocked(resolveHub).mockResolvedValue(fakeResolvedHub);
    vi.mocked(getProvider).mockReturnValue({
      createIssue: mockCreateIssue,
      listIssues: vi.fn(),
      closeIssue: vi.fn(),
      getRepoInfo: vi.fn(),
      createRepo: vi.fn(),
    });

    await runCapture(['capture', '--labels', 'learning, typescript, vitest', 'TIL: vitest rocks']);

    expect(mockCreateIssue).toHaveBeenCalledWith(
      'TIL: vitest rocks',
      'TIL: vitest rocks',
      ['learning', 'typescript', 'vitest'],
    );
  });

  it('truncates the auto-derived title to 100 characters', async () => {
    const longLine = 'A'.repeat(120);
    const mockCreateIssue = vi.fn().mockResolvedValue({ ...fakeIssue, title: longLine.slice(0, 100) });
    vi.mocked(resolveHub).mockResolvedValue(fakeResolvedHub);
    vi.mocked(getProvider).mockReturnValue({
      createIssue: mockCreateIssue,
      listIssues: vi.fn(),
      closeIssue: vi.fn(),
      getRepoInfo: vi.fn(),
      createRepo: vi.fn(),
    });

    await runCapture(['capture', longLine]);

    expect(mockCreateIssue).toHaveBeenCalledWith(
      'A'.repeat(100),
      longLine,
      ['learning'],
    );
  });

  it('passes the --hub flag through to resolveHub', async () => {
    const mockCreateIssue = vi.fn().mockResolvedValue(fakeIssue);
    vi.mocked(resolveHub).mockResolvedValue(fakeResolvedHub);
    vi.mocked(getProvider).mockReturnValue({
      createIssue: mockCreateIssue,
      listIssues: vi.fn(),
      closeIssue: vi.fn(),
      getRepoInfo: vi.fn(),
      createRepo: vi.fn(),
    });

    await runCapture(['capture', '--hub', 'work', 'TIL: vitest rocks']);

    expect(resolveHub).toHaveBeenCalledWith('work');
  });
});

describe('capture command — error cases', () => {
  it('propagates KnowhubError with "Run `knowhub init`" hint when no hubs configured', async () => {
    vi.mocked(resolveHub).mockRejectedValue(
      new KnowhubError('No hubs configured', 1, 'Run `knowhub init` first'),
    );

    await expect(runCapture(['capture', 'TIL: vitest rocks'])).rejects.toThrow(KnowhubError);

    try {
      await runCapture(['capture', 'TIL: vitest rocks']);
    } catch (err) {
      expect(err).toBeInstanceOf(KnowhubError);
      const khErr = err as KnowhubError;
      expect(khErr.hint).toContain('knowhub init');
    }
  });
});
